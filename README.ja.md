# Quick Terminal Command

プレースホルダーとコマンド履歴を使って素早くターミナルコマンドを入力するVS Code拡張機能です。

**[日本語版 README](README.ja.md) | [English README](README.md)**

## 基本的な使い方

1. `Ctrl+Alt+I` でターミナル入力ボックスを開く
2. `{fileBasename}` や `{dir}` などのプレースホルダーを使ってコマンドを入力
3. Enter で実行

## キーバインド

- `Ctrl+Alt+I`: ターミナル入力ボックスを開く
- `↑` / `↓`: コマンド履歴をナビゲート
- `Ctrl+R`: コマンド履歴を検索
- `Tab`: 検索結果を選択
- `Esc`: 検索モードを終了

## プレースホルダー

プレースホルダーはコマンド実行時に実際の値に自動置換されます。

### ファイルプレースホルダー

- `{file}` - 現在のファイルのフルパス
- `{fileBasename}` - 拡張子付きのファイル名
- `{fileBasenameNoExtension}` - 拡張子なしのファイル名
- `{fileDirname}` - 現在のファイルがあるディレクトリ
- `{dir}` - `{fileDirname}` の短縮エイリアス（パス用に便利）
- `{fileExtname}` - ファイルの拡張子（例: `.py`, `.js`）
- `{selectedText}` - 現在選択中のテキスト
- `{lineNumber}` - 現在のカーソル行番号
- `{columnNumber}` - 現在のカーソル列番号

### ワークスペースプレースホルダー

- `{workspaceFolder}` - ワークスペースのルートパス
- `{workspaceFolderBasename}` - ワークスペースフォルダ名

### システムプレースホルダー

- `{userHome}` - ユーザーのホームディレクトリ
- `{cwd}` - 現在の作業ディレクトリ
- `{pathSeparator}` - 現在のOSのパス区切り文字
- `{env:VAR_NAME}` - 環境変数
- `{config:setting.name}` - VS Code設定値
- `{pythonPath}` - アクティブなPythonインタープリターのパス

### 使用例

```bash
python {file}
cd {dir}
cp {fileBasename} backup/
echo "現在の選択: {selectedText}"
{pythonPath} -m pytest {dir}/test_{fileBasenameNoExtension}.py
```

### パス結合の例

```bash
# 自動結合とクォート
cat {dir}/config.txt               # → cat "/path/to/project/config.txt"
cp {fileBasename} {workspaceFolder}/backup/  # → cp "script.py" "/workspace/backup/"
```

## 設定

## 拡張機能設定

- `quickTerminalCommand.autoChangeDirectory` (文字列, デフォルト: "workspace")
  - コマンド実行前のディレクトリ変更動作を制御
  - オプション:
    - `"none"`: ディレクトリを変更しない
    - `"file"`: 現在のファイルのディレクトリに変更
    - `"workspace"`: ワークスペースのルートディレクトリに変更 (デフォルト)

- `quickTerminalCommand.shell` (文字列, デフォルト: "")
  - Quick Terminalで使用するシェル実行ファイルのパス
  - 空の場合、VS Codeのデフォルトターミナルシェルを使用
  - 例:
    - Linux/Mac: `/bin/zsh`, `/bin/bash`, `/bin/fish`
    - Windows: `pwsh`, `powershell`, `cmd`

- `quickTerminalCommand.shellArgs` (文字列配列, デフォルト: [])
  - Quick Terminal用のシェル引数
  - `quickTerminalCommand.shell`が指定されている場合のみ使用
  - 例:
    - Zshの場合: `["-l", "-i"]` (ログインシェル、インタラクティブモード)
    - Bashの場合: `["--login", "-i"]`
    - PowerShellの場合: `["-NoLogo", "-NoProfile"]`

## 設定形式

拡張機能は2つの主要な設定スタイルをサポートしています:

### シンプルコマンド形式
直接的なコマンド実行用:
```json
{
  "cmd": "npm test",
  "autoExecute": true
}
```

### ルールベース形式
ファイルタイプ固有のコマンド用:
```json
{
  "rules": [
    {
      "filePattern": "*.py",
      "cmd": "python {file}"
    },
    {
      "filePattern": "*.js",
      "cmd": "node {file}"
    }
  ],
  "autoExecute": false
}
```

### 設定プロパティ

- **`cmd`** (文字列, オプション): 直接実行するコマンド
- **`rules`** (配列, オプション): ファイルパターンベースのルール配列
- **`autoExecute`** (真偽値, オプション): 入力ボックスを表示せずに自動実行 (デフォルト: `false`)

**注意**: `cmd`または`rules`のどちらか（または両方）を指定する必要があります。両方指定した場合、`cmd`が優先されます。

### ルールプロパティ

- **`filePattern`** (文字列): ファイル名にマッチするGlobパターン (例: `"*.py"`, `"test_*.js"`, `"*"`)
- **`cmd`** (文字列): パターンがマッチしたときに実行するコマンド

## カスタムキーバインドの例

機能を拡張するために、VS Codeのkeybindings.jsonに以下を追加してください:


### シンプルコマンド実行

入力表示状態でシンプルなコマンドを実行:

```json
{
  "key": "ctrl+alt+l",
  "command": "quick-terminal-command.pasteCommand",
  "when": "quickTerminalCommand.inputBoxActive",
  "args": {
    "cmd": "ls -la {dir}",
    "autoExecute": true
  }
}
```
**注意**: pasteCommandでは`"quickTerminalCommand.inputBoxActive"`の`when`条件を使用して、Quick Terminal入力ボックスがアクティブな時のみキーバインドが動作するようにしてください。

### 編集可能コマンドテンプレート

実行前に編集するため入力ボックスにコマンドを表示:
(実行時オプションを頻繁に変えるときなどに)

```json
{
  "key": "ctrl+l",
  "command": "quick-terminal-command.pasteCommand",
  "when": "quickTerminalCommand.inputBoxActive",
  "args": {
    "cmd": "{pythonPath} -m pytest {file}"
  }
}
```

### ファイルパターンベースコマンド

ファイルタイプに基づいて異なるコマンドを直接実行:

```json
{
  "key": "ctrl+t",
  "command": "quick-terminal-command.inputWithPastedCommand",
  "when": "editorTextFocus",
  "args": {
    "rules": [
      {
        "filePattern": "test_*.py",
        "cmd": "{pythonPath} -m pytest {fileBasename}"
      },
      {
        "filePattern": "*.py",
        "cmd": "{pythonPath} -u {file}"
      },
      {
        "filePattern": "*.test.ts",
        "cmd": "npm test {file}"
      },
      {
        "filePattern": "*.ts",
        "cmd": "npx ts-node {file}"
      },
      {
        "filePattern": "*.rs",
        "cmd": "cd {dir} && rustc {fileName} && {dir}{fileNameWithoutExt}"
      },
      {
        "filePattern": "*",
        "cmd": "echo '{fileBasename}用のコマンドがありません'"
      }
    ],
    "autoExecute": true
  }
}
```

### 高度な例: 混合使用

異なるキーバインドでシンプルコマンドとパターンベースルールを組み合わせ:

```json
[
  {
    "key": "ctrl+alt+r",
    "command": "quick-terminal-command.inputWithPastedCommand",
    "args": {
      "cmd": "npm run dev",
      "autoExecute": true
    }
  },
  {
    "key": "ctrl+alt+t",
    "command": "quick-terminal-command.inputWithPastedCommand",
    "args": {
      "rules": [
        {
          "filePattern": "*.test.*",
          "cmd": "npm test"
        },
        {
          "filePattern": "*",
          "cmd": "npm run build"
        }
      ]
    }
  }
]
```

## 使用例

### 開発ワークフロー

```bash
# 現在のファイルを実行
python {file}
node {file}
npx ts-node {file}

# テストを実行
python -m pytest {fileBasename}
npm test
jest {fileBasename}

# ファイル操作
cat {fileBasename}
cp {fileBasename} {dir}/backup/
mv {fileBasename} {dir}/archive/

# ビルドとデプロイ
docker build -t myapp {dir}
rsync -av {dir}/ user@server:/path/
```

### 設定ファイル

```bash
# 設定ファイルを編集
code {dir}/config.json
vim {workspaceFolder}/.env
cat {dir}/requirements.txt
```

### ログとデバッグ

```bash
# ログを表示
tail -f {workspaceFolder}/logs/app.log
grep -r "ERROR" {dir}
find {workspaceFolder} -name "*.log"
```

## スマートターミナル選択

Quick Terminalは、すべてのコマンド実行に「q-terminal」という名前の専用ターミナルを使用します。これにより一貫性のある予測可能な動作を提供します:

- **専用ターミナル**: 常に「q-terminal」という名前のターミナルを使用または作成
- **自動作成**: 「q-terminal」が存在しない場合、新しく作成して表示
- **カスタムシェル対応**: `quickTerminalCommand.shell`と`quickTerminalCommand.shellArgs`設定から設定されたシェルを使用
- **プロセス分離**: ターミナル名を変更する長時間実行プロセス（`npm run dev`など）がクイックコマンドに干渉しない
- **一貫した履歴**: すべてのクイックコマンドが同じターミナルで実行されるため、コマンド履歴の追跡が容易

`npm run dev`などのコマンドを実行すると、VS Codeは通常ターミナル名を変更します（例:「npm: dev」）。このターミナルは「q-terminal」という名前でなくなるため、拡張機能は後続のクイックコマンド用に新しい「q-terminal」を作成し、開発サーバーとクイックコマンド実行を分離します。

### シェル設定

Quick TerminalはVS Codeのデフォルトターミナル設定とは独立してシェルをカスタマイズできます:

```json
{
  "quickTerminalCommand.shell": "/bin/zsh",
  "quickTerminalCommand.shellArgs": ["-l", "-i"]
}
```

これにより以下が可能になります:
- 通常のターミナルとは異なるシェルをQuick Terminalコマンド用に使用
- コマンド実行に最適な特定のシェルオプションを設定
- 異なるワークスペースやチーム環境での一貫性を保持

## コツとトリック

1. **コマンド履歴**: `↑`と`↓`の矢印キーでコマンド履歴をナビゲート
2. **インクリメンタル検索**: `Ctrl+R`で部分一致入力によるクイック検索
3. **検索と編集**: `Tab`で検索結果を選択してから実行前に編集
4. **複数検索語**: コマンドの任意の部分で検索可能（例: "fix"で"git commit -m 'fix bug'"を検索）
5. **パス結合**: 安全なパス結合には`{dirname}/subfolder/file`を使用
6. **自動実行**: 頻繁に実行するコマンドには`"autoExecute": true`を設定
7. **パターンマッチング**: 異なるファイルタイプに対して異なるコマンドを作成
8. **ディレクトリ制御**: `quickTerminalCommand.autoChangeDirectory`で作業ディレクトリを制御:
   - `"workspace"` (デフォルト): ワークスペースルートからコマンドを実行
   - `"file"`: 現在のファイルのディレクトリからコマンドを実行
   - `"none"`: 現在のターミナルディレクトリからコマンドを実行

---

## 実験的機能

### 自動ディレクトリ変更（実験的）

`quickTerminalCommand.autoChangeDirectory` の `"auto"` オプションは、コマンドタイプを自動判別して設定ファイルに基づいて適切なディレクトリに変更します。

**サポートされるコマンド:**
- `npm`/`yarn`/`pnpm` → `package.json` を探す
- `pytest` → `pytest.ini`、`pyproject.toml` を探す
- `docker compose` → `docker-compose.yml` を探す
- `make` → `Makefile` を探す
- その他多数...

**注意:** これは実験的機能で変更される可能性があります。予測可能な動作には `"file"`、`"workspace"`、または `"none"` を使用してください。