// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	try {
		// Command history management
		let commandHistory: string[] = [];
		let historyIndex: number = -1;
		let currentInput: string = '';
		let activeInputBox: vscode.InputBox | undefined;

		// Use the console to output diagnostic information (console.log) and errors (console.error)
		// This line of code will only be executed once when your extension is activated
		console.log('Congratulations, your extension "quick-terminal" is now active!');

		// The command has been defined in the package.json file
		// Now provide the implementation of the command with registerCommand
		// The commandId parameter must match the command field in package.json
		const disposable = vscode.commands.registerCommand('quick-terminal.helloWorld', () => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage('Hello World from quick-terminal!');
		});

		// Helper function to create and show input box with terminal integration
		async function showTerminalInputBox(options: {
			prompt?: string;
			placeholder?: string;
			initialValue?: string;
			selectAll?: boolean;
		} = {}): Promise<void> {
			try {
				// Set custom context key
				await vscode.commands.executeCommand('setContext', 'quickTerminal.inputBoxActive', true);

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
					if (historyIndex === -1) {
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

						// Debug logging
						console.log('Original command:', trimmedCommand);
						console.log('Processed command:', processedCommand);

						// Remove any existing occurrence of the same command from history
						const existingIndex = commandHistory.indexOf(trimmedCommand);
						if (existingIndex !== -1) {
							commandHistory.splice(existingIndex, 1);
						}

						// Add the command to the end of history (most recent)
						commandHistory.push(trimmedCommand);

						// Keep only last 50 commands
						if (commandHistory.length > 50) {
							commandHistory.shift();
						}

						// Get appropriate terminal (may create new one if current seems busy)
						const terminal = getOrCreateTerminal();
						// Send processed text (with placeholders replaced) without moving focus
						terminal.sendText(processedCommand, true);
					}
				});

				// Handle hide/cancel
				inputBox.onDidHide(() => {
					activeInputBox = undefined;
					if (!isAccepted) {
						// InputBox was cancelled
					}
					// Reset context key
					vscode.commands.executeCommand('setContext', 'quickTerminal.inputBoxActive', false);
				});

				inputBox.show();

			} catch (error) {
				console.error('Error in showTerminalInputBox:', error);
				vscode.window.showErrorMessage(`Failed to execute terminal command: ${error}`);
				// Ensure context is reset even on error
				await vscode.commands.executeCommand('setContext', 'quickTerminal.inputBoxActive', false);
			}
		}

		// Core function to paste command into active input box
		function pasteCommandToInputBox(input: string | Array<{pattern: string, command: string}> | {command: string | Array<{pattern: string, command: string}>, autoExecute: boolean}): void {
			if (!activeInputBox) {
				console.warn('No active InputBox found for pasteCommand');
				return;
			}

			const {text, autoExecute} = processCommandInput(input);

			// Debug logging
			console.log('Processed text:', text);
			console.log('Auto execute:', autoExecute);

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

		// Core function to show terminal input box
		async function showTerminalInput(options: {
			prompt?: string;
			placeholder?: string;
			initialValue?: string;
			selectAll?: boolean;
		} = {}): Promise<void> {
			await showTerminalInputBox(options);
		}

		// Command to paste text into active InputBox with placeholder replacement
		const pasteCommand = vscode.commands.registerCommand('quick-terminal.pasteCommand', (input: string | Array<{pattern: string, command: string}> | {command: string | Array<{pattern: string, command: string}>, autoExecute: boolean}) => {
		try {
			pasteCommandToInputBox(input);
		} catch (error) {
			console.error('Error in pasteCommand:', error);
			vscode.window.showErrorMessage(`Failed to paste command: ${error}`);
		}
		});

		// New command: input box → terminal with history support
		const inputToTerminal = vscode.commands.registerCommand('quick-terminal.inputToTerminal', async () => {
			try {
				await showTerminalInput();
			} catch (error) {
				console.error('Error in inputToTerminal:', error);
				vscode.window.showErrorMessage(`Failed to show terminal input: ${error}`);
			}
		});

		// New combined command: just combines the two above functions!
		const inputWithPastedCommand = vscode.commands.registerCommand('quick-terminal.inputWithPastedCommand', async (input: string | Array<{pattern: string, command: string}> | {command: string | Array<{pattern: string, command: string}>, autoExecute: boolean}) => {
			try {
				const {text, autoExecute} = processCommandInput(input);

				if (autoExecute) {
					// If autoExecute is true, execute directly without showing input box
					executeCommand(text);
				} else {
					// Show input box with pre-filled command - this is just inputToTerminal with initial value!
					await showTerminalInput({
						prompt: 'Enter terminal command (pre-filled with template)',
						placeholder: 'Edit the command and press Enter to execute...',
						initialValue: text,
						selectAll: true
					});
				}

			} catch (error) {
				console.error('Error in inputWithPastedCommand command:', error);
				vscode.window.showErrorMessage(`Failed to execute terminal command: ${error}`);
			}
		});		// Command to navigate to previous command in history
		const historyPrevious = vscode.commands.registerCommand('quick-terminal.historyPrevious', () => {
		try {
			if (!activeInputBox || commandHistory.length === 0) return;

			if (historyIndex === -1) {
				// First time accessing history, save current input
				currentInput = activeInputBox.value;
				historyIndex = commandHistory.length - 1;
			} else if (historyIndex > 0) {
				historyIndex--;
			}

			if (historyIndex >= 0 && historyIndex < commandHistory.length) {
				// Set the value and select all text
				activeInputBox.value = commandHistory[historyIndex];
				activeInputBox.valueSelection = [0, commandHistory[historyIndex].length];
			}
		} catch (error) {
			console.error('Error in historyPrevious:', error);
		}
		});

		// Command to navigate to next command in history
		const historyNext = vscode.commands.registerCommand('quick-terminal.historyNext', () => {
		try {
			if (!activeInputBox || commandHistory.length === 0 || historyIndex === -1) return;

			if (historyIndex < commandHistory.length - 1) {
				historyIndex++;
				const nextCommand = commandHistory[historyIndex];
				activeInputBox.value = nextCommand;
				activeInputBox.valueSelection = [0, nextCommand.length];
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

		// Helper function to parse command input and execute or paste
		function processCommandInput(input: string | Array<{pattern: string, command: string}> | {command: string | Array<{pattern: string, command: string}>, autoExecute: boolean}): {text: string, autoExecute: boolean} {
			let textToProcess: string;
			let autoExecute = false;

			// Handle different input types
			if (typeof input === 'string') {
				// Simple string input (backward compatibility)
				textToProcess = input;
			} else if (Array.isArray(input)) {
				// Array of pattern-command pairs (backward compatibility)
				textToProcess = selectCommandByPattern(input);
			} else if (typeof input === 'object' && input !== null && 'command' in input && 'autoExecute' in input) {
				// New format with autoExecute option
				autoExecute = input.autoExecute;
				if (typeof input.command === 'string') {
					textToProcess = input.command;
				} else if (Array.isArray(input.command)) {
					textToProcess = selectCommandByPattern(input.command);
				} else {
					throw new Error(`Invalid command type: ${typeof input.command}`);
				}
			} else {
				throw new Error(`Invalid input type: ${typeof input}`);
			}

			// Don't replace placeholders here! Let them be replaced at execution time
			// This allows users to see and edit placeholders when pasting commands
			return { text: textToProcess, autoExecute };
		}

		// Helper function to get or create a suitable terminal
		function getOrCreateTerminal(): vscode.Terminal {
			const activeTerminal = vscode.window.activeTerminal;

			// If no active terminal, create new one
			if (!activeTerminal) {
				return vscode.window.createTerminal('Quick Terminal');
			}

			// Check if active terminal might be busy (heuristic approach)
			const terminalName = activeTerminal.name;

			// List of terminal names that are likely running long processes
			const busyTerminalPatterns = [
				/dev/i,        // npm run dev, yarn dev, etc.
				/serve/i,      // serve, http-server, etc.
				/watch/i,      // npm run watch, etc.
				/build/i,      // continuous build processes
				/server/i,     // development servers
				/start/i,      // npm start, yarn start
				/uvicorn/i,    // uvicorn (FastAPI development server)
				/docker/i,     // docker compose up, docker run, etc.
				/compose/i,    // docker compose up
				/fastapi/i,    // FastAPI development server
				/django/i,     // django runserver
				/flask/i,      // flask run, flask dev
				/rails/i,      // rails server
				/jupyter/i,    // jupyter lab, jupyter notebook
				/streamlit/i,  // streamlit run
				/gradio/i,     // gradio apps
				/celery/i,     // celery worker
				/redis/i,      // redis-server
				/postgres/i,   // postgres server
				/mysql/i,      // mysql server
				/mongodb/i,    // mongodb server
				/nginx/i,      // nginx
			];

			// Check if terminal name suggests it's running a long process
			const mightBeBusy = busyTerminalPatterns.some(pattern => pattern.test(terminalName));

			if (mightBeBusy) {
				console.log(`Terminal "${terminalName}" might be busy, creating new terminal`);
				return vscode.window.createTerminal('Quick Terminal');
			}

			// For terminals with generic names, we can't be sure, so we'll reuse them
			// Users can manually create new terminals if needed
			return activeTerminal;
		}

		// Helper function to execute command directly
		function executeCommand(command: string): void {
			if (command.trim() === '') return;

			const trimmedCommand = command.trim();

			// Process placeholders for direct execution
			const processedCommand = replacePlaceholders(trimmedCommand);

			console.log('Executing command:', trimmedCommand);
			console.log('Processed command:', processedCommand);

			// Add original command (with placeholders) to history
			const existingIndex = commandHistory.indexOf(trimmedCommand);
			if (existingIndex !== -1) {
				commandHistory.splice(existingIndex, 1);
			}
			commandHistory.push(trimmedCommand);
			if (commandHistory.length > 50) {
				commandHistory.shift();
			}

			// Get appropriate terminal (may create new one if current seems busy)
			const terminal = getOrCreateTerminal();

			// Send processed command to terminal
			terminal.sendText(processedCommand, true);
		}
		function selectCommandByPattern(patterns: Array<{pattern: string, command: string}>): string {
		try {
			const activeEditor = vscode.window.activeTextEditor;

			if (!activeEditor || activeEditor.document.uri.scheme !== 'file') {
				// No active file, return first command as fallback
				return patterns.length > 0 ? patterns[0].command : '';
			}

			const fileName = path.basename(activeEditor.document.fileName);

			// Check each pattern to find a match
			for (const item of patterns) {
				if (matchesPattern(fileName, item.pattern)) {
					console.log(`Matched pattern "${item.pattern}" for file "${fileName}"`);
					return item.command;
				}
			}

			// No pattern matched, return first command as fallback
			console.log(`No pattern matched for file "${fileName}", using fallback`);
			return patterns.length > 0 ? patterns[0].command : '';
		} catch (error) {
			console.error('Error in selectCommandByPattern:', error);
			return patterns.length > 0 ? patterns[0].command : '';
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

		// Helper function to escape shell arguments
		function escapeShellArg(arg: string): string {
			// For simple cases without special characters, don't add quotes
			if (/^[a-zA-Z0-9._/-]+$/.test(arg)) {
				return arg;
			}
			// For arguments with spaces or special characters, use double quotes
			// and escape existing quotes and backslashes
			return '"' + arg.replace(/[\\$"`]/g, '\\$&') + '"';
		}

		// Helper function to replace placeholders
		function replacePlaceholders(text: string): string {
		try {
			let result = text;

			// Get current active editor
			const activeEditor = vscode.window.activeTextEditor;

			if (activeEditor && activeEditor.document.uri.scheme === 'file') {
				const fileName = path.basename(activeEditor.document.fileName);
				const fileStem = path.basename(activeEditor.document.fileName, path.extname(activeEditor.document.fileName));
				const filePath = activeEditor.document.fileName;
				const fileExt = path.extname(activeEditor.document.fileName);
				const dirName = path.dirname(activeEditor.document.fileName);

				// Smart replacement: handle path concatenation properly
				// Replace {dirname}/something with "full/path/something" (quoted as a whole)
				result = result.replace(/\{dirname\}\/([^\s]+)/g, (match, suffix) => {
					return escapeShellArg(path.join(dirName, suffix));
				});

				// Replace {workspace}/something with "full/workspace/path/something" (quoted as a whole)
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
					result = result.replace(/\{workspace\}\/([^\s]+)/g, (match, suffix) => {
						return escapeShellArg(path.join(workspacePath, suffix));
					});
				}

				// Handle remaining standalone placeholders (quoted for safety)
				result = result.replace(/\{filename\}/g, escapeShellArg(fileName));
				result = result.replace(/\{filestem\}/g, escapeShellArg(fileStem));
				result = result.replace(/\{filepath\}/g, escapeShellArg(filePath));
				result = result.replace(/\{dirname\}/g, escapeShellArg(dirName));

				// {fileext} - File extension (usually safe without quotes)
				result = result.replace(/\{fileext\}/g, fileExt);

				// {relativepath} - File path relative to workspace
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const relativePath = vscode.workspace.asRelativePath(activeEditor.document.fileName);
					result = result.replace(/\{relativepath\}/g, escapeShellArg(relativePath));
				}

				// Check setting for auto cd functionality
				const config = vscode.workspace.getConfiguration('quickTerminal');
				const autoChangeDirectory = config.get<boolean>('autoChangeDirectory', true);

				if (autoChangeDirectory) {
					// Automatically cd to the file's directory for execution context
					// This ensures commands run in the correct location
					result = `cd ${escapeShellArg(dirName)} && ${result}`;
				}
			}

			// Workspace placeholders
			if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
				const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
				const workspaceName = vscode.workspace.workspaceFolders[0].name;

				// Handle remaining standalone workspace placeholders
				result = result.replace(/\{workspace\}/g, escapeShellArg(workspacePath));
				result = result.replace(/\{workspacename\}/g, escapeShellArg(workspaceName));
			}

			return result;
		} catch (error) {
			console.error('Error in replacePlaceholders:', error);
			return text; // Return original text if processing fails
		}
		}

		context.subscriptions.push(disposable);
		context.subscriptions.push(inputToTerminal);
		context.subscriptions.push(pasteCommand);
		context.subscriptions.push(historyPrevious);
		context.subscriptions.push(historyNext);
		context.subscriptions.push(inputWithPastedCommand);
	} catch (error) {
		console.error('Error during extension activation:', error);
		vscode.window.showErrorMessage(`Quick Terminal extension failed to activate: ${error}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Quick Terminal extension is being deactivated');
}
