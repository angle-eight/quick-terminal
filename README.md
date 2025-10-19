# Quick Terminal

A VS Code extension for quick terminal command input with smart placeholders, command history, and flexible execution options.

**[日本語版 README](README.ja.md) | [English README](README.md)**

## Features

- **Quick Terminal Input**: Open an input box to quickly type and execute terminal commands
- **Smart Placeholders**: Use placeholders like `{filename}`, `{dirname}`, etc. with automatic path handling
- **Command History**: Navigate through previous commands with arrow keys
- **Auto Directory Change**: Automatically cd to the current file's directory (configurable)
- **Flexible Command Templates**: Support for pattern matching and auto-execution

## Default Keybindings

- `Ctrl+Alt+I`: Open terminal input box
- `↑` / `↓`: Navigate command history (when input box is active)

## Commands

- `Quick Terminal: Input to Terminal` - Open input box for terminal command
- `Quick Terminal: Paste Command to InputBox` - Paste predefined command to active input box
- `Quick Terminal: Input to Terminal with Pasted Command` - Open input box with predefined command
- `Quick Terminal: Previous Command in History` - Navigate to previous command
- `Quick Terminal: Next Command in History` - Navigate to next command

## Placeholders

Quick Terminal supports various placeholders that are automatically replaced with actual values:

### Basic Placeholders

- `{filename}` - Current file name with extension (e.g., "my script.py")
- `{filestem}` - File name without extension (e.g., "script")
- `{filepath}` - Full path to current file
- `{fileext}` - File extension (e.g., ".py")
- `{dirname}` - Directory containing current file
- `{relativepath}` - File path relative to workspace
- `{workspace}` - Workspace root path
- `{workspacename}` - Workspace folder name

### Smart Path Handling

Placeholders automatically handle spaces and special characters in paths:

```bash
# Single placeholder usage (automatically quoted)
python {filename}                    # → python "my script.py"
cd {dirname}                        # → cd "/path/to/project"

# Path concatenation (automatically combines and quotes)
cat {dirname}/config.txt            # → cat "/path/to/project/config.txt"
cp {filename} {workspace}/backup/   # → cp "script.py" "/workspace/backup/"
```

## Configuration

- `quickTerminal.autoChangeDirectory` (boolean, default: true)
  - Automatically change to the current file's directory before executing commands

## Custom Keybindings Examples

Add these to your VS Code keybindings.json for enhanced functionality:

### Basic Command Templates

```json
{
  "command": "quick-terminal.pasteCommand",
  "key": "ctrl+l",
  "when": "quickTerminal.inputBoxActive",
  "args": "ls -la {dirname}"
}
```

### Auto-Execute Commands

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

### Pattern-Based Commands

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
      "command": "echo 'No test command for {filename}'"
    }
  ]
}
```

### Input with Predefined Commands

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

## Use Cases

### Development Workflows

```bash
# Run current file
python {filename}
node {filename}
npx ts-node {filename}

# Run tests
python -m pytest {filename}
npm test
jest {filename}

# File operations
cat {filename}
cp {filename} {dirname}/backup/
mv {filename} {dirname}/archive/

# Build and deployment
docker build -t myapp {dirname}
rsync -av {dirname}/ user@server:/path/
```

### Configuration Files

```bash
# Edit configuration files
code {dirname}/config.json
vim {workspace}/.env
cat {dirname}/requirements.txt
```

### Log and Debugging

```bash
# View logs
tail -f {workspace}/logs/app.log
grep -r "ERROR" {dirname}
find {workspace} -name "*.log"
```

## Smart Terminal Selection

Quick Terminal automatically detects when terminals might be busy and creates new ones when needed. It recognizes common development server patterns:

- `npm run dev`, `yarn dev`
- `docker compose up`
- `uvicorn`, `fastapi`, `django runserver`
- `jupyter lab`, `streamlit run`
- And many more...

## Tips and Tricks

1. **Command History**: Use `↑` and `↓` arrows to navigate through your command history
2. **Path Concatenation**: Use `{dirname}/subfolder/file` for safe path joining
3. **Auto-Execute**: Set `"autoExecute": true` for commands you run frequently
4. **Pattern Matching**: Create different commands for different file types
5. **Disable Auto-CD**: Set `quickTerminal.autoChangeDirectory: false` if you prefer working from workspace root

## Requirements

- VS Code 1.105.0 or higher

## Known Issues

None currently known. Please report issues on GitHub.

## Release Notes

### 0.0.1

- Initial release
- Basic terminal input functionality
- Smart placeholder system with automatic path handling
- Command history navigation
- Auto directory changing (configurable)
- Intelligent terminal selection
- Support for command templates and pattern matching
- Auto-execution capability

## Contributing

Found a bug or have a feature request? Please open an issue on GitHub.

## License

This extension is licensed under the MIT License.

**Enjoy!**
