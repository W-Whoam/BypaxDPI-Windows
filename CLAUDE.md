# CLAUDE.md

## 0. Critical Working Rules (read first, never skip)

These four rules override convenience. They exist so that work survives a
context reset and so that a fresh session is productive immediately.

### 0.1 `.context/` is the source of truth for technical facts

The [`.context/`](./.context/) directory holds version-pinned research reports
(block-breaking hardness, vanilla feedback effects, similar-plugin prior art,
PaperMC plugin best practices, anti-cheat integration, and more).

- **Before doing any work on a subsystem, list `.context/` and read the
  report(s) relevant to that subsystem.** They contain the exact, current API
  names, version facts, and design decisions for this project.
- **Treat `.context/` as authoritative over your training data.** When a
  `.context/` report and your memory disagree, the report wins.
- When you discover a new technical fact worth keeping (an API quirk, a version
  detail, a resolved design question), **write it into the relevant `.context/`
  report** so the next session has it.
- If a needed fact is in neither `.context/` nor the live docs, say so and ask —
  do not guess an API.

### 0.2 Read the related files every time, before editing

Never edit from memory. Before changing any code or doc:

1. Re-read the **source files** you are about to touch.
2. Re-read the relevant **`.context/`** report(s).
3. Re-read the relevant **root doc(s)** (`ARCHITECTURE.md`, etc.). This costs
   tokens but prevents the far more expensive mistake of editing a stale mental
   model. If a file is large, read the relevant section, not the whole thing.

### 0.3 Document every step in the files

After every meaningful change, update the docs in the same session, before
moving on:

- **`CHANGELOG.md`** — what changed (version-based, structured).
- **`HISTORY.md`** — _why_, for any non-obvious decision or milestone.
- **`ARCHITECTURE.md`** — if you changed design, data shape, or workflow.
- **`.context/`** — if you learned a reusable technical fact. A change that
  isn't written down does not exist for the next session. Prefer small, frequent
  doc updates over one big one at the end.

### 0.4 Short sessions, context in docs, reset often

This project uses a deliberate workflow: **short chats, context carried by the
docs, frequent context resets to save tokens.** Work accordingly:

- Assume the chat will be reset soon. Leave the repo in a state where a fresh
  session, reading only the files, can continue without the chat history.
- Don't rely on anything said earlier in the conversation that isn't also
  written in a file.
- When you finish a unit of work, make sure the docs reflect it, then it is safe
  to reset.

### 0.5 Use git for version control

All changes must be committed to git with clear, atomic commits:

- **Commit frequently and atomically.** Each commit should represent one logical
  unit of work (e.g. "update CHANGELOG for v0.2.0", "add proxy logic"). Never
  mix unrelated changes in one commit.
- **Write clear commit messages.** Use the format `type: brief summary` (e.g.
  `feat: add captcha wait penalty`, `docs: update ARCHITECTURE section`).
  Include context in the message body if the change is non-obvious.
- **Commit docs alongside code.** When you change implementation, update
  `CHANGELOG.md`, `HISTORY.md`, or `ARCHITECTURE.md` in the same commit (or
  immediately following). Do not leave docs stale.
- **Push after every meaningful unit of work.** A feature, bugfix, or doc update
  should be pushed so it survives a context reset and is visible to other team
  members immediately.
- **The repo state on git is the source of truth for the team.** Code that is
  not committed does not exist for the next session or teammate. Always assume
  the next action is `git pull` and a fresh `claude` session.

### Required root-level files (reference)

| File                 | Purpose                                                                           | May split into                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`          | Entry point — 4-part structure above                                              | —                                                                                                                                                                                                           |
| `SUMMARY.md`         | Handbook; explains the project to users in narrative form                         | —                                                                                                                                                                                                           |
| `CHANGELOG.md`       | Version-based structured change log                                               | —                                                                                                                                                                                                           |
| `HISTORY.md`         | Narrative of important decisions and milestones                                   | `RATIONALE.md`                                                                                                                                                                                              |
| `GLOSSARY.md`        | Project terms/abbreviations; each term a heading so it can be linked              | —                                                                                                                                                                                                           |
| `FAQ.md`             | Frequently asked questions; short answers with links                              | —                                                                                                                                                                                                           |
| `MANIFESTO.md`       | Beliefs, goals, principles, values                                                | `SCOPE.md`, `MISSION.md`, `VISION.md`, `VALUES.md`                                                                                                                                                          |
| `ROADMAP.md`         | Future-facing planned features only (no past)                                     | —                                                                                                                                                                                                           |
| `GOVERNANCE.md`      | Roles, authorization, decision/approval workflows, reporting                      | `ROLES.md`, `MAINTAINERS.md`, `AUTHORS.md`, `ACKNOWLEDGEMENTS.md`, `POLICY.md`, `INCIDENT.md`, `REVIEW.md`, `APPROVAL.md`, `ROLLBACK.md`, `OFFBOARDING.md`, `REPORT.md`, `ASSESSMENT.md`                    |
| `CODE_OF_CONDUCT.md` | Social rules, ethics, privacy; onboarding reading                                 | `ETHICS.md`, `PRIVACY.md`, `ONBOARDING.md`                                                                                                                                                                  |
| `CONTRIBUTING.md`    | Contribution types, workflow, review expectations                                 | —                                                                                                                                                                                                           |
| `COMPLIANCE.md`      | Minimum compliance requirements and conformance levels                            | `REQUIREMENTS.md`                                                                                                                                                                                           |
| `LICENSE`            | License — no `.md` extension                                                      | —                                                                                                                                                                                                           |
| `LEGAL.md`           | Liability limits, notices, third-party attributions                               | `DISCLAIMER.md`, `NOTICE.md`, `REFERENCES.md`                                                                                                                                                               |
| `ARCHITECTURE.md`    | System design, component relations, schemas, workflows, configuration, deployment | `DESIGN.md`, `PROCESS.md`, `WORKFLOW.md`, `LIFECYCLE.md`, `SCHEMA.md`, `API.md`, `CHECKLIST.md`, `INTEGRATIONS.md`, `CONFIGURATION.md`, `DEPENDENCIES.md`, `DEPLOYMENT.md`, `MIGRATION.md`, `VERSIONING.md` |
| `PERFORMANCE.md`     | Performance expectations, benchmarks, measurement methods                         | `BENCHMARKS.md`                                                                                                                                                                                             |
| `SECURITY.md`        | Threat model, access control, auth, encryption, audit, data handling              | `THREAT-MODEL.md`, `ACCESS-CONTROL.md`, `AUTHENTICATION.md`, `AUTHORIZATION.md`, `ENCRYPTION.md`, `AUDIT.md`, `DATA-HANDLING.md`                                                                            |
| `AGENTS.md`          | Guidance for AI coding agents (this `CLAUDE.md` is filed under it)                | `CONTEXT.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`                                                                                                                                                      |

> Note: `.context/` (research reports for AI work) is distinct from the
> regulation docs above. `.context/` is working fuel for coding sessions; the
> root docs are the project's permanent record. Keep both current.
