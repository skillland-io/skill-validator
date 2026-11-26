import type { RuleSource } from "./types";

/**
 * Every source a rule cites, with the sentence it relies on, copied word for word from the page.
 * Checked against the live pages on 2026-11-20; security and NVIDIA sources added 2026-11-26. When a page changes, update the quote here.
 */
const SPEC = "https://agentskills.io/specification";
const AS_SCRIPTS = "https://agentskills.io/skill-creation/using-scripts";
const OVERVIEW = "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview";
const BEST = "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices";
const CC = "https://code.claude.com/docs/en/skills";
const CODEX = "https://learn.chatgpt.com/docs/build-skills";
const ENTERPRISE = "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/enterprise";
const OWASP_AST = "https://github.com/OWASP/www-project-agentic-skills-top-10/blob/main";
const CURSOR = "https://cursor.com/docs/skills";
const ANTHROPIC_CREATOR = "https://github.com/anthropics/skills/blob/main/skills/skill-creator";
const OPENAI_CREATOR = "https://github.com/openai/skills/blob/main/skills/.system/skill-creator";
const NV = "https://docs.nvidia.com/skills";
const NV_HARNESS = `${NV}/skillevaluator/harness-check`;
const NV_TIER1 = `${NV}/skillevaluator/tier1-reference#the-checks`;

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
  overviewToolMisuse: src(
    "Anthropic: Agent Skills overview, security considerations",
    `${OVERVIEW}#security-considerations`,
    "Tool misuse: Malicious Skills can call tools (file operations, bash commands, code execution) in harmful ways.",
  ),
  overviewDependencies: src(
    "Anthropic: Agent Skills overview, security considerations",
    `${OVERVIEW}#security-considerations`,
    "Even trustworthy Skills can be compromised if their external dependencies change over time.",
  ),
  entManipulation: src(
    "Anthropic: Skills for enterprise, risk tier assessment",
    `${ENTERPRISE}#risk-tier-assessment`,
    "Directives to ignore safety rules, hide actions from users, or alter Claude's behavior conditionally",
  ),
  entNetwork: src(
    "Anthropic: Skills for enterprise, risk tier assessment",
    `${ENTERPRISE}#risk-tier-assessment`,
    "URLs, API endpoints, `fetch`, `curl`, or `requests` calls",
  ),
  entCodeExecution: src(
    "Anthropic: Skills for enterprise, risk tier assessment",
    `${ENTERPRISE}#risk-tier-assessment`,
    "High: scripts run with full environment access",
  ),
  entFilesystem: src(
    "Anthropic: Skills for enterprise, risk tier assessment",
    `${ENTERPRISE}#risk-tier-assessment`,
    "Paths outside the Skill directory, broad glob patterns, path traversal (`../`)",
  ),
  entAdversarial: src(
    "Anthropic: Skills for enterprise, review checklist",
    `${ENTERPRISE}#review-checklist`,
    "Check for adversarial instructions. Look for directives that tell Claude to ignore safety rules, hide actions from users, exfiltrate data through responses, or alter behavior based on specific inputs.",
  ),
  entCombined: src(
    "Anthropic: Skills for enterprise, review checklist",
    `${ENTERPRISE}#review-checklist`,
    "Consider the combined risk when a Skill uses both file-read and network tools together.",
  ),
  entExfiltration: src(
    "Anthropic: Skills for enterprise, review checklist",
    `${ENTERPRISE}#review-checklist`,
    "Look for instructions that read sensitive data and then write, send, or encode it for external transmission",
  ),
  entRedirects: src(
    "Anthropic: Skills for enterprise, review checklist",
    `${ENTERPRISE}#review-checklist`,
    "Confirm redirect destinations. If the Skill references external URLs, verify they point to expected domains.",
  ),
  entScanning: src(
    "Anthropic: Skills for enterprise, skill content scanning",
    `${ENTERPRISE}#skill-content-scanning`,
    "These signs include hidden code execution, transfer of your data to an outside service, and instructions that tamper with Claude's safeguards.",
  ),
  ccHooks: src(
    "Claude Code: hooks in skills and agents",
    "https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents",
    "Frontmatter hooks in a project skill follow the same … so they can run under -p in a folder you haven't trusted.",
  ),
  ccHooksField: src(
    "Claude Code: frontmatter reference",
    `${CC}#frontmatter-reference`,
    "Hooks that Claude Code registers when the skill is invoked and keeps running for the rest of the session.",
  ),
  ccBypass: src(
    "Claude Code: permission modes",
    "https://code.claude.com/docs/en/permission-modes#skip-all-checks-with-bypasspermissions-mode",
    "`bypassPermissions` mode disables permission prompts and safety checks so tool calls execute immediately … Isolated containers and VMs only",
  ),
  owaspHidden: src(
    "OWASP Agentic Skills Top 10: AST04 Insecure Metadata",
    `${OWASP_AST}/ast04.md`,
    "Apply static analysis to all metadata fields and `SKILL.md` prose at publish time: flag suspicious patterns in general, and specifically ASCII smuggling, base64 payloads, and zero-width characters invisible to human reviewers.",
  ),
  owaspYamlTags: src(
    "OWASP Agentic Skills Top 10: AST04 Insecure Metadata",
    `${OWASP_AST}/ast04.md`,
    "Use safe parsers by default — disable dangerous tags (`!!python/object`, `!!python/apply`; `yaml.load` → `yaml.safe_load`)",
  ),
  owaspHttp: src(
    "OWASP Agentic Skills Top 10: AST01 Malicious Skills",
    `${OWASP_AST}/ast01.md`,
    "Instructions to download from non-HTTPS URLs",
  ),
  owaspPersistence: src(
    "OWASP Agentic Skills Top 10: AST01 Malicious Skills",
    `${OWASP_AST}/ast01.md`,
    "Check for persistence mechanisms (SOUL.md, MEMORY.md modifications)",
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
  ccBody: src(
    "Claude Code: create your first skill",
    `${CC}#create-your-first-skill`,
    "Every skill needs a `SKILL.md` file with two parts: YAML frontmatter between `---` markers that tells Claude when to use the skill, and markdown content with the instructions Claude follows when the skill runs.",
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
  ccPlaceholders: src(
    "Claude Code: available string substitutions",
    `${CC}#available-string-substitutions`,
    "Skills support string substitution for dynamic values in the skill content:",
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

  nvStrictYaml: src(
    "NVIDIA SkillEvaluator: Harness Check, fix what it finds",
    `${NV_HARNESS}#fix-what-it-finds`,
    "Codex, Copilot CLI, OpenClaw and OpenCode parse front matter strictly.",
  ),
  nvFrontmatterRules: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, harness check",
    NV_TIER1,
    "Frontmatter rules: duplicate keys (Codex, Copilot CLI, OpenClaw and OpenCode drop the skill), tab indentation (Codex, Copilot CLI and OpenClaw), a UTF-8 BOM (Codex), no front matter (Copilot CLI), and long custom frontmatter that never reaches the model.",
  ),
  nvBom: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, schema check",
    NV_TIER1,
    "A duplicate frontmatter key is HIGH (`duplicate_key`; several harnesses drop the skill), and a UTF-8 BOM is MEDIUM (`manifest_bom`).",
  ),
  nvStringKeys: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, schema check",
    NV_TIER1,
    "Frontmatter keys, including keys nested under `metadata`, must be strings.",
  ),
  nvRequired: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, schema check",
    NV_TIER1,
    "`name` and `description` are required. Names are 1–64 characters; descriptions are 1–1024 characters.",
  ),
  nvNameFolder: src("NVIDIA SkillEvaluator: Tier 1 reference, schema check", NV_TIER1, "The directory name must match the frontmatter `name`."),
  nvReserved: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, schema check",
    NV_TIER1,
    "The reserved words `anthropic` and `claude` must not appear in a skill name.",
  ),
  nvGlobs: src("NVIDIA SkillEvaluator: Tier 1 reference, schema check", NV_TIER1, "`alwaysApply` and `globs` are forbidden skill fields."),
  nvUnknownField: src("NVIDIA SkillEvaluator: Tier 1 reference, schema check", NV_TIER1, "Fields outside the spec are LOW (`unknown_field`)."),
  nvLines: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, schema check",
    NV_TIER1,
    "`SKILL.md` should stay at or below 500 lines; larger files receive an advisory finding.",
  ),
  nvXml: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, quality check",
    NV_TIER1,
    "Correctness reports XML-style tags in any frontmatter value as a HIGH finding (potential prompt injection).",
  ),
  nvTokenBudget: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, quality check",
    NV_TIER1,
    "The 5,000-token budget for `SKILL.md` is a recommendation, not a hard limit.",
  ),
  nvCodexDelivery: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, harness check",
    NV_TIER1,
    "Delivery rules: Claude Code's body cap, … and Codex's ~10K-token cut when the model reads `SKILL.md` through the shell.",
  ),
  nvListingCut: src(
    "NVIDIA SkillEvaluator: Harness Check, fix what it finds",
    `${NV_HARNESS}#fix-what-it-finds`,
    "Codex cuts at 1,024 characters, Claude Code at 1,536, and Copilot CLI drops the skill past 1,024 UTF-16 units.",
  ),
  nvTriggerFirst: src(
    "NVIDIA SkillEvaluator: Harness Check, fix what it finds",
    `${NV_HARNESS}#fix-what-it-finds`,
    "Put the trigger first and keep the description under 1,024 characters.",
  ),
  nvInvocation: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, harness check",
    NV_TIER1,
    "Invocation rules: `disable-model-invocation` (ignored by Codex, Hermes and OpenCode), Codex's `agents/openai.yaml` implicit-invocation policy (Codex only)",
  ),
  nvPlaceholders: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, harness check",
    NV_TIER1,
    "Placeholder rules: `$ARGUMENTS` and `${CLAUDE_SKILL_DIR}` are substituted only by Claude Code, and price-like `$N` text is replaced with arguments by Claude Code and OpenCode.",
  ),
  nvUnicode: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, unicode check",
    NV_TIER1,
    "Detects invisible Unicode characters associated with ASCII smuggling, hidden-data encoding, and trojan-source attacks.",
  ),
  nvFixtures: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, code-integrity check",
    NV_TIER1,
    "Files under a folder named `tests`, `examples`, `fixtures`, or `mocks`, or the singular form, are skipped at any depth",
  ),
  nvHygiene: src(
    "NVIDIA SkillEvaluator: Tier 1 reference, code-integrity check",
    NV_TIER1,
    "**Hygiene** — dead relative Markdown links, banned or unpinned dependency declarations, and static discovery of conventional Python test filenames.",
  ),
  nvRisky: src(
    "NVIDIA: scan agent skills before installation",
    `${NV}/scanning-agent-skills`,
    "Agent skills can look harmless while still containing risky instructions, hidden metadata, overbroad permissions, or executable code that does more than the description says.",
  ),
  nvPluginParts: src(
    "NVIDIA: scan agent skills before installation, scan a plugin",
    `${NV}/scanning-agent-skills#scan-a-plugin`,
    "Review a plugin's MCP server, hooks, commands, and subagents separately before installing.",
  ),
  nvPermissions: src(
    "NVIDIA: a trust pipeline for agent skills, review questions",
    `${NV}/agent-skill-trust-pipeline#review-questions`,
    "Are permissions limited to what the skill or plugin actually needs?",
  ),
  nvCapabilities: src(
    "NVIDIA: a trust pipeline for agent skills, review questions",
    `${NV}/agent-skill-trust-pipeline#review-questions`,
    "Are network, shell, file, environment, and MCP capabilities declared in the `SKILL.md` frontmatter and justified by the skill's stated use case?",
  ),
  nvActivate: src("NVIDIA: release checklist, before scanning", `${NV}/release-checklist#before-scanning`, "`SKILL.md` describes when the skill should activate."),

  owaspSecrets: src(
    "OWASP Secrets Management Cheat Sheet",
    "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
    "Many organizations have them hardcoded within the source code in plaintext, littered throughout configuration files and configuration management tools.",
  ),
} satisfies Record<string, RuleSource>;
