import fs from "node:fs";
import path from "node:path";
import { RULES, reportToMarkdown, validateSkill } from "./index";
import type { Report } from "./types";

const HELP = `Usage: skillland check <path> [options]

Lints an agent skill against the Skillland rules (https://skillland.io/validate/rules).
<path> is a skill folder that holds SKILL.md, or a SKILL.md file. Folders are searched
for every SKILL.md below them.

Options:
  --json             Print the reports as JSON instead of text
  --min-score <n>    Exit with code 1 when any skill scores below n (default: fail only on errors)
  -h, --help         Show this help

Exit codes: 0 all skills pass, 1 a skill has an error or scores below --min-score, 2 bad usage.`;

const MAX_FILE_BYTES = 200_000;
const TEXT_EXT = /\.(md|mdx|markdown|txt|ya?ml|json|py|sh|bash|zsh|js|mjs|cjs|ts|ps1|rb)$/i;
const SKIP_DIRS = new Set(["node_modules", ".git"]);

function walk(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(dir, p));
    } else if (entry.isFile()) out.push(p);
  }
  return out;
}

/** Validates the skill whose SKILL.md sits in `dir`, with every other file in that folder. */
function checkFolder(dir: string): Report {
  const files: Record<string, string> = {};
  for (const rel of walk(dir)) {
    if (rel === "SKILL.md" || /(^|\/)SKILL\.md$/.test(rel)) continue;
    const full = path.join(dir, rel);
    const readable = TEXT_EXT.test(rel) && fs.statSync(full).size <= MAX_FILE_BYTES;
    files[rel] = readable ? fs.readFileSync(full, "utf8") : "";
  }
  return validateSkill({ skillMd: fs.readFileSync(path.join(dir, "SKILL.md"), "utf8"), folderName: path.basename(path.resolve(dir)), files });
}

function findSkills(target: string): string[] {
  if (fs.statSync(target).isFile()) return [path.dirname(target)];
  if (fs.existsSync(path.join(target, "SKILL.md"))) return [target];
  return walk(target)
    .filter((p) => /(^|\/)SKILL\.md$/.test(p))
    .map((p) => path.join(target, path.dirname(p)));
}

function main(argv: string[]): number {
  if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) {
    console.log(HELP);
    return argv.length === 0 ? 2 : 0;
  }
  const [command, target, ...rest] = argv;
  if (command !== "check" || !target) {
    console.error(`Unknown command. Run "skillland --help".`);
    return 2;
  }
  const json = rest.includes("--json");
  const minAt = rest.indexOf("--min-score");
  const minScore = minAt === -1 ? undefined : Number(rest[minAt + 1]);
  if (minScore !== undefined && !(minScore >= 0 && minScore <= 100)) {
    console.error("--min-score needs a number from 0 to 100.");
    return 2;
  }
  if (!fs.existsSync(target)) {
    console.error(`Not found: ${target}`);
    return 2;
  }
  const dirs = findSkills(target);
  if (dirs.length === 0) {
    console.error(`No SKILL.md found under ${target}.`);
    return 2;
  }

  const results = dirs.map((dir) => ({ path: path.relative(process.cwd(), dir) || ".", report: checkFolder(dir) }));
  const failed = results.filter(
    ({ report }) => report.findings.some((f) => f.severity === "error") || (minScore !== undefined && report.score < minScore),
  );

  if (json) console.log(JSON.stringify(results, null, 2));
  else {
    for (const { path: p, report } of results) console.log(`${reportToMarkdown(report, `${report.name ?? "SKILL.md"} (${p})`)}\n`);
    console.log(`${results.length} skill(s) checked against ${RULES.length} rules, ${failed.length} failed.`);
  }
  return failed.length ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
