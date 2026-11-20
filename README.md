# @skillland/validator

[![npm](https://img.shields.io/npm/v/@skillland/validator)](https://www.npmjs.com/package/@skillland/validator)
[![CI](https://github.com/skillland-io/skill-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/skillland-io/skill-validator/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/@skillland/validator)](https://www.npmjs.com/package/@skillland/validator)
[![license](https://img.shields.io/npm/l/@skillland/validator)](https://github.com/skillland-io/skill-validator/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@skillland/validator)](https://github.com/skillland-io/skill-validator/blob/main/package.json)

![skillland check prints a score, a grade and each finding for a skill](https://raw.githubusercontent.com/skillland-io/skill-validator/main/.github/preview.png)

Lints agent skills (`SKILL.md` folders) for Claude Code, Codex, Cursor and any other agent that follows the [Agent Skills specification](https://agentskills.io/specification).

Every rule quotes, word for word, the sentence of official guidance it relies on: the spec, Anthropic's and Claude Code's docs, OpenAI's and Cursor's docs, and the validation scripts Anthropic and OpenAI ship with their skill creators. Where a rule needs a number the sources leave open, such as a length threshold, the rule says so in `ourCall`.

The same rules score the public skills on [skillland.io](https://skillland.io). Each rule has a page at [skillland.io/validate/rules](https://skillland.io/validate/rules).

## Command line

```bash
npx -p @skillland/validator skillland check ./my-skill
```

`<path>` can be a skill folder, a `SKILL.md` file, or a folder that holds many skills. Folders are read whole, so rules about bundled files (broken links, nested references, scripts) run too.

| Option | What it does |
| --- | --- |
| `--json` | Print the reports as JSON |
| `--min-score <n>` | Also fail when a skill scores below `n` |

Exit codes: `0` every skill passes, `1` a skill has an error or scores below `--min-score`, `2` bad usage.

To check skills on every pull request:

```yaml
- run: npx -p @skillland/validator skillland check skills --min-score 80
```

## Library

```bash
npm install @skillland/validator
```

```ts
import { validateSkill, RULES } from "@skillland/validator";

const report = validateSkill({
  skillMd: fs.readFileSync("my-skill/SKILL.md", "utf8"),
  folderName: "my-skill", // optional: enables the name-matches-folder rule
  files: { "references/api.md": "..." }, // optional: other files, keyed by path inside the folder
});

report.score; // 0-100
report.grade; // "A" to "F"
report.findings; // [{ ruleId, severity, message, fix, line }]
```

It has one dependency, [`yaml`](https://www.npmjs.com/package/yaml), and runs in Node and in the browser.

`RULES` holds every rule with its title, severity, explanation, a failing and a passing example, and `sources: [{ label, url, quote }]`.

## Scoring

A skill starts at 100. Each failing rule costs 25 points for an error, 8 for a warning and 2 for a suggestion, once per rule however often it fails. Any error caps the score at 59. Grades: A from 90, B from 80, C from 70, D from 60, F below.

The formula is Skillland's own; no vendor publishes one. It may change between minor versions, which the [changelog](CHANGELOG.md) will say.

## Contributing

New rules and corrections are welcome, as long as each rule is backed by official guidance. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. Quotes from third-party documentation are short excerpts, each credited and linked to its source.
