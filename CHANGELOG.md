# Changelog

## 0.2.2

- `description-no-trigger`: the reason no longer claims a count of scored skills ("the 300 skills Skillland scored"), which went stale as the index grew. The site shows the live count next to the rule.

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
