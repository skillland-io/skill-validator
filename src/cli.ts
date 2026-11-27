import fs from "node:fs";
import path from "node:path";
import { failsAreaGrade, parseAreaGrade, toAnnotations, toSummary } from "./github";
import { RULES, reportToMarkdown, validateSkill } from "./index";
import type { Report } from "./types";

const HELP = `Usage: skillland check <path> [options]

Lints an agent skill against the Skillland rules (https://skillland.io/validate/rules).
<path> is a skill folder that holds SKILL.md, or a SKILL.md file. Folders are searched
for every SKILL.md below them.

Options:
  --format <f>            text (default), json, or github: annotations on each finding's line
                          in the pull request, plus a job summary when GITHUB_STEP_SUMMARY is set
  --json                  Same as --format json
  --min-score <n>         Exit with code 1 when any skill scores below n (default: fail only on errors)
  --min-area-grade <g>    Exit with code 1 when an area grades below g. "B" applies to every area,
                          "security=A" to one (spec, description, structure, security). Repeatable.
  -h, --help              Show this help

Exit codes: 0 all skills pass, 1 a skill has an error or misses a --min-score or --min-area-grade
limit, 2 bad usage.`;

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

/** "owner/name" when the workflow runs in a public repo, so the summary can link its skills on skillland.io/check. */
function publicRepo(): string | undefined {
  const repo = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!repo || !eventPath || !fs.existsSync(eventPath)) return undefined;
  try {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    return event?.repository?.private === false ? repo : undefined;
  } catch {
    return undefined;
  }
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
  const formatAt = rest.indexOf("--format");
  const format = rest.includes("--json") ? "json" : formatAt === -1 ? "text" : (rest[formatAt + 1] ?? "");
  if (!["text", "json", "github"].includes(format)) {
    console.error("--format needs text, json or github.");
    return 2;
  }
  const areaLimits: NonNullable<ReturnType<typeof parseAreaGrade>>[] = [];
  for (let i = rest.indexOf("--min-area-grade"); i !== -1; i = rest.indexOf("--min-area-grade", i + 1)) {
    const limit = parseAreaGrade(rest[i + 1] ?? "");
    if (!limit) {
      console.error('--min-area-grade needs a grade from A to F, such as "B" or "security=A".');
      return 2;
    }
    areaLimits.push(limit);
  }
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
    ({ report }) =>
      report.findings.some((f) => f.severity === "error") ||
      (minScore !== undefined && report.score < minScore) ||
      failsAreaGrade(report, areaLimits),
  );

  if (format === "json") console.log(JSON.stringify(results, null, 2));
  else if (format === "github") {
    for (const line of toAnnotations(results)) console.log(line);
    for (const { path: p, report } of results) {
      const mark = failed.some((f) => f.path === p) ? "fail" : "pass";
      console.log(`${mark}  ${report.score} (${report.grade})  ${report.name ?? "SKILL.md"} (${p})`);
    }
    console.log(`${results.length} skill(s) checked against ${RULES.length} rules, ${failed.length} failed.`);
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      const repo = publicRepo();
      fs.appendFileSync(summaryFile, toSummary(results, { repo, failed: new Set(failed.map((f) => f.path)) }));
    }
  } else {
    for (const { path: p, report } of results) console.log(`${reportToMarkdown(report, `${report.name ?? "SKILL.md"} (${p})`)}\n`);
    console.log(`${results.length} skill(s) checked against ${RULES.length} rules, ${failed.length} failed.`);
  }
  return failed.length ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
