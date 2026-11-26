# Changelog

Every release of `@skillland/validator`, newest first, with its release date. A version that changes scores says so on its first line. skillland.io shows this file at [skillland.io/validate/changelog](https://skillland.io/validate/changelog).

## 0.6.0 (2026-11-26)

Scoring change: 3 new rules, so some scores in the Skillland index go down when the site updates to this version.

NVIDIA's skill docs are now a source. Its [SkillEvaluator Harness Check](https://docs.nvidia.com/skills/skillevaluator/harness-check) records what Claude Code, Codex and four other agents actually load, cut or drop, so it backs rules that the vendor docs leave unstated.

- New warnings: `byte-order-mark` (`SKILL.md` starts with a UTF-8 byte order mark, which makes Codex drop the skill), `non-string-keys` (unquoted frontmatter keys such as `true:`, `yes:`, `2024:` or a date, which YAML may read as something other than text).
- New suggestion: `claude-only-placeholders` (`$ARGUMENTS`, `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PROJECT_DIR}`, which only Claude Code fills in).
- `frontmatter-invalid-yaml` says "(Codex skips the skill)" when the problem is a duplicate key or tab indentation.
- 24 existing rules add an NVIDIA quote, including `description-listing-too-long` (Codex cuts the listing at 1,024 characters), `body-too-many-tokens` (Codex's ~10K-token read through the shell) and `side-effects-auto-invoke` (Codex ignores `disable-model-invocation`).
- `npm run check-quotes` reads docs.nvidia.com pages as Markdown.

## 0.5.0 (2026-11-26)

Scoring change: 14 new Security rules, so some scores in the Skillland index go down when the site updates to this version.

The checks from the skillland.io security scan now live here, each with an official quote, so the scan page and the grades use the same rules. Most quotes come from Anthropic's [Skills for enterprise](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/enterprise) guide (its risk table and review checklist) and the [OWASP Agentic Skills Top 10](https://github.com/OWASP/www-project-agentic-skills-top-10).

- New severity `note`: a fact to review, not a fault. It costs no points and counts as neither passed nor failed. Note rules that found something are listed in the new `Report.noted`.
- New errors: `hidden-characters` (Unicode tag characters, bidi controls, runs of zero-width characters), `unsafe-yaml-tag` (`!!python/object` and other code-running YAML tags in the frontmatter).
- New warnings: `instruction-manipulation` ("ignore previous instructions", "don't tell the user."), `permission-bypass` (`--dangerously-skip-permissions`, `danger-full-access`, `--yolo` and similar, unless the file says it runs in a container or VM), `secrets-and-network` (one file reads a credential file and calls the network), `encoded-payload` (decode-then-run code, long base64 or hex payloads), `plain-http-download` (downloads over `http://` from public hosts).
- New suggestions: `skill-hooks` (`hooks` in the frontmatter), `credential-files`, `system-changes` (shell startup files, agent settings, scheduled jobs, recursive deletes of `/` or `~`), `mutable-download` (`releases/latest` and branch URLs), `hidden-link` (URL shorteners and public IP addresses).
- New notes: `network-calls`, `binary-files`.
- `remote-exec` also catches `curl ... | python`, `bash <(curl ...)` and `iex (New-Object Net.WebClient)...`, and now reads the bundled files too, not only the SKILL.md body.
- `broad-allowed-tools` also flags unrestricted `Shell`.
- Security checks skip tests, test data and bundled third-party or built code (`node_modules/`, `vendor/`, `dist/`, `build/`, `*.min.js`).
- The YAML parser no longer prints warnings to the console for unknown tags.
- New test file covers every rule with at least one failing and one passing case, and fails when a rule has none.

## 0.4.0 (2026-11-25)

Scoring change: a near-empty skill can no longer score A. Scores in the Skillland index move when the site updates to this version.

- `body-empty` is now an error, not a warning, and also fails a body with fewer than 3 words, such as `sss`. A skill with valid frontmatter and no real body scored 100 (A); it now scores 75 (C) with Structure and content at F. The rule also quotes the Claude Code docs: the body holds "the instructions Claude follows when the skill runs".
- When the frontmatter block is missing or isn't valid YAML, only Specification gets a grade. The other areas used to show A because the few checks that could run found nothing. They now have `graded: false`, and the Markdown report says "not graded".
- New `Report.notApplicable` lists checks that had nothing to look at, instead of counting them as passed: `no-steps` and `no-examples` on a body of 15 lines or fewer, `long-body-no-references` on one of 250 lines or fewer, the body checks on an empty body, and description checks with no description. Area counts ("5 of 6 passed") leave them out.
- The npm package now includes this changelog, so skillland.io can show it.
- `AreaScore` has two new fields, `graded` and `notApplicable`. `scoreAreas()` takes an optional third argument, `{ notApplicable, frontmatterBroken }`.

## 0.3.0 (2026-11-24)

Scoring change: scores in the Skillland index move when the site updates to this version.

- An error no longer caps the overall score at 59. One error on its own now gives 75 (C) instead of an F.
- `Report.areas` grades each area (Specification, Description, Structure and content, Security) from its own rules. An error caps its area at 59, so the area with the problem shows F.
- The overall score is still capped at 59 when the frontmatter block is missing or isn't valid YAML, because no agent can load that skill.
- New exports `AREAS`, `scoreAreas(findings, passed)` and the `AreaScore` type. `ERROR_CAP` now applies to areas.
- The Markdown report starts with a table of area grades.

## 0.2.3 (2026-11-24)

Fewer false positives, found by reviewing every finding in the Skillland index. Scores can go up; no rule got stricter.

- `description-no-trigger` and `description-trigger-late`: any "when" clause now counts as a trigger, plus `Trigger:`, `Use only when`, `Also load it when` and `Applies when`. Descriptions written as `WHEN: ...` no longer fail.
- `description-vague`: flags a vague verb only in a description under 150 characters that also has no trigger. Specific descriptions that say "manages" or "handles" pass.
- `long-body-no-references`: a plain path such as `references/api.md`, or the name of a bundled file, counts as pointing to a reference file, not only a Markdown link.
- `time-sensitive`: "the new version" and "the latest version" are no longer flagged; they don't go out of date.
- `hardcoded-secret` and `fixture-secret`: values with counting digits (`1234`, `4567`) or "pass" in them are treated as samples.
- `broken-links`: site-absolute links such as `/features/analytics` are not treated as file links.
- `reference-no-toc`: skips files under `assets/` or `templates/` and template files.
- `interactive-script`: skips template scripts, which a person copies and runs.
- Rule texts: `frontmatter-invalid-yaml` says the Cursor warning is in Cloud Agents; `description-missing` notes Claude Code's fallback to the first body line; `broad-allowed-tools` says Claude Code's grant lasts for the invoking turn.

## 0.2.2 (2026-11-23)

- `description-no-trigger`: the reason no longer claims a count of scored skills ("the 300 skills Skillland scored"), which went stale as the index grew. The site shows the live count next to the rule.

## 0.2.1 (2026-11-23)

- The README and the npm page link to [skillland.io](https://skillland.io); `homepage` points to the site.

## 0.2.0 (2026-11-20)

- `Report.blocked` lists the rules that didn't run because the frontmatter block is missing or isn't valid YAML. With `passed`, `skipped` and the findings, every rule is now accounted for.
- The Markdown report says how many checks didn't run and how many folder checks were skipped.
- Singular counts read "1 line", "1 token" and "1 check".
- New export `plural(n, word)`.

## 0.1.1 (2026-11-20)

- First release published from GitHub Actions through npm trusted publishing, with provenance.
- `publishConfig` makes the package public by default.
- Releasing is now automatic: merging a version bump to main publishes to npm and creates the tag and GitHub Release.

## 0.1.0 (2026-11-20)

First release, moved out of the skillland.io site. 40 rules, each quoting its official source.
