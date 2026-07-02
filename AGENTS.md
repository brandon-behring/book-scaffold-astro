# AGENTS.md

Cross-tool agent authoring guide. The full content is in [`package/CLAUDE.md`](package/CLAUDE.md) — kept in one file to avoid drift. (There is deliberately no root `CLAUDE.md`; the authoring guide lives with the published package so consumers receive it.)

If your tool reads `AGENTS.md` rather than `CLAUDE.md` (Codex CLI, some others), treat `package/CLAUDE.md` as the canonical authoring guide. The contents are agent-agnostic; nothing in it is Claude-Code-specific.

## Why one file

Per Q10 in the v2.0 decisions ledger, the scaffold ships both `CLAUDE.md` and `AGENTS.md` at root so any agent finds something. Maintaining two parallel files invites drift; the pointer pattern is simpler and matches the precedent set by [`agentprotocol.org`](https://agentprotocol.org)-style cross-tool standards.

If a downstream tool needs an actual file at this path, copy `package/CLAUDE.md` here verbatim. Both should always be the same content.
