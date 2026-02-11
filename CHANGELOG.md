# Change Log

All notable changes to the "single-multi-line" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.2.0] - 2025-02-11

### Added

- **Compact Blocks** command (`Ctrl+Alt+B` / `Ctrl+Cmd+B`) — compacts multiple multiline `{ }` blocks into one block per line, preserving indentation and commas.
- SOLID architecture: separated `parser.ts`, `transformer.ts`, `types.ts` modules.
- Unit tests with vitest in `./tests/unit/`.
- ESLint configuration (replacing deprecated tslint).
- `Taskfile.yml` for build, test, package, and publish workflows.
- Support for publishing to both VS Code Marketplace and Eclipse Open VSX.

### Changed

- Forked from [SuperKXT/vscode-ext-single-multi-line](https://github.com/SuperKXT/vscode-ext-single-multi-line).
- Build system switched from plain `tsc` to `esbuild` (faster builds, smaller package).
- TypeScript updated to 5.x, VS Code engine to ^1.85.0.
- Tests moved from `./src/test/` to `./tests/{unit,integration,e2e,bdd}`.
- Updated publisher to `TobiasHochguertel`.

## [0.1.1] - Original

- Initial release by SuperKXT.
