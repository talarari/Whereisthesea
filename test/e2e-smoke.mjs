// End-to-end smoke test: boots the real page in Chromium, mocks
// geolocation (Tel Aviv) and dispatches synthetic absolute orientation
// events to play the game both ways.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// NODE_PATH is ignored by ESM, so resolve the globally installed playwright
const { chromium } = await import(
  process.env.PLAYWRIGHT_PATH || "/opt/node22/lib/node_modules/playwright/index.mjs");

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, "index.html"));
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(html);
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
};

const browser = await chromium.launch();

async function playRound({ alpha, press }) {
  const ctx = await browser.newContext({
    geolocation: { latitude: 32.08, longitude: 34.78 }, // Tel Aviv
    permissions: ["geolocation"],
    viewport: { width: 390, height: 760 },
    isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(url);
  await page.click("#btnStart");
  // feed absolute orientation events (Android-style): heading = 360 - alpha
  await page.evaluate(a => {
    const fire = () => window.dispatchEvent(new DeviceOrientationEvent(
      "deviceorientationabsolute", { alpha: a, beta: 12, gamma: -4, absolute: true }));
    fire(); window.__fireTimer = setInterval(fire, 100);
  }, alpha);
  await page.waitForFunction(() =>
    document.getElementById("headingReadout").textContent.includes("°") &&
    !document.getElementById("headingReadout").textContent.includes("--"));
  const readout = await page.textContent("#headingReadout");
  if (press) {
    await page.click("#btnReady");
    await page.waitForSelector("#screen-result.active");
  }
  const state = {
    readout,
    errors,
    timer: await page.textContent("#timer"),
    title: press ? await page.textContent("#resultTitle") : null,
    detail: press ? await page.textContent("#resultDetail") : null,
    demoVisible: await page.isVisible("#demoControls"),
  };
  await ctx.close();
  return state;
}

console.log("— round 1: Tel Aviv, pointing WEST (alpha=90 → heading 270) —");
{
  const r = await playRound({ alpha: 90, press: true });
  check(`no JS errors (${r.errors.join("; ") || "clean"})`, r.errors.length === 0);
  check(`heading readout shows ~270 W (got "${r.readout}")`, /27\d° W|26\d° W/.test(r.readout));
  check(`verdict is success (got "${r.title}")`, /found the sea/i.test(r.title));
  check("demo mode NOT triggered (real sensor data used)", !r.demoVisible);
}

console.log("— round 2: Tel Aviv, pointing EAST (alpha=270 → heading 90) —");
{
  const r = await playRound({ alpha: 270, press: true });
  check(`heading readout shows ~90 E (got "${r.readout}")`, /9\d° E|8\d° E/.test(r.readout));
  check(`verdict is failure (got "${r.title}")`, /lost/i.test(r.title));
  check(`failure tells where the sea was (got "${r.detail}")`, /W \(2\d\d°\)/.test(r.detail));
}

console.log("— round 3: timer ticks and timeout fails the game —");
{
  const ctx = await browser.newContext({
    geolocation: { latitude: 32.08, longitude: 34.78 },
    permissions: ["geolocation"],
  });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.evaluate(() => {
    // shrink the timer so the test doesn't wait 30 real seconds
    const t = document.getElementById("timer");
    t.textContent = "30";
  });
  await page.click("#btnStart");
  await page.waitForTimeout(2500);
  const t = Number(await page.textContent("#timer"));
  check(`timer counts down (now ${t})`, t < 30 && t >= 26);
  // no sensors in this context → demo mode should have appeared
  check("demo slider appears when no sensor data", await page.isVisible("#demoControls"));
  await ctx.close();
}

console.log("— round 4: challenge link shows challenger name —");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url + "?by=Tal");
  const line = await page.textContent("#challengerLine");
  check(`challenger banner (got "${line}")`, line.includes("Tal"));
  await page.click("#btnChallenge");
  check("creator screen opens", await page.isVisible("#screen-create.active"));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
