# Contributing to Pi

Pi's core is minimal. Features that do not belong in the core should be extensions, and new extension hooks must justify their maintenance cost.

## Requirements

- Understand and be able to explain the change and its interactions.
- Follow the centralized [fork policy](FORK.md) and the operational rules in [AGENTS.md](AGENTS.md).
- Keep changes concise, focused, and easy to integrate with upstream.
- Prefer stable positive tests over issue-specific regression tests.

Issues should be short, concrete, reproducible, and explain why they matter. Do not submit unreviewed agent-generated output.

Before submitting a pull request, run:

```bash
bun run check
./test.sh
```

Do not edit released changelog sections. Maintainers curate changelog entries under each package's `[Unreleased]` section.
