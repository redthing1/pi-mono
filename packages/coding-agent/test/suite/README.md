# Coding agent suite tests

Use `test/suite/` for the new harness-based test suite around `AgentSession` and `AgentSessionRuntime`.

Rules:
- Use `test/suite/harness.ts`
- Use the faux provider from `packages/ai/src/providers/faux.ts`
- Do not use real provider APIs, real API keys, network calls, or paid tokens
- Keep these tests CI-safe and deterministic
- Do not use or extend the legacy `test/test-harness.ts` path unless a missing capability forces it

Organization:
- Put broad lifecycle, characterization, and positive contract tests directly under `test/suite/`
- Use `test/suite/regressions/` only when an issue-specific test is genuinely justified; do not create historical tombstones by default
- Name justified regression tests as `<issue-number>-<short-slug>.test.ts`
- Example: `test/suite/regressions/2023-queued-slash-command-followup.test.ts`
