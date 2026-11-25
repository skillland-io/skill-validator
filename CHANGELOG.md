# Changelog

## 0.4.0

Scoring change: a near-empty skill can no longer score A. Scores in the Skillland index move when the site updates to this version.

- `body-empty` is now an error, not a warning, and also fails a body with fewer than 3 words, such as `sss`. A skill with valid frontmatter and no real body scored 100 (A); it now scores 75 (C) with Structure and content at F. The rule also quotes the Claude Code docs: the body holds "the instructions Claude follows when the skill runs".
- When the frontmatter block is missing or isn't valid YAML, only Specification gets a grade. The other areas used to show A because the few checks that could run found nothing. They now have `graded: false`, and the Markdown report says "not graded".
- New `Report.notApplicable` lists checks that had nothing to look at, instead of counting them as passed: `no-steps` and `no-examples` on a body of 15 lines or fewer, `long-body-no-references` on one of 250 lines or fewer, the body checks on an empty body, and description checks with no description. Area counts ("5 of 6 passed") leave them out.
- `AreaScore` has two new fields, `graded` and `notApplicable`. `scoreAreas()` takes an optional third argument, `{ notApplicable, frontmatterBroken }`.

## 0.3.0

Scoring change: scores in the Skillland index move when the site updates to this version.

- An error no longer caps the overall score at 59. One error on its own now gives 75 (C) instead of an F.
- `Report.areas` grades each area (Specification, Description, Structure and content, Security) from its own rules. An error caps its area at 59, so the area with the problem shows F.
- The overall score is still capped at 59 when the frontmatter block is missing or isn't valid YAML, because no agent can load that skill.
- New exports `AREAS`, `scoreAreas(findings, passed)` and the `AreaScore` type. `ERROR_CAP` now applies to areas.
- The Markdown report starts with a table of area grades.

## 0.2.3

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

## 0.2.2

- `description-no-trigger`: the reason no longer claims a count of scored skills ("the 300 skills Skillland scored"), which went stale as the index grew. The site shows the live count next to the rule.

## 0.2.1

- The README and the npm page link to [skillland.io](https://skillland.io); `homepage` points to the site.

## 0.2.0

- `Report.blocked` lists the rules that didn't run because the frontmatter block is missing or isn't valid YAML. With `passed`, `skipped` and the findings, every rule is now accounted for.
- The Markdown report says how many checks didn't run and how many folder checks were skipped.
- Singular counts read "1 line", "1 token" and "1 check".
- New export `plural(n, word)`.

## 0.1.1

- First release published from GitHub Actions through npm trusted publishing, with provenance.
- `publishConfig` makes the package public by default.
- Releasing is now automatic: merging a version bump to main publishes to npm and creates the tag and GitHub Release.

## 0.1.0

First release, moved out of the skillland.io site. 40 rules, each quoting its official source.
