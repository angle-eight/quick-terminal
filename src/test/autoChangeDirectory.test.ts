import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { applyAutoCdCommand, FileInfo } from '../autoChangeDirectory';

// テスト用の一時ディレクトリとファイルを作成するヘルパー関数
function createTestStructure(): { tempDir: string; cleanup: () => void } {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-terminal-test-'));

	const cleanup = () => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	};

	return { tempDir, cleanup };
}

// テスト用のFileInfoを作成するヘルパー関数
function createFileInfo(filePath: string): FileInfo {
	const fileBasename = path.basename(filePath);
	const fileBasenameNoExtension = path.basename(filePath, path.extname(filePath));
	const fileExtname = path.extname(filePath);
	const fileDirname = path.dirname(filePath);
	const fileDirnameBasename = path.basename(fileDirname);

	return {
		fileBasename,
		fileBasenameNoExtension,
		file: filePath,
		fileExtname,
		fileDirname,
		fileDirnameBasename,
		fileWorkspaceFolder: '',
		relativeFile: '',
		relativeFileDirname: '',
		lineNumber: 1,
		columnNumber: 1,
		selectedText: ''
	};
}

suite('AutoChangeDirectory Tests', () => {
	let tempDir: string;
	let cleanup: () => void;

	setup(() => {
		const testStructure = createTestStructure();
		tempDir = testStructure.tempDir;
		cleanup = testStructure.cleanup;
	});

	teardown(() => {
		cleanup();
	});

	test('File placeholder commands should cd to file directory', () => {
		const filePath = path.join(tempDir, 'src', 'test.py');
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, 'print("hello")');

		const fileInfo = createFileInfo(filePath);

		// Test single placeholder
		const result1 = applyAutoCdCommand('{filename}', fileInfo, tempDir);
		assert.strictEqual(result1, `cd ${path.dirname(filePath)} && {filename}`);

		// Test placeholder in command
		const result2 = applyAutoCdCommand('cat {filename}', fileInfo, tempDir);
		assert.strictEqual(result2, `cd ${path.dirname(filePath)} && cat {filename}`);

		// Test multiple placeholders
		const result3 = applyAutoCdCommand('gcc {filename} -o {filestem}', fileInfo, tempDir);
		assert.strictEqual(result3, `cd ${path.dirname(filePath)} && gcc {filename} -o {filestem}`);
	});

	test('Pytest should find configuration files', () => {
		// Create project structure
		const projectRoot = path.join(tempDir, 'project');
		const srcDir = path.join(projectRoot, 'src');
		const testFile = path.join(srcDir, 'test_main.py');

		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(testFile, 'def test_example(): pass');
		fs.writeFileSync(path.join(projectRoot, 'pytest.ini'), '[tool:pytest]');

		const fileInfo = createFileInfo(testFile);
		const result = applyAutoCdCommand('pytest', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && pytest`);
	});

	test('NPM should find package.json', () => {
		// Create monorepo structure
		const workspaceRoot = path.join(tempDir, 'workspace');
		const appDir = path.join(workspaceRoot, 'apps', 'frontend');
		const srcFile = path.join(appDir, 'src', 'App.tsx');

		fs.mkdirSync(path.dirname(srcFile), { recursive: true });
		fs.writeFileSync(srcFile, 'export default function App() {}');
		fs.writeFileSync(path.join(workspaceRoot, 'package.json'), '{"name": "workspace"}');
		fs.writeFileSync(path.join(appDir, 'package.json'), '{"name": "frontend"}');

		const fileInfo = createFileInfo(srcFile);
		const result = applyAutoCdCommand('npm run build', fileInfo, workspaceRoot);

		// Should find the nearest package.json in apps/frontend
		assert.strictEqual(result, `cd ${appDir} && npm run build`);
	});

	test('Docker compose should find compose files', () => {
		const projectRoot = path.join(tempDir, 'project');
		const serviceDir = path.join(projectRoot, 'services', 'api');
		const dockerFile = path.join(serviceDir, 'Dockerfile');

		fs.mkdirSync(path.dirname(dockerFile), { recursive: true });
		fs.writeFileSync(dockerFile, 'FROM node:18');
		fs.writeFileSync(path.join(projectRoot, 'docker-compose.yml'), 'version: "3"');

		const fileInfo = createFileInfo(dockerFile);
		const result = applyAutoCdCommand('docker compose up', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && docker compose up`);
	});

	test('Make should find Makefile', () => {
		const projectRoot = path.join(tempDir, 'project');
		const srcDir = path.join(projectRoot, 'src');
		const sourceFile = path.join(srcDir, 'main.c');

		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(sourceFile, '#include <stdio.h>');
		fs.writeFileSync(path.join(projectRoot, 'Makefile'), 'all:\n\tgcc src/main.c -o main');

		const fileInfo = createFileInfo(sourceFile);
		const result = applyAutoCdCommand('make', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && make`);
	});

	test('Terraform should find tf files', () => {
		const infraDir = path.join(tempDir, 'infrastructure', 'modules', 'vpc');
		const tfFile = path.join(infraDir, 'networking.tf');

		fs.mkdirSync(infraDir, { recursive: true });
		fs.writeFileSync(tfFile, 'resource "aws_vpc" "main" {}');
		fs.writeFileSync(path.join(infraDir, 'main.tf'), 'terraform {}');

		const fileInfo = createFileInfo(tfFile);
		const result = applyAutoCdCommand('terraform plan', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${infraDir} && terraform plan`);
	});

	test('Go should find go.mod', () => {
		const projectRoot = path.join(tempDir, 'goproject');
		const pkgDir = path.join(projectRoot, 'pkg', 'utils');
		const goFile = path.join(pkgDir, 'helper.go');

		fs.mkdirSync(pkgDir, { recursive: true });
		fs.writeFileSync(goFile, 'package utils');
		fs.writeFileSync(path.join(projectRoot, 'go.mod'), 'module example.com/project');

		const fileInfo = createFileInfo(goFile);
		const result = applyAutoCdCommand('go build', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && go build`);
	});

	test('Cargo should find Cargo.toml', () => {
		const projectRoot = path.join(tempDir, 'rustproject');
		const srcDir = path.join(projectRoot, 'src');
		const rustFile = path.join(srcDir, 'main.rs');

		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(rustFile, 'fn main() {}');
		fs.writeFileSync(path.join(projectRoot, 'Cargo.toml'), '[package]\nname = "rustproject"');

		const fileInfo = createFileInfo(rustFile);
		const result = applyAutoCdCommand('cargo build', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && cargo build`);
	});

	test('Should respect workspace boundary', () => {
		// Create structure that goes beyond workspace
		const systemRoot = tempDir;
		const workspaceRoot = path.join(systemRoot, 'workspace');
		const projectDir = path.join(workspaceRoot, 'project');
		const srcFile = path.join(projectDir, 'src', 'test.py');

		fs.mkdirSync(path.dirname(srcFile), { recursive: true });
		fs.writeFileSync(srcFile, 'print("test")');

		// Put pytest.ini outside workspace (should not be found)
		fs.writeFileSync(path.join(systemRoot, 'pytest.ini'), '[tool:pytest]');

		const fileInfo = createFileInfo(srcFile);
		const result = applyAutoCdCommand('pytest', fileInfo, workspaceRoot);

		// Should not find the pytest.ini outside workspace, so falls back to file directory
		assert.strictEqual(result, `cd ${path.dirname(srcFile)} && pytest`);
	});

	test('Should fall back to file directory when no config found', () => {
		const srcFile = path.join(tempDir, 'src', 'random.py');
		fs.mkdirSync(path.dirname(srcFile), { recursive: true });
		fs.writeFileSync(srcFile, 'print("test")');

		const fileInfo = createFileInfo(srcFile);
		const result = applyAutoCdCommand('pytest', fileInfo, tempDir);

		// No pytest.ini found, should fall back to file directory
		assert.strictEqual(result, `cd ${path.dirname(srcFile)} && pytest`);
	});

	test('Should handle empty command', () => {
		const filePath = path.join(tempDir, 'test.py');
		fs.writeFileSync(filePath, 'print("test")');

		const fileInfo = createFileInfo(filePath);
		const result = applyAutoCdCommand('', fileInfo, tempDir);

		assert.strictEqual(result, '');
	});

	test('Should handle whitespace-only command', () => {
		const filePath = path.join(tempDir, 'test.py');
		fs.writeFileSync(filePath, 'print("test")');

		const fileInfo = createFileInfo(filePath);
		const result = applyAutoCdCommand('   ', fileInfo, tempDir);

		assert.strictEqual(result, '   ');
	});

	test('Non-matching commands should cd to file directory', () => {
		const filePath = path.join(tempDir, 'test.py');
		fs.writeFileSync(filePath, 'print("test")');

		const fileInfo = createFileInfo(filePath);
		const result = applyAutoCdCommand('echo "hello world"', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${path.dirname(filePath)} && echo "hello world"`);
	});

	test('Multiple configuration files - should find first match', () => {
		const projectRoot = path.join(tempDir, 'project');
		const srcDir = path.join(projectRoot, 'src');
		const testFile = path.join(srcDir, 'test_main.py');

		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(testFile, 'def test_example(): pass');

		// Create multiple config files - should find pyproject.toml first
		fs.writeFileSync(path.join(projectRoot, 'pyproject.toml'), '[tool.pytest]');
		fs.writeFileSync(path.join(projectRoot, 'pytest.ini'), '[tool:pytest]');

		const fileInfo = createFileInfo(testFile);
		const result = applyAutoCdCommand('pytest', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && pytest`);
	});

	test('Python -m pytest should work', () => {
		const projectRoot = path.join(tempDir, 'project');
		const srcDir = path.join(projectRoot, 'src');
		const testFile = path.join(srcDir, 'test_main.py');

		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(testFile, 'def test_example(): pass');
		fs.writeFileSync(path.join(projectRoot, 'pytest.ini'), '[tool:pytest]');

		const fileInfo = createFileInfo(testFile);
		const result = applyAutoCdCommand('python -m pytest', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && python -m pytest`);
	});

	test('ESLint should find configuration files', () => {
		const projectRoot = path.join(tempDir, 'project');
		const srcDir = path.join(projectRoot, 'src');
		const jsFile = path.join(srcDir, 'app.js');

		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(jsFile, 'console.log("hello");');
		fs.writeFileSync(path.join(projectRoot, '.eslintrc.json'), '{"rules": {}}');

		const fileInfo = createFileInfo(jsFile);
		const result = applyAutoCdCommand('eslint .', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && eslint .`);
	});

	test('Should quote paths with spaces', () => {
		// Create a directory with spaces
		const projectRoot = path.join(tempDir, 'my project');
		const srcDir = path.join(projectRoot, 'src folder');
		const testFile = path.join(srcDir, 'test.py');

		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(testFile, 'print("test")');
		fs.writeFileSync(path.join(projectRoot, 'pytest.ini'), '[tool:pytest]');

		const fileInfo = createFileInfo(testFile);
		const result = applyAutoCdCommand('pytest', fileInfo, tempDir);

		// Should quote the path because it contains spaces
		assert.strictEqual(result, `cd "${projectRoot}" && pytest`);
	});

	test('Should handle dotnet project files with wildcards', () => {
		// Note: This tests the pattern matching, not actual filesystem wildcards
		const projectRoot = path.join(tempDir, 'dotnetproject');
		const srcDir = path.join(projectRoot, 'src');
		const csFile = path.join(srcDir, 'Program.cs');

		fs.mkdirSync(srcDir, { recursive: true });
		fs.writeFileSync(csFile, 'Console.WriteLine("Hello");');
		fs.writeFileSync(path.join(projectRoot, 'MyApp.csproj'), '<Project Sdk="Microsoft.NET.Sdk">');

		const fileInfo = createFileInfo(csFile);
		const result = applyAutoCdCommand('dotnet build', fileInfo, tempDir);

		assert.strictEqual(result, `cd ${projectRoot} && dotnet build`);
	});
});