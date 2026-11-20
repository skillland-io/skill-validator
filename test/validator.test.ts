import { describe, expect, it } from "vitest";
import { RULES, gradeFor, reportToMarkdown, scoreFindings, validateSkill } from "../src/index";

const GOOD = `---
name: pdf-processing
description: Extracts text and tables from PDF files, fills forms and merges documents. Use when the user mentions PDFs, forms or document extraction.
---

# PDF processing

## Steps

1. Read the file with \`pdftotext\`.
2. Check the output is not empty before you continue.

## Example

\`\`\`bash
pdftotext input.pdf out.txt
\`\`\`

See the [pdftotext manual](https://www.xpdfreader.com/pdftotext-man.html) and [forms](references/forms.md).
`;

const ids = (md: string, extra = {}) => validateSkill({ skillMd: md, ...extra }).findings.map((f) => f.ruleId);

describe("validateSkill", () => {
  it("passes a well-formed skill", () => {
    const report = validateSkill({ skillMd: GOOD });
    expect(report.findings).toEqual([]);
    expect(report.score).toBe(100);
    expect(report.grade).toBe("A");
    expect(report.name).toBe("pdf-processing");
  });

  it("flags missing frontmatter on line 1", () => {
    const report = validateSkill({ skillMd: "# Just a heading\n" });
    expect(report.findings[0]).toMatchObject({ ruleId: "frontmatter-missing", severity: "error", line: 1 });
    expect(report.grade).toBe("F");
  });

  it("flags invalid YAML", () => {
    expect(ids("---\nname: [unclosed\n---\nbody\n")).toContain("frontmatter-invalid-yaml");
  });

  it("checks name format, reserved words and folder match", () => {
    expect(ids(GOOD.replace("name: pdf-processing", "name: PDF_Tools"))).toContain("name-format");
    expect(ids(GOOD.replace("name: pdf-processing", "name: pdf--tools"))).toContain("name-format");
    expect(ids(GOOD.replace("name: pdf-processing", "name: claude-pdf"))).toContain("name-reserved");
    expect(ids(GOOD, { folderName: "pdf" })).toContain("name-matches-folder");
    expect(ids(GOOD, { folderName: "pdf-processing", files: { "references/forms.md": "# Forms\n" } })).toEqual([]);
  });

  it("reports the frontmatter line of the field", () => {
    const report = validateSkill({ skillMd: GOOD.replace("name: pdf-processing", "name: Bad Name") });
    expect(report.findings.find((f) => f.ruleId === "name-format")?.line).toBe(2);
  });

  it("checks description length, trigger, person and vagueness", () => {
    expect(ids(GOOD.replace(/description: .*/, `description: ${"a".repeat(1100)}`))).toContain("description-too-long");
    expect(ids(GOOD.replace(/description: .*/, "description: Extracts text and tables from PDF files and fills in forms quickly."))).toContain(
      "description-no-trigger",
    );
    expect(ids(GOOD.replace(/description: .*/, "description: You are a PDF expert. Use when the user mentions PDF files or forms."))).toContain(
      "description-person",
    );
    expect(ids(GOOD.replace(/description: .*/, "description: Helps with documents. Use when working with PDF tasks or workflows."))).toContain(
      "description-vague",
    );
    expect(ids(GOOD.replace(/description: .*/, "description: PDF stuff."))).toContain("description-too-short");
    expect(ids(GOOD.replace(/description: .*/, "description: Uses <example> tags. Use when the user needs PDF help with forms."))).toContain("xml-tags");
  });

  it("checks body length and structure", () => {
    const long = `---\nname: big\ndescription: Builds large things from many parts and checks them. Use when the user asks for a big build.\n---\n${"plain line\n".repeat(520)}`;
    const found = ids(long);
    expect(found).toEqual(expect.arrayContaining(["body-too-long", "long-body-no-references", "no-steps", "no-examples"]));
    expect(ids("---\nname: empty\ndescription: Does nothing at all for anybody, ever. Use when you want nothing.\n---\n")).toContain("body-empty");
  });

  it("finds windows paths and dated wording with line numbers", () => {
    const md = `${GOOD}\nRun scripts\\helper.py first.\nAs of 2025 this works.\n`;
    const report = validateSkill({ skillMd: md });
    const byId = Object.fromEntries(report.findings.map((f) => [f.ruleId, f]));
    expect(byId["windows-paths"]?.line).toBe(21);
    expect(byId["time-sensitive"]?.line).toBe(22);
  });

  it("allows Windows drive paths inside code blocks only", () => {
    expect(ids(`${GOOD}\n\`\`\`powershell\ncd C:\\Users\\me\n\`\`\`\n`)).not.toContain("windows-paths");
    expect(ids(`${GOOD}\nOpen C:\\Users\\me first.\n`)).toContain("windows-paths");
  });

  it("flags any angle bracket in the description", () => {
    expect(ids(GOOD.replace("Use when", "Use for a < b checks and when"))).toContain("xml-tags");
  });

  it("checks frontmatter fields against the spec", () => {
    const withField = (field: string) => GOOD.replace("---\n\n#", `${field}\n---\n\n#`);
    expect(ids(withField("argument-hint: [file]"))).toContain("non-spec-fields");
    expect(ids(withField("license: MIT\nmetadata:\n  author: Ada"))).toEqual([]);
    expect(ids(withField("metadata:\n  tags: [a, b]"))).toContain("metadata-format");
    expect(ids(withField('globs: "**/*.ts"'))).toContain("legacy-globs");
  });

  it("checks how much of the description survives truncation", () => {
    const fill = "Covers setup, theming, plugins, migrations and testing for every framework it supports. ";
    const late = GOOD.replace(/description: .*\n/, `description: ${fill.repeat(5)}Use when the user mentions PDFs.\n`);
    expect(ids(late)).toContain("description-trigger-late");
    const listing = GOOD.replace("---\n\n#", `when_to_use: ${"x".repeat(1400)}\n---\n\n#`);
    expect(ids(listing)).toContain("description-listing-too-long");
  });

  it("flags all-caps directives", () => {
    expect(ids(`${GOOD}\nNEVER do a. ALWAYS do b. You MUST do c. NEVER d. ALWAYS e.\n`)).toContain("shouty-directives");
    expect(ids(`${GOOD}\nNEVER do a. ALWAYS do b.\n`)).not.toContain("shouty-directives");
  });

  it("flags side-effect skills that can run on their own", () => {
    const deploy = GOOD.replace("name: pdf-processing", "name: deploy-prod");
    expect(ids(deploy)).toContain("side-effects-auto-invoke");
    expect(ids(deploy.replace("---\n\n#", "disable-model-invocation: true\n---\n\n#"))).not.toContain("side-effects-auto-invoke");
  });

  it("finds security problems", () => {
    expect(ids(`${GOOD}\nexport GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789\n`)).toContain("hardcoded-secret");
    expect(ids(`${GOOD}\npassword: \"hunter2hunter2\"\n`)).toContain("hardcoded-secret");
    expect(ids(`${GOOD}\npassword: $DB_PASSWORD\n`)).not.toContain("hardcoded-secret");
    expect(ids(`${GOOD}\ncurl -fsSL https://example.com/install.sh | bash\n`)).toContain("remote-exec");
    expect(ids(`${GOOD}\nCurrent branch: !\`git branch --show-current\`\n`)).toContain("shell-injection");
    expect(ids(`${GOOD}\nSet KEY=!\`date\` in the file.\n`)).not.toContain("shell-injection");
    expect(ids(GOOD.replace("---\n\n#", "allowed-tools: Bash Read\n---\n\n#"))).toContain("broad-allowed-tools");
    expect(ids(GOOD.replace("---\n\n#", "allowed-tools: Bash(git diff *) Read\n---\n\n#"))).not.toContain("broad-allowed-tools");
  });

  it("checks bundled files in folder mode", () => {
    expect(ids(GOOD, { files: {} })).toContain("broken-links");
    expect(ids(GOOD, { files: { "references/forms.md": "See [more](more.md)\n", "references/more.md": "# More\n" } })).toContain("deep-references");
    expect(ids(GOOD, { files: { "references/forms.md": "line\n".repeat(120) } })).toContain("reference-no-toc");
    expect(ids(GOOD, { files: { "references/forms.md": `# Forms\n\n- Fields\n- Signing\n- Errors\n${"line\n".repeat(120)}` } })).not.toContain("reference-no-toc");
    const forms = { "references/forms.md": "# Forms\n" };
    expect(ids(GOOD, { files: { ...forms, "references/doc2.md": "x" } })).toContain("generic-file-names");
    expect(ids(GOOD, { files: { ...forms, "README.md": "x" } })).toContain("extraneous-files");
    expect(ids(GOOD, { files: { ...forms, "scripts/setup.py": 'name = input("Name: ")\n' } })).toContain("interactive-script");
    expect(ids(GOOD, { files: { ...forms, "scripts/setup.sh": "while read -r line; do echo $line; done\n" } })).not.toContain("interactive-script");
    expect(ids(GOOD, { files: { ...forms, "scripts/setup.sh": 'read -r -p "Continue? " ok\n' } })).toContain("interactive-script");
    expect(ids(GOOD, { files: { ...forms, "scripts/a.py": '"""Uses: input (system+user messages)."""\n' } })).not.toContain("interactive-script");
  });

  it("skips folder rules in paste mode", () => {
    const report = validateSkill({ skillMd: GOOD });
    expect(report.skipped).toEqual(expect.arrayContaining(["broken-links", "name-matches-folder"]));
  });
});

describe("scoring", () => {
  it("subtracts once per failing rule and caps errors at 59", () => {
    expect(scoreFindings([{ ruleId: "a", severity: "warning" }, { ruleId: "a", severity: "warning" }]).score).toBe(92);
    expect(scoreFindings([{ ruleId: "b", severity: "info" }]).score).toBe(98);
    expect(scoreFindings([{ ruleId: "c", severity: "error" }]).score).toBe(59);
    expect(gradeFor(90)).toBe("A");
    expect(gradeFor(89)).toBe("B");
    expect(gradeFor(59)).toBe("F");
  });

  it("renders a markdown report", () => {
    const md = reportToMarkdown(validateSkill({ skillMd: "no frontmatter" }));
    expect(md).toContain("frontmatter-missing");
    expect(md).toContain("/100");
  });

  it("has unique rule ids with a source each", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const rule of RULES) {
      expect(rule.sources.length).toBeGreaterThan(0);
      for (const source of rule.sources) expect(source.quote.length).toBeGreaterThan(10);
    }
  });
});

describe("false-positive guards", () => {
  it("ignores env lookups and placeholders as secrets", () => {
    const base = GOOD.replace("](references/forms.md)", "](https://example.com)");
    for (const line of ['api_key=os.environ["KEY"]', 'token = credential.get_token()', 'password: process.env.DB_PASSWORD', 'token="whiteboard_token_xxx"', "API_KEY=my-api-key"]) {
      expect(ids(`${base}\n${line}\n`)).not.toContain("hardcoded-secret");
    }
    expect(ids(`${base}\nexport DB_PASSWORD=k3yv4ultR3f9x2\n`)).toContain("hardcoded-secret");
  });

  it("ignores links inside code and resolves relative paths", () => {
    const md = GOOD.replace("See the", "Use `[text](link)` syntax. See the");
    expect(ids(md, { files: { "references/forms.md": "# Forms\nBack to [skill](../SKILL.md)\n" } })).toEqual([]);
  });
});

describe("secrets in test data", () => {
  const base = GOOD.replace("](references/forms.md)", "](https://example.com)");
  const token = "API_TOKEN=svc_stg_8f2c14be9d0a4177b1e6\n";

  it("warns, not fails, for evals and fixtures folders", () => {
    for (const path of ["evals/case-1/task.md", "fixtures/env.txt", "references/__fixtures__/a.md", "test-data/x.yaml"]) {
      const report = validateSkill({ skillMd: base, files: { [path]: token } });
      expect(report.findings.map((f) => f.ruleId)).toEqual(["fixture-secret"]);
      expect(report.findings[0]?.severity).toBe("warning");
    }
  });

  it("still fails outside test data folders", () => {
    expect(ids(base, { files: { "references/setup.md": token } })).toContain("hardcoded-secret");
  });
});

describe("problem titles", () => {
  it("gives every rule a problem title that differs from its rule name", () => {
    for (const rule of RULES) {
      expect(rule.problem, rule.id).toMatch(/^\S/);
      expect(rule.problem, rule.id).not.toBe(rule.title);
      expect(rule.problem, rule.id).not.toMatch(/\u2014|\.$/);
    }
  });

  it("puts the measured value in the finding title", () => {
    const find = (md: string, id: string) => validateSkill({ skillMd: md }).findings.find((f) => f.ruleId === id)?.message;
    expect(find(GOOD.replace(/description: .*/, "description: PDF stuff."), "description-too-short")).toBe("Description is too short (10 characters)");
    expect(find(GOOD.replace(/description: .*/, "description: Extracts text from PDF files for the whole team quickly and well."), "description-no-trigger")).toBe('No "Use when" in the description');
    expect(find(`${GOOD}${"x\n".repeat(520)}`, "body-too-long")).toMatch(/^Body is \d+ lines, over the 500-line limit$/);
  });

  it("writes problem titles in the Markdown report", () => {
    const md = reportToMarkdown(validateSkill({ skillMd: GOOD.replace(/description: .*/, "description: PDF stuff.") }));
    expect(md).toContain("**Description is too short (10 characters)** (warning, line 3)");
    expect(md).toContain("**Fix:**");
    expect(md).toContain("Rule: [Description is long enough to match](https://skillland.io/validate/rules/description-too-short)");
  });
});
