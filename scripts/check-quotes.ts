/**
 * Checks that every quoted source sentence still appears on its page.
 * Run weekly in CI; a failure means a vendor edited their docs and a quote needs updating.
 * Usage: npm run check-quotes
 */
import { RULES } from "../src/index";
import type { RuleSource } from "../src/types";

/** Where to read each page as plain Markdown, which is steadier to match than rendered HTML. */
function readableUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  const p = u.pathname.replace(/\/$/, "");
  switch (u.hostname) {
    case "agentskills.io":
      return `https://raw.githubusercontent.com/agentskills/agentskills/main/docs${p}.mdx`;
    case "github.com":
      return `https://raw.githubusercontent.com${p.replace("/blob/", "/")}`;
    case "cheatsheetseries.owasp.org":
      return `https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/${p.split("/").pop()!.replace(/\.html$/, ".md")}`;
    case "platform.claude.com":
    case "code.claude.com":
    case "learn.chatgpt.com":
    case "cursor.com":
    case "docs.nvidia.com":
      return `${u.origin}${p}.md`;
    default:
      return `${u.origin}${p}`;
  }
}

const normalize = (text: string) =>
  text
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/[`*_]/g, "")
    .replace(/\\([[\]()~])/g, "$1")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/^\s*[-*+]\s+/gm, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

/** A quote may join list items or skip text with an ellipsis; each piece must appear on the page. */
const fragments = (quote: string) =>
  normalize(quote)
    .split(/ … |…|\. |: |, | — /)
    .map((f) => f.replace(/[.:,]+$/, "").trim())
    .filter((f) => f.length >= 12);

async function main() {
  const bySource = new Map<string, { source: RuleSource; rules: string[] }>();
  for (const rule of RULES) {
    for (const source of rule.sources) {
      const key = `${source.url}\n${source.quote}`;
      const entry = bySource.get(key) ?? { source, rules: [] };
      entry.rules.push(rule.id);
      bySource.set(key, entry);
    }
  }
  const pages = new Map<string, Promise<string | null>>();
  const load = (url: string) => {
    if (!pages.has(url)) {
      pages.set(
        url,
        fetch(url, { headers: { "User-Agent": "skillland-quote-check" } })
          .then(async (r) => (r.ok ? normalize(await r.text()) : null))
          .catch(() => null),
      );
    }
    return pages.get(url)!;
  };

  const problems: string[] = [];
  for (const { source, rules } of bySource.values()) {
    const url = readableUrl(source.url);
    const page = await load(url);
    if (page === null) {
      problems.push(`- Could not load ${url} (${source.label}), used by ${rules.join(", ")}`);
      continue;
    }
    const missing = fragments(source.quote).filter((f) => !page.includes(f));
    if (missing.length) problems.push(`- ${source.label} (${source.url}), used by ${rules.join(", ")}: not found: "${missing.join('", "')}"`);
  }

  if (problems.length) {
    console.log(`${problems.length} of ${bySource.size} quotes need attention:\n${problems.join("\n")}`);
    process.exitCode = 1;
  } else console.log(`All ${bySource.size} quotes still match their pages.`);
}

main();
