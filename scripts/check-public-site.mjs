/** Real Chromium smoke/capture checks. Uses a locally installed playwright-core supplied by path. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.SISIH_PLAYWRIGHT_PATH;
if (!modulePath) throw new Error("Set SISIH_PLAYWRIGHT_PATH to the installed playwright-core index.mjs");
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const origin = process.env.SISIH_CHECK_ORIGIN ?? "http://127.0.0.1:3000";
const output = resolve("docs/verification/public-site-20261108");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], colorScheme: "light" });
const errors = [];
const page = await context.newPage();
page.on("pageerror", (err) => errors.push(err.message));
// Prevent the inspection from reading mutable deployment state or invoking any application action.
await context.route("**/api/state", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"isolated browser verification"}' }));
const captures = [];
const contrast = [];
async function checkContrast(label) {
  const result = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const color = (value) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
    const luminance = (rgba) => rgba.slice(0, 3).map((c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const failures = []; let checked = 0;
    for (const el of document.querySelectorAll("body *")) {
      const text = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent.trim()).filter(Boolean).join(" ");
      if (!text || !el.getBoundingClientRect().height || ["SCRIPT", "STYLE"].includes(el.tagName)) continue;
      const css = getComputedStyle(el); const fg = color(css.color); if (fg[3] !== 255) continue;
      const ancestors = []; for (let p = el; p; p = p.parentElement) ancestors.unshift(p);
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1, 1);
      for (const ancestor of ancestors) { ctx.fillStyle = getComputedStyle(ancestor).backgroundColor; ctx.fillRect(0, 0, 1, 1); }
      const bg = [...ctx.getImageData(0, 0, 1, 1).data];
      const [lo, hi] = [luminance(fg), luminance(bg)].sort((a, b) => a - b);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const size = Number.parseFloat(css.fontSize);
      const minimum = size >= 24 || (size >= 18.66 && Number(css.fontWeight) >= 700) ? 3 : 4.5;
      checked++;
      if (ratio < minimum) failures.push({ text: text.slice(0, 55), ratio: Number(ratio.toFixed(2)), minimum });
    }
    return { checked, failures };
  });
  contrast.push({ label, ...result });
  assert.deepEqual(result.failures, [], `${label} text contrast`);
}
try {
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/connect", "/proof"]) {
      const response = await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator("h1").count(), 1);
      assert.deepEqual(await page.locator('nav[aria-label="Primary"] a').allTextContents(), ["Home", "Connect", "Proof"]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `${path} overflows ${width}px`);
      const name = `${path === "/" ? "home" : path.slice(1)}-${width}.png`;
      await page.screenshot({ path: resolve(output, name), fullPage: true });
      captures.push(name);
      if (width === 1440) await checkContrast(`${path}:light`);
    }
  }
  await page.goto(`${origin}/connect`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Retry status" }).waitFor();
  await page.getByRole("button", { name: "Retry status" }).click();
  await page.getByRole("button", { name: "Retry status" }).waitFor();
  const tab = page.getByRole("tab", { name: "PowerShell" }).first();
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "Bash / zsh" }).first().getAttribute("aria-selected"), "true");
  const copy = page.getByRole("button", { name: "Copy agent MCP configuration", exact: true });
  await copy.click();
  await page.getByRole("button", { name: "Copy agent MCP configuration: copied", exact: true }).waitFor();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /SISIH_AGENT_TOKEN/);
  // Failure feedback works when clipboard permission is unavailable.
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error("permission denied"); }; });
  await page.getByRole("button", { name: "Copy connection check prompt", exact: true }).click();
  assert.ok(await page.getByText("Select and copy", { exact: true }).count());
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  assert.equal(await page.locator("html").getAttribute("class"), "dark");
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });
  await page.screenshot({ path: resolve(output, "connect-dark-1440.png"), fullPage: true });
  await checkContrast("/connect:dark");
  for (const path of ["/", "/proof"]) {
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    await checkContrast(`${path}:dark`);
    await page.screenshot({ path: resolve(output, `${path === "/" ? "home" : "proof"}-dark-1440.png`), fullPage: true });
  }
  await page.goto(`${origin}/connect`, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("class"), "dark");
  await page.goto(origin);
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => ({ tag: document.activeElement.tagName, outline: getComputedStyle(document.activeElement).outlineStyle }));
  assert.notEqual(focus.outline, "none");
  for (const [path, target] of [["/workspace", "/"], ["/agent", "/proof"], ["/memory", "/proof"], ["/settings", "/connect"]]) {
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, target);
  }
  const skill = await context.request.get(`${origin}/skills/sisih/SKILL.md`);
  assert.equal(skill.status(), 200);
  assert.doesNotMatch(await skill.text(), /dashboard link/);
  assert.deepEqual(errors, []);
  const report = { origin, revision: "working-tree-based-on-1109d5b", mutable_api: "intercepted with isolated 503 fixture; no payments or memory writes", viewports: [375, 768, 1280, 1440], captures, contrast, checks: ["routes and read-only navigation", "no horizontal overflow", "API error and retry", "arrow-key shell tabs", "copy success and failure", "keyboard focus", "dark theme and persistence", "legacy redirects", "served skill", "text contrast in both themes"], page_errors: errors };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
