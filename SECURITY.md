# Security Policy

Pi runs with the permissions of its user. It does not provide a filesystem, process, network, credential, or prompt-injection security boundary; use a container, virtual machine, or sandbox when one is required.

The local account, writable files, environment, shell configuration, Pi configuration, repositories, extensions, skills, hooks, and prompts are trusted inputs. Code loaded into Pi can generally read files, run commands, and access credentials available to Pi. See [FORK.md](FORK.md) for dependency and installation policy.

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

Security boundary bypasses in distributed packages, command-line tools, APIs, repository code, and Earendil-operated `pi.dev` infrastructure are in scope.

## Out Of Scope

- Expected local code execution or lack of sandboxing
- Behavior of user-installed extensions, skills, packages, or tools
- Risks from untrusted repositories or writable local configuration
- Issues caused by untrusted man-in-the-middle proxies
- Public internet exposure of a Pi installation
- Prompt injection attacks
- Exposed secrets that are third-party/user-controlled credentials
- Reports requiring prior modification of user-controlled files, environment, configuration, or symlinks unless Pi grants that access
- Intentionally weakened user configuration
- Resource-exhaustion claims requiring trusted local input or configuration
- Malicious model output
- User-approved or user-initiated local actions presented as vulnerabilities.

## Notes for Reporters

Reports should demonstrate a current, reproducible boundary bypass and its impact. Include the affected path and version or commit, relevant configuration, and a proof of concept against the latest release or `main`. Dependency reports must show that the shipped dependency is affected and reachable through Pi.
