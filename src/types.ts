export type Severity = "error" | "warning" | "info";

export type RuleCategory = "spec" | "description" | "structure" | "security";

export interface RuleSource {
  label: string;
  url: string;
  /** The sentence the rule relies on, copied word for word from the page. */
  quote: string;
}

export interface Rule {
  id: string;
  title: string;
  /** Card title when the rule fails; findings add the measured value. */
  problem: string;
  severity: Severity;
  category: RuleCategory;
  summary: string;
  /** Heading for the "why" section, specific to this rule. */
  whyHeading: string;
  why: string;
  /** Heading for the fix section, specific to this rule. */
  fixHeading: string;
  fix: string;
  /** A short snippet that fails the rule, and the same snippet fixed. */
  bad: string;
  good: string;
  /** Upload mode only: needs the skill's folder, not just SKILL.md. */
  needsFolder?: boolean;
  sources: RuleSource[];
  /** The part of the rule the sources leave open and Skillland decided, such as a threshold. */
  ourCall?: string;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  fix: string;
  line?: number;
}

export interface SkillInput {
  /** Full SKILL.md text. */
  skillMd: string;
  /** Name of the folder holding SKILL.md, when known. */
  folderName?: string;
  /** Other files in the skill folder, keyed by path relative to it (forward slashes). */
  files?: Record<string, string>;
}

export interface ReportStats {
  bodyLines: number;
  bodyTokens: number;
  descriptionChars: number;
  descriptionTokens: number;
  files: number;
}

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface AreaScore {
  area: RuleCategory;
  label: string;
  /** 0-100 from this area's rules only; an error caps it at 59. */
  score: number;
  grade: Grade;
  /** Rules in this area that ran and found nothing. */
  passed: number;
  /** Rules in this area with at least one finding. */
  failed: number;
  /** passed + failed: the rules in this area that ran. 0 means the area wasn't checked. */
  total: number;
}

export interface Report {
  name?: string;
  description?: string;
  findings: Finding[];
  /** Rules that ran and found nothing. */
  passed: string[];
  /** Rules skipped because they need the whole folder. */
  skipped: string[];
  /** Rules that didn't run because the frontmatter block is missing or isn't valid YAML. */
  blocked: string[];
  /** 0-100 overall: 100 minus a penalty per failing rule. */
  score: number;
  grade: Grade;
  /** A grade for each of the four areas, in display order. */
  areas: AreaScore[];
  stats: ReportStats;
}
