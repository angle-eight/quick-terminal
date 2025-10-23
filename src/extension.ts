// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { resolvePlaceholders, createPlaceholderContext } from './placeholderResolver';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	try {
		// Command rule definition - ファイルパターンベースのルール
		interface CommandRule {
			filePattern: string;    // ファイルパターン（glob形式）例: "*.py", "test_*.ts"
			cmd: string;           // 実行するコマンド 例: "{pythonPath} -u {file}"
		}

		// Configuration type - 柔軟な設定形式
		interface CommandConfig {
			cmd?: string;          // 直接コマンドを指定（シンプルなケース）
			rules?: CommandRule[]; // ファイルパターンベースのルール（複雑なケース）
			autoExecute?: boolean; // 自動実行するか（デフォルト: false）
		}

		// Command history management
		interface HistoryEntry {
			original: string;    // プレースホルダー付きの元のコマンド
			expanded: string;    // 展開済みのコマンド
		}
		let commandHistory: HistoryEntry[] = [];
		let historyIndex: number = -1;
		let currentInput: string = '';
		let activeInputBox: vscode.InputBox | undefined;
		let isSearchMode: boolean = false;
		let searchResults: HistoryEntry[] = [];
		let searchIndex: number = 0;
		let currentSearchTerm: string = '';
		let isUpdatingValue: boolean = false;

		// Load command history from persistent storage
		function loadCommandHistory(): void {
			try {
				const savedHistory = context.globalState.get<HistoryEntry[]>('quickTerminalCommand.commandHistory', []);
				commandHistory = savedHistory;
				console.log(`Loaded ${commandHistory.length} commands from history`);
			} catch (error) {
				console.error('Error loading command history:', error);
				commandHistory = [];
			}
		}

		// Save command history to persistent storage
		function saveCommandHistory(): void {
			try {
				context.globalState.update('quickTerminalCommand.commandHistory', commandHistory);
			} catch (error) {
				console.error('Error saving command history:', error);
			}
		}

		// Add command to history with deduplication and persistence
		function addToHistory(original: string, expanded: string): void {
			try {
				// Remove any existing occurrence of the same command from history
				const existingIndex = commandHistory.findIndex(entry => entry.original === original);
				if (existingIndex !== -1) {
					commandHistory.splice(existingIndex, 1);
				}

				// Add the command to the end of history (most recent)
				commandHistory.push({
					original: original,
					expanded: expanded
				});

				// Get configured history size
				const config = vscode.workspace.getConfiguration('quickTerminalCommand');
				const maxHistorySize = config.get<number>('historySize', 100);

				// Keep only last N commands as configured
				while (commandHistory.length > maxHistorySize) {
					commandHistory.shift();
				}

				// Save to persistent storage
				saveCommandHistory();
			} catch (error) {
				console.error('Error adding to history:', error);
			}
		}

		// Load existing history on activation
		loadCommandHistory();

		// Core function to show terminal input box
		async function showTerminalInput(options: {
			prompt?: string;
			placeholder?: string;
			initialValue?: string;
			selectAll?: boolean;
		} = {}): Promise<void> {
			try {
				// Set custom context key
				await vscode.commands.executeCommand('setContext', 'quickTerminalCommand.inputBoxActive', true);

				// Reset history index for new input session
				historyIndex = -1;
				currentInput = '';

				// Create custom InputBox for better control
				const inputBox = vscode.window.createInputBox();
				activeInputBox = inputBox;
				inputBox.prompt = options.prompt || 'Enter terminal command';
				inputBox.placeholder = options.placeholder || 'Type your command here...';

				// Set initial value if provided
				if (options.initialValue) {
					inputBox.value = options.initialValue;
					if (options.selectAll) {
						inputBox.valueSelection = [0, options.initialValue.length];
					} else {
						inputBox.valueSelection = [options.initialValue.length, options.initialValue.length];
					}
				}

				let isAccepted = false;

				// Handle value changes
				inputBox.onDidChangeValue((value) => {
					if (isUpdatingValue) {
						// Ignore programmatic value changes
						return;
					}

					if (isSearchMode) {
						// In search mode, save the user's search term and perform search
						performHistorySearch(value);
					} else if (historyIndex === -1) {
						currentInput = value;
					}
				});

				// Handle accept (Enter key)
				inputBox.onDidAccept(() => {
					isAccepted = true;
					const command = inputBox.value;
					inputBox.hide();

					if (command.trim() !== '') {
						const trimmedCommand = command.trim();

						// Process placeholders in the command before sending to terminal
						const processedCommand = replacePlaceholders(trimmedCommand);

						// Add command to persistent history
						addToHistory(trimmedCommand, processedCommand);

					// Get appropriate terminal (reuse idle terminals or create new one)
					const terminal = getOrCreateTerminal();
					// Send processed text (with placeholders replaced) without moving focus
					// Use shouldExecute: false and manual Enter to better simulate user typing
					terminal.sendText(processedCommand, false);
					// Small delay to let the terminal process the text before executing
					setTimeout(() => {
						terminal.sendText('\r'); // Send Enter key
					}, 10);
					}
				});

				// Handle hide/cancel
				inputBox.onDidHide(() => {
					activeInputBox = undefined;
					isSearchMode = false;
					searchResults = [];
					searchIndex = 0;
					if (!isAccepted) {
						// InputBox was cancelled
					}
					// Reset context key
					vscode.commands.executeCommand('setContext', 'quickTerminalCommand.inputBoxActive', false);
				});

				inputBox.show();

			} catch (error) {
				console.error('Error in showTerminalInputBox:', error);
				vscode.window.showErrorMessage(`Failed to execute terminal command: ${error}`);
				// Ensure context is reset even on error
				await vscode.commands.executeCommand('setContext', 'quickTerminalCommand.inputBoxActive', false);
			}
		}

		// Core function to paste command into active input box
		function pasteCommandToInputBox(config: CommandConfig): void {
			if (!activeInputBox) {
				console.warn('No active InputBox found for pasteCommand');
				return;
			}

			const {text, autoExecute} = processCommandInput(config);

			// Set the value in the InputBox
			activeInputBox.value = text;
			activeInputBox.valueSelection = [text.length, text.length]; // Place cursor at end

			// If autoExecute is true, automatically execute the command
			if (autoExecute) {
				setTimeout(() => {
					if (activeInputBox && activeInputBox.value.trim() !== '') {
						const command = activeInputBox.value.trim();
						activeInputBox.hide(); // Hide the input box first
						executeCommand(command);
					}
				}, 50); // Small delay to ensure the value is set
			}
		}


		// Command to paste text into active InputBox with placeholder replacement
		const pasteCommand = vscode.commands.registerCommand('quick-terminal-command.pasteCommand', (config: CommandConfig) => {
		try {
			pasteCommandToInputBox(config);
		} catch (error) {
			console.error('Error in pasteCommand:', error);
			vscode.window.showErrorMessage(`Failed to paste command: ${error}`);
		}
		});

		// New command: input box → terminal with history support
		const showQuickInput = vscode.commands.registerCommand('quick-terminal-command.showQuickInput', async () => {
			try {
				await showTerminalInput();
			} catch (error) {
				console.error('Error in showQuickInput:', error);
				vscode.window.showErrorMessage(`Failed to show terminal input: ${error}`);
			}
		});

		// New combined command: just combines the two above functions!
		const inputWithPastedCommand = vscode.commands.registerCommand('quick-terminal-command.inputWithPastedCommand', async (config: CommandConfig) => {
			try {
				const {text, autoExecute} = processCommandInput(config);

				if (autoExecute) {
					// If autoExecute is true, execute directly without showing input box
					executeCommand(text);
				} else {
					// Show input box first
					await showTerminalInput({
						prompt: 'Enter terminal command',
						placeholder: 'Edit the command and press Enter to execute...'
					});

					// Then paste the command into the active input box
					if (activeInputBox) {
						pasteCommandToInputBox(config);
					}
				}

			} catch (error) {
				console.error('Error in inputWithPastedCommand command:', error);
				vscode.window.showErrorMessage(`Failed to execute terminal command: ${error}`);
			}
		});		// Command to navigate to previous command in history
		const toPrev = () => {
			if (!activeInputBox || commandHistory.length === 0) return;

			if (historyIndex === -1) {
				// First time accessing history, save current input
				currentInput = activeInputBox.value;
				historyIndex = commandHistory.length - 1;
			} else if (historyIndex > 0) {
				historyIndex--;
			}

			if (historyIndex >= 0 && historyIndex < commandHistory.length) {
				// Set the value to the expanded command and select all text
				const expandedCommand = commandHistory[historyIndex].expanded;
				activeInputBox.value = expandedCommand;
				activeInputBox.valueSelection = [expandedCommand.length, expandedCommand.length];
			}
		}
		const historyPrevious = vscode.commands.registerCommand('quick-terminal-command.historyPrevious', () => {
		try {
			// If in search mode, use search navigation instead of history navigation
			if (isSearchMode) {
				nextSearchResult();
				return;
			}

			// For normal up arrow in non-search mode, exit search mode if it was active
			if (isSearchMode) {
				isSearchMode = false;
				searchResults = [];
				searchIndex = 0;
				if (activeInputBox) {
					activeInputBox.prompt = 'Enter terminal command';
				}
			}

			toPrev();
		} catch (error) {
			console.error('Error in historyPrevious:', error);
		}
		});

		// Command to navigate to next command in history
		const historyNext = vscode.commands.registerCommand('quick-terminal-command.historyNext', () => {
		try {
			if (!activeInputBox || commandHistory.length === 0) return;

			// Exit search mode if active
			if (isSearchMode) {
				isSearchMode = false;
				searchResults = [];
				searchIndex = 0;
				activeInputBox.prompt = 'Enter terminal command';
				// Don't return, continue with normal history navigation
			}

			if (historyIndex === -1) return;

			if (historyIndex < commandHistory.length - 1) {
				historyIndex++;
				const nextCommand = commandHistory[historyIndex].expanded;
				activeInputBox.value = nextCommand;
				activeInputBox.valueSelection = [nextCommand.length, nextCommand.length];
			} else {
				// Go back to empty/current input
				historyIndex = -1;
				activeInputBox.value = currentInput;
				activeInputBox.valueSelection = [0, currentInput.length];
			}
		} catch (error) {
			console.error('Error in historyNext:', error);
		}
		});
		const restorePlaceholder = vscode.commands.registerCommand('quick-terminal-command.restorePlaceholder', () => {
		try {
			if (!activeInputBox) return;

			if (isSearchMode && searchResults.length > 0) {
				// In search mode, restore the original command with placeholders
				const currentResult = searchResults[searchIndex];
				if (currentResult) {
					activeInputBox.value = currentResult.original;
					activeInputBox.valueSelection = [currentResult.original.length, currentResult.original.length];
				}
			} else if (commandHistory.length > 0 && historyIndex !== -1) {
				// Normal history mode
				if (historyIndex >= 0 && historyIndex < commandHistory.length) {
					const originalCommand = commandHistory[historyIndex].original;
					activeInputBox.value = originalCommand;
					activeInputBox.valueSelection = [originalCommand.length, originalCommand.length];
				}
			}
		} catch (error) {
			console.error('Error in restorePlaceholder:', error);
		}
		});
		// Helper function to parse command input and execute or paste
		const showLastCommand = vscode.commands.registerCommand('quick-terminal-command.showLastCommand', async() => {
			try {
				await showTerminalInput();
				toPrev();
			} catch (error) {
				console.error('Error in showLastCommand:', error);
			}
		});

		// Command to search through command history
		const searchHistory = vscode.commands.registerCommand('quick-terminal-command.searchHistory', async () => {
			try {
				// If already in search mode, go to next result instead of starting new search
				if (isSearchMode && activeInputBox) {
					nextSearchResult();
					return;
				}

				if (!activeInputBox || commandHistory.length === 0) {
					await showTerminalInput({
						prompt: 'Search command history (type to search, Ctrl+R for next match)',
						placeholder: 'Type to search command history...'
					});
					if (!activeInputBox) return;
				}

				// Enter search mode
				isSearchMode = true;
				searchIndex = 0;
				searchResults = [];
				currentSearchTerm = '';

				// Update the prompt to indicate search mode
				activeInputBox.prompt = 'Search command history (type to search, Ctrl+R for next match, Esc to exit search)';

				// Clear the input box and start with empty search
				isUpdatingValue = true;
				activeInputBox.value = '';
				isUpdatingValue = false;

				// Start with empty search to show all commands
				performHistorySearch('');

			} catch (error) {
				console.error('Error in searchHistory:', error);
				vscode.window.showErrorMessage(`Failed to search history: ${error}`);
			}
		});		// Command to exit search mode
		const exitSearch = vscode.commands.registerCommand('quick-terminal-command.exitSearch', () => {
			try {
				if (!activeInputBox) return;

				if (isSearchMode) {
					// Exit search mode
					isSearchMode = false;
					searchResults = [];
					searchIndex = 0;

					// Restore normal prompt
					activeInputBox.prompt = 'Enter terminal command';

					// Keep the current command but allow normal editing
					// Don't clear the value - user might want to edit the selected command
				} else {
					// If not in search mode, ESC should close the input box
					activeInputBox.hide();
				}

			} catch (error) {
				console.error('Error in exitSearch:', error);
			}
		});

		// Command to clear input box content
		const clearInput = vscode.commands.registerCommand('quick-terminal-command.clearInput', () => {
			try {
				if (!activeInputBox) return;

				// Clear the input box content
				activeInputBox.value = '';

				// Reset history navigation state
				historyIndex = -1;
				currentInput = '';

				// If in search mode, exit search mode and return to normal input
				if (isSearchMode) {
					isSearchMode = false;
					searchResults = [];
					searchIndex = 0;
					activeInputBox.prompt = 'Enter terminal command';
				}

			} catch (error) {
				console.error('Error in clearInput:', error);
			}
		});
		function processCommandInput(config: CommandConfig): {text: string, autoExecute: boolean} {
			let selectedCommand: string;

			// 設定の検証
			if (!config.cmd && !config.rules) {
				throw new Error('cmdまたはrulesのどちらかを指定してください');
			}

			// コマンドの選択ロジック
			if (config.cmd) {
				// 直接コマンド指定の場合（シンプルなケース）
				selectedCommand = config.cmd;
			} else if (config.rules && config.rules.length > 0) {
				// ファイルパターンベースのルール適用
				selectedCommand = selectCommandByFilePattern(config.rules);
			} else {
				throw new Error('有効なコマンド設定が見つかりません');
			}

			// autoExecuteは設定から取得（デフォルト: false）
			const autoExecute = config.autoExecute ?? false;

			// プレースホルダーはここでは置換しない（実行時に置換することでユーザーが編集可能）
			return { text: selectedCommand, autoExecute };
		}

		// Helper function to get or create a terminal with smart busy detection
		function getOrCreateTerminal(preferNew: boolean = false): vscode.Terminal {
			const config = vscode.workspace.getConfiguration('quickTerminalCommand');
			const createNewWhenBusy = config.get<boolean>('createNewTerminalWhenBusy', true);

			// Get custom shell configuration to determine what shell names to look for
			const customShell = config.get<string>('shell', '');
			const customShellArgs = config.get<string[]>('shellArgs', []);

			// Always try to find an available terminal first (unless preferNew is explicitly true)
			if (!preferNew) {
				// Look for a terminal that might be available (has shell name that looks idle)
				const availableTerminal = vscode.window.terminals.find(terminal => {
					// Terminal has exited, don't use it
					if (terminal.exitStatus) {
						return false;
					}

					const name = terminal.name.toLowerCase();

					// Look for default shell names
					const defaultShells = ['bash', 'zsh', 'fish', 'cmd', 'powershell', 'pwsh'];
					const isDefaultShell = defaultShells.includes(name);

					// Also check if the terminal name matches the user's custom shell
					let isCustomShell = false;
					if (customShell && customShell.trim() !== '') {
						const customShellName = path.basename(customShell).toLowerCase();
						isCustomShell = name === customShellName;
					}

					return isDefaultShell || isCustomShell;
				});

				if (availableTerminal) {
					availableTerminal.show(true);
					return availableTerminal;
				}
			}

			// Create a new terminal
			// Don't set a name so VS Code can automatically change it to the process name

			let terminalOptions: vscode.TerminalOptions = {};

			if (customShell && customShell.trim() !== '') {
				terminalOptions.shellPath = customShell;
				if (customShellArgs.length > 0) {
					terminalOptions.shellArgs = customShellArgs;
				}
			}

			const terminal = vscode.window.createTerminal(terminalOptions);
			terminal.show(true);
			return terminal;
		}

		// Helper function to execute command directly
		function executeCommand(command: string): void {
			if (command.trim() === '') return;

			const trimmedCommand = command.trim();

			// Process placeholders for direct execution
			const processedCommand = replacePlaceholders(trimmedCommand);

			// Add command to persistent history
			addToHistory(trimmedCommand, processedCommand);

			// Get appropriate terminal (reuse idle terminals or create new one)
			const terminal = getOrCreateTerminal();

			// Send processed command to terminal
			// Use shouldExecute: false and manual Enter to better simulate user typing
			terminal.sendText(processedCommand, false);
			// Small delay to let the terminal process the text before executing
			setTimeout(() => {
				terminal.sendText('\r'); // Send Enter key
			}, 10);
		}


		function selectCommandByFilePattern(rules: CommandRule[]): string {
		try {
			const activeEditor = vscode.window.activeTextEditor;

			if (!activeEditor || activeEditor.document.uri.scheme !== 'file') {
				// アクティブなファイルがない場合、最初のルールのコマンドをフォールバックとして返す
				return rules.length > 0 ? rules[0].cmd : '';
			}

			const fileName = path.basename(activeEditor.document.fileName);

			// 各ルールをチェックしてマッチするものを探す
			for (const rule of rules) {
				if (matchesPattern(fileName, rule.filePattern)) {
					return rule.cmd;
				}
			}

			// パターンにマッチしない場合、最初のルールのコマンドをフォールバックとして返す
			return rules.length > 0 ? rules[0].cmd : '';
		} catch (error) {
			console.error('Error in selectCommandByFilePattern:', error);
			return rules.length > 0 ? rules[0].cmd : '';
		}
		}

		// Helper function to match file name against glob pattern
		function matchesPattern(fileName: string, pattern: string): boolean {
		try {
			// Convert glob pattern to regex
			// Escape regex special characters except * and ?
			let regexPattern = pattern
				.replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
				.replace(/\*/g, '.*')  // Replace * with .*
				.replace(/\?/g, '.');  // Replace ? with .

			// Anchor the pattern to match the whole filename
			regexPattern = '^' + regexPattern + '$';

			const regex = new RegExp(regexPattern, 'i'); // Case insensitive
			return regex.test(fileName);
		} catch (error) {
			console.error('Error in matchesPattern:', error);
			return false;
		}
		}

		// Helper function to replace placeholders
		function replacePlaceholders(text: string): string {
			try {
				const context = createPlaceholderContext();
				const result = resolvePlaceholders(text, context);

				// Show warnings if any
				if (result.warnings.length > 0) {
					result.warnings.forEach(warning => {
						vscode.window.showWarningMessage(warning, 'OK');
					});
				}

				return result.resolvedText;
			} catch (error) {
				console.error('Error in replacePlaceholders:', error);
				return text; // Return original text if processing fails
			}
		}

		// Helper function to perform history search
		function performHistorySearch(searchTerm: string): void {
			if (!activeInputBox || !isSearchMode) return;

			currentSearchTerm = searchTerm;

			if (searchTerm === '') {
				// Empty search, prepare all commands but don't display anything yet
				searchResults = [...commandHistory].reverse(); // Show most recent first
				searchIndex = 0;

				// Don't auto-display the first result for empty search
				// Let user start typing to see results
				if (activeInputBox) {
					activeInputBox.prompt = 'Search command history (type to search, Ctrl+R for next match, Esc to exit search)';
				}
				return;
			} else {
				// Filter commands that contain the search term
				searchResults = commandHistory
					.filter(entry =>
						entry.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
						entry.expanded.toLowerCase().includes(searchTerm.toLowerCase())
					)
					.reverse(); // Show most recent matches first
				searchIndex = 0;
			}

			// Update the display only with prompt - don't change input value
			updateSearchPrompt();
		}		// Helper function to update search display
		function updateSearchDisplay(): void {
			if (!activeInputBox || !isSearchMode) return;

			if (searchResults.length === 0) {
				activeInputBox.prompt = 'Search command history (no matches found) - type to search, Esc to exit';
				return;
			}

			const currentResult = searchResults[searchIndex];
			if (currentResult) {
				// Show the expanded command (with resolved placeholders) in input box
				isUpdatingValue = true;
				activeInputBox.value = currentResult.expanded;
				activeInputBox.valueSelection = [currentResult.expanded.length, currentResult.expanded.length];
				isUpdatingValue = false;

				// Update prompt to show current position
				const position = searchIndex + 1;
				const total = searchResults.length;
				activeInputBox.prompt = `Search command history (${position}/${total}) - Ctrl+R for next, Tab to use, Esc to exit`;
			}
		}

		// Helper function to update search prompt only (for incremental search)
		function updateSearchPrompt(): void {
			if (!activeInputBox || !isSearchMode) return;

			if (searchResults.length === 0) {
				activeInputBox.prompt = 'Search command history (no matches found) - type to search, Esc to exit';
				return;
			}

			const currentResult = searchResults[searchIndex];
			if (currentResult) {
				// Update prompt to show current position and preview
				const position = searchIndex + 1;
				const total = searchResults.length;
				const preview = currentResult.expanded.length > 50
					? currentResult.expanded.substring(0, 50) + '...'
					: currentResult.expanded;
				activeInputBox.prompt = `Search: "${currentSearchTerm}" (${position}/${total}) Preview: ${preview} - Ctrl+R for next, Tab to use, Esc to exit`;
			}
		}

		// Helper function to go to next search result
		function nextSearchResult(): void {
			if (!isSearchMode) return;

			// If no search results yet (empty search), show all commands
			if (searchResults.length === 0 && commandHistory.length > 0) {
				searchResults = [...commandHistory].reverse();
				searchIndex = 0;
				updateSearchDisplay();
				return;
			}

			if (searchResults.length === 0) return;

			searchIndex = (searchIndex + 1) % searchResults.length;
			updateSearchDisplay();
		};
		context.subscriptions.push(showQuickInput);
		context.subscriptions.push(pasteCommand);
		context.subscriptions.push(historyPrevious);
		context.subscriptions.push(restorePlaceholder);
		context.subscriptions.push(historyNext);
		context.subscriptions.push(showLastCommand);
		context.subscriptions.push(inputWithPastedCommand);
		context.subscriptions.push(searchHistory);
		context.subscriptions.push(exitSearch);
		context.subscriptions.push(clearInput);
	} catch (error) {
		console.error('Error during extension activation:', error);
		vscode.window.showErrorMessage(`Quick Terminal extension failed to activate: ${error}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Quick Terminal extension is being deactivated');
}
