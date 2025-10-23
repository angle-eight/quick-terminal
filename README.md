# Quick Terminal Command

A VS Code extension for quick terminal command input with placeholders and command history.

**[日本語版 README](README.ja.md) | [English README](README.md)**

## Basic Usage

1. Press `Ctrl+Alt+I` to open the terminal input box
2. Type a command using placeholders like `{fileBasename}` or `{dir}`
3. Press Enter to execute

## Keybindings

- `Ctrl+Alt+I`: Open terminal input box
- `↑` / `↓`: Navigate command history
- `Ctrl+R`: Search command history
- `Tab`: Select search result
- `Esc`: Exit search mode

## Placeholders

Placeholders are automatically replaced with actual values when executing commands.

### File Placeholders

- `{file}` - Full path to current file
- `{fileBasename}` - Current file name with extension
- `{fileBasenameNoExtension}` - Current file name without extension
- `{fileDirname}` - Directory containing current file
- `{dir}` - Short alias for `{fileDirname}` (convenient for paths)
- `{fileExtname}` - File extension (e.g., `.py`, `.js`)
- `{selectedText}` - Currently selected text
- `{lineNumber}` - Current cursor line number
- `{columnNumber}` - Current cursor column number

### Workspace Placeholders

- `{workspaceFolder}` - Workspace root path
- `{workspaceFolderBasename}` - Workspace folder name

### System Placeholders

- `{userHome}` - User home directory
- `{cwd}` - Current working directory
- `{pathSeparator}` - Path separator for current OS
- `{env:VAR_NAME}` - Environment variable
- `{config:setting.name}` - VS Code configuration value
- `{pythonPath}` - Active Python interpreter path

### Examples

```bash
python {file}
cd {dir}
cp {fileBasename} backup/
echo "Current selection: {selectedText}"
{pythonPath} -m pytest {dir}/test_{fileBasenameNoExtension}.py
```
## Configuration

- `quickTerminalCommand.autoChangeDirectory` (default: "workspace")
  - `"none"`: Do not change directory
  - `"file"`: Change to current file's directory
  - `"workspace"`: Change to workspace root directory
```

## Configuration Format

The extension supports two main configuration styles:

### Simple Command Style
For straightforward command execution:
```json
{
  "cmd": "npm test",
  "autoExecute": true
}
```

### Rule-Based Style
For file type-specific commands:
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

### Configuration Properties

- **`cmd`** (string, optional): Direct command to execute
- **`rules`** (array, optional): Array of file pattern-based rules
- **`autoExecute`** (boolean, optional): Auto-execute command without showing input box (default: `false`)

**Note**: You must specify either `cmd` or `rules` (or both, where `cmd` takes precedence).

### Rule Properties

- **`filePattern`** (string): Glob pattern to match filenames (e.g., `"*.py"`, `"test_*.js"`, `"*"`)
- **`cmd`** (string): Command to execute when pattern matches

## Extension Settings

- `quickTerminalCommand.autoChangeDirectory` (string, default: "workspace")
  - Controls directory changing behavior before executing commands
  - Options:
    - `"none"`: Do not change directory
    - `"file"`: Change to current file's directory
    - `"workspace"`: Change to workspace root directory (default)

- `quickTerminalCommand.shell` (string, default: "")
  - Shell executable path for quick terminal
  - Leave empty to use VS Code's default terminal shell
  - Examples:
    - Linux/Mac: `/bin/zsh`, `/bin/bash`, `/bin/fish`
    - Windows: `pwsh`, `powershell`, `cmd`

- `quickTerminalCommand.shellArgs` (array of strings, default: [])
  - Shell arguments for quick terminal
  - Only used when `quickTerminalCommand.shell` is specified
  - Examples:
    - For Zsh: `["-l", "-i"]` (login shell, interactive mode)
    - For Bash: `["--login", "-i"]`
    - For PowerShell: `["-NoLogo", "-NoProfile"]`

## Custom Keybindings Examples

Add these to your VS Code keybindings.json for enhanced functionality:

**Note**: Use the `when` condition `"quickTerminalCommand.inputBoxActive"` to ensure keybindings only work when the Quick Terminal input box is active. This prevents conflicts with other VS Code functionality.

### Simple Command Execution

Execute a simple command directly:

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

### Editable Command Template

Show command in input box for editing before execution:

```json
{
  "key": "ctrl+l",
  "command": "quick-terminal-command.pasteCommand",
  "when": "quickTerminalCommand.inputBoxActive",
  "args": {
    "cmd": "ls -la {dir}"
  }
}
```

### File Pattern-Based Commands

Execute different commands based on file type:

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
        "cmd": "echo 'No command available for {fileBasename}'"
      }
    ],
    "autoExecute": true
  }
}
```

### Advanced Example: Mixed Usage

You can combine simple commands with pattern-based rules by using different keybindings:

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

## Use Cases

### Development Workflows

```bash
# Run current file
python {file}
node {file}
npx ts-node {file}

# Run tests
python -m pytest {fileBasename}
npm test
jest {fileBasename}

# File operations
cat {fileBasename}
cp {fileBasename} {dir}/backup/
mv {fileBasename} {dir}/archive/

# Build and deployment
docker build -t myapp {dir}
rsync -av {dir}/ user@server:/path/
```

### Configuration Files

```bash
# Edit configuration files
code {dir}/config.json
vim {workspaceFolder}/.env
cat {dir}/requirements.txt
```

### Log and Debugging

```bash
# View logs
tail -f {workspaceFolder}/logs/app.log
grep -r "ERROR" {dir}
find {workspaceFolder} -name "*.log"
```

## Smart Terminal Selection

Quick Terminal uses a dedicated terminal named "q-terminal" for all command executions. This provides consistent and predictable behavior:

- **Dedicated Terminal**: Always uses or creates a terminal named "q-terminal"
- **Automatic Creation**: If no "q-terminal" exists, creates a new one and displays it
- **Custom Shell Support**: Uses configured shell from `quickTerminalCommand.shell` and `quickTerminalCommand.shellArgs` settings
- **Process Isolation**: Long-running processes (like `npm run dev`) that rename terminals won't interfere with quick commands
- **Consistent History**: All quick commands are executed in the same terminal, making it easy to track command history

When you run commands like `npm run dev`, VS Code typically renames the terminal (e.g., to "npm: dev"). Since this terminal no longer has the name "q-terminal", the extension will create a new "q-terminal" for subsequent quick commands, keeping your development servers separate from quick command execution.

### Shell Configuration

You can customize the shell used by Quick Terminal independently of VS Code's default terminal settings:

```json
{
  "quickTerminalCommand.shell": "/bin/zsh",
  "quickTerminalCommand.shellArgs": ["-l", "-i"]
}
```

This allows you to:
- Use a different shell for Quick Terminal commands than your regular terminal
- Set specific shell options that are optimal for command execution
- Maintain consistency across different workspaces or team environments

## Tips and Tricks

1. **Command History**: Use `↑` and `↓` arrows to navigate through your command history
2. **Incremental Search**: Use `Ctrl+R` to quickly find commands by typing partial matches
3. **Search and Edit**: Use `Tab` to select a search result, then edit before executing
4. **Multiple Search Terms**: Search works with any part of the command (e.g., search "fix" to find "git commit -m 'fix bug'")
5. **Path Concatenation**: Use `{dirname}/subfolder/file` for safe path joining
6. **Auto-Execute**: Set `"autoExecute": true` for commands you run frequently
7. **Pattern Matching**: Create different commands for different file types
8. **Directory Control**: Use `quickTerminalCommand.autoChangeDirectory` to control working directory:
   - `"workspace"` (default): Commands run from workspace root
   - `"file"`: Commands run from current file's directory
   - `"none"`: Commands run from current terminal directory



---

## Experimental Features

### Auto Directory Change (Experimental)

The `"auto"` option for `quickTerminalCommand.autoChangeDirectory` automatically detects the command type and changes to the appropriate directory based on configuration files.

**Supported Commands:**
- `npm`/`yarn`/`pnpm` → looks for `package.json`
- `pytest` → looks for `pytest.ini`, `pyproject.toml`
- `docker compose` → looks for `docker-compose.yml`
- `make` → looks for `Makefile`
- And many others...

**Note:** This is experimental and may change. Use `"file"`, `"workspace"`, or `"none"` for predictable behavior.
