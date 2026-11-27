import { getRule } from "./rules";
import type { Grade, Report, RuleCategory, Severity } from "./types";

/** One checked skill: its folder relative to the working directory, and its report. */
export interface CheckedSkill {
  path: string;
  report: Report;
}

const RULES_URL = "https://skillland.io/validate/rules";
const LEVEL: Record<Severity, "error" | "warning" | "notice"> = { error: "error", warning: "warning", info: "notice", note: "notice" };
const GRADES: Grade[] = ["A", "B", "C", "D", "F"];
const AREAS: RuleCategory[] = ["spec", "description", "structure", "security"];

const escapeData = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProp = (s: string) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
const skillFile = (dir: string) => (dir === "." ? "SKILL.md" : `${dir.replace(/\\/g, "/")}/SKILL.md`);

/**
 * GitHub Actions workflow commands, one per finding, so each shows on its line of SKILL.md in the
 * pull request. Errors are errors, warnings warnings, suggestions and notes are notices.
 */
export function toAnnotations(results: CheckedSkill[]): string[] {
  const out: string[] = [];
  for (const { path, report } of results) {
    for (const f of report.findings) {
      const rule = getRule(f.ruleId);
      const props = [`file=${escapeProp(skillFile(path))}`];
      if (f.line) props.push(`line=${f.line}`);
      props.push(`title=${escapeProp(`Skillland: ${rule.title}`)}`);
      const msg = `${f.message}. Fix: ${rule.fixHeading}. ${RULES_URL}/${f.ruleId}`;
      out.push(`::${LEVEL[f.severity]} ${props.join(",")}::${escapeData(msg)}`);
    }
  }
  return out;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/**
 * Markdown for the job summary: a table with each skill's score and area grades, then its findings
 * with links to the rule pages. `repo` ("owner/name" of a public repo) adds a link to the skill's
 * full report on skillland.io/check.
 */
export function toSummary(results: CheckedSkill[], opts: { repo?: string; failed?: Set<string> } = {}): string {
  const lines = ["## Skillland skill check", ""];
  lines.push(
    "| Skill | Result | Score | Specification | Description | Structure | Security |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const { path, report } of results) {
    const name = cell(report.name ?? path);
    const link = opts.repo ? `[${name}](https://skillland.io/check/${opts.repo}/${path === "." ? "SKILL.md" : path.replace(/\\/g, "/")})` : name;
    const grades = AREAS.map((a) => {
      const area = report.areas.find((x) => x.area === a);
      return area?.graded ? area.grade : "–";
    });
    const result = opts.failed?.has(path) ? "❌ fail" : "✅ pass";
    lines.push(`| ${link} | ${result} | ${report.score} (${report.grade}) | ${grades.join(" | ")} |`);
  }
  lines.push("");
  for (const { path, report } of results) {
    const findings = report.findings.filter((f) => f.severity !== "note");
    if (!findings.length) continue;
    lines.push(`<details><summary><b>${cell(report.name ?? path)}</b>: ${findings.length} finding(s)</summary>`, "");
    for (const f of findings) {
      const rule = getRule(f.ruleId);
      lines.push(`- **${f.severity}**${f.line ? ` (line ${f.line})` : ""}: ${f.message}. [${rule.title}](${RULES_URL}/${f.ruleId})`);
    }
    lines.push("", "</details>", "");
  }
  lines.push(`Checked with [@skillland/validator](https://github.com/skillland-io/skill-validator). Every rule quotes its source: [skillland.io/validate/rules](${RULES_URL}).`);
  return `${lines.join("\n")}\n`;
}

/**
 * Parses a --min-area-grade value: "B" for every area, or "security=A" for one. Returns null when
 * the value is not valid.
 */
export function parseAreaGrade(value: string): { area?: RuleCategory; grade: Grade } | null {
  const m = /^(?:(spec|description|structure|security)=)?([A-Fa-f])$/.exec(value.trim());
  const grade = m?.[2]?.toUpperCase();
  if (!m || !grade || grade === "E") return null;
  return { area: m[1] as RuleCategory | undefined, grade: grade as Grade };
}

/** True when a graded area of the report is below the grade asked for. */
export function failsAreaGrade(report: Report, limits: { area?: RuleCategory; grade: Grade }[]): boolean {
  return limits.some(({ area, grade }) =>
    report.areas.some((a) => a.graded && (!area || a.area === area) && GRADES.indexOf(a.grade) > GRADES.indexOf(grade)),
  );
}
