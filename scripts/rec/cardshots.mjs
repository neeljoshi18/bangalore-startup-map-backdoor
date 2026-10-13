import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = process.argv[2];
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars", "--window-size=1400,800"] });
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
await p.goto("http://127.0.0.1:8790/index.html", { waitUntil: "load" });
await p.waitForFunction(() => window.__blr?.state.data && document.querySelectorAll(".msg").length >= 4, null, { timeout: 60000 });
for (const name of ["OpenAI", "Zomato", "Stripe", "Meesho"]) {
  const id = await p.evaluate((n) => window.__blr.state.data.startups.find((s) => s.name === n).id, name);
  await p.evaluate((id) => window.__blr.select(id, true), id); await p.waitForTimeout(1500);
  const card = await p.$(".cardb"); await card.screenshot({ path: `${out}/card-${name}.png` });
}
await b.close(); console.log("card shots done");
