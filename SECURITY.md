# Security Policy

This repository maintains Pi as an agent harness with a conservative security posture. The goal is to keep the fork close to upstream while adding small, explicit hardening layers around dependency management, installation, updates, and extension loading.

## Security Goals

- Keep local changes surgical so upstream can be merged frequently with low conflict risk.
- Prefer policy and configuration over broad rewrites.
- Make installs reproducible from reviewed source and committed lockfiles.
- Treat dependencies, packages, extensions, skills, hooks, and other loaded code as part of the trusted computing base.
- Avoid silent drift from registries, mutable refs, or automatic update behavior.
- Require dependency changes to be intentional, reviewable, and easy to audit.

## Threat Model

Pi is an agent harness. Anything that can load code into the harness can potentially read files, run commands, access credentials available to the process, or influence agent behavior.

Important risks include:

- Compromised package registry releases.
- Install-time lifecycle scripts.
- Unpinned dependency ranges that resolve to new code without review.
- Mutable git refs such as branches and tags.
- Malicious or compromised Pi packages, extensions, hooks, prompt templates, and skills.
- Automatic self-update or package-update paths that bypass review.
- Prompt or tool abuse that causes the agent to install or execute unreviewed code.

## Dependency Principles

- Use Bun for JavaScript dependency installation and lockfile management.
- Commit and respect `bun.lock`.
- Prefer exact direct dependency versions.
- Avoid adding dependencies unless they provide clear value and have been reviewed.
- Avoid lifecycle scripts by default. Only trust a package script when the package and reason are reviewed.
- Use overrides or resolutions only as explicit policy decisions.
- Do not update dependencies opportunistically. Update for a clear reason such as a security fix, compatibility fix, or deliberate feature need.

## Installation Principles

- Prefer installing Pi from reviewed source in this repository.
- If installing from git, prefer a full commit SHA over a branch or tag.
- Avoid global registry installs for the primary trusted Pi installation.
- Build and run from reproducible inputs where possible.
- Self-update paths should not replace reviewed source with unreviewed registry output.

## Source Checkout Installation

The preferred trusted install path is a reviewed source checkout:

```bash
bun run install:local-pi
```

The script performs a frozen Bun install, builds the Pi workspaces, registers the local coding-agent package with `bun link`, and installs the global `pi` binary as `@redthing1/pi-coding-agent` from that local link. It avoids a registry install for Pi.

For a GitHub-hosted fork, clone the repository, check out a reviewed full commit SHA, then run the same command from the repository root:

```bash
git clone <fork-url> pi-mono
cd pi-mono
git checkout <full-commit-sha>
bun run install:local-pi
```

## Package And Extension Principles

Pi packages and extensions are executable code. Installing one should be treated like adding a dependency to the harness itself.

- Prefer local packages or reviewed git sources pinned to commit SHAs.
- Avoid unpinned registry packages.
- Avoid `latest` and other moving tags.
- Disable or reject automatic installation of missing packages in hardened workflows.
- Review package manifests, lifecycle scripts, dependency changes, and loaded entry points before enabling a package.
- Keep project-local packages preferred over global packages where isolation is useful.

## Update Principles

- Pull upstream frequently, but keep hardening changes isolated.
- Review upstream dependency and installer changes before adopting them.
- Keep security policy changes separate from unrelated feature work.
- Use small commits that separate policy, implementation, documentation, and lockfile updates when possible.
- Do not preserve backwards compatibility when it conflicts with the hardening policy unless explicitly required.

## Reporting Security Issues

Do not disclose suspected vulnerabilities publicly before maintainers have had a reasonable opportunity to investigate and respond. Report issues through the repository's preferred private security channel when available.

Include enough detail to reproduce the issue, but do not include secrets, credentials, private tokens, or unrelated system information.
