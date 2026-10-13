// Headless screenshots of the page at a few moments: after the intro, after V, after two tour stops.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = process.argv[2] || ".";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1600,900"] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on("pageerror", (e) => console.log("pageerror", e.message)); p.on("console", (m) => { if (m.type() === "error") console.log("console", m.text().slice(0, 120)); });
await p.goto("http://127.0.0.1:8790/index.html", { waitUntil: "load" });
await p.waitForFunction(() => window.__blr?.state.data && document.querySelectorAll(".msg").length >= 4, null, { timeout: 60000 });
await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/s1-intro.png` });
await p.evaluate(() => window.__blr.videoFrame()); await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/s2-frame.png` });
await p.evaluate(() => window.__blr.toggleTour()); await p.waitForTimeout(5200); await p.screenshot({ path: `${out}/s3-tour.png` });
await p.waitForTimeout(3100); await p.screenshot({ path: `${out}/s4-tour.png` });
const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.goto("http://127.0.0.1:8790/index.html", { waitUntil: "load" });
await m.waitForFunction(() => window.__blr?.state.data && document.querySelectorAll(".msg").length >= 4, null, { timeout: 60000 });
await m.waitForTimeout(2500); await m.screenshot({ path: `${out}/s5-mobile.png` });
await b.close(); console.log("shots done");
