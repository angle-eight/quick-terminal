import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { applyAutoCdCommand, FileInfo } from './autoChangeDirectory';

/**
 * Placeholder resolution context containing all the information needed to resolve placeholders
 */
export interface PlaceholderContext {
	// Active editor information
	activeEditor?: vscode.TextEditor;

	// Workspace information
	workspaceFolders?: readonly vscode.WorkspaceFolder[];

	// System information
	userHome: string;
	pathSeparator: string;
	cwd: string;

	// Environment and configuration getters
	getEnvVar: (name: string) => string | undefined;
	getConfig: (name: string) => any;

	// Auto change directory setting
	autoChangeDirectory?: 'file' | 'workspace' | 'none' | 'auto (experimental)';
}

/**
 * Result of placeholder resolution
 */
export interface PlaceholderResult {
	resolvedText: string;
	warnings: string[];
}



/**
 * Helper function to escape shell arguments
 */
function escapeShellArg(arg: string): string {
	// For simple cases without special characters, don't add quotes
	if (/^[a-zA-Z0-9._/-]+$/.test(arg)) {
		return arg;
	}
	// For arguments with spaces or special characters, use double quotes
	// and escape existing quotes and backslashes
	return '"' + arg.replace(/[\\$"`]/g, '\\$&') + '"';
}

/**
 * Check if a path looks like a valid Python interpreter path
 */
function isValidPythonPath(pythonPath: string): boolean {
	// Reject generic command names
	if (pythonPath === 'python' || pythonPath === 'python3' || pythonPath === 'python2') {
		return false;
	}

	// Accept paths that look like actual file paths
	if (pythonPath.includes('/') || pythonPath.includes('\\')) {
		return true;
	}

	// Accept paths that end with python-like executable names
	if (/python[\d\.]*(?:\.exe)?$/i.test(pythonPath)) {
		return true;
	}

	return false;
}

/**
 * Get the active Python interpreter path using multiple methods
 */
async function getPythonInterpreterPathAsync(context: PlaceholderContext): Promise<string | undefined> {
	try {
		// Method 1: Try Python extension API
		const pythonExtension = vscode.extensions.getExtension('ms-python.python');
		if (pythonExtension && pythonExtension.isActive) {
			try {
				const pythonApi = pythonExtension.exports;

				// Modern Python extension API
				if (pythonApi?.environments) {
					const workspaceFolder = context.workspaceFolders?.[0];

					// Try to get the active environment
					if (pythonApi.environments.getActiveEnvironmentPath) {
						const activeEnvPath = await pythonApi.environments.getActiveEnvironmentPath(workspaceFolder?.uri);
						if (activeEnvPath && activeEnvPath.path) {
							return activeEnvPath.path;
						}
					}

					// Alternative: resolve interpreter for workspace
					if (pythonApi.environments.resolveEnvironment) {
						const resolved = await pythonApi.environments.resolveEnvironment(workspaceFolder?.uri);
						if (resolved && resolved.path) {
							return resolved.path;
						}
					}
				}

				// Legacy API fallback
				if (pythonApi?.settings) {
					const workspaceUri = context.workspaceFolders?.[0]?.uri;

					if (pythonApi.settings.getExecutionDetails) {
						const execDetails = pythonApi.settings.getExecutionDetails(workspaceUri);
						if (execDetails?.execCommand?.[0]) {
							return execDetails.execCommand[0];
						}
					}

					if (pythonApi.settings.getSettings) {
						const settings = pythonApi.settings.getSettings(workspaceUri);
						if (settings?.pythonPath) {
							return settings.pythonPath;
						}
					}
				}
			} catch (apiError) {
				// Python extension API not available or error
			}
		}

		// Method 2: Try workspace configuration
		const interpreterPath = context.getConfig('python.defaultInterpreterPath') ||
		                       context.getConfig('python.pythonPath');
		if (interpreterPath) {
			return String(interpreterPath);
		}

		// Method 3: Command execution fallback
		// Execute python.setInterpreter command to trigger selection and then get the result
		// This is not ideal in a synchronous context, so we'll skip it for now

		return undefined;

	} catch (error) {
		return undefined;
	}
}

/**
 * Synchronous wrapper for Python interpreter path
 */
function getPythonInterpreterPath(context: PlaceholderContext): string | undefined {
	try {
		// Method 1: Use the provided context.getConfig function (for testability)
		const defaultInterpreterPath = context.getConfig('python.defaultInterpreterPath');
		const pythonPath = context.getConfig('python.pythonPath');

		if (defaultInterpreterPath && isValidPythonPath(defaultInterpreterPath)) {
			return String(defaultInterpreterPath);
		}

		if (pythonPath && isValidPythonPath(pythonPath)) {
			return String(pythonPath);
		}

		// Method 2: Try direct VS Code API access
		const directPythonConfig = vscode.workspace.getConfiguration('python');
		const directDefaultPath = directPythonConfig.get<string>('defaultInterpreterPath');
		const directPythonPath = directPythonConfig.get<string>('pythonPath');

		if (directDefaultPath && isValidPythonPath(directDefaultPath)) {
			return String(directDefaultPath);
		}

		if (directPythonPath && isValidPythonPath(directPythonPath)) {
			return String(directPythonPath);
		}

		// Method 3: Try workspace-specific Python settings
		const workspacePython = vscode.workspace.getConfiguration('python', context.workspaceFolders?.[0]?.uri);
		const workspaceInterpreter = workspacePython.get<string>('defaultInterpreterPath') ||
		                           workspacePython.get<string>('pythonPath');

		if (workspaceInterpreter && isValidPythonPath(workspaceInterpreter)) {
			return String(workspaceInterpreter);
		}

		// Method 4: Try global Python settings
		const globalPython = vscode.workspace.getConfiguration('python');
		const globalInterpreter = globalPython.get<string>('defaultInterpreterPath') ||
		                         globalPython.get<string>('pythonPath');

		if (globalInterpreter && isValidPythonPath(globalInterpreter)) {
			return String(globalInterpreter);
		}

		// Method 5: Try Python extension API for active interpreter
		const pythonExtension = vscode.extensions.getExtension('ms-python.python');

		if (pythonExtension && pythonExtension.isActive) {
			const pythonApi = pythonExtension.exports;

			// Try the modern Python extension API for getting the active interpreter
			if (pythonApi?.environments) {
				try {
					const workspaceUri = context.workspaceFolders?.[0]?.uri;

					// Try to get the active environment using the new API
					if (pythonApi.environments.getActiveEnvironmentPath) {
						const activeEnvPath = pythonApi.environments.getActiveEnvironmentPath(workspaceUri);

						if (activeEnvPath) {
							if (typeof activeEnvPath === 'string') {
								return activeEnvPath;
							} else if (typeof activeEnvPath === 'object' && activeEnvPath.path) {
								return String(activeEnvPath.path);
							}
						}
					}

					// Alternative: Try to resolve environment for workspace
					if (pythonApi.environments.resolveEnvironment) {
						const resolved = pythonApi.environments.resolveEnvironment(workspaceUri);

						if (resolved && typeof resolved === 'object' && resolved.path) {
							return String(resolved.path);
						}
					}
				} catch (envError) {
					// Python extension API access failed
				}
			}

			// Try modern API methods
			if (pythonApi?.environments) {
				// Note: These are typically async, but we'll try sync access to cached data
				try {
					// Try to get workspace-specific environment info
					const workspaceUri = context.workspaceFolders?.[0]?.uri;
					if (workspaceUri && pythonApi.environments.getActiveEnvironmentPath) {
						// This might be cached data
						const activeEnv = pythonApi.environments.getActiveEnvironmentPath(workspaceUri);
						if (activeEnv && typeof activeEnv === 'object' && 'path' in activeEnv) {
							return String(activeEnv.path);
						} else if (typeof activeEnv === 'string') {
							return activeEnv;
						}
					}
				} catch (envError) {
					// Ignore async API errors in sync context
				}
			}

			// Fallback to legacy API
			if (pythonApi?.settings?.getSettings) {
				const workspaceUri = context.workspaceFolders?.[0]?.uri;
				const settings = pythonApi.settings.getSettings(workspaceUri);
				if (settings?.pythonPath) {
					return settings.pythonPath;
				}
			}
		}

		return undefined;

	} catch (error) {
		// Failed to get Python interpreter path
		return undefined;
	}
}

/**
 * Get a fallback Python command when exact path cannot be determined
 */
function getPythonFallbackCommand(context: PlaceholderContext): string {
	// Try to use 'python3' as a more reliable fallback than 'python'
	// This is especially important on systems where 'python' might point to Python 2
	const fallback = process.platform === 'win32' ? 'python' : 'python3';
	return fallback;
}

/**
 * Extract file information from active editor
 */
function extractFileInfo(activeEditor: vscode.TextEditor, workspaceFolders?: readonly vscode.WorkspaceFolder[]): FileInfo | null {
	if (activeEditor.document.uri.scheme !== 'file') {
		return null;
	}

	const fileName = activeEditor.document.fileName;
	const fileBasename = path.basename(fileName);
	const fileBasenameNoExtension = path.basename(fileName, path.extname(fileName));
	const fileExtname = path.extname(fileName);
	const fileDirname = path.dirname(fileName);
	const fileDirnameBasename = path.basename(fileDirname);

	// Get workspace folder for current file
	const fileWorkspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)?.uri.fsPath || '';

	// Get relative paths if workspace exists
	let relativeFile = '';
	let relativeFileDirname = '';
	if (workspaceFolders && workspaceFolders.length > 0) {
		relativeFile = vscode.workspace.asRelativePath(fileName);
		relativeFileDirname = path.dirname(relativeFile);
		if (relativeFileDirname === '.') {
			relativeFileDirname = '';
		}
	}

	// Cursor position and selection
	const selection = activeEditor.selection;
	const lineNumber = selection.active.line + 1; // VS Code uses 0-based, display as 1-based
	const columnNumber = selection.active.character + 1; // VS Code uses 0-based, display as 1-based
	const selectedText = activeEditor.document.getText(selection);

	return {
		fileBasename,
		fileBasenameNoExtension,
		file: fileName,
		fileExtname,
		fileDirname,
		fileDirnameBasename,
		fileWorkspaceFolder,
		relativeFile,
		relativeFileDirname,
		lineNumber,
		columnNumber,
		selectedText
	};
}

/**
 * Extract basic file information for non-file schemes
 */
function extractBasicFileInfo(activeEditor: vscode.TextEditor): Partial<FileInfo> {
	const uri = activeEditor.document.uri;
	let fileBasename = '';
	let fileBasenameNoExtension = '';
	let fileExtname = '';

	if (uri.path) {
		fileBasename = path.basename(uri.path);
		fileBasenameNoExtension = path.basename(uri.path, path.extname(uri.path));
		fileExtname = path.extname(uri.path);
	} else if (activeEditor.document.fileName) {
		// Fallback to fileName property
		fileBasename = path.basename(activeEditor.document.fileName);
		fileBasenameNoExtension = path.basename(activeEditor.document.fileName, path.extname(activeEditor.document.fileName));
		fileExtname = path.extname(activeEditor.document.fileName);
	}

	// Cursor position and selection (these work for non-file schemes too)
	const selection = activeEditor.selection;
	const lineNumber = selection.active.line + 1;
	const columnNumber = selection.active.character + 1;
	const selectedText = activeEditor.document.getText(selection);

	return {
		fileBasename,
		fileBasenameNoExtension,
		fileExtname,
		lineNumber,
		columnNumber,
		selectedText
	};
}

/**
 * Replace file-related placeholders
 */
function replaceFileePlaceholders(text: string, fileInfo: FileInfo): string {
	let result = text;

	// Smart replacement: handle path concatenation properly
	result = result.replace(/\{fileDirname\}\/([^\s]+)/g, (match, suffix) => {
		return escapeShellArg(path.join(fileInfo.fileDirname, suffix));
	});

	// Handle path concatenation for {dir} as well
	result = result.replace(/\{dir\}\/([^\s]+)/g, (match, suffix) => {
		return escapeShellArg(path.join(fileInfo.fileDirname, suffix));
	});

	// Handle remaining standalone placeholders (quoted for safety)
	result = result.replace(/\{fileBasename\}/g, escapeShellArg(fileInfo.fileBasename));
	result = result.replace(/\{fileBasenameNoExtension\}/g, escapeShellArg(fileInfo.fileBasenameNoExtension));
	result = result.replace(/\{file\}/g, escapeShellArg(fileInfo.file));
	result = result.replace(/\{fileDirname\}/g, escapeShellArg(fileInfo.fileDirname));
	result = result.replace(/\{dir\}/g, escapeShellArg(fileInfo.fileDirname)); // 便利なエイリアス
	result = result.replace(/\{fileDirnameBasename\}/g, escapeShellArg(fileInfo.fileDirnameBasename));

	// File workspace folder
	if (fileInfo.fileWorkspaceFolder) {
		result = result.replace(/\{fileWorkspaceFolder\}/g, escapeShellArg(fileInfo.fileWorkspaceFolder));
	}

	// {fileExtname} - File extension (usually safe without quotes)
	result = result.replace(/\{fileExtname\}/g, fileInfo.fileExtname);

	// Relative paths
	if (fileInfo.relativeFile) {
		result = result.replace(/\{relativeFile\}/g, escapeShellArg(fileInfo.relativeFile));
	}
	if (fileInfo.relativeFileDirname) {
		result = result.replace(/\{relativeFileDirname\}/g, escapeShellArg(fileInfo.relativeFileDirname));
	}

	// Cursor position and selection
	result = result.replace(/\{lineNumber\}/g, fileInfo.lineNumber.toString());
	result = result.replace(/\{columnNumber\}/g, fileInfo.columnNumber.toString());
	if (fileInfo.selectedText) {
		result = result.replace(/\{selectedText\}/g, escapeShellArg(fileInfo.selectedText));
	}

	return result;
}



/**
 * Replace workspace-related placeholders
 */
function replaceWorkspacePlaceholders(text: string, workspaceFolders?: readonly vscode.WorkspaceFolder[]): string {
	let result = text;

	if (workspaceFolders && workspaceFolders.length > 0) {
		const workspaceFolder = workspaceFolders[0].uri.fsPath;
		const workspaceFolderBasename = workspaceFolders[0].name;

		// Smart replacement: handle path concatenation properly
		result = result.replace(/\{workspaceFolder\}\/([^\s]+)/g, (match, suffix) => {
			return escapeShellArg(path.join(workspaceFolder, suffix));
		});

		// Handle remaining standalone workspace placeholders
		result = result.replace(/\{workspaceFolder\}/g, escapeShellArg(workspaceFolder));
		result = result.replace(/\{workspaceFolderBasename\}/g, escapeShellArg(workspaceFolderBasename));
	}

	return result;
}

/**
 * Replace system and environment placeholders
 */
function replaceSystemPlaceholders(text: string, context: PlaceholderContext): string {
	let result = text;

	// System variables
	result = result.replace(/\{userHome\}/g, escapeShellArg(context.userHome));
	result = result.replace(/\{pathSeparator\}/g, context.pathSeparator);
	result = result.replace(/\{\/\}/g, context.pathSeparator); // Shorthand for pathSeparator
	result = result.replace(/\{cwd\}/g, escapeShellArg(context.cwd));

	// Environment variables: ${env:VAR_NAME}
	result = result.replace(/\{env:([^}]+)\}/g, (match, varName) => {
		const envValue = context.getEnvVar(varName);
		return envValue ? escapeShellArg(envValue) : match; // Keep original if not found
	});

	// Configuration variables: ${config:setting.name}
	result = result.replace(/\{config:([^}]+)\}/g, (match, configName) => {
		try {
			const configValue = context.getConfig(configName);
			if (configValue !== undefined) {
				return escapeShellArg(String(configValue));
			}
		} catch (error) {
			console.warn(`Failed to get config ${configName}:`, error);
		}
		return match; // Keep original if not found or error
	});

	// Python-specific placeholders for convenience
	result = result.replace(/\{pythonPath\}/g, () => {
		const pythonPath = getPythonInterpreterPath(context);
		if (pythonPath) {
			return escapeShellArg(String(pythonPath));
		} else {
			// If we can't determine the exact path, use a more intelligent fallback
			// that will try to use the Python extension's selected interpreter
			return getPythonFallbackCommand(context);
		}
	});

	result = result.replace(/\{pythonInterpreter\}/g, () => {
		const interpreterPath = getPythonInterpreterPath(context);
		if (interpreterPath) {
			return escapeShellArg(String(interpreterPath));
		} else {
			return getPythonFallbackCommand(context);
		}
	});

	return result;
}

/**
 * Find unresolved placeholders in text
 */
function findUnresolvedPlaceholders(text: string): string[] {
	const matches = text.match(/\{[^}]+\}/g);
	return matches || [];
}

/**
 * Generate warnings for missing context
 */
function generateWarnings(originalText: string, context: PlaceholderContext): string[] {
	const warnings: string[] = [];

	// File-related placeholders warning
	if (!context.activeEditor) {
		const fileRelatedPlaceholders = [
			'{fileBasename}', '{fileBasenameNoExtension}', '{file}', '{fileDirname}', '{dir}', '{fileExtname}', '{relativeFile}',
			'{fileWorkspaceFolder}', '{relativeFileDirname}', '{fileDirnameBasename}', '{lineNumber}', '{columnNumber}', '{selectedText}'
		];

		const hasFileRelatedPlaceholders = fileRelatedPlaceholders.some(placeholder => originalText.includes(placeholder));
		if (hasFileRelatedPlaceholders) {
			warnings.push('ファイル関連のプレースホルダーを使用していますが、アクティブなファイルエディターがありません。');
		}
	}

	// Workspace placeholders warning
	if (!context.workspaceFolders || context.workspaceFolders.length === 0) {
		const workspaceRelatedPlaceholders = ['{workspaceFolder}', '{workspaceFolderBasename}'];
		const hasWorkspaceRelatedPlaceholders = workspaceRelatedPlaceholders.some(placeholder => originalText.includes(placeholder));

		if (hasWorkspaceRelatedPlaceholders) {
			warnings.push('ワークスペース関連のプレースホルダーを使用していますが、ワークスペースが開かれていません。');
		}
	}

	// Non-file scheme warnings
	if (context.activeEditor && context.activeEditor.document.uri.scheme !== 'file') {
		const unsupportedPlaceholders = [
			'{file}', '{fileDirname}', '{dir}', '{relativeFile}', '{fileWorkspaceFolder}',
			'{relativeFileDirname}', '{fileDirnameBasename}'
		];

		const hasUnsupportedPlaceholders = unsupportedPlaceholders.some(placeholder => originalText.includes(placeholder));
		if (hasUnsupportedPlaceholders) {
			warnings.push(`ファイルスキーム以外では一部のファイルパス関連プレースホルダーは使用できません (${context.activeEditor.document.uri.scheme}:)`);
		}
	}

	return warnings;
}

/**
 * Apply auto change directory if configured
 */
function applyAutoChangeDirectory(text: string, fileInfo: FileInfo | null, context: PlaceholderContext): string {
	if (!context.autoChangeDirectory || context.autoChangeDirectory === 'none' || !fileInfo) {
		return text;
	}

  if (context.autoChangeDirectory === 'auto (experimental)') {
    const workspaceRoot = context.workspaceFolders && context.workspaceFolders.length > 0
      ? context.workspaceFolders[0].uri.fsPath
      : null;
    return applyAutoCdCommand(text, fileInfo, workspaceRoot);
  } else if (context.autoChangeDirectory === 'file') {
		// Change to the file's directory for execution context
		return `cd ${escapeShellArg(fileInfo.fileDirname)} && ${text}`;
	} else if (context.autoChangeDirectory === 'workspace') {
		// Change to the workspace root directory
		if (context.workspaceFolders && context.workspaceFolders.length > 0) {
			const workspaceRoot = context.workspaceFolders[0].uri.fsPath;
			return `cd ${escapeShellArg(workspaceRoot)} && ${text}`;
		}
	}

	return text;
}




/**
 * Main function to resolve all placeholders in text
 */
export function resolvePlaceholders(text: string, context: PlaceholderContext): PlaceholderResult {
	const warnings: string[] = [];
	let result = text;
	let fileInfo: FileInfo | null = null;

	// Generate context warnings first
	warnings.push(...generateWarnings(text, context));

	// Apply auto change directory BEFORE placeholder replacement
	// This allows detection of placeholder-based commands like {filename} and {pythonPath}
	if (context.activeEditor && context.activeEditor.document.uri.scheme === 'file') {
		const tempFileInfo = extractFileInfo(context.activeEditor, context.workspaceFolders);
		if (tempFileInfo) {
			result = applyAutoChangeDirectory(result, tempFileInfo, context);
		}
	}

	// Replace file-related placeholders
	if (context.activeEditor) {
		if (context.activeEditor.document.uri.scheme === 'file') {
			// Full file support for file:// scheme
			fileInfo = extractFileInfo(context.activeEditor, context.workspaceFolders);
			if (fileInfo) {
				result = replaceFileePlaceholders(result, fileInfo);
			}
		} else {
			// Limited support for non-file schemes
			const basicFileInfo = extractBasicFileInfo(context.activeEditor);

			// Replace basic info that works for non-file schemes
			if (basicFileInfo.fileBasename) {
				result = result.replace(/\{fileBasename\}/g, escapeShellArg(basicFileInfo.fileBasename));
			}
			if (basicFileInfo.fileBasenameNoExtension) {
				result = result.replace(/\{fileBasenameNoExtension\}/g, escapeShellArg(basicFileInfo.fileBasenameNoExtension));
			}
			if (basicFileInfo.fileExtname) {
				result = result.replace(/\{fileExtname\}/g, basicFileInfo.fileExtname);
			}
			if (basicFileInfo.lineNumber) {
				result = result.replace(/\{lineNumber\}/g, basicFileInfo.lineNumber.toString());
			}
			if (basicFileInfo.columnNumber) {
				result = result.replace(/\{columnNumber\}/g, basicFileInfo.columnNumber.toString());
			}
			if (basicFileInfo.selectedText) {
				result = result.replace(/\{selectedText\}/g, escapeShellArg(basicFileInfo.selectedText));
			}
		}
	}

	// Replace workspace placeholders
	result = replaceWorkspacePlaceholders(result, context.workspaceFolders);

	// Replace system placeholders
	result = replaceSystemPlaceholders(result, context);

	// Check for unresolved placeholders
	const unresolvedPlaceholders = findUnresolvedPlaceholders(result);
	if (unresolvedPlaceholders.length > 0) {
		warnings.push(`未解決のプレースホルダーが見つかりました: ${unresolvedPlaceholders.join(', ')}`);
	}

	return {
		resolvedText: result,
		warnings
	};
}

/**
 * Create context from current VS Code state
 */
export function createPlaceholderContext(): PlaceholderContext {
	// Get auto change directory setting
	const config = vscode.workspace.getConfiguration('quickTerminalCommand');
	const autoChangeDirectory = config.get<string>('autoChangeDirectory', 'workspace') as 'file' | 'workspace' | 'none' | 'auto (experimental)';

	return {
		activeEditor: vscode.window.activeTextEditor,
		workspaceFolders: vscode.workspace.workspaceFolders,
		userHome: os.homedir(),
		pathSeparator: path.sep,
		cwd: process.cwd(),
		getEnvVar: (name: string) => process.env[name],
		getConfig: (name: string) => {
			// Parse the setting name to get the correct scope
			const parts = name.split('.');
			if (parts.length >= 2) {
				const scope = parts[0];
				const settingName = parts.slice(1).join('.');
				return vscode.workspace.getConfiguration(scope).get(settingName);
			} else {
				// Fallback for settings without scope
				return vscode.workspace.getConfiguration().get(name);
			}
		},
		autoChangeDirectory
	};
}