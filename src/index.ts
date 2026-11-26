import { isMap, isScalar, parse as parseYaml, parseDocument } from "yaml";
import { RULES, RULES_BY_ID, getRule } from "./rules";
import type { AreaScore, Finding, Grade, Report, RuleCategory, SkillInput } from "./types";

export * from "./types";
export { RULES, RULES_BY_ID, getRule } from "./rules";
export { S as SOURCES } from "./sources";

/** Points off per failing rule. A note is a fact to review, not a fault, so it costs nothing. */
export const PENALTY = { error: 25, warning: 8, info: 2, note: 0 } as const;
/**
 * An error caps the score of its own area at this, so that area shows F. The overall score is
 * capped only when the frontmatter block is missing or isn't valid YAML, since no agent can load that skill.
 */
export const ERROR_CAP = 59;
/** The four areas the rules fall into, in display order. Each area gets its own grade. */
export const AREAS: { id: RuleCategory; label: string; summary: string }[] = [
  { id: "spec", label: "Specification", summary: "Fields and format the Agent Skills specification requires" },
  { id: "description", label: "Description", summary: "Whether an agent can tell when to use the skill" },
  { id: "structure", label: "Structure and content", summary: "How the body and the bundled files are laid out" },
  { id: "security", label: "Security", summary: "Secrets, hidden instructions, shell commands and side effects" },
];
export const GRADE_BANDS: [Grade, number][] = [
  ["A", 90],
  ["B", 80],
  ["C", 70],
  ["D", 60],
  ["F", 0],
];

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const XML_TAG_RE = /<\/?[a-zA-Z][\w-]*(\s[^>]*)?>/;
// Any "when" clause counts, so "WHEN: ...", "Applies when ..." and "Use <name> when ..." pass.
const TRIGGER_RE = /\b(use (it |this |this skill |only |also )?(when|whenever|for|to|before|after|if)|used (when|whenever|for|to|before|after|if)|when(ever)?|triggers?(:| on| when| include| phrases?)|invoke (it )?when|(load|apply|applies|activate|invoke) (it |this skill )?(when|for|if))\b/i;
const PERSON_RE = /^\s*(you are|you can|you will|i help|i can|i am|i will|this skill helps you)\b/i;
const VAGUE_RE = /\b(helps? (you )?with|handles|manages|deals with|assists with|various tasks|tasks or workflows)\b/i;
const DRIVE_PATH_RE = /(?:^|[\s`"'(])[A-Za-z]:\\[\w.-]/;
const RELATIVE_BACKSLASH_RE = /(?:^|[\s`"'(])(?:\.{1,2}|[\w-]+)\\[\w-]+(?:\\[\w.-]+)*\.[a-z]{1,5}\b/i;
const SPEC_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
const SHOUT_RE = /\b(MUST|NEVER|ALWAYS)\b/g;
const GENERIC_FILE_RE = /(^|\/)(file|doc|document|note|notes|page|part|section|ref|untitled|temp|tmp|misc)[-_ ]?\d+\.(md|txt)$/i;
const EXTRANEOUS_FILES = new Set(["readme.md", "changelog.md", "installation_guide.md", "quick_reference.md"]);
const INTERACTIVE_BY_EXT: [RegExp, RegExp][] = [
  [/\.py$/i, /(?<![\w.])(input|getpass)\s*\(\s*(["'f)]|$)|\bgetpass\.getpass\s*\(/],
  [/\.(sh|bash|zsh)$/i, /\bread\b(\s+-[a-z]+)*\s+-[a-z]*p\b/],
  [/\.ps1$/i, /\bRead-Host\b/i],
  [/\.(js|mjs|cjs|ts)$/i, /\.question\s*\(|from\s+["'](inquirer|prompts|@inquirer\/prompts)["']|require\(\s*["'](inquirer|prompts)["']\s*\)/],
];
const SIDE_EFFECT_NAME_RE = /(^|-)(deploy|publish|send|ship|delete|push)(-|$)/;
const SIDE_EFFECT_DESC_RE = /^\s*(deploys|publishes|sends|ships|deletes|pushes)\b/i;
const TIME_RE = /\b(as of (20\d\d|january|february|march|april|may|june|july|august|september|october|november|december)|(before|after|since|until) (january|february|march|april|may|june|july|august|september|october|november|december) 20\d\d|recently (added|released)|coming soon)\b/i;
const REMOTE_EXEC_RE =
  /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?((ba|z|da|k)?sh\b|(python3?|node|perl|ruby)(\s+-)?\s*($|[;&|)`'"]))|\b(ba|z)?sh\s+<\(\s*(curl|wget)\b|\b(iwr|invoke-webrequest|irm|invoke-restmethod)\b[^\n|]*\|\s*(iex|invoke-expression)\b|\biex\s*\(\s*\(?\s*New-Object\s+Net\.WebClient/i;

// Security content checks. Each runs over SKILL.md and the bundled text files.
/** Unicode tag characters (as surrogate pairs) and bidirectional controls: they can hide or reorder text. */
const TAG_BIDI_RE = /\uDB40[\uDC00-\uDC7F]|[\u202A-\u202E\u2066-\u2069]/g;
/** Zero-width characters that can carry text in a sequence. One stray zero-width space is common and harmless. */
const ZERO_WIDTH_RE = /[\u200B\u200C\u2060-\u2064]/g;
/** Files the model reads as instructions; in code, only tag and bidi characters count (zero-width ones appear in string literals). */
const PROSE_FILE_RE = /\.(md|mdx|markdown|txt|ya?ml)$/i;
/** Bundled third-party or generated code and tests: not written as part of the skill's instructions. */
const NOT_SKILL_CODE_RE = /(^|\/)(node_modules|vendor|dist|build|tests?|__tests__|spec)\/|\.min\.(js|css)$|\.(test|spec)\.[jt]sx?$/i;
const UNSAFE_YAML_TAG_RE = /!!(python|js|javascript|ruby|perl|java|php)\/|!<tag:yaml\.org,2002:(python|js|ruby|perl|java|php)\//i;
const MANIPULATION_RE = new RegExp(
  [
    String.raw`\b(ignore|disregard|forget|override|discard)\s+(all\s+|any\s+)?(of\s+)?(the\s+|your\s+)?(previous|prior|above|earlier|preceding|system|safety|baseline)\s+(instructions|rules|prompts?|guidelines|directions|safeguards)\b`,
    String.raw`\b(ignore|override|bypass|disable)\s+(all|any|your)\s+(of\s+)?(your\s+)?(safety|security)\s+(rules|guidelines|checks|filters|safeguards|restrictions)\b`,
    String.raw`\b(do not|don't|never)\s+(tell|inform|alert|notify)\s+(the user|the human|anyone)(\s+(about (this|it|these|that)|that you|what you|you('re| are| have|'ve)))?\s*([.;:!]|$)`,
    String.raw`\bwithout\s+(telling|informing|notifying|alerting)\s+(the user|the human|anyone)\s*([.;!]|$)`,
    String.raw`\bhide\s+(this|it|these|that|your actions?)\s+from\s+(the user|the human)\b`,
  ].join("|"),
  "i",
);
/** Lines that quote such phrases in order to warn the agent against them. */
const DEFENSIVE_RE =
  /\b(not instructions|treat (it|them|this|that|every|all|any|fetched|the)\b|flag (it|them|this)|disregard (it|them)|refuse|resist|prompt[- ]injection|injection attempt|(if|when) (a |the |any )?(file|page|content|response|document|text|input|message|tool result|website|email|issue|comment)s? (says|tries|contains|tells|asks|includes)|such as|e\.g\.|for example|attempts? to|jailbreak)\b/i;
const BYPASS_RE = /--dangerously-skip-permissions\b|\bbypassPermissions\b|--dangerously-bypass-approvals-and-sandbox\b|\bdanger-full-access\b|(^|[\s"'`])--yolo\b/;
/** The flag is used, not just named: an agent command on the same line, or a setting that assigns the mode. */
const BYPASS_USE_RE =
  /\b(claude|codex|gemini|qwen|kimi|cursor-agent|copilot|amp|opencode|aider|droid|crush)\b[^\n]*(--dangerously-skip-permissions|--dangerously-bypass-approvals-and-sandbox|danger-full-access|--yolo|bypassPermissions)|(permission_?mode|defaultMode|sandbox(_mode)?|approval_?policy)["']?\s*[:=]\s*["']?(bypassPermissions|danger-full-access)/i;
const ISOLATED_RE = /\b(container|docker|devcontainer|podman|VM|virtual machine|isolated environment|disposable environment)s?\b/i;
const CREDENTIAL_FILE_RE =
  /(~|\$HOME)\/\.ssh\b|\bid_(rsa|ed25519|ecdsa|dsa)\b(?!\.pub)|\.aws\/credentials\b|(^|[\s"'`/~(])\.(netrc|pypirc)\b|\.kube\/config\b|\.docker\/config\.json\b|(~|\$HOME)\/\.config\/gh\b|\/etc\/shadow\b|\bLogin Data\b|Cookies\.binarycookies|\bwallet\.dat\b|\bsecurity\s+find-(generic|internet)-password\b/i;
/** Credential files that hold secrets themselves, unlike `~/.ssh`, which is mostly config. */
const SECRET_FILE_RE =
  /\bid_(rsa|ed25519|ecdsa|dsa)\b(?!\.pub)|\.aws\/credentials\b|(^|[\s"'`/~(])\.netrc\b|\.docker\/config\.json\b|\.kube\/config\b|\/etc\/shadow\b|\bLogin Data\b|Cookies\.binarycookies|\bwallet\.dat\b|\bsecurity\s+find-(generic|internet)-password\b/i;
const NETWORK_RE =
  /\b(curl|wget|ncat|scp|rsync)\s|\bnc\s+-|\bfetch\s*\(|\brequests\.(get|post|put|patch|delete|request)\s*\(|\burllib\.request\b|\bhttpx\.|\bhttps?\.(get|request)\s*\(|\baxios\b|\bInvoke-WebRequest\b|\bInvoke-RestMethod\b|\biwr\s|\birm\s|\bWebClient\b/i;
const DECODE_RUN_RE =
  /\bbase64\s+(-d|--decode|-D)\b[^\n]*\|\s*(sudo\s+)?((ba|z|da|k)?sh|python3?|node|perl)\b|\b(eval|exec|Function)\s*\(\s*(atob|Buffer\.from|base64\.b64decode|b64decode|codecs\.decode|bytes\.fromhex)\b|\bexec\s*\(\s*__import__\(\s*["']base64|FromBase64String[^\n]*\b(Invoke-Expression|iex)\b|(\\x[0-9a-f]{2}){16,}|String\.fromCharCode\(\s*\d+\s*(,\s*\d+\s*){15,}\)/i;
const LONG_BASE64_RE = /[A-Za-z0-9+/]{200,}={0,2}/;
const DATA_URI_RE = /data:[a-z]+\/[\w.+-]+;base64,/i;
/** Files that hold data rather than instructions or code, where long base64 strings are normal. */
const DATA_FILE_RE = /(^|\/)assets\/|\.(json|svg|csv|tsv|lock|txt|xml|html?|map)$/i;
const DOWNLOAD_CMD_RE = /\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|urlretrieve)\b/i;
const HTTP_URL_RE = /(?<!(Origin|Referer|Host):\s*["']?)\bhttp:\/\/([^\s/"'`<>)\]:]+)/gi;
const LOCAL_HOST_RE =
  /^(localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+|(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+|\[?::1\]?|host\.docker\.internal)$|\.(local|localhost|internal|test|example|invalid|lan|home)$|(^|\.)example\.(com|org|net)$|[$<{%]/i;
const SYSTEM_CHANGE_RE =
  /\brm\s+(-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+(-[a-zA-Z]+\s+)*["']?(\/|\/\*|~\/?|\$HOME\/?|\$\{HOME\}\/?)["']?(?=\s|$|[;&|)])|\bchmod\s+(-R\s+)?(777|[ugoa]*\+s|[4-7][0-7]{3})\b|(>>?|\btee\s+(-a\s+)?)\s*["']?(~|\$HOME)\/\.(bashrc|bash_profile|zshrc|zprofile|zshenv|profile|config\/fish\/config\.fish)\b|(>>?|\btee\s+(-a\s+)?)\s*["']?((~|\$HOME)\/)?\.claude\/settings(\.local)?\.json\b|(>>?|\btee\s+(-a\s+)?)\s*["']?(~|\$HOME)\/\.codex\/config\.toml\b|\bcrontab\s+(-e\b|-\s|[\w./-]+\.(txt|cron)\b)|\|\s*crontab\b|\blaunchctl\s+(load|bootstrap)\b|\bsystemctl\s+(--user\s+)?enable\b|\bschtasks\s+\/create\b|\bmkfs(\.\w+)?\s|\bdd\s+if=\S+\s+of=\/dev\//i;
const MUTABLE_URL_RE =
  /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\/latest\/download\/[^\s"'`)]+|https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/(main|master|HEAD)\/[^\s"'`)]+\.(sh|bash|ps1|py|js|mjs|exe|bin)\b/i;
// An agent instruction file on the web (SKILL.md, AGENTS.md, CLAUDE.md, instructions.md, prompt.md, .cursorrules).
const REMOTE_INSTRUCTION_URL_RE =
  /https?:\/\/[^\s)`'"<>\]]*\/((SKILL|AGENTS|CLAUDE|GEMINI|instructions?|prompts?|system[-_]?prompt)\.(md|txt)|\.cursorrules)\b/i;
// A fetch verb shortly before the URL, so "The canonical copy is at <url>" is not a fetch.
const FETCH_BEFORE_URL_RE = /\b(fetch|download|curl|wget|webfetch|read|load|save|pull|retrieve|install)\b[^.\n]{0,60}$/i;
// "Follow the steps at https://...", "execute the commands from https://...".
const FOLLOW_URL_RE =
  /\b(follow|obey|execute|carry out)\b[^.\n]{0,40}\b(instructions?|commands?|steps|directions|prompts?)\b[^.\n]{0,20}https?:\/\/\S+/i;
const NEGATED_RE = /\b(never|don'?t|do not|refuse to)\b[^.\n]{0,40}\b(follow|fetch|load|run|execute|obey|trust)\b/i;

const SHORTENER_RE = /https?:\/\/(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|v\.gd|t\.ly)\/\S+/i;
const IP_URL_RE = /https?:\/\/(\d{1,3}(\.\d{1,3}){3})\b/g;
const NON_PUBLIC_IP_RE = /^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|^192\.0\.2\.|^198\.51\.100\.|^203\.0\.113\./;
const BINARY_EXT_RE = /\.(exe|dll|so|dylib|bin|o|a|class|jar|pyc|wasm|msi|dmg|pkg|deb|rpm|apk)$/i;

const codePoint = (c: string) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

/**
 * Characters on a line that can hide text: any tag or bidi control, and in prose files two or more
 * zero-width characters. Joiners in emoji, a BOM, soft hyphens and direction marks are left out.
 */
function hiddenIn(line: string, path: string): string[] {
  const found = [...line.matchAll(TAG_BIDI_RE)].map((m) => codePoint(m[0]));
  const zero = PROSE_FILE_RE.test(path) ? [...line.matchAll(ZERO_WIDTH_RE)].map((m) => codePoint(m[0])) : [];
  return zero.length >= 2 ? [...found, ...zero] : found;
}

/** A phrase that tells the agent to hide something or drop its rules, unless the line quotes it as a warning. */
function manipulationIn(line: string): string | undefined {
  const m = MANIPULATION_RE.exec(line);
  if (!m) return undefined;
  const before = line.slice(Math.max(0, m.index - 2), m.index);
  if (/["'“‘`(]/.test(before) || DEFENSIVE_RE.test(line)) return undefined;
  return m[0].trim();
}

/** The first public host on a download line served over plain HTTP. */
function plainHttpHost(line: string): string | undefined {
  if (!DOWNLOAD_CMD_RE.test(line)) return undefined;
  for (const m of line.matchAll(HTTP_URL_RE)) {
    const host = m[2]!.toLowerCase();
    if (host.includes(".") && !LOCAL_HOST_RE.test(host)) return host;
  }
  return undefined;
}

function publicIpIn(line: string): string | undefined {
  for (const m of line.matchAll(IP_URL_RE)) if (!NON_PUBLIC_IP_RE.test(m[1]!)) return m[1];
  return undefined;
}

function encodedIn(line: string, path: string): string | undefined {
  if (DECODE_RUN_RE.test(line)) return "decode-then-run code";
  if (DATA_FILE_RE.test(path) || DATA_URI_RE.test(line)) return undefined;
  const blob = LONG_BASE64_RE.exec(line)?.[0];
  if (blob && /\d/.test(blob) && /[a-z]/.test(blob) && /[A-Z]/.test(blob)) return `a ${blob.length}-character base64 string`;
  return undefined;
}
const INLINE_EXEC_RE = /(^|\s)!`[^`\n]+`/;
const SECRET_PATTERNS: [RegExp, string][] = [
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, "a GitHub token"],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}\b/, "a GitHub token"],
  [/\bsk-(ant-|proj-)?[A-Za-z0-9_-]{24,}\b/, "an API secret key"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, "a Slack token"],
  [/\bsk_live_[A-Za-z0-9]{16,}\b/, "a Stripe live key"],
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, "a private key"],
];
/** Test data folders: a secret-looking value here is usually a fake, so it is a warning, not an error. */
const FIXTURE_DIR_RE = /(^|\/)(evals?|fixtures?|__fixtures__|test-?data|testdata|__testdata__)\//i;
/** Bundled files the agent copies or fills in rather than reads for guidance. */
const NOT_REFERENCE_RE = /(^|\/)(assets|templates?)\/|template/i;
const QUOTED_CREDENTIAL_RE = /\b(password|passwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|token)\b["']?\s*[:=]\s*["']([^"'\s]{10,})["']/i;
const ENV_CREDENTIAL_RE = /^\s*(?:export\s+)?[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY)\s*=\s*([^\s"'$]{12,})\s*$/;
const PLACEHOLDER_VALUE_RE = /x{3,}|\*{3,}|your|example|sample|dummy|placeholder|changeme|redacted|test|fake|demo|my-|<|>|\$|\{|\(|token|secret|pass|key|env|\.\.\.|0123|1234|2345|3456|4567|5678|6789/i;

/** Literal-looking secret on this line: a known key format, or a quoted or env value with letters and digits. */
function secretIn(line: string): string | undefined {
  const known = SECRET_PATTERNS.find(([re]) => re.test(line));
  if (known) return known[1];
  const value = QUOTED_CREDENTIAL_RE.exec(line)?.[2] ?? ENV_CREDENTIAL_RE.exec(line)?.[1];
  if (value && /\d/.test(value) && /[a-z]/i.test(value) && !PLACEHOLDER_VALUE_RE.test(value)) return "a literal credential";
  return undefined;
}

const tokens = (text: string) => Math.ceil(text.length / 4);

// Unquoted keys that a YAML 1.1 parser reads as a boolean, null, number or date rather than text.
const NON_STRING_KEY_RE = /^(true|false|yes|no|on|off|y|n|null|~|[-+]?(\d[\d_]*)?\.?\d+([eE][-+]?\d+)?|0x[0-9a-fA-F]+|0o[0-7]+|\d{4}-\d{2}-\d{2})$/i;
const CLAUDE_ONLY_PLACEHOLDER_RE = /\$ARGUMENTS\b|\$\{CLAUDE_(SKILL|PROJECT)_DIR\}/;

/** Every unquoted frontmatter key, at any depth, that YAML may read as something other than text. */
function nonStringKeys(fmText: string): { key: string; line: number }[] {
  const out: { key: string; line: number }[] = [];
  const doc = parseDocument(fmText, { uniqueKeys: false, logLevel: "silent" });
  const walk = (node: unknown) => {
    if (!isMap(node)) return;
    for (const item of node.items) {
      const k = item.key;
      if (isScalar(k) && k.type === "PLAIN" && k.range) {
        const raw = fmText.slice(k.range[0], k.range[1]).trim();
        if (NON_STRING_KEY_RE.test(raw)) out.push({ key: raw, line: fmText.slice(0, k.range[0]).split("\n").length });
      }
      walk(item.value);
    }
  };
  walk(doc.contents);
  return out;
}

interface Parsed {
  frontmatter: Record<string, unknown> | null;
  yamlError?: string;
  fmLines: string[];
  body: string;
  bodyStartLine: number;
}

function parseSkill(text: string): Parsed {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: null, fmLines: [], body: normalized, bodyStartLine: 1 };
  }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return { frontmatter: null, fmLines: [], body: normalized, bodyStartLine: 1 };
  const fmLines = lines.slice(1, end);
  const body = lines.slice(end + 1).join("\n");
  try {
    const data = parseYaml(fmLines.join("\n"), { logLevel: "error" });
    if (data !== null && (typeof data !== "object" || Array.isArray(data))) {
      return { frontmatter: {}, yamlError: "Frontmatter is not a key: value map.", fmLines, body, bodyStartLine: end + 2 };
    }
    return { frontmatter: (data ?? {}) as Record<string, unknown>, fmLines, body, bodyStartLine: end + 2 };
  } catch (e) {
    return { frontmatter: {}, yamlError: (e as Error).message.split("\n")[0], fmLines, body, bodyStartLine: end + 2 };
  }
}

/** Body lines outside fenced code blocks, with their 1-based file line numbers. */
function proseLines(body: string, start: number): { text: string; line: number; inFence: boolean }[] {
  let inFence = false;
  return body.split("\n").map((text, i) => {
    const fence = /^\s*(```|~~~)/.test(text);
    const row = { text, line: start + i, inFence: inFence || fence };
    if (fence) inFence = !inFence;
    return row;
  });
}

function normalizePath(p: string): string {
  const out: string[] = [];
  for (const part of safeDecode(p).split("/")) {
    if (part === "" || part === ".") continue;
    if (part === ".." && out.length && out[out.length - 1] !== "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function safeDecode(p: string): string {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

const stripCode =(md: string) => md.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1.*$/gm, "").replace(/`[^`\n]*`/g, "");

const localLinks = (md: string) =>
  [...stripCode(md).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((m) => m[1]!)
    .filter((href) => !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href))
    .map((href) => href.split("#")[0]!.replace(/^\.\//, ""))
    .filter(Boolean);

export function validateSkill(input: SkillInput): Report {
  const findings: Finding[] = [];
  const ran = new Set<string>();
  const add = (ruleId: string, message: string, line?: number) => {
    const rule = getRule(ruleId);
    findings.push({ ruleId, severity: rule.severity, message, fix: rule.fix, line });
  };
  const run = (ruleId: string, check: () => void) => {
    ran.add(ruleId);
    check();
  };
  // Rules whose subject isn't there, such as step checks on a three-line body. Neither passed nor failed.
  const notApplicable = new Set<string>();
  const na = (...ruleIds: string[]) => ruleIds.forEach((id) => notApplicable.add(id));

  const parsed = parseSkill(input.skillMd);
  const fm = parsed.frontmatter;
  const fmLine = (key: string) => {
    const i = parsed.fmLines.findIndex((l) => new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(l));
    return i === -1 ? undefined : i + 2;
  };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
  const name = fm ? str(fm.name) : "";
  const description = fm ? str(fm.description) : "";
  const hasFolder = input.files !== undefined || input.folderName !== undefined;

  run("frontmatter-missing", () => {
    if (!fm) add("frontmatter-missing", getRule("frontmatter-missing").problem, 1);
  });
  run("frontmatter-invalid-yaml", () => {
    if (!parsed.yamlError) return;
    // NVIDIA's harness tests: Codex drops a skill with duplicate keys or tab indentation.
    const codex = /Map keys must be unique|Tabs are not allowed/.test(parsed.yamlError) ? " (Codex skips the skill)" : "";
    add("frontmatter-invalid-yaml", `Frontmatter is not valid YAML: ${parsed.yamlError.slice(0, 80)}${codex}`, 1);
  });
  run("byte-order-mark", () => {
    if (input.skillMd.startsWith("\uFEFF")) add("byte-order-mark", getRule("byte-order-mark").problem, 1);
  });

  if (fm && !parsed.yamlError) {
    run("name-missing", () => {
      if (!name) add("name-missing", getRule("name-missing").problem, 2);
    });
    run("name-format", () => {
      if (name && (!NAME_RE.test(name) || name.length > 64)) {
        add("name-format", `Name \`${name}\` is not lowercase kebab-case`, fmLine("name"));
      }
    });
    run("name-reserved", () => {
      if (/anthropic|claude/i.test(name)) add("name-reserved", `Name \`${name}\` contains a reserved word`, fmLine("name"));
    });
    if (input.folderName !== undefined) {
      run("name-matches-folder", () => {
        if (name && name !== input.folderName) {
          add("name-matches-folder", `Name \`${name}\` does not match the folder \`${input.folderName}\``, fmLine("name"));
        }
      });
    }
    run("description-missing", () => {
      if (!description) add("description-missing", getRule("description-missing").problem, 2);
    });
    run("description-too-long", () => {
      if (description.length > 1024) {
        add("description-too-long", `Description is ${description.length.toLocaleString("en-US")} characters, over the 1,024 limit`, fmLine("description"));
      }
    });
    run("xml-tags", () => {
      const inName = /[<>]/.test(name);
      if (inName || /[<>]/.test(description)) {
        const what = XML_TAG_RE.test(inName ? name : description) ? "XML-style tag" : "Angle bracket";
        add("xml-tags", `${what} in the ${inName ? "name" : "description"}`, fmLine(inName ? "name" : "description"));
      }
    });
    run("compatibility-too-long", () => {
      const c = str(fm.compatibility);
      if (fm.compatibility !== undefined && (c.length === 0 || c.length > 500)) {
        add("compatibility-too-long", c.length === 0 ? "Compatibility note is empty" : `Compatibility note is ${c.length} characters, over the 500 limit`, fmLine("compatibility"));
      }
    });
    if (description) {
      run("description-no-trigger", () => {
        if (!TRIGGER_RE.test(description)) add("description-no-trigger", getRule("description-no-trigger").problem, fmLine("description"));
      });
      run("description-person", () => {
        const m = PERSON_RE.exec(description);
        if (m) add("description-person", `Description starts with "${m[0].trim()}"`, fmLine("description"));
      });
      run("description-vague", () => {
        // A vague verb only counts when the description also lacks a trigger and is short; longer ones name their tools.
        const m = !TRIGGER_RE.test(description) && description.length < 150 ? VAGUE_RE.exec(description) : null;
        if (description.toLowerCase() === name.toLowerCase() || description.toLowerCase() === name.replace(/-/g, " ")) {
          add("description-vague", "Description only repeats the name", fmLine("description"));
        } else if (m) {
          add("description-vague", `Vague wording in the description: "${m[0]}"`, fmLine("description"));
        }
      });
      run("description-listing-too-long", () => {
        const combined = description.length + str(fm.when_to_use).length;
        if (fm.when_to_use !== undefined && combined > 1536) {
          add("description-listing-too-long", `Description and when_to_use are ${combined.toLocaleString("en-US")} characters, over the 1,536 limit`, fmLine("when_to_use"));
        }
      });
      run("description-trigger-late", () => {
        const at = description.search(TRIGGER_RE);
        if (at > 400) add("description-trigger-late", `Description says when to use it at character ${at}, after the first 400`, fmLine("description"));
      });
      run("description-too-short", () => {
        if (description.length < 60) add("description-too-short", `Description is too short (${description.length} characters)`, fmLine("description"));
      });
    }
    run("non-spec-fields", () => {
      const extra = Object.keys(fm).filter((k) => !SPEC_FIELDS.has(k));
      if (extra.length) add("non-spec-fields", `Frontmatter fields outside the spec: ${extra.map((k) => `\`${k}\``).join(", ")}`, fmLine(extra[0]!));
    });
    run("metadata-format", () => {
      const m = fm.metadata;
      if (m === undefined || m === null) return;
      if (typeof m !== "object" || Array.isArray(m)) {
        add("metadata-format", "metadata is not a key: value map", fmLine("metadata"));
        return;
      }
      const bad = Object.entries(m as Record<string, unknown>).find(([, v]) => v !== null && typeof v === "object");
      if (bad) add("metadata-format", `\`metadata.${bad[0]}\` is a ${Array.isArray(bad[1]) ? "list" : "map"}, not a string`, fmLine("metadata"));
    });
    run("non-string-keys", () => {
      const hit = nonStringKeys(parsed.fmLines.join("\n"))[0];
      if (hit) add("non-string-keys", `Key \`${hit.key}\` is not quoted, so YAML may not read it as text`, hit.line + 1);
    });
    run("legacy-globs", () => {
      if (fm.globs !== undefined) add("legacy-globs", getRule("legacy-globs").problem, fmLine("globs"));
    });
    run("side-effects-auto-invoke", () => {
      const manual = fm["disable-model-invocation"] === true || /allow_implicit_invocation:\s*false/.test(input.files?.["agents/openai.yaml"] ?? "");
      if (!manual && (SIDE_EFFECT_NAME_RE.test(name) || SIDE_EFFECT_DESC_RE.test(description))) {
        add("side-effects-auto-invoke", getRule("side-effects-auto-invoke").problem, fmLine("name"));
      }
    });
    run("broad-allowed-tools", () => {
      const raw = fm["allowed-tools"];
      const list = Array.isArray(raw) ? raw.map(str) : str(raw).split(/[\s,]+(?![^(]*\))/).filter(Boolean);
      const broad = list.find((t) => t === "*" || /^(Bash|Shell)$/i.test(t) || /^(Bash|Shell)\(\s*\*\s*\)$/i.test(t) || /^(Bash|Shell)\(\s*\*?:\*\s*\)$/i.test(t));
      if (broad) add("broad-allowed-tools", `allowed-tools pre-approves \`${broad}\``, fmLine("allowed-tools"));
    });
  }

  const body = parsed.body;
  const bodyTrim = body.trim();
  const bodyLines = bodyTrim ? bodyTrim.split("\n").length : 0;
  const bodyTokens = tokens(bodyTrim);
  // Words with a letter or digit, so Markdown markers such as "#" or "---" don't count.
  const bodyWords = bodyTrim.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const rows = proseLines(body, parsed.bodyStartLine);
  const prose = rows.filter((r) => !r.inFence);
  const firstMatch = (re: RegExp, set = prose) => set.find((r) => re.test(r.text.replace(/`[^`\n]*`/g, "")));
  const links = localLinks(body);

  run("body-empty", () => {
    if (!bodyTrim) add("body-empty", getRule("body-empty").problem, parsed.bodyStartLine);
    else if (bodyWords < 3) add("body-empty", `Body has only ${plural(bodyWords, "word")}, no instructions`, parsed.bodyStartLine);
  });
  if (!bodyTrim) {
    na("body-too-long", "body-too-many-tokens", "long-body-no-references", "no-steps", "no-examples", "shouty-directives", "windows-paths", "time-sensitive", "shell-injection");
  } else {
    run("body-too-long", () => {
      if (bodyLines > 500) add("body-too-long", `Body is ${bodyLines} lines, over the 500-line limit`);
    });
    run("body-too-many-tokens", () => {
      if (bodyTokens > 5000) add("body-too-many-tokens", `Body is about ${bodyTokens.toLocaleString("en-US")} tokens, over about 5,000`);
    });
    if (bodyLines <= 250) {
      na("long-body-no-references");
    } else {
      run("long-body-no-references", () => {        // A Markdown link, a path into a bundled folder, or the name of a bundled file all count as pointing to one.
        const bundled = Object.keys(input.files ?? {}).filter((f) => /\.\w+$/.test(f));
        const mentions = /(^|[\s`"'(])(references|scripts|assets|docs|examples|templates|reference|rules)\/[\w./-]+\.\w+/.test(body) || bundled.some((f) => body.includes(f));
        if (links.length === 0 && !mentions) add("long-body-no-references", `Body is ${bodyLines} lines and links no reference files`);
      });
    }
    // Short bodies are often one-line hand-offs to another skill; steps and examples are only recommended.
    if (bodyLines <= 15) {
      na("no-steps", "no-examples");
    } else {
      run("no-steps", () => {
        const hasSteps = prose.some((r) => /^\s*\d+[.)]\s/.test(r.text) || /^#{1,6}\s.*\b(step|steps|workflow|procedure|how to)\b/i.test(r.text));
        if (!hasSteps) add("no-steps", getRule("no-steps").problem);
      });
      run("no-examples", () => {
        const hasExample = rows.some((r) => /^\s*(```|~~~)/.test(r.text)) || prose.some((r) => /^#{1,6}\s.*\bexamples?\b/i.test(r.text));
        if (!hasExample) add("no-examples", getRule("no-examples").problem);
      });
    }
    run("shouty-directives", () => {
      const count = prose.reduce((n, r) => n + (r.text.replace(/`[^`\n]*`/g, "").match(SHOUT_RE)?.length ?? 0), 0);
      if (count >= 5) add("shouty-directives", `Body shouts MUST, NEVER or ALWAYS ${count} times`);
    });
    run("windows-paths", () => {
      const hit = rows.find((r) => RELATIVE_BACKSLASH_RE.test(r.text) || (!r.inFence && DRIVE_PATH_RE.test(r.text)));
      if (hit) add("windows-paths", `Path uses backslashes: "${hit.text.trim().slice(0, 60)}"`, hit.line);
    });
    run("claude-only-placeholders", () => {
      const hit = rows.find((r) => CLAUDE_ONLY_PLACEHOLDER_RE.test(r.text));
      if (hit) add("claude-only-placeholders", `\`${CLAUDE_ONLY_PLACEHOLDER_RE.exec(hit.text)![0]}\` is filled in only by Claude Code`, hit.line);
    });
    run("time-sensitive", () => {
      const hit = firstMatch(TIME_RE);
      if (hit) add("time-sensitive", `Wording that will go out of date: "${TIME_RE.exec(hit.text)?.[0]}"`, hit.line);
    });
    run("shell-injection", () => {
      const hit = rows.find((r) => /^\s*```!\s*$/.test(r.text)) ?? prose.find((r) => INLINE_EXEC_RE.test(r.text));
      if (hit) add("shell-injection", getRule("shell-injection").problem, hit.line);
    });
  }

  run("hardcoded-secret", () => {
    const all = input.skillMd.replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < all.length; i++) {
      const found = secretIn(all[i]!);
      if (found) {
        add("hardcoded-secret", `Possible real secret: ${found}`, i + 1);
        return;
      }
    }
    for (const [path, text] of Object.entries(input.files ?? {})) {
      if (FIXTURE_DIR_RE.test(path)) continue;
      const lines = text.split("\n");
      const at = lines.findIndex((l) => secretIn(l));
      if (at !== -1) {
        add("hardcoded-secret", `Possible real secret: ${secretIn(lines[at]!)} in \`${path}\`, line ${at + 1}`);
        return;
      }
    }
  });

  if (input.files !== undefined) {
    run("fixture-secret", () => {
      for (const [path, text] of Object.entries(input.files!)) {
        if (!FIXTURE_DIR_RE.test(path)) continue;
        const lines = text.split("\n");
        const at = lines.findIndex((l) => secretIn(l));
        if (at !== -1) {
          add("fixture-secret", `Realistic secret in test data: ${secretIn(lines[at]!)} in \`${path}\`, line ${at + 1}`);
          return;
        }
      }
    });
  }

  if (input.files !== undefined) {
    const files = input.files;
    const has = (p: string) => p in files || Object.keys(files).some((f) => f.startsWith(`${p.replace(/\/$/, "")}/`));
    run("broken-links", () => {
      const missing = links.find((l) => !has(normalizePath(l)));
      const where = missing?.startsWith("../") ? "points outside the skill folder" : "is linked but missing from the folder";
      if (missing) add("broken-links", `\`${missing}\` ${where}`, rows.find((r) => r.text.includes(missing))?.line);
    });
    run("deep-references", () => {
      const direct = new Set(links.map((l) => normalizePath(l)));
      for (const link of links.filter((l) => /\.md$/i.test(l) && normalizePath(l) in files)) {
        const dir = link.includes("/") ? link.slice(0, link.lastIndexOf("/") + 1) : "";
        const nested = localLinks(files[normalizePath(link)]!).find((l) => {
          const target = normalizePath(`${dir}${l}`);
          return /\.md$/i.test(l) && target !== "SKILL.md" && target in files && !direct.has(target);
        });
        if (nested) {
          add("deep-references", `\`${link}\` links on to \`${nested}\`, which SKILL.md does not link`);
          return;
        }
      }
    });
    run("reference-no-toc", () => {
      for (const [path, text] of Object.entries(files)) {
        if (!/\.md$/i.test(path) || NOT_REFERENCE_RE.test(path) || FIXTURE_DIR_RE.test(path)) continue;
        const lines = text.split("\n");
        if (lines.length <= 100) continue;
        const head = lines.slice(0, 40);
        const listed = head.filter((l) => /^\s*([-*+]|\d+[.)])\s/.test(l)).length;
        const hasToc = head.some((l) => /^#{1,6}\s*(table of )?contents\b/i.test(l)) || listed >= 3;
        if (!hasToc) {
          add("reference-no-toc", `\`${path}\` is ${lines.length} lines with no contents list`);
          return;
        }
      }
    });
    run("generic-file-names", () => {
      const hit = Object.keys(files).find((p) => GENERIC_FILE_RE.test(p));
      if (hit) add("generic-file-names", `\`${hit}\` has a generic name`);
    });
    run("extraneous-files", () => {
      const hit = Object.keys(files).find((p) => !p.includes("/") && EXTRANEOUS_FILES.has(p.toLowerCase()));
      if (hit) add("extraneous-files", `\`${hit}\` is inside the skill folder`);
    });
    run("interactive-script", () => {
      for (const [path, text] of Object.entries(files)) {
        const re = INTERACTIVE_BY_EXT.find(([ext]) => ext.test(path))?.[1];
        // Templates are copied and edited for a person to run, often on purpose interactive.
        if (!re || /template/i.test(path)) continue;
        const at = text.split("\n").findIndex((l) => !/^\s*(#|\/\/)/.test(l) && re.test(l));
        if (at !== -1) {
          add("interactive-script", `\`${path}\` line ${at + 1} waits for typed input`);
          return;
        }
      }
    });
  }

  // Security content checks read SKILL.md and the bundled text files the skill's author wrote. Test data,
  // tests and bundled third-party or built code hold samples and other people's code, so they are skipped.
  const texts: { path: string; lines: string[]; fixture: boolean }[] = [
    { path: "SKILL.md", lines: input.skillMd.replace(/\r\n/g, "\n").split("\n"), fixture: false },
    ...Object.entries(input.files ?? {}).map(([path, text]) => ({
      path,
      lines: text.replace(/\r\n/g, "\n").split("\n"),
      fixture: FIXTURE_DIR_RE.test(path) || NOT_SKILL_CODE_RE.test(path),
    })),
  ];
  const where = (path: string, line: number) => (path === "SKILL.md" ? "" : ` in \`${path}\`, line ${line}`);
  /** First line in the scanned files where `test` returns something; SKILL.md first. */
  const scan = <T,>(test: (line: string, i: number, path: string) => T | undefined, withFixtures = false) => {
    for (const { path, lines, fixture } of texts) {
      if (fixture && !withFixtures) continue;
      for (let i = 0; i < lines.length; i++) {
        const value = test(lines[i]!, i, path);
        if (value !== undefined && value !== false) return { path, line: i + 1, value, text: lines[i]! };
      }
    }
    return undefined;
  };
  const snippet = (t: string, n = 70) => t.trim().slice(0, n);
  const lineFor = (hit: { path: string; line: number }) => (hit.path === "SKILL.md" ? hit.line : undefined);

  run("hidden-characters", () => {
    const hit = scan((l, _i, path) => {
      const found = hiddenIn(l, path);
      return found.length ? found : undefined;
    });
    if (hit) {
      const kinds = [...new Set(hit.value)].slice(0, 3).join(", ");
      add("hidden-characters", `${plural(hit.value.length, "hidden character")} (${kinds})${where(hit.path, hit.line)}`, lineFor(hit));
    }
  });
  if (fm && !parsed.yamlError) {
    run("unsafe-yaml-tag", () => {
      const i = parsed.fmLines.findIndex((l) => UNSAFE_YAML_TAG_RE.test(l));
      if (i !== -1) add("unsafe-yaml-tag", `Frontmatter uses \`${UNSAFE_YAML_TAG_RE.exec(parsed.fmLines[i]!)![0]}\``, i + 2);
    });
    run("skill-hooks", () => {
      if (fm.hooks !== undefined && fm.hooks !== null) add("skill-hooks", getRule("skill-hooks").problem, fmLine("hooks"));
    });
  }
  run("remote-exec", () => {
    const hit = scan((l) => REMOTE_EXEC_RE.test(l));
    if (hit) add("remote-exec", `Pipes a download into a shell: "${snippet(hit.text)}"${where(hit.path, hit.line)}`, lineFor(hit));
  });
  run("instruction-manipulation", () => {
    const hit = scan((l) => manipulationIn(l));
    if (hit) add("instruction-manipulation", `Tells the agent: "${hit.value}"${where(hit.path, hit.line)}`, lineFor(hit));
  });
  run("permission-bypass", () => {
    const isolated = new Set(texts.filter((t) => t.lines.some((l) => ISOLATED_RE.test(l))).map((t) => t.path));
    const hit = scan((l, _i, path) => (!isolated.has(path) && BYPASS_USE_RE.test(l) ? BYPASS_RE.exec(l)?.[0].replace(/^["'`\s]+/, "") : undefined));
    if (hit) add("permission-bypass", `Turns off permission prompts with \`${hit.value}\`${where(hit.path, hit.line)}`, lineFor(hit));
  });
  const credential = scan((l) => CREDENTIAL_FILE_RE.exec(l)?.[0].trim());
  const network = scan((l) => NETWORK_RE.exec(l)?.[0].trim());
  run("secrets-and-network", () => {
    // Both in the same file, so a big repo's unrelated README and script don't add up to a finding.
    for (const t of texts) {
      if (t.fixture) continue;
      const at = t.lines.findIndex((l) => SECRET_FILE_RE.test(l));
      const net = at === -1 ? undefined : t.lines.map((l) => NETWORK_RE.exec(l)?.[0].trim()).find(Boolean);
      if (net) {
        add("secrets-and-network", `Reads \`${SECRET_FILE_RE.exec(t.lines[at]!)![0].trim()}\`${where(t.path, at + 1)} and calls the network with \`${net}\``, t.path === "SKILL.md" ? at + 1 : undefined);
        return;
      }
    }
  });
  run("credential-files", () => {
    if (credential) add("credential-files", `Names the credential file \`${credential.value}\`${where(credential.path, credential.line)}`, lineFor(credential));
  });
  run("encoded-payload", () => {
    const hit = scan((l, _i, path) => encodedIn(l, path));
    if (hit) add("encoded-payload", `Contains ${hit.value}${where(hit.path, hit.line)}`, lineFor(hit));
  });
  run("plain-http-download", () => {
    const hit = scan((l) => plainHttpHost(l));
    if (hit) add("plain-http-download", `Downloads from http://${hit.value} without HTTPS${where(hit.path, hit.line)}`, lineFor(hit));
  });
  run("system-changes", () => {
    const hit = scan((l) => SYSTEM_CHANGE_RE.exec(l)?.[0].trim());
    if (hit) add("system-changes", `Changes the system: "${snippet(hit.text)}"${where(hit.path, hit.line)}`, lineFor(hit));
  });
  run("mutable-download", () => {
    const hit = scan((l) => (DOWNLOAD_CMD_RE.test(l) ? MUTABLE_URL_RE.exec(l)?.[0] : undefined));
    if (hit) add("mutable-download", `Downloads from a URL that changes: ${snippet(hit.value, 90)}${where(hit.path, hit.line)}`, lineFor(hit));
  });
  run("remote-instructions", () => {
    const hit = scan((l) => {
      if (NEGATED_RE.test(l)) return undefined;
      const file = REMOTE_INSTRUCTION_URL_RE.exec(l);
      if (file && FETCH_BEFORE_URL_RE.test(l.slice(0, file.index))) return file[0];
      return FOLLOW_URL_RE.exec(l)?.[0].match(/https?:\/\/\S+/)![0].replace(/[)`'".,>\]]+$/, "");
    });
    if (hit) add("remote-instructions", `Takes instructions from the web: ${snippet(hit.value, 90)}${where(hit.path, hit.line)}`, lineFor(hit));
  });
  run("hidden-link", () => {
    const hit = scan((l) => SHORTENER_RE.exec(l)?.[0] ?? publicIpIn(l));
    if (hit) add("hidden-link", `Link hides its destination: ${snippet(hit.value, 60)}${where(hit.path, hit.line)}`, lineFor(hit));
  });
  run("network-calls", () => {
    if (network) add("network-calls", `Calls the network with \`${network.value}\`${where(network.path, network.line)}`, lineFor(network));
  });
  if (input.files !== undefined) {
    run("binary-files", () => {
      const bins = Object.keys(input.files!).filter((p) => BINARY_EXT_RE.test(p));
      if (bins.length) add("binary-files", `Ships ${plural(bins.length, "binary file")}: ${bins.slice(0, 3).map((b) => `\`${b}\``).join(", ")}`);
    });
  }

  const failed = new Set(findings.map((f) => f.ruleId));
  const passed = RULES.filter((r) => ran.has(r.id) && !failed.has(r.id)).map((r) => r.id);
  const noted = RULES.filter((r) => r.severity === "note" && failed.has(r.id)).map((r) => r.id);
  const skipped = RULES.filter((r) => r.needsFolder && !hasFolder).map((r) => r.id);
  const left = RULES.filter((r) => !ran.has(r.id) && !skipped.includes(r.id) && !notApplicable.has(r.id)).map((r) => r.id);
  // Without a readable frontmatter block the rules that read its fields can't run, and no agent can load
  // the skill, so it can't pass. Otherwise a rule that didn't run had nothing to check, such as
  // `description-no-trigger` with no description or `name-matches-folder` with no folder name.
  const frontmatterBroken = !fm || parsed.yamlError !== undefined;
  const blocked = frontmatterBroken ? left : [];
  if (!frontmatterBroken) na(...left);
  const notApplicableIds = RULES.filter((r) => notApplicable.has(r.id)).map((r) => r.id);
  const { score, grade } = frontmatterBroken ? penaltyScore(findings, true) : scoreFindings(findings);

  return {
    name: name || undefined,
    description: description || undefined,
    findings: findings.sort((a, b) => order(a.severity) - order(b.severity) || (a.line ?? 0) - (b.line ?? 0)),
    passed,
    skipped,
    blocked,
    notApplicable: notApplicableIds,
    noted,
    score,
    grade,
    areas: scoreAreas(findings, passed, { notApplicable: notApplicableIds, frontmatterBroken }),
    stats: {
      bodyLines,
      bodyTokens,
      descriptionChars: description.length,
      descriptionTokens: tokens(description),
      files: 1 + Object.keys(input.files ?? {}).length,
    },
  };
}

const order = (s: Finding["severity"]) => ({ error: 0, warning: 1, info: 2, note: 3 })[s];

/** Overall score: 100 minus a penalty for each failing rule, counted once per rule. */
export function scoreFindings(findings: Pick<Finding, "ruleId" | "severity">[]): { score: number; grade: Grade } {
  return penaltyScore(findings, false);
}

/**
 * A grade for each area, from that area's rules only. An error caps its area at {@link ERROR_CAP}.
 * `passed` lists the rule ids that ran and found nothing; rules that didn't run don't count.
 * With `frontmatterBroken`, only Specification is graded: the other areas would grade a file no agent can load.
 */
export function scoreAreas(
  findings: Pick<Finding, "ruleId" | "severity">[],
  passed: string[],
  { notApplicable = [], frontmatterBroken = false }: { notApplicable?: string[]; frontmatterBroken?: boolean } = {},
): AreaScore[] {
  const areaOf = (id: string) => RULES_BY_ID[id]?.category;
  return AREAS.map(({ id, label }) => {
    // Notes cost nothing and are neither passed nor failed.
    const own = findings.filter((f) => areaOf(f.ruleId) === id && f.severity !== "note");
    const failed = new Set(own.map((f) => f.ruleId)).size;
    const passedHere = passed.filter((r) => areaOf(r) === id).length;
    const total = passedHere + failed;
    return {
      area: id,
      label,
      ...penaltyScore(own, true),
      graded: total > 0 && (!frontmatterBroken || id === "spec"),
      passed: passedHere,
      failed,
      total,
      notApplicable: notApplicable.filter((r) => areaOf(r) === id).length,
    };
  });
}

function penaltyScore(findings: Pick<Finding, "ruleId" | "severity">[], capErrors: boolean): { score: number; grade: Grade } {
  const failedRules = new Map(findings.map((f) => [f.ruleId, f.severity]));
  let score = 100;
  for (const severity of failedRules.values()) score -= PENALTY[severity];
  if (capErrors && [...failedRules.values()].includes("error")) score = Math.min(score, ERROR_CAP);
  score = Math.max(0, score);
  return { score, grade: gradeFor(score) };
}

export function gradeFor(score: number): Grade {
  return GRADE_BANDS.find(([, min]) => score >= min)![0];
}

/** "1 line", "2 lines". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function reportToMarkdown(report: Report, title = report.name ?? "SKILL.md"): string {
  const lines = [`# Skillland report: ${title}`, "", `**Score:** ${report.score}/100 (grade ${report.grade})`, ""];
  lines.push(
    "| Area | Grade | Checks passed |",
    "| --- | --- | --- |",
    ...report.areas.map((a) => `| ${a.label} | ${a.graded ? `${a.grade} (${a.score})` : a.total ? "not graded" : "not checked"} | ${a.passed} of ${a.total} |`),
    "",
  );
  lines.push(
    `Body: ${plural(report.stats.bodyLines, "line")}, about ${plural(report.stats.bodyTokens, "token")}. Description: ${plural(report.stats.descriptionChars, "character")}.`,
    "",
  );
  if (!report.findings.some((f) => f.severity !== "note")) lines.push("No findings.", "");
  const headings = { error: "Errors", warning: "Warnings", info: "Suggestions", note: "Notes to review (no points off)" } as const;
  for (const severity of ["error", "warning", "info", "note"] as const) {
    const group = report.findings.filter((f) => f.severity === severity);
    if (!group.length) continue;
    lines.push(`## ${headings[severity]}`, "");
    for (const f of group) {
      const rule = getRule(f.ruleId);
      lines.push(
        `- **${f.message}** (${f.severity}${f.line ? `, line ${f.line}` : ""}). ${rule.whyHeading}. **Fix:** ${rule.fixHeading}. ${rule.fix} Rule: [${rule.title}](https://skillland.io/validate/rules/${f.ruleId})`,
      );
    }
    lines.push("");
  }
  lines.push(`${plural(report.passed.length, "check")} passed. Rules: https://skillland.io/validate/rules`);
  if (report.blocked.length) {
    lines.push("", `${plural(report.blocked.length, "check")} didn't run because the frontmatter block is missing or isn't valid YAML. Only Specification is graded until it is fixed.`);
  }
  if (report.notApplicable.length) lines.push("", `${plural(report.notApplicable.length, "check")} didn't apply, such as step checks on a short body.`);
  if (report.skipped.length) lines.push("", `${plural(report.skipped.length, "folder check")} skipped. Check the whole skill folder to run them.`);
  return lines.join("\n");
}
