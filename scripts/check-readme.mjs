/** Check local README links and render its architecture diagram in a real browser. */
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
const readme = readFileSync("README.md", "utf8");
const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
const missing = links.filter((link) => !/^https?:|^#/.test(link) && !existsSync(resolve(link.split("#")[0])));
assert.deepEqual(missing, []);
const diagram = /```mermaid\s+([\s\S]*?)```/.exec(readme)?.[1];
assert.ok(diagram);
const { chromium } = await import(pathToFileURL(resolve(process.env.SISIH_PLAYWRIGHT_PATH)).href);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("about:blank");
  await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" });
  const svg = await page.evaluate(async (source) => {
    window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
    return (await window.mermaid.render("sisih-architecture", source)).svg;
  }, diagram);
  const out = resolve("docs/verification/readme-architecture.svg");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg);
  console.log(JSON.stringify({ local_readme_links_checked: links.filter((link) => !/^https?:|^#/.test(link)).length, missing, mermaid_rendered: true, artifact: "docs/verification/readme-architecture.svg" }, null, 2));
} finally { await browser.close(); }
