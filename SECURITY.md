# Security Policy

This repository maintains Pi as an agent harness with a conservative security posture. The goal is to keep the fork close to upstream while adding small, explicit hardening layers around dependency management, installation, updates, and extension loading.

Pi is a coding agent that runs locally within the security boundary of the user that is running it. It is the user's responsibility to monitor its operations or to contain it within a container, virtual machine, or other sandbox solution.

Pi treats the local user account and files writable by that account as inside the same trust boundary as the Pi process itself. If an attacker can modify files under the user's home directory, workspace, shell startup files, environment, or Pi configuration, they can generally influence Pi or other local developer tools. Reports that depend on such prior local write access are not security vulnerabilities unless they demonstrate how Pi grants that write access or crosses an operating-system privilege boundary.

Pi relies on users installing trustworthy extensions, loading trustworthy skills, and using pi within trusted repositories. Files like `AGENTS.md` or instructions in comments can prompt-inject the coding agent, and that is expected local-agent behavior rather than a vulnerability by itself.

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

## Reporting a Vulnerability

If you believe you found a security vulnerability in pi or another package in
this repository, please report it privately by either:

- Emailing `security@earendil.com`, or
- Opening a private report through GitHub Security Advisories for this repository

Please include:

- A description of the issue and its impact
- Steps to reproduce, proof of concept, or relevant logs
- Affected package, version, commit, or configuration
- Any known mitigations

Do not open a public issue for security-sensitive reports.  We will review
reports and coordinate disclosure as appropriate.

## Scope

Security issues in the distributed packages, command-line tools, APIs, and
repository code are in scope as well as earendil operated infrastricture
on `pi.dev`.

## Out Of Scope

- Local code execution or sandboxing behavior (the Pi coding agent intentionally does not have a sandbox)
- Behavior of pi extensions or skills installed by the user
- Risks from working in untrusted repositories
- Risks from installing untrusted extensions, skills, packages, or tools
- Isuses caused by non trustworthy MITM proxies
- Public internet exposure of a Pi installation
- Prompt injection attacks
- Exposed secrets that are third-party/user-controlled credentials
- Reports requiring the ability to create, modify, delete, or replace files,
  directories, symlinks, environment variables, shell configuration, or other
  user-controlled local state on the target machine. This includes `~/.pi`,
  `~/.pi/agent/models.json`, workspace files, `AGENTS.md`, skills, extensions,
  extension configuration, dotfiles, and files synchronized through NFS, roaming
  profiles, or dotfile managers, unless the report shows how Pi itself grants
  that access.
- Issues caused by intentionally weakened user configuration.
- Resource/DOS claims that require trusted local input/config against the pi coding agent.
- Reports about malicious model output.
- User-approved or user-initiated local actions presented as vulnerabilities.

## Notes for Reporters

The most useful reports show a current, reproducible security boundary bypass
with demonstrated impact.  Reports that only show expected local-agent behavior,
prompt injection, or a malicious trusted extension/skill are not security
vulnerabilities under this model.

For example, a report showing that malicious contents written to a trusted Pi
configuration file cause Pi to execute commands, load attacker-controlled tools,
send credentials to an attacker-controlled endpoint, or otherwise change behavior
is out of scope.

When possible, include the exact affected path, package version or commit SHA,
configuration, and a proof of concept against the latest release or latest
`main`.  For dependency reports, include evidence that the shipped dependency is
affected and that the issue is reachable through Pi.  For exposed-secret reports,
include evidence that the credential is owned by Earendil or grants access to
Earendil-operated infrastructure or services.
