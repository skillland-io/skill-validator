import type { RuleSource } from "./types";

/**
 * Every source a rule cites, with the sentence it relies on, copied word for word from the page.
 * Checked against the live pages on 2026-11-20. When a page changes, update the quote here.
 */
const SPEC = "https://agentskills.io/specification";
const AS_SCRIPTS = "https://agentskills.io/skill-creation/using-scripts";
const OVERVIEW = "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview";
const BEST = "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices";
const CC = "https://code.claude.com/docs/en/skills";
const CODEX = "https://learn.chatgpt.com/docs/build-skills";
const CURSOR = "https://cursor.com/docs/skills";
const ANTHROPIC_CREATOR = "https://github.com/anthropics/skills/blob/main/skills/skill-creator";
const OPENAI_CREATOR = "https://github.com/openai/skills/blob/main/skills/.system/skill-creator";

const src = (label: string, url: string, quote: string): RuleSource => ({ label, url, quote });

export const S = {
  specFormat: src(
    "Agent Skills specification: SKILL.md format",
    `${SPEC}#skill-md-format`,
    "The `SKILL.md` file must contain YAML frontmatter followed by Markdown content.",
  ),
  specNameRequired: src(
    "Agent Skills specification: name field",
    `${SPEC}#name-field`,
    "The required `name` field: Must be 1-64 characters",
  ),
  specNameChars: src(
    "Agent Skills specification: name field",
    `${SPEC}#name-field`,
    "May only contain unicode lowercase alphanumeric characters (`a-z`, `0-9`) and hyphens (`-`). Must not start or end with a hyphen (`-`). Must not contain consecutive hyphens (`--`).",
  ),
  specNameFolder: src("Agent Skills specification: name field", `${SPEC}#name-field`, "Must match the parent directory name"),
  specDescription: src(
    "Agent Skills specification: description field",
    `${SPEC}#description-field`,
    "Must be 1-1024 characters. Should describe both what the skill does and when to use it.",
  ),
  specDescriptionKeywords: src(
    "Agent Skills specification: description field",
    `${SPEC}#description-field`,
    "Should include specific keywords that help agents identify relevant tasks",
  ),
  specCompatibility: src(
    "Agent Skills specification: compatibility field",
    `${SPEC}#compatibility-field`,
    "Must be 1-500 characters if provided",
  ),
  specMetadata: src(
    "Agent Skills specification: metadata field",
    `${SPEC}#metadata-field`,
    "A map from string keys to string values",
  ),
  specBody: src(
    "Agent Skills specification: body content",
    `${SPEC}#body-content`,
    "Recommended sections: Step-by-step instructions, Examples of inputs and outputs, Common edge cases",
  ),
  specLines: src(
    "Agent Skills specification: progressive disclosure",
    `${SPEC}#progressive-disclosure`,
    "Keep your main `SKILL.md` under 500 lines. Move detailed reference material to separate files.",
  ),
  specTokens: src(
    "Agent Skills specification: progressive disclosure",
    `${SPEC}#progressive-disclosure`,
    "Instructions (< 5000 tokens recommended): The full `SKILL.md` body is loaded when the skill is activated",
  ),
  specFileRefs: src(
    "Agent Skills specification: file references",
    `${SPEC}#file-references`,
    "When referencing other files in your skill, use relative paths from the skill root",
  ),
  specOneLevel: src(
    "Agent Skills specification: file references",
    `${SPEC}#file-references`,
    "Keep file references one level deep from `SKILL.md`. Avoid deeply nested reference chains.",
  ),
  skillsRefFields: src(
    "skills-ref, the spec's reference validator",
    "https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/validator.py",
    "Unexpected fields in frontmatter",
  ),
  skillsRefYaml: src(
    "skills-ref, the spec's reference validator",
    "https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/parser.py",
    "Invalid YAML in frontmatter",
  ),
  asInteractive: src(
    "Agent Skills: using scripts in skills",
    `${AS_SCRIPTS}#avoid-interactive-prompts`,
    "This is a hard requirement of the agent execution environment. Agents operate in non-interactive shells — they cannot respond to TTY prompts, password dialogs, or confirmation menus.",
  ),

  overviewName: src(
    "Anthropic: Agent Skills overview, skill structure",
    `${OVERVIEW}#skill-structure`,
    "Cannot contain XML tags. Cannot contain reserved words: `anthropic`, `claude`",
  ),
  overviewDescription: src(
    "Anthropic: Agent Skills overview, skill structure",
    `${OVERVIEW}#skill-structure`,
    "Maximum 1,024 characters. Cannot contain XML tags",
  ),
  overviewAudit: src(
    "Anthropic: Agent Skills overview, security considerations",
    `${OVERVIEW}#security-considerations`,
    "Audit thoroughly: Review all files bundled in the Skill: `SKILL.md`, scripts, images, and other resources.",
  ),
  overviewExternal: src(
    "Anthropic: Agent Skills overview, security considerations",
    `${OVERVIEW}#security-considerations`,
    "External sources are risky: Skills that fetch data from external URLs pose particular risk, as fetched content might contain malicious instructions.",
  ),
  bestWhatWhen: src(
    "Anthropic: skill authoring best practices, writing effective descriptions",
    `${BEST}#writing-effective-descriptions`,
    "The `description` field makes Skill discovery possible and should include both what the Skill does and when to use it.",
  ),
  bestThirdPerson: src(
    "Anthropic: skill authoring best practices, writing effective descriptions",
    `${BEST}#writing-effective-descriptions`,
    "Always write in third person. The description is injected into the system prompt, and inconsistent point-of-view can cause discovery problems.",
  ),
  bestSpecific: src(
    "Anthropic: skill authoring best practices, writing effective descriptions",
    `${BEST}#writing-effective-descriptions`,
    "Be specific and include key terms. Include both what the Skill does and specific triggers/contexts for when to use it.",
  ),
  bestVague: src(
    "Anthropic: skill authoring best practices, writing effective descriptions",
    `${BEST}#writing-effective-descriptions`,
    "Avoid vague descriptions such as these: … Helps with documents … Processes data … Does stuff with files",
  ),
  bestLines: src(
    "Anthropic: skill authoring best practices, token budgets",
    `${BEST}#token-budgets`,
    "Keep the `SKILL.md` body under 500 lines for optimal performance. If your content exceeds this, split it into separate files using the progressive disclosure patterns described earlier.",
  ),
  bestSteps: src(
    "Anthropic: skill authoring best practices, checklist",
    `${BEST}#checklist-for-effective-skills`,
    "Workflows have clear steps",
  ),
  bestExamples: src(
    "Anthropic: skill authoring best practices, checklist",
    `${BEST}#checklist-for-effective-skills`,
    "Examples are concrete, not abstract",
  ),
  bestWindows: src(
    "Anthropic: skill authoring best practices, avoid Windows-style paths",
    `${BEST}#avoid-windows-style-paths`,
    "Always use forward slashes in file paths, even on Windows",
  ),
  bestTime: src(
    "Anthropic: skill authoring best practices, avoid time-sensitive information",
    `${BEST}#avoid-time-sensitive-information`,
    "Don’t include information that will become outdated",
  ),
  bestNested: src(
    "Anthropic: skill authoring best practices, avoid deeply nested references",
    `${BEST}#avoid-deeply-nested-references`,
    "When encountering nested references, Claude might use commands such as `head -100` to preview content rather than reading entire files, resulting in incomplete information. Keep references one level deep from `SKILL.md`.",
  ),
  bestToc: src(
    "Anthropic: skill authoring best practices, table of contents",
    `${BEST}#structure-longer-reference-files-with-a-table-of-contents`,
    "For reference files longer than 100 lines, include a table of contents at the top. This ensures Claude can see the full scope of available information even when previewing with partial reads.",
  ),
  bestFileNames: src(
    "Anthropic: skill authoring best practices, runtime environment",
    `${BEST}#runtime-environment`,
    "Name files descriptively: Use names that indicate content: `form_validation_rules.md`, not `doc2.md`.",
  ),
  anthropicCaps: src(
    "Anthropic: skill-creator skill",
    `${ANTHROPIC_CREATOR}/SKILL.md`,
    "If you find yourself writing ALWAYS or NEVER in all caps, or using super rigid structures, that's a yellow flag — if possible, reframe and explain the reasoning so that the model understands why the thing you're asking for is important.",
  ),
  anthropicAngle: src(
    "Anthropic: skill-creator validation script",
    `${ANTHROPIC_CREATOR}/scripts/quick_validate.py`,
    "Description cannot contain angle brackets (< or >)",
  ),
  anthropicKeys: src(
    "Anthropic: skill-creator validation script",
    `${ANTHROPIC_CREATOR}/scripts/quick_validate.py`,
    "Unexpected key(s) in SKILL.md frontmatter",
  ),

  ccFrontmatter: src(
    "Claude Code: frontmatter reference",
    `${CC}#frontmatter-reference`,
    "Claude Code reads the frontmatter only when the opening `---` is the file's first line. Otherwise it treats the whole file, `---` markers included, as skill content.",
  ),
  ccBadYaml: src(
    "Claude Code: skill not triggering",
    `${CC}#skill-not-triggering`,
    "If the frontmatter YAML is malformed, Claude Code loads the skill body with empty metadata, so `/skill-name` still works but Claude can't match against your `description`.",
  ),
  ccListingCap: src(
    "Claude Code: frontmatter reference",
    `${CC}#frontmatter-reference`,
    "Put the key use case first: the combined `description` and `when_to_use` text is truncated at 1,536 characters in the skill listing to reduce context usage.",
  ),
  ccCompaction: src(
    "Claude Code: skill content lifecycle",
    `${CC}#skill-content-lifecycle`,
    "Claude Code re-attaches the most recent invocation of each skill after the summary, keeping the first 5,000 tokens of each.",
  ),
  ccOutside: src(
    "Claude Code: using skill frontmatter outside Claude Code",
    `${CC}#using-skill-frontmatter-outside-claude-code`,
    "If you include any field the spec doesn't allow, packaging or upload fails with a hard error instead of ignoring the field",
  ),
  ccInject: src(
    "Claude Code: inject dynamic context",
    `${CC}#inject-dynamic-context`,
    "The !`<command>` syntax runs shell commands before the skill content is sent to Claude. The command output replaces the placeholder, so Claude receives actual data, not the command itself.",
  ),
  ccAllowedTools: src(
    "Claude Code: pre-approve tools for a skill",
    `${CC}#pre-approve-tools-for-a-skill`,
    "A skill can grant itself broad tool access, so review the `allowed-tools` of skills checked into a repository before you run Claude Code there.",
  ),
  ccSideEffects: src(
    "Claude Code: control who invokes a skill",
    `${CC}#control-who-invokes-a-skill`,
    "Use this for workflows with side effects or that you want to control timing, like `/commit`, `/deploy`, or `/send-slack-message`. You don't want Claude deciding to deploy because your code looks ready.",
  ),

  codexRequired: src("OpenAI: build skills", CODEX, "The `SKILL.md` file must include `name` and `description`."),
  codexFrontLoad: src(
    "OpenAI: build skills",
    `${CODEX}#how-chatgpt-and-codex-use-skills`,
    "Because implicit matching depends on `description`, write concise descriptions with clear scope and boundaries. Front-load the key use case and trigger words so a host can still match the skill if descriptions are shortened.",
  ),
  codexSteps: src("OpenAI: build skills, best practices", `${CODEX}#best-practices`, "Write imperative steps with explicit inputs and outputs."),
  codexImplicit: src(
    "OpenAI: build skills, optional metadata",
    `${CODEX}#optional-metadata`,
    "`allow_implicit_invocation` (default: `true`): When `false`, Codex won't implicitly invoke the skill based on user prompt; explicit `$skill` invocation still works.",
  ),
  openaiExtraneous: src(
    "OpenAI: skill-creator skill",
    `${OPENAI_CREATOR}/SKILL.md`,
    "A skill should only contain essential files that directly support its functionality. Do NOT create extraneous documentation or auxiliary files, including: README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, CHANGELOG.md",
  ),
  openaiAngle: src(
    "OpenAI: skill-creator validation script",
    `${OPENAI_CREATOR}/scripts/quick_validate.py`,
    "Description cannot contain angle brackets (< or >)",
  ),

  cursorName: src(
    "Cursor: Agent Skills, frontmatter fields",
    `${CURSOR}#frontmatter-fields`,
    "Skill identifier. Lowercase letters, numbers, and hyphens only. Must match the parent folder name.",
  ),
  cursorDescription: src(
    "Cursor: Agent Skills, frontmatter fields",
    `${CURSOR}#frontmatter-fields`,
    "Describes what the skill does and when to use it. Used by the agent to determine relevance.",
  ),
  cursorParse: src(
    "Cursor: Agent Skills, frontmatter fields",
    `${CURSOR}#frontmatter-fields`,
    "… whose `SKILL.md` can't be read, has frontmatter that doesn't parse, or has no `description` shows a warning in the run that names the skill.",
  ),
  cursorGlobs: src(
    "Cursor: scoping a skill to specific files",
    `${CURSOR}#scoping-a-skill-to-specific-files`,
    "The legacy `globs` field is still accepted as a fallback for older skills, but new skills should use `paths`.",
  ),
  cursorSideEffects: src(
    "Cursor: disabling automatic invocation",
    `${CURSOR}#disabling-automatic-invocation`,
    "Set `disable-model-invocation: true` to make a skill behave like a traditional slash command",
  ),

  owaspSecrets: src(
    "OWASP Secrets Management Cheat Sheet",
    "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
    "Many organizations have them hardcoded within the source code in plaintext, littered throughout configuration files and configuration management tools.",
  ),
} satisfies Record<string, RuleSource>;
