# Quick Terminal

素早くよく使うターミナルコマンド入力をするためのVS Code用の拡張機能です。

**[日本語版 README](README.ja.md) | [English README](README.md)**

## 機能

- **高速ターミナル入力**: 入力ボックスを開いて素早くターミナルコマンドを入力・実行
- **スマートプレースホルダー**: `{filename}`、`{dirname}`等のプレースホルダーを自動パス処理で使用
- **コマンド履歴**: 矢印キーで過去のコマンドをナビゲート
- **自動ディレクトリ変更**: 現在のファイルのディレクトリに自動でcdする機能（設定可能）
- **柔軟なコマンドテンプレート**: パターンマッチングと自動実行をサポート

## デフォルトキーバインド

- `Ctrl+Alt+I`: ターミナル入力ボックスを開く
- `↑` / `↓`: コマンド履歴をナビゲート（入力ボックスがアクティブな時）

## コマンド

- `Quick Terminal: Input to Terminal` - ターミナルコマンド用の入力ボックスを開く
- `Quick Terminal: Paste Command to InputBox` - 事前定義されたコマンドをアクティブな入力ボックスに貼り付け
- `Quick Terminal: Input to Terminal with Pasted Command` - 事前定義されたコマンド付きで入力ボックスを開く
- `Quick Terminal: Previous Command in History` - 前のコマンドに移動
- `Quick Terminal: Next Command in History` - 次のコマンドに移動

## プレースホルダー

Quick Terminalは、実際の値に自動置換される様々なプレースホルダーをサポートしています：

### 基本プレースホルダー

- `{filename}` - 現在のファイル名（拡張子付き）（例：「my script.py」）
- `{filestem}` - ファイル名（拡張子なし）（例：「script」）
- `{filepath}` - 現在のファイルへのフルパス
- `{fileext}` - ファイル拡張子（例：「.py」）
- `{dirname}` - 現在のファイルを含むディレクトリ
- `{relativepath}` - ワークスペースからの相対ファイルパス
- `{workspace}` - ワークスペースのルートパス
- `{workspacename}` - ワークスペースフォルダ名

### スマートパス処理

プレースホルダーはパス内のスペースや特殊文字を自動的に処理します：

```bash
# 単一プレースホルダー使用（自動クォート）
python {filename}                    # → python "my script.py"
cd {dirname}                        # → cd "/path/to/project"

# パス結合（自動結合とクォート）
cat {dirname}/config.txt            # → cat "/path/to/project/config.txt"
cp {filename} {workspace}/backup/   # → cp "script.py" "/workspace/backup/"
```

## 設定

### 拡張機能設定

- `quickTerminal.autoChangeDirectory`（boolean、デフォルト：true）
  - コマンド実行前に現在のファイルのディレクトリに自動的に変更する

## カスタムキーバインドの例

機能を拡張するために、VS Codeのkeybindings.jsonに以下を追加してください：

### 基本コマンドテンプレート

```json
{
  "command": "quick-terminal.pasteCommand",
  "key": "ctrl+l",
  "when": "quickTerminal.inputBoxActive",
  "args": "ls -la {dirname}"
}
```

### 自動実行コマンド

```json
{
  "command": "quick-terminal.pasteCommand",
  "key": "ctrl+alt+l",
  "when": "quickTerminal.inputBoxActive",
  "args": {
    "command": "ls -la {dirname}",
    "autoExecute": true
  }
}
```

### パターンベースコマンド

```json
{
  "command": "quick-terminal.pasteCommand",
  "key": "ctrl+t",
  "when": "quickTerminal.inputBoxActive",
  "args": [
    {
      "pattern": "test*.py",
      "command": "python -m pytest {filename}"
    },
    {
      "pattern": "*.test.ts",
      "command": "npm test"
    },
    {
      "pattern": "*.test.js",
      "command": "npm test"
    },
    {
      "pattern": "*",
      "command": "echo '{filename}用のテストコマンドはありません'"
    }
  ]
}
```

### 事前定義コマンド付き入力

```json
{
  "command": "quick-terminal.inputWithPastedCommand",
  "key": "ctrl+alt+shift+r",
  "when": "editorTextFocus",
  "args": {
    "command": [
      {
        "pattern": "*.py",
        "command": "python {filename}"
      },
      {
        "pattern": "*.js",
        "command": "node {filename}"
      },
      {
        "pattern": "*.ts",
        "command": "npx ts-node {filename}"
      }
    ],
    "autoExecute": false
  }
}
```

## 使用例

### 開発ワークフロー

```bash
# 現在のファイルを実行
python {filename}
node {filename}
npx ts-node {filename}

# テストを実行
python -m pytest {filename}
npm test
jest {filename}

# ファイル操作
cat {filename}
cp {filename} {dirname}/backup/
mv {filename} {dirname}/archive/

# ビルドとデプロイ
docker build -t myapp {dirname}
rsync -av {dirname}/ user@server:/path/
```

### 設定ファイル

```bash
# 設定ファイルを編集
code {dirname}/config.json
vim {workspace}/.env
cat {dirname}/requirements.txt
```

### ログとデバッグ

```bash
# ログを表示
tail -f {workspace}/logs/app.log
grep -r "ERROR" {dirname}
find {workspace} -name "*.log"
```

## スマートターミナル選択

Quick Terminalは、ターミナルがビジー状態の可能性を自動的に検出し、必要に応じて新しいターミナルを作成します。一般的な開発サーバーパターンを認識します：

- `npm run dev`、`yarn dev`
- `docker compose up`
- `uvicorn`、`fastapi`、`django runserver`
- `jupyter lab`、`streamlit run`
- その他多数...

## コツとトリック

1. **コマンド履歴**: `↑` と `↓` の矢印キーでコマンド履歴をナビゲート
2. **パス結合**: 安全なパス結合には `{dirname}/subfolder/file` を使用
3. **自動実行**: 頻繁に実行するコマンドには `"autoExecute": true` を設定
4. **パターンマッチング**: 異なるファイルタイプに対して異なるコマンドを作成
5. **自動CD無効化**: 常にワークスペースルートから作業したい場合は `quickTerminal.autoChangeDirectory: false` を設定

## 要件

- VS Code 1.105.0 以上

## 既知の問題

現在、既知の問題はありません。問題を発見した場合はGitHubで報告してください。

## リリースノート

### 0.0.1

- 初回リリース
- 基本的なターミナル入力機能
- 自動パス処理を備えたスマートプレースホルダーシステム
- コマンド履歴ナビゲーション
- 自動ディレクトリ変更（設定可能）
- インテリジェントなターミナル選択
- コマンドテンプレートとパターンマッチングのサポート
- 自動実行機能

## 貢献

バグを見つけたり、機能リクエストがありましたら、GitHubでIssueを開いてください。

## ライセンス

この拡張機能はMITライセンスの下でライセンスされています。