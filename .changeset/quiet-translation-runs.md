---
"@p6t/cli": minor
---

Make translation runs quiet and inspectable in agents and CI, without spinner redraws burying the result.

`p6t translate` now supports `--quiet` / `-q`, `--no-progress`, and `--json`. Progress is automatically disabled when stdout is not a TTY. Plain output gives concise per-file summaries; JSON reports pending, translated, missing, failed, and removed counts plus errors, without mixing in progress or raw model responses.

Incomplete translations now exit nonzero when groups fail or the model omits results, so CI can distinguish a complete run from one that still needs attention. Existing automation that relied on a successful exit despite partial results must handle this change.
