# Changelog

## 0.3.0

Scoring change: scores in the Skillland index move when the site updates to this version.

- An error no longer caps the overall score at 59. One error on its own now gives 75 (C) instead of an F.
- `Report.areas` grades each area (Specification, Description, Structure and content, Security) from its own rules. An error caps its area at 59, so the area with the problem shows F.
- The overall score is still capped at 59 when the frontmatter block is missing or isn't valid YAML, because no agent can load that skill.
- New exports `AREAS`, `scoreAreas(findings, passed)` and the `AreaScore` type. `ERROR_CAP` now applies to areas.
- The Markdown report starts with a table of area grades.

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
