import { parse as parseYaml } from "yaml";
import { RULES, getRule } from "./rules";
import type { Finding, Grade, Report, SkillInput } from "./types";

export * from "./types";
export { RULES, RULES_BY_ID, getRule } from "./rules";
export { S as SOURCES } from "./sources";

export const PENALTY = { error: 25, warning: 8, info: 2 } as const;
export const ERROR_CAP = 59;
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
const REMOTE_EXEC_RE = /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|k)?sh\b|\b(iwr|invoke-webrequest|irm|invoke-restmethod)\b[^\n|]*\|\s*(iex|invoke-expression)\b/i;
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
    const data = parseYaml(fmLines.join("\n"));
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
    if (parsed.yamlError) add("frontmatter-invalid-yaml", `Frontmatter is not valid YAML: ${parsed.yamlError.slice(0, 80)}`, 1);
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
      const broad = list.find((t) => t === "*" || t === "Bash" || /^Bash\(\s*\*\s*\)$/.test(t) || /^Bash\(\s*\*:\*\s*\)$/.test(t));
      if (broad) add("broad-allowed-tools", `allowed-tools pre-approves \`${broad}\``, fmLine("allowed-tools"));
    });
  }

  const body = parsed.body;
  const bodyTrim = body.trim();
  const bodyLines = bodyTrim ? bodyTrim.split("\n").length : 0;
  const bodyTokens = tokens(bodyTrim);
  const rows = proseLines(body, parsed.bodyStartLine);
  const prose = rows.filter((r) => !r.inFence);
  const firstMatch = (re: RegExp, set = prose) => set.find((r) => re.test(r.text.replace(/`[^`\n]*`/g, "")));
  const links = localLinks(body);

  run("body-empty", () => {
    if (!bodyTrim) add("body-empty", getRule("body-empty").problem, parsed.bodyStartLine);
  });
  if (bodyTrim) {
    run("body-too-long", () => {
      if (bodyLines > 500) add("body-too-long", `Body is ${bodyLines} lines, over the 500-line limit`);
    });
    run("body-too-many-tokens", () => {
      if (bodyTokens > 5000) add("body-too-many-tokens", `Body is about ${bodyTokens.toLocaleString("en-US")} tokens, over about 5,000`);
    });
    run("long-body-no-references", () => {
      // A Markdown link, a path into a bundled folder, or the name of a bundled file all count as pointing to one.
      const bundled = Object.keys(input.files ?? {}).filter((f) => /\.\w+$/.test(f));
      const mentions = /(^|[\s`"'(])(references|scripts|assets|docs|examples|templates|reference|rules)\/[\w./-]+\.\w+/.test(body) || bundled.some((f) => body.includes(f));
      if (bodyLines > 250 && links.length === 0 && !mentions) add("long-body-no-references", `Body is ${bodyLines} lines and links no reference files`);
    });
    run("no-steps", () => {
      const hasSteps = prose.some((r) => /^\s*\d+[.)]\s/.test(r.text) || /^#{1,6}\s.*\b(step|steps|workflow|procedure|how to)\b/i.test(r.text));
      if (bodyLines > 15 && !hasSteps) add("no-steps", getRule("no-steps").problem);
    });
    run("no-examples", () => {
      const hasExample = rows.some((r) => /^\s*(```|~~~)/.test(r.text)) || prose.some((r) => /^#{1,6}\s.*\bexamples?\b/i.test(r.text));
      if (bodyLines > 15 && !hasExample) add("no-examples", getRule("no-examples").problem);
    });
    run("shouty-directives", () => {
      const count = prose.reduce((n, r) => n + (r.text.replace(/`[^`\n]*`/g, "").match(SHOUT_RE)?.length ?? 0), 0);
      if (count >= 5) add("shouty-directives", `Body shouts MUST, NEVER or ALWAYS ${count} times`);
    });
    run("windows-paths", () => {
      const hit = rows.find((r) => RELATIVE_BACKSLASH_RE.test(r.text) || (!r.inFence && DRIVE_PATH_RE.test(r.text)));
      if (hit) add("windows-paths", `Path uses backslashes: "${hit.text.trim().slice(0, 60)}"`, hit.line);
    });
    run("time-sensitive", () => {
      const hit = firstMatch(TIME_RE);
      if (hit) add("time-sensitive", `Wording that will go out of date: "${TIME_RE.exec(hit.text)?.[0]}"`, hit.line);
    });
    run("remote-exec", () => {
      const hit = rows.find((r) => REMOTE_EXEC_RE.test(r.text));
      if (hit) add("remote-exec", `Pipes a download into a shell: "${hit.text.trim().slice(0, 70)}"`, hit.line);
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

  const failed = new Set(findings.map((f) => f.ruleId));
  const passed = RULES.filter((r) => ran.has(r.id) && !failed.has(r.id)).map((r) => r.id);
  const skipped = RULES.filter((r) => r.needsFolder && !hasFolder).map((r) => r.id);
  // Rules that read frontmatter fields can't run without a valid frontmatter block.
  const blocked = RULES.filter((r) => !ran.has(r.id) && !skipped.includes(r.id)).map((r) => r.id);
  const { score, grade } = scoreFindings(findings);

  return {
    name: name || undefined,
    description: description || undefined,
    findings: findings.sort((a, b) => order(a.severity) - order(b.severity) || (a.line ?? 0) - (b.line ?? 0)),
    passed,
    skipped,
    blocked,
    score,
    grade,
    stats: {
      bodyLines,
      bodyTokens,
      descriptionChars: description.length,
      descriptionTokens: tokens(description),
      files: 1 + Object.keys(input.files ?? {}).length,
    },
  };
}

const order = (s: Finding["severity"]) => (s === "error" ? 0 : s === "warning" ? 1 : 2);

export function scoreFindings(findings: Pick<Finding, "ruleId" | "severity">[]): { score: number; grade: Grade } {
  const failedRules = new Map(findings.map((f) => [f.ruleId, f.severity]));
  let score = 100;
  for (const severity of failedRules.values()) score -= PENALTY[severity];
  if ([...failedRules.values()].includes("error")) score = Math.min(score, ERROR_CAP);
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
    `Body: ${plural(report.stats.bodyLines, "line")}, about ${plural(report.stats.bodyTokens, "token")}. Description: ${plural(report.stats.descriptionChars, "character")}.`,
    "",
  );
  if (report.findings.length === 0) lines.push("No findings.");
  for (const severity of ["error", "warning", "info"] as const) {
    const group = report.findings.filter((f) => f.severity === severity);
    if (!group.length) continue;
    lines.push(`## ${severity === "error" ? "Errors" : severity === "warning" ? "Warnings" : "Suggestions"}`, "");
    for (const f of group) {
      const rule = getRule(f.ruleId);
      lines.push(
        `- **${f.message}** (${f.severity}${f.line ? `, line ${f.line}` : ""}). ${rule.whyHeading}. **Fix:** ${rule.fixHeading}. ${rule.fix} Rule: [${rule.title}](https://skillland.io/validate/rules/${f.ruleId})`,
      );
    }
    lines.push("");
  }
  lines.push(`${plural(report.passed.length, "check")} passed. Rules: https://skillland.io/validate/rules`);
  if (report.blocked.length) lines.push("", `${plural(report.blocked.length, "check")} didn't run because the frontmatter block is missing or isn't valid YAML.`);
  if (report.skipped.length) lines.push("", `${plural(report.skipped.length, "folder check")} skipped. Check the whole skill folder to run them.`);
  return lines.join("\n");
}
