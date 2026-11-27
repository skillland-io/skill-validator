import { describe, expect, it } from "vitest";
import { failsAreaGrade, parseAreaGrade, toAnnotations, toSummary } from "../src/github";
import { validateSkill } from "../src/index";

const BAD = `---
name: Bad_Name
description: Helps.
---

# Bad
`;

describe("GitHub output", () => {
  const report = validateSkill({ skillMd: BAD, folderName: "bad" });
  const results = [{ path: "skills/bad", report }];

  it("writes one annotation per finding on SKILL.md", () => {
    const lines = toAnnotations(results);
    expect(lines).toHaveLength(report.findings.length);
    expect(lines.some((l) => l.startsWith("::error file=skills/bad/SKILL.md,line=2,title=Skillland%3A "))).toBe(true);
    for (const l of lines) expect(l).toMatch(/^::(error|warning|notice) .*::.*https:\/\/skillland\.io\/validate\/rules\//);
  });

  it("uses forward slashes and a root SKILL.md path", () => {
    expect(toAnnotations([{ path: "a\\b", report }])[0]).toContain("file=a/b/SKILL.md");
    expect(toAnnotations([{ path: ".", report }])[0]).toContain("file=SKILL.md");
  });

  it("escapes newlines and commas", () => {
    const r = { ...report, findings: [{ ruleId: report.findings[0]!.ruleId, severity: "error" as const, message: "a\nb", fix: "" }] };
    const [line] = toAnnotations([{ path: "x,y", report: r }]);
    expect(line).toContain("file=x%2Cy/SKILL.md");
    expect(line).toContain("a%0Ab");
  });

  it("summarises scores, grades and findings, with check links for a public repo", () => {
    const md = toSummary(results, { repo: "acme/skills", failed: new Set(["skills/bad"]) });
    expect(md).toContain(`| [Bad_Name](https://skillland.io/check/acme/skills/skills/bad) | ❌ fail | ${report.score} (${report.grade}) |`);
    expect(md).toContain("https://skillland.io/validate/rules/");
    expect(toSummary(results)).not.toContain("skillland.io/check/");
  });
});

describe("--min-area-grade", () => {
  it("parses one grade or area=grade", () => {
    expect(parseAreaGrade("b")).toEqual({ area: undefined, grade: "B" });
    expect(parseAreaGrade("security=A")).toEqual({ area: "security", grade: "A" });
    expect(parseAreaGrade("E")).toBeNull();
    expect(parseAreaGrade("tests=A")).toBeNull();
  });

  it("fails only when a graded area is below the limit", () => {
    const report = validateSkill({ skillMd: BAD, folderName: "bad" });
    expect(failsAreaGrade(report, [{ grade: "F" }])).toBe(false);
    expect(failsAreaGrade(report, [{ grade: "A" }])).toBe(true);
    const security = report.areas.find((a) => a.area === "security")!;
    expect(failsAreaGrade(report, [{ area: "security", grade: security.grade }])).toBe(false);
  });
});
