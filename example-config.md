# 新しい設定形式の例

## シンプルなコマンド指定

単一のコマンドを実行する場合：

```json
{
    "key": "ctrl+t",
    "command": "quick-terminal-command.inputWithPastedCommand",
    "args": {
        "cmd": "npm test",
        "autoExecute": true
    }
}
```

## ファイルパターンベースのルール

ファイルの種類によって異なるコマンドを実行する場合：

```json
{
    "key": "ctrl+t",
    "command": "quick-terminal-command.inputWithPastedCommand",
    "args": {
        "rules": [
            {
                "filePattern": "test_*.py",
                "cmd": "{pythonPath} -m pytest {filename}"
            },
            {
                "filePattern": "*.py",
                "cmd": "{pythonPath} -u {file}"
            },
            {
                "filePattern": "*.rs",
                "cmd": "cd {dir} && rustc {fileName} && {dir}{fileNameWithoutExt}"
            },
            {
                "filePattern": "*.test.ts",
                "cmd": "npm test {file}"
            },
            {
                "filePattern": "*.ts",
                "cmd": "ts-node {file}"
            },
            {
                "filePattern": "*",
                "cmd": "echo '{filename}用のテストコマンドはありません'"
            }
        ],
        "autoExecute": true
    }
}
```

## 設定のポイント

### 必須項目
- `cmd` または `rules` のどちらかを指定する必要があります

### オプション項目
- `autoExecute`: `true`にするとコマンドを自動実行、`false`またはundefineの場合は編集可能な入力ボックスを表示（デフォルト: `false`）

### ファイルパターン
- glob形式で指定（`*`は任意の文字列、`?`は任意の1文字）
- 配列の上から順にチェックされ、最初にマッチしたパターンのコマンドが実行されます
- `*`パターンは最後のフォールバックとして使用できます

### プレースホルダー
利用可能なプレースホルダー：
- `{file}`: ファイルの絶対パス
- `{filename}`: ファイル名（拡張子込み）
- `{fileNameWithoutExt}`: ファイル名（拡張子なし）
- `{dir}`: ディレクトリパス
- `{pythonPath}`: Python実行パス
- その他多数...