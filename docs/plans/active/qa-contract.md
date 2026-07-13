# Scaffold QA contract

**Date:** 2026-07-13 · **Issue:** #158 · **Status:** implemented in v5.1.0

`book-scaffold qa` is the standard content-health adapter for scaffold books.
It composes existing validation with stable MDX metrics and emits a CI-safe
verdict. It does not become a general shell-task runner: the portfolio-level QA
engine may execute `check_cmd` entries, while this package owns the book-aware
check those entries call.

## Commands

```text
book-scaffold qa [--book <id> | --all] [--format human|json]
book-scaffold init-qa [--force]
```

- `qa` defaults to every registered corpus book, or the one implicit book in a
  single-book project.
- `--book` accepts exactly one registered corpus id. It is invalid in
  single-book mode.
- `--all` is an explicit synonym for the default and is mutually exclusive
  with `--book`.
- `--format human` is the interactive default. `--format json` writes only the
  versioned result document to stdout; progress and fatal diagnostics go to
  stderr.
- `--json` remains a convenience alias for `--format json`.
- `init-qa` creates `guide_qa.yaml`, refuses to overwrite an existing file, and
  makes the same deterministic output on every run. `--force` authorizes only
  replacing that file.

## Check model

The command runs these scaffold-owned checks per selected book:

| Check | Value | Blocking rule |
|---|---|---|
| `content_contract` | existing `validate` diagnostics | zero errors |
| `chapters` | total, non-draft, and draft counts | at least one non-draft chapter |
| `links` | checked internal links and broken targets/fragments | zero broken links |
| `learning_objectives` | declared objectives and resolved prose anchors | 100% when the profile exposes objectives; otherwise `not_applicable` |
| `components` | deterministic counts by scaffold MDX component name | informational |
| `demo_fixtures` | discovered JSON fixtures and parse/schema failures | zero invalid fixtures; `not_applicable` when none exist |

`content_contract` calls the same library code as `validate`; it does not spawn
a second CLI with subtly different config resolution. #147 and #190
diagnostics flow through this check when those releases are installed.

Component counts are facts, not quality scores. The scaffold does not claim
that a chapter needs a particular number of citations, figures, demos, or
callouts across all five presets. New blocking metrics require an issue with
consumer evidence and a schema-version review.

Demo fixtures are non-generated JSON under `src/data/`. Known scaffold outputs
such as `labels.json`, `references.json`, `tips.json`, and `exercises.json` are
excluded. In a corpus, `src/data/<book>/` belongs to that book; JSON outside a
registered book directory is checked once as corpus-shared data and can make
only the corpus verdict red. `qa` verifies JSON syntax and a referenced JSON
Schema when `$schema` is present; it does not run consumer simulation kernels.
Schema v1 supports draft-07 (the default when `$schema` is absent), 2019-09,
and 2020-12. Recursive references must resolve to files inside the project after
symlink resolution, mixed/unsupported dialects are rejected, network schemas
are never fetched, and `format` remains annotation-only.

The link inventory covers internal targets authored in chapter Markdown/MDX.
Resolved scaffold toggles, Astro page routes, and public files establish route
existence. A fragment whose render semantics depend on a consumer-defined MDX
component or a known non-chapter route is an explicit amber
`fragment_unverified` advisory rather than a fabricated pass or blocking miss.

## Verdicts and exit codes

Each check and book has one traffic-light state:

- `green`: applicable and all blocking rules pass;
- `amber`: blocking rules pass but one or more advisory diagnostics exist;
- `red`: at least one blocking rule fails;
- `not_applicable`: the profile/content does not expose that metric.

The book verdict is the worst applicable check. The corpus verdict is the worst
selected book or the corpus-shared aggregate; it never replaces the individual
book results. In single-book mode the shared aggregate is explicitly
`not_applicable`.

| Exit | Meaning |
|---|---|
| `0` | no blocking failures (`green` or `amber`) |
| `1` | at least one selected book is `red` |
| `2` | invalid invocation, unresolved config, malformed manifest, or internal execution failure |

Advisories remain visible but do not make CI fail. Signals and termination map
to the platform's conventional non-contract exit status rather than being
reclassified as content failure.

## Human output

Human output starts with the resolved preset and selected scope, then prints
one compact table per book followed by the explicit corpus verdict. Every
diagnostic includes its source path and line when available. Color is used only
when the terminal supports it and never carries meaning without a text label.
When corpus-shared fixture data is applicable, a separate `shared` block
appears after the books and before the corpus verdict.

Example shape:

```text
evaluation              GREEN
  content_contract      GREEN   0 errors, 2 advisories
  chapters              GREEN   14 ready, 1 draft
  links                  GREEN   186 checked
  learning_objectives   GREEN   31/31 anchors
  components             GREEN   Figure 18, Cite 42, DemoFrame 3
  demo_fixtures          N/A     none discovered

corpus                   GREEN   2 books checked
```

## JSON output

The top-level shape is stable and versioned:

```json
{
  "schemaVersion": 1,
  "preset": "research-portfolio",
  "scope": { "kind": "corpus", "selected": ["evaluation"] },
  "verdict": "green",
  "books": {
    "evaluation": {
      "verdict": "green",
      "checks": {},
      "diagnostics": []
    }
  },
  "shared": {
    "verdict": "not_applicable",
    "checks": {
      "demo_fixtures": {
        "state": "not_applicable",
        "metrics": {},
        "diagnosticIds": []
      }
    },
    "diagnostics": []
  },
  "summary": {
    "booksChecked": 1,
    "blockingFailures": 0,
    "advisories": 2
  }
}
```

`shared` is always present and has the same aggregate shape as a book result:
`{ verdict, checks, diagnostics }`. It is not a synthetic entry in `books`.
In corpus mode its `checks.demo_fixtures` value uses the normal check payload
`{ state, metrics, diagnosticIds }` for non-generated JSON outside registered
`src/data/<book>/` directories. Shared failures affect the top-level verdict
and summary but never change an individual book verdict. Diagnostics owned by
this aggregate use `book: "corpus"`; registered ids remain reserved for their
individual book results. In single-book mode the exact value is:

```json
{
  "verdict": "not_applicable",
  "checks": {},
  "diagnostics": []
}
```

Check payloads contain `state`, typed `metrics`, and diagnostic ids. Every
diagnostic contains `severity`, `code`, `message`, `book`, and optional
`file`, `line`, and `column`. Object keys and arrays use manifest order plus
stable source ordering so two unchanged runs diff cleanly. Timestamps and
durations are intentionally omitted from stdout JSON.

## `guide_qa.yaml`

`init-qa` emits an interoperability file for the existing portfolio QA engine;
it is not a second corpus manifest and `book-scaffold qa` does not execute its
shell commands.

For a corpus it contains one guide entry per manifest book, in manifest order:

```yaml
# Generated by book-scaffold init-qa.
# Regenerate with: book-scaffold init-qa --force
version: 1
guides:
  - id: evaluation
    check_cmd: npm --offline exec -- book-scaffold qa --book evaluation --format json
  - id: llm-app-engineering
    check_cmd: npm --offline exec -- book-scaffold qa --book llm-app-engineering --format json
```

A single-book project gets one `book` entry whose command omits `--book`.
Generated commands use the locally installed binary and never fetch a package
from the network. The header comment says the file is generated and documents
`init-qa --force`; consumers may add engine-owned presentation fields, but a
subsequent forced regeneration replaces the whole file.

## Profile behavior

All five presets run the universal checks. A metric unavailable in a profile is
`not_applicable`, never a fabricated zero. Profile-specific schema validation
continues to live in `validate`; `qa` reports it rather than maintaining a
second profile rule registry.

Corpus selection, book identity, artifact envelopes, and diagnostic prefixes
come from the #80 contract. That is why implementation follows the corpus core.
The command must still work in single-book mode and cannot require consumers to
adopt a corpus manifest.

## Acceptance gates

Implementation is complete when:

1. every command/selector/exit-code branch has fixture tests;
2. all five presets produce valid human and schema-v1 JSON output;
3. a two-book corpus reports independent counts, a named aggregate, and its
   separate corpus-shared fixture result;
4. one red book makes the corpus red while preserving the green book result;
5. JSON stdout remains parseable with advisories and fatal stderr output;
6. `init-qa` is deterministic, network-free, and overwrite-safe;
7. a generated single-book and corpus fixture run green with no bespoke
   consumer script; and
8. a red shared fixture makes only the corpus aggregate red while every book
   result remains independently attributable.
