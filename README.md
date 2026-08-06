# Pi Agent Harness

This is a private fork of [Pi](https://github.com/badlogic/pi-mono), a minimal, extensible coding-agent harness. The fork stays close to upstream while maintaining stricter dependency, installation, package-loading, and zero-data-retention guarantees.

## Packages

| Package | Description |
|---------|-------------|
| [@earendil-works/pi-telemetry](packages/telemetry) | Vendor-neutral telemetry contracts and typed schema utilities |
| [@earendil-works/pi-ai](packages/ai) | Unified multi-provider LLM API |
| [@earendil-works/pi-agent-core](packages/agent) | Agent runtime and tool calling |
| [@earendil-works/pi-coding-agent](packages/coding-agent) | Interactive coding-agent CLI |
| [@earendil-works/pi-tui](packages/tui) | Terminal UI library |

## Development

```bash
bun run install:local-pi  # Hydrate, build, and link Pi from a fresh clone
bun run check             # Lint, format, and type check
./test.sh                 # Run the test suite
./pi-test.sh              # Run Pi from source
```

`bun run check` requires the packages to be built first.

## Policy and documentation

- [FORK.md](FORK.md): authoritative fork, upstream-integration, supply-chain, and ZDR policy
- [SECURITY.md](SECURITY.md): security boundary and vulnerability reporting
- [AGENTS.md](AGENTS.md): operational rules for development agents
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution requirements
- [packages/coding-agent/docs](packages/coding-agent/docs/index.md): user documentation

Pi runs with the permissions of its process and has no built-in sandbox. See [containerization](packages/coding-agent/docs/containerization.md) when stronger isolation is required.

## License

MIT
