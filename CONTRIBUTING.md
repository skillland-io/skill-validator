# Contributing

Thanks for helping. This project has one firm rule: **every check must be backed by official guidance, quoted word for word.** Rules based on taste or experience alone are not accepted, however sensible.

## What counts as a source

- The [Agent Skills specification](https://agentskills.io/specification) and its other pages, including the skills-ref validator.
- Skill documentation from vendors whose agents load skills: Anthropic (platform docs and Claude Code docs), OpenAI, Cursor, and others that adopt the spec.
- Validation scripts those vendors publish, such as `quick_validate.py` in Anthropic's and OpenAI's skill-creator skills.
- For security rules, an established security body such as OWASP, alongside the vendor guidance it applies to.

Blog posts, tweets and third-party guides are not sources.

## Adding or changing a rule

1. Add the quote to `src/sources.ts`: a label, a URL (with the section anchor when there is one), and the sentence copied exactly. Use ` … ` where you skip text.
2. Add or edit the rule in `src/rules.ts`: `id`, `title`, `problem`, `severity`, `category`, `summary`, the `why` and `fix` text, a failing (`bad`) and a passing (`good`) example, and `sources`.
3. If the rule needs a value the source leaves open, such as a threshold or a list of phrases, say so in `ourCall`.
4. Add the check in `src/index.ts` and tests in `test/validator.test.ts` for both a failing and a passing case.
5. Run `npm run check` and `npm run check-quotes`.

Severity:

- **error**: breaks the spec or a host's hard limit (an upload fails, a field is rejected), or leaks a secret.
- **warning**: goes against official guidance in a way that changes how the skill behaves.
- **info**: good practice, or official guidance that hosts don't enforce.

## Versions

A change that can move a score (new rule, removed rule, changed threshold or severity) is a minor version and gets a changelog entry. A change to the report format or the exported API is a major version.

## Quotes going stale

A weekly workflow checks that every quote still appears on its page and opens an issue when one doesn't. Fixing it means updating the quote, or the rule when the guidance itself changed.
