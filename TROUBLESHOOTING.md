# トラブルシューティング

このドキュメントでは、Quick Terminal拡張機能で発生する可能性のある問題とその解決方法について説明します。

## 機能の説明

### コマンド履歴の動作
- 最大50個のコマンドを履歴として保存
- 同じコマンドが再実行された場合、古い履歴から削除して最新の位置に移動
- 重複を避けることで、より自然な履歴ナビゲーションを実現

### キーバインド
- `Ctrl+Alt+I`: ターミナルコマンド入力ボックスを開く
- `Alt+Shift+↑` または `Alt+Shift+K`: 前のコマンド
- `Alt+Shift+↓` または `Alt+Shift+J`: 次のコマンド
- `Ctrl+L`: `ls -la {dirname}` をペースト
- `Ctrl+Shift+L`: `cat {relativepath}` をペースト

## 一般的な問題と解決方法

### 1. punycode 廃止警告

**症状:**
```
(node:xxxxx) [DEP0040] DeprecationWarning: The `punycode` module is deprecated.
```

**原因:**
依存関係のパッケージが古いpunycodeモジュールを使用している。

**解決方法:**
- `package.json`に`overrides`セクションを追加済み
- `npm install`を実行して依存関係を更新

### 2. ネットワーク接続エラー

**症状:**
```
HttpError: getaddrinfo ENOTFOUND api.github.com
TypeError: fetch failed
```

**原因:**
- インターネット接続の問題
- プロキシ設定の問題
- ファイアウォールの制限
- GitHub拡張機能の認証問題

**解決方法:**

#### ネットワーク接続の確認
```bash
# DNS解決の確認
nslookup api.github.com

# 接続の確認
curl -I https://api.github.com
```

#### プロキシ設定の確認
```bash
# 環境変数の確認
echo $HTTP_PROXY
echo $HTTPS_PROXY
echo $NO_PROXY

# VS Codeのプロキシ設定
# 設定 > "proxy" で検索 > HTTP Proxyを設定
```

#### GitHub認証の再設定
1. VS Codeでコマンドパレット（Ctrl+Shift+P）を開く
2. "GitHub: Sign out"を実行
3. "GitHub: Sign in"を実行

### 3. 循環参照のJSONシリアライゼーションエラー

**症状:**
```
TypeError: Converting circular structure to JSON
```

**原因:**
VS Codeの内部エラー。通常は一時的な問題。

**解決方法:**
- VS Codeを再起動
- 拡張機能を無効化/有効化
- VS Codeの更新を確認

### 4. 存在しないコマンドのエラー

**症状:**
```
Error: command 'workbench.action.quickInputSelectAll' not found
```

**原因:**
VS Codeに存在しないコマンドを実行しようとしている。

**解決方法:**
- バージョン1.0.1以降では修正済み
- カスタムInputBoxを使用してvalueSelectionプロパティで選択を制御

### 5. SQLite実験的機能警告

**症状:**
```
ExperimentalWarning: SQLite is an experimental feature
```

**原因:**
Node.jsの新しい実験的SQLite機能を使用している拡張機能。

**解決方法:**
- 通常は警告のみで機能に影響なし
- 必要に応じて関連拡張機能を更新

## 追加のデバッグ方法

### 開発者ツールでの確認
1. `Ctrl+Shift+P` → "Developer: Toggle Developer Tools"
2. Consoleタブでエラーメッセージを確認

### 拡張機能のログ確認
1. `Ctrl+Shift+P` → "Developer: Show Logs..."
2. "Extension Host"を選択

### VS Codeの再読み込み
`Ctrl+Shift+P` → "Developer: Reload Window"

## 連絡先

問題が解決しない場合は、以下の情報と共にイシューを報告してください：
- VS Codeのバージョン
- 拡張機能のバージョン
- OS情報
- エラーメッセージの全文
- 再現手順