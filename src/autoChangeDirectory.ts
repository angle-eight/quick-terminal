import * as path from 'path';
import * as fs from 'fs';

/**
 * File information extracted from active editor
 */
export interface FileInfo {
	fileBasename: string;
	fileBasenameNoExtension: string;
	file: string;
	fileExtname: string;
	fileDirname: string;
	fileDirnameBasename: string;
	fileWorkspaceFolder: string;
	relativeFile: string;
	relativeFileDirname: string;
	lineNumber: number;
	columnNumber: number;
	selectedText: string;
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
 * 指定された設定ファイルのいずれかが存在するディレクトリを見つける
 * ワークスペースルートまでしか探索しない
 */
function findConfigDirectory(startDir: string, configFiles: string[], workspaceRoot: string | null): string | null {
	let currentDir = startDir;

	while (currentDir !== path.dirname(currentDir)) { // ルートディレクトリに到達するまで
		// 各設定ファイルが存在するかチェック
		for (const configFile of configFiles) {
			try {
				// ワイルドカードを含む場合はディレクトリ内のファイルをチェック
				if (configFile.includes('*')) {
					const files = fs.readdirSync(currentDir);
					const pattern = new RegExp('^' + configFile.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
					if (files.some(file => pattern.test(file))) {
						return currentDir;
					}
				} else {
					// 通常のファイル名
					const configPath = path.join(currentDir, configFile);
					if (fs.existsSync(configPath)) {
						return currentDir;
					}
				}
			} catch (error) {
				// ファイルアクセスエラーは無視して続行
				continue;
			}
		}

		// ワークスペースルートに到達したら停止
		if (workspaceRoot && currentDir === workspaceRoot) {
			break;
		}

		// 親ディレクトリに移動
		currentDir = path.dirname(currentDir);
	}

	return null;
}

/**
 * コマンド定義のインターフェース
 */
interface CommandRule {
	pattern: RegExp;
	configFiles: string[];
}

/**
 * 自動ディレクトリ変更対象のコマンドルール
 */
const COMMAND_RULES: CommandRule[] = [
	// Python関連
	{
		pattern: /^((?:[^\s]*python[^\s]*|\{pythonPath\})\s+-m\s+)?pytest(\s|$)/,
		configFiles: ['pytest.ini', 'pyproject.toml', 'tox.ini', 'setup.cfg']
	},
	{
		pattern: /^((?:[^\s]*python[^\s]*|\{pythonPath\})\s+-m\s+)?ruff(\s|$)/,
		configFiles: ['pyproject.toml', 'ruff.toml', '.ruff.toml']
	},
	{
		pattern: /^((?:[^\s]*python[^\s]*|\{pythonPath\})\s+-m\s+)?black(\s|$)/,
		configFiles: ['pyproject.toml', '.black']
	},
	{
		pattern: /^((?:[^\s]*python[^\s]*|\{pythonPath\})\s+-m\s+)?mypy(\s|$)/,
		configFiles: ['mypy.ini', 'pyproject.toml', 'setup.cfg']
	},
	{
		pattern: /^uv(\s|$)/,
		configFiles: ['pyproject.toml']
	},
	{
		pattern: /^flake8(\s|$)/,
		configFiles: ['setup.cfg', 'tox.ini', '.flake8']
	},
	{
		pattern: /^poetry(\s|$)/,
		configFiles: ['pyproject.toml']
	},

	// Docker関連
	{
		pattern: /^docker\s+compose(\s|$)|^docker-compose(\s|$)/,
		configFiles: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']
	},

	// Node.js関連
	{
		pattern: /^(npm|yarn|pnpm)(\s|$)/,
		configFiles: ['package.json']
	},
	{
		pattern: /^vite(\s|$)/,
		configFiles: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.cjs', 'package.json']
	},
	{
		pattern: /^tsc(\s|$)/,
		configFiles: ['tsconfig.json']
	},
	{
		pattern: /^eslint(\s|$)/,
		configFiles: ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml', 'eslint.config.js', 'eslint.config.mjs', 'package.json']
	},

	// ビルドシステム関連
	{
		pattern: /^make(\s|$)/,
		configFiles: ['Makefile', 'makefile', 'GNUmakefile']
	},
	{
		pattern: /^(gradle|gradlew|\.\/gradlew)(\s|$)/,
		configFiles: ['build.gradle', 'build.gradle.kts', 'gradlew', 'settings.gradle', 'settings.gradle.kts']
	},
	{
		pattern: /^(mvn|mvnw|\.\/mvnw)(\s|$)/,
		configFiles: ['pom.xml', 'mvnw']
	},

	// その他の言語・ツール
	{
		pattern: /^terraform(\s|$)/,
		configFiles: ['main.tf', 'variables.tf', 'outputs.tf', 'terraform.tf']
	},
	{
		pattern: /^ansible-playbook(\s|$)/,
		configFiles: ['ansible.cfg', 'playbook.yml', 'site.yml', 'inventory']
	},
	{
		pattern: /^cargo(\s|$)/,
		configFiles: ['Cargo.toml']
	},
	{
		pattern: /^go(\s|$)/,
		configFiles: ['go.mod']
	},
	{
		pattern: /^composer(\s|$)/,
		configFiles: ['composer.json']
	},
	{
		pattern: /^(bundle|bundler)(\s|$)/,
		configFiles: ['Gemfile']
	},
	{
		pattern: /^dotnet(\s|$)/,
		configFiles: ['*.csproj', '*.sln', '*.fsproj', '*.vbproj']
	},
	{
		pattern: /^helm(\s|$)/,
		configFiles: ['Chart.yaml', 'Chart.yml']
	}
];

/**
 * コマンドの内容をもとに適切なディレクトリにcdするコマンドを付け加える
 */
export function applyAutoCdCommand(commandText: string, fileInfo: FileInfo, workspaceRoot: string | null): string {
	const trimmedCommand = commandText.trim();

	// 空のコマンドの場合はそのまま返す
	if (!trimmedCommand) {
		return commandText;
	}

	// ファイル関連のプレースホルダーがスペース区切りで単独使用されている場合
	const fileOnlyPlaceholders = [
		'{filename}', '{filestem}', '{fileext}',
		'{fileBasename}', '{fileBasenameNoExtension}', '{fileExtname}'
	];

	// コマンドをスペース区切りで分割して、プレースホルダーが単独で存在するかチェック
	const commandParts = trimmedCommand.split(/\s+/);
	const hasFileOnlyPlaceholder = commandParts.some(part =>
		fileOnlyPlaceholders.includes(part)
	);

	if (hasFileOnlyPlaceholder) {
		return `cd ${escapeShellArg(fileInfo.fileDirname)} && ${commandText}`;
	}

	// 各コマンドルールをチェック
	for (const rule of COMMAND_RULES) {
		if (rule.pattern.test(trimmedCommand)) {
			const configDir = findConfigDirectory(fileInfo.fileDirname, rule.configFiles, workspaceRoot);
			if (configDir) {
				return `cd ${escapeShellArg(configDir)} && ${commandText}`;
			}
		}
	}

	// その他の場合はファイルのディレクトリにcd
	return `cd ${escapeShellArg(fileInfo.fileDirname)} && ${commandText}`;
}