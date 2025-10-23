import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolvePlaceholders, PlaceholderContext, createPlaceholderContext } from '../placeholderResolver';

// モックの Selection クラス
class MockSelection implements vscode.Selection {
	constructor(
		public anchor: vscode.Position,
		public active: vscode.Position
	) {}

	get start(): vscode.Position {
		return this.anchor.line <= this.active.line && this.anchor.character <= this.active.character ? this.anchor : this.active;
	}

	get end(): vscode.Position {
		return this.anchor.line >= this.active.line && this.anchor.character >= this.active.character ? this.anchor : this.active;
	}

	get isEmpty(): boolean {
		return this.anchor.line === this.active.line && this.anchor.character === this.active.character;
	}

	get isSingleLine(): boolean {
		return this.start.line === this.end.line;
	}

	isEqual(other: vscode.Selection): boolean {
		return this.anchor.isEqual(other.anchor) && this.active.isEqual(other.active);
	}

	contains(positionOrRange: vscode.Position | vscode.Range): boolean {
		// 簡単な実装
		return false;
	}

	intersection(range: vscode.Range): vscode.Range | undefined {
		return undefined;
	}

	union(other: vscode.Range): vscode.Range {
		return new MockSelection(this.start, other.end);
	}

	with(start?: vscode.Position, end?: vscode.Position): vscode.Range;
	with(change: { start?: vscode.Position; end?: vscode.Position }): vscode.Range;
	with(startOrChange?: vscode.Position | { start?: vscode.Position; end?: vscode.Position }, end?: vscode.Position): vscode.Range {
		if (startOrChange && typeof startOrChange === 'object' && 'start' in startOrChange) {
			const change = startOrChange as { start?: vscode.Position; end?: vscode.Position };
			return new MockSelection(change.start || this.start, change.end || this.end);
		} else {
			const start = startOrChange as vscode.Position | undefined;
			return new MockSelection(start || this.start, end || this.end);
		}
	}

	isReversed: boolean = false;
}

// モックの Position クラス
class MockPosition implements vscode.Position {
	constructor(public line: number, public character: number) {}

	compareTo(other: vscode.Position): number {
		if (this.line < other.line) return -1;
		if (this.line > other.line) return 1;
		if (this.character < other.character) return -1;
		if (this.character > other.character) return 1;
		return 0;
	}

	isAfter(other: vscode.Position): boolean {
		return this.compareTo(other) > 0;
	}

	isAfterOrEqual(other: vscode.Position): boolean {
		return this.compareTo(other) >= 0;
	}

	isBefore(other: vscode.Position): boolean {
		return this.compareTo(other) < 0;
	}

	isBeforeOrEqual(other: vscode.Position): boolean {
		return this.compareTo(other) <= 0;
	}

	isEqual(other: vscode.Position): boolean {
		return this.compareTo(other) === 0;
	}

	translate(lineDelta?: number, characterDelta?: number): vscode.Position;
	translate(change: { lineDelta?: number; characterDelta?: number }): vscode.Position;
	translate(lineDeltaOrChange?: number | { lineDelta?: number; characterDelta?: number }, characterDelta?: number): vscode.Position {
		if (typeof lineDeltaOrChange === 'number') {
			return new MockPosition(this.line + (lineDeltaOrChange || 0), this.character + (characterDelta || 0));
		} else {
			const change = lineDeltaOrChange || {};
			return new MockPosition(this.line + (change.lineDelta || 0), this.character + (change.characterDelta || 0));
		}
	}

	with(line?: number, character?: number): vscode.Position;
	with(change: { line?: number; character?: number }): vscode.Position;
	with(lineOrChange?: number | { line?: number; character?: number }, character?: number): vscode.Position {
		if (typeof lineOrChange === 'number') {
			return new MockPosition(lineOrChange ?? this.line, character ?? this.character);
		} else {
			const change = lineOrChange || {};
			return new MockPosition(change.line ?? this.line, change.character ?? this.character);
		}
	}
}

function createMockTextDocument(fileName: string, scheme: string = 'file'): Partial<vscode.TextDocument> {
	let uri: vscode.Uri;
	if (scheme === 'file') {
		uri = vscode.Uri.file(fileName);
	} else {
		// For non-file schemes, create a proper URI
		uri = vscode.Uri.parse(`${scheme}:${fileName}`);
	}

	return {
		fileName: fileName,
		uri: uri,
		getText: (range?: vscode.Range) => {
			if (!range) return 'mock file content';
			return 'selected text';
		}
	};
}

function createMockTextEditor(fileName: string, scheme: string = 'file', line: number = 0, character: number = 0): Partial<vscode.TextEditor> {
	return {
		document: createMockTextDocument(fileName, scheme) as vscode.TextDocument,
		selection: new MockSelection(new MockPosition(line, character), new MockPosition(line, character))
	};
}

function createMockWorkspaceFolder(name: string, path: string): vscode.WorkspaceFolder {
	return {
		name,
		uri: vscode.Uri.file(path),
		index: 0
	};
}

function createTestContext(overrides: Partial<PlaceholderContext> = {}): PlaceholderContext {
	return {
		activeEditor: undefined,
		workspaceFolders: undefined,
		userHome: '/home/testuser',
		pathSeparator: '/',
		cwd: '/test/cwd',
		getEnvVar: (name: string) => name === 'TEST_VAR' ? 'test_value' : undefined,
		getConfig: (name: string) => {
			switch (name) {
				case 'editor.fontSize': return 14;
				case 'python.pythonPath': return '/usr/bin/python3';
				case 'python.defaultInterpreterPath': return '/usr/bin/python3';
				default: return undefined;
			}
		},
		...overrides
	};
}

suite('PlaceholderResolver Tests', () => {

	test('Basic file placeholders', () => {
		const mockEditor = createMockTextEditor('/home/user/project/src/main.ts');
		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor
		});

		const result = resolvePlaceholders('File: {fileBasename}, Dir: {fileDirname}', context);

		assert.strictEqual(result.resolvedText, 'File: main.ts, Dir: /home/user/project/src');
		assert.strictEqual(result.warnings.length, 0);
	});

	test('File extension handling', () => {
		const mockEditor = createMockTextEditor('/home/user/project/test.spec.ts');
		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor
		});

		const result = resolvePlaceholders('{fileBasenameNoExtension}{fileExtname}', context);

		assert.strictEqual(result.resolvedText, 'test.spec.ts');
	});

	test('Workspace placeholders', () => {
		const mockEditor = createMockTextEditor('/home/user/project/src/main.ts');
		const mockWorkspace = [createMockWorkspaceFolder('MyProject', '/home/user/project')];

		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor,
			workspaceFolders: mockWorkspace
		});

		const result = resolvePlaceholders('{workspaceFolder} and {workspaceFolderBasename}', context);

		assert.strictEqual(result.resolvedText, '/home/user/project and MyProject');
	});

	test('Relative path placeholders', () => {
		const mockEditor = createMockTextEditor('/home/user/project/src/components/Button.tsx');
		const mockWorkspace = [createMockWorkspaceFolder('MyProject', '/home/user/project')];

		// Mock vscode.workspace.asRelativePath
		const originalAsRelativePath = vscode.workspace.asRelativePath;
		(vscode.workspace as any).asRelativePath = (pathOrUri: string | vscode.Uri) => {
			return 'src/components/Button.tsx';
		};

		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor,
			workspaceFolders: mockWorkspace
		});

		const result = resolvePlaceholders('{relativeFile} in {relativeFileDirname}', context);

		assert.strictEqual(result.resolvedText, 'src/components/Button.tsx in src/components');

		// Restore original function
		(vscode.workspace as any).asRelativePath = originalAsRelativePath;
	});

	test('Cursor position placeholders', () => {
		const mockEditor = createMockTextEditor('/home/user/project/main.ts', 'file', 42, 15);
		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor
		});

		const result = resolvePlaceholders('Line {lineNumber}, Column {columnNumber}', context);

		assert.strictEqual(result.resolvedText, 'Line 43, Column 16'); // 1-based
	});

	test('Selected text placeholder', () => {
		const mockEditor = createMockTextEditor('/home/user/project/main.ts');
		// Mock selection with text
		const selection = new MockSelection(new MockPosition(0, 0), new MockPosition(0, 5));
		(mockEditor as any).selection = selection;

		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor
		});

		const result = resolvePlaceholders('Search for: {selectedText}', context);

		assert.strictEqual(result.resolvedText, 'Search for: "selected text"');
	});

	test('System placeholders', () => {
		const context = createTestContext();

		const result = resolvePlaceholders('Home: {userHome}, Sep: {pathSeparator}, CWD: {cwd}', context);

		assert.strictEqual(result.resolvedText, 'Home: /home/testuser, Sep: /, CWD: /test/cwd');
	});

	test('Environment variable placeholders', () => {
		const context = createTestContext();

		const result = resolvePlaceholders('Test var: {env:TEST_VAR}, Missing: {env:MISSING_VAR}', context);

		assert.strictEqual(result.resolvedText, 'Test var: test_value, Missing: {env:MISSING_VAR}');
	});

	test('Configuration placeholders', () => {
		const context = createTestContext();

		const result = resolvePlaceholders('Font size: {config:editor.fontSize}px', context);

		assert.strictEqual(result.resolvedText, 'Font size: 14px');
	});

	test('Python-specific placeholders', () => {
		const context = createTestContext();

		const result = resolvePlaceholders('Run: {pythonPath} script.py, Interpreter: {pythonInterpreter}', context);

		// Updated expectation: should use the configured path if available
		assert.strictEqual(result.resolvedText, 'Run: /usr/bin/python3 script.py, Interpreter: /usr/bin/python3');
	});

	test('Python placeholders fallback', () => {
		// Test when no Python path is configured
		const context = createTestContext({
			getConfig: (name: string) => {
				// Don't return Python config
				if (name.startsWith('python.')) return undefined;
				return createTestContext().getConfig(name);
			}
		});

		const result = resolvePlaceholders('Run: {pythonPath} script.py', context);

		// Updated: Now expects 'python3' on Unix-like systems
		assert.strictEqual(result.resolvedText, 'Run: python3 script.py');
	});

	test('Python path with real VS Code configuration', () => {
		// Test with actual VS Code configuration (if available)
		const context = createPlaceholderContext();

		const result = resolvePlaceholders('Run: {pythonPath} script.py', context);

		// The result should either have a real Python path or fallback to 'python3'/'python'
		assert.ok(
			result.resolvedText.includes('/python') ||
			result.resolvedText.includes('python script.py') ||
			result.resolvedText.includes('python3 script.py'),
			`Expected Python path or fallback, got: ${result.resolvedText}`
		);
	});

	test('Path concatenation', () => {
		const mockEditor = createMockTextEditor('/home/user/project/src/main.ts');
		const mockWorkspace = [createMockWorkspaceFolder('MyProject', '/home/user/project')];

		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor,
			workspaceFolders: mockWorkspace
		});

		const result = resolvePlaceholders('Build to {workspaceFolder}/dist/{fileBasename}', context);

		assert.strictEqual(result.resolvedText, 'Build to /home/user/project/dist/main.ts');
	});

	test('Legacy placeholder compatibility', () => {
		const mockEditor = createMockTextEditor('/home/user/project/src/main.ts');
		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor
		});

		const result = resolvePlaceholders('Legacy: {filename}, {filestem}, {filepath}', context);

		assert.strictEqual(result.resolvedText, 'Legacy: main.ts, main, /home/user/project/src/main.ts');
	});

	test('Non-file scheme handling', () => {
		const mockEditor = createMockTextEditor('Untitled-1', 'untitled');
		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor
		});

		const result = resolvePlaceholders('Name: {fileBasename}, Unsupported: {file}', context);

		assert.strictEqual(result.resolvedText, 'Name: Untitled-1, Unsupported: {file}');
		assert.ok(result.warnings.some(w => w.includes('ファイルスキーム以外では')));
	});

	test('Warning for missing active editor', () => {
		const context = createTestContext(); // No active editor

		const result = resolvePlaceholders('File: {fileBasename}', context);

		assert.strictEqual(result.resolvedText, 'File: {fileBasename}');
		assert.ok(result.warnings.some(w => w.includes('アクティブなファイルエディターがありません')));
	});

	test('Warning for missing workspace', () => {
		const context = createTestContext(); // No workspace

		const result = resolvePlaceholders('Workspace: {workspaceFolder}', context);

		assert.strictEqual(result.resolvedText, 'Workspace: {workspaceFolder}');
		assert.ok(result.warnings.some(w => w.includes('ワークスペースが開かれていません')));
	});

	test('Unresolved placeholder warning', () => {
		const context = createTestContext();

		const result = resolvePlaceholders('Unknown: {unknownPlaceholder}', context);

		assert.strictEqual(result.resolvedText, 'Unknown: {unknownPlaceholder}');
		assert.ok(result.warnings.some(w => w.includes('未解決のプレースホルダー')));
	});

	test('Shell escaping for special characters', () => {
		const mockEditor = createMockTextEditor('/home/user/My Project/file with spaces.ts');
		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor
		});

		const result = resolvePlaceholders('File: {fileBasename}', context);

		assert.strictEqual(result.resolvedText, 'File: "file with spaces.ts"');
	});

	test('Complex placeholder combination', () => {
		const mockEditor = createMockTextEditor('/home/user/project/src/components/Button.tsx', 'file', 10, 5);
		const mockWorkspace = [createMockWorkspaceFolder('MyProject', '/home/user/project')];

		// Mock vscode.workspace.asRelativePath
		const originalAsRelativePath = vscode.workspace.asRelativePath;
		(vscode.workspace as any).asRelativePath = () => 'src/components/Button.tsx';

		const context = createTestContext({
			activeEditor: mockEditor as vscode.TextEditor,
			workspaceFolders: mockWorkspace
		});

		const result = resolvePlaceholders(
			'echo "File {fileBasename} at line {lineNumber} in {workspaceFolderBasename}" > {userHome}/log.txt',
			context
		);

		assert.strictEqual(
			result.resolvedText,
			'echo "File Button.tsx at line 11 in MyProject" > /home/testuser/log.txt'
		);

		// Restore
		(vscode.workspace as any).asRelativePath = originalAsRelativePath;
	});
});