# Fork Policy

This private fork stays close to upstream while enforcing reproducible source builds and a strict supply-chain boundary. This is the authoritative fork-specific policy.

## Upstream discipline

- Merge upstream frequently. Keep fork changes small, isolated, and easy to review.
- Treat deliberate fork behavior as a requirement, not as disposable patch content. Preserve it unless upstream now provides an equivalent outcome or the user explicitly agrees to change or remove it.
- Preserve outcomes rather than old implementations. When upstream refactors an affected system, understand the fork feature and adapt it cleanly to the new architecture with the smallest practical delta.
- Textual conflicts are not the only risk: cleanly merged upstream changes can also alter fork behavior. Identify affected features before finalizing an integration, and discuss ambiguous tradeoffs with the user.
- Prefer narrow configuration and focused adaptations over broad rewrites, fork-only abstractions, compatibility shims, or preserving obsolete structure.
- Treat upstream as untrusted at the supply-chain boundary. Revalidate dependency, installation, update, package-loading, automation, and security-policy changes independently.
- Verify preserved behavior with stable positive contract tests. Do not add issue-specific regression tombstones by default.

## Supply-chain boundary

- Pi runtime must never acquire or execute package code outside the reviewed source or release artifact. Registry, Git, URL, automatic package installation, and self-update paths stay disabled.
- Pi packages and extensions must be already-present local paths with their runtime dependencies bundled or vendored.
- Treat manifests and `bun.lock` as reviewed code. Pin direct external dependencies exactly and pin Git dependencies to full commit SHAs.
- Keep Bun's seven-day dependency cooldown and exact-version policy in `bunfig.toml`.
- Do not run dependency lifecycle scripts. Do not use ad hoc package runners, remote installers, or setup scripts.
- Add or update a dependency only for a specific reviewed reason; update `bun.lock` intentionally and inspect the complete diff.

## Fresh-clone installation

`bun run install:local-pi` is the supported source-install path. It must:

1. Hydrate only the graph committed in `bun.lock`, with lifecycle scripts disabled.
2. Build the checkout without generating code from unreviewed package sources.
3. Link the built local CLI directly, without resolving a registry package.

Fresh-clone dependency hydration may download the exact artifacts named by `bun.lock`; Pi runtime may not download or install packages. `bun run check:pinned-deps` and `bun run check:local-pi-install` enforce these invariants and must remain part of `bun run check`.

## Zero data retention

`pi --zdr` is fail-closed privacy mode:

- Keep the session in memory; do not persist, resume, import, export, share, or debug it.
- Send requests only to models explicitly approved with `zdr: true`, including an explicit OpenRouter ZDR route. Never fall back to an unapproved model.

ZDR approval is an explicit operator assertion, not provider-policy discovery. Verify the provider agreement and route before marking a provider or model as ZDR. `--zdr-client` and `--no-session` provide only local ephemeral sessions and make no remote-retention claim. See [the model configuration guide](packages/coding-agent/docs/models.md#zero-data-retention) for configuration.
