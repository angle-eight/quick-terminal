# Change Log

All notable changes to the "quick-terminal-command" extension will be documented in this file.

## [0.0.5] - 2025-10-24

### Changed
- **BREAKING CHANGE**: Completely redesigned configuration format for better usability
- Old format with nested `command` properties has been replaced with clearer structure
- New simple format: `{"cmd": "command", "autoExecute": true}`
- New rule-based format: `{"rules": [{"filePattern": "*.py", "cmd": "python {file}"}]}`
- Renamed `pattern` to `filePattern` for clarity
- Renamed `command` to `cmd` for brevity
- Removed backward compatibility for old configuration format

### Added
- Flexible configuration supporting both simple commands and file pattern rules
- Better validation and error messages for configuration
- Comprehensive documentation with examples

### Improved
- More intuitive configuration structure
- Clearer property names and structure
- Enhanced README with detailed examples

## [0.0.4] - Previous Release

- Initial release with basic functionality