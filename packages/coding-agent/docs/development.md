# Development

See [AGENTS.md](https://github.com/earendil-works/pi-mono/blob/main/AGENTS.md) for additional guidelines.

## Setup

```bash
git clone https://github.com/earendil-works/pi-mono
cd pi-mono
bun install
bun run build
```

Run from source:

```bash
/path/to/pi-mono/pi-test.sh
```

The script can be run from any directory. Pi keeps the caller's current working directory.

## Forking / Rebranding

Configure via `package.json`:

```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi"
  }
}
```

Change `name`, `configDir`, and `bin` field for your fork. Affects CLI banner, config paths, and environment variable names.

## Path Resolution

Three execution modes: source install, standalone binary, tsx from source.

**Always use `src/config.ts`** for package assets:

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

Never use `__dirname` directly for package assets.

## Debug Command

`/debug` (hidden) writes to `~/.pi/agent/pi-debug.log`:
- Rendered TUI lines with ANSI codes
- Last messages sent to the LLM

## Testing

```bash
./test.sh                         # Run non-LLM tests (no API keys needed)
bun run test                      # Run all tests
bun ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts # Run specific test from package root
```

## Project Structure

```
packages/
  ai/           # LLM provider abstraction
  agent/        # Agent loop and message types  
  tui/          # Terminal UI components
  coding-agent/ # CLI and interactive mode
```
