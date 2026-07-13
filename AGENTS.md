# AGENTS.md

Cross-tool agent authoring guide. The full content is in [`CLAUDE.md`](CLAUDE.md) at this same path — kept in one file to avoid drift.

If your tool reads `AGENTS.md` rather than `CLAUDE.md` (Codex CLI, some others), treat that file as the canonical authoring guide. The contents are agent-agnostic; nothing in `CLAUDE.md` is Claude-Code-specific.

## Why one file

Per Q10 in the v2.0 decisions ledger, the scaffold ships both `CLAUDE.md` and `AGENTS.md` at root so any agent finds something. Maintaining two parallel files invites drift; the pointer pattern is simpler and matches the precedent set by [`agentprotocol.org`](https://agentprotocol.org)-style cross-tool standards.

If a downstream tool requires the full guide inline at this path, copy
`CLAUDE.md` here verbatim. Otherwise keep this pointer small and edit only the
canonical `CLAUDE.md` content.
