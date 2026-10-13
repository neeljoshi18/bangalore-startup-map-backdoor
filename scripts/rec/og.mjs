// Renders assets/og.jpg (1200×630) from the live page after the intro, plus a quick functional pass.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars", "--window-size=1200,630"] });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errs.push(m.text()); });
await p.goto("http://127.0.0.1:8790/index.html", { waitUntil: "load" });
await p.waitForFunction(() => window.__blr?.state.data && document.querySelectorAll(".msg").length >= 4, null, { timeout: 60000 });
await p.waitForTimeout(2600);
await p.screenshot({ path: new URL("../../assets/og.jpg", import.meta.url).pathname, type: "jpeg", quality: 88 });
// functional: tracking shim records events; pin click opens a card
await p.evaluate(() => { window.__ev = []; window.bdTrack = (e, pr) => window.__ev.push([e, pr]); });
const pin = await p.$(".pin"); await pin.click(); await p.waitForTimeout(1500);
const card = await p.$(".cardb"); const getmein = await card.$eval('a[href^="sms:"]', (a) => decodeURIComponent(a.getAttribute("href")));
await card.$eval('a[href^="sms:"]', (a) => a.addEventListener("click", (e) => e.preventDefault(), { once: true }));
await card.$eval('a[href^="sms:"]', (a) => a.click()); await p.waitForTimeout(2000);
const ev = await p.evaluate(() => window.__ev.map((x) => x[0] + " " + JSON.stringify(x[1])));
const fb = await p.$eval("#fb", (d) => d.classList.contains("on"));
console.log(JSON.stringify({ title: await p.title(), getmein, events: ev, fallbackShown: fb, errors: errs }, null, 1));
await b.close();
