// Functional check: pins open cards, card header flies to the pin, Get me in / Share carry the right links.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = process.argv[2] || ".";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars", "--window-size=1600,900"] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto("http://127.0.0.1:8790/index.html", { waitUntil: "load" });
await p.waitForFunction(() => window.__blr?.state.data && document.querySelectorAll(".msg").length >= 4, null, { timeout: 60000 });
await p.waitForTimeout(2500);
// open Meesho through the page's own select, then click its pin for real
const id = await p.evaluate(() => window.__blr.state.data.startups.find((s) => s.name === "Meesho").id);
await p.evaluate((id) => window.__blr.select(id, true), id); await p.waitForTimeout(1800);
const pin = await p.$(`.pin[data-id="${id}"]`); console.log("pin on screen:", !!pin);
const info = await p.evaluate(() => { const c = [...document.querySelectorAll(".cardb")].pop(); const a = [...c.querySelectorAll("a")]; return { name: c.querySelector(".nm").textContent, roles: c.querySelectorAll(".role").length, getmein: decodeURIComponent(a.find((x) => x.href.startsWith("sms:")).getAttribute("href")), share: decodeURIComponent(a.find((x) => x.href.includes("x.com")).href), more: a.find((x) => x.classList.contains("more"))?.textContent, hasHeaderBtn: !!c.querySelector("button[data-fly]") }; });
console.log(JSON.stringify(info, null, 1));
// click another pin on screen and check a new card appears
const pins = await p.$$(".pin"); const before = await p.$$eval(".cardb", (n) => n.length);
if (pins.length > 1) { await pins[pins.length - 1].click(); await p.waitForTimeout(1500); }
const after = await p.$$eval(".cardb", (n) => n.length); console.log("cards before/after pin click:", before, after);
console.log("compose hrefs:", await p.$eval("#imsg", (a) => decodeURIComponent(a.getAttribute("href"))), "|", await p.$eval("#plus", (a) => a.getAttribute("href").slice(0, 30)));
console.log("top share:", await p.$eval("#share", (a) => decodeURIComponent(a.href)));
// careers-only card: Unacademy
const uid = await p.evaluate(() => window.__blr.state.data.startups.find((s) => s.name === "Unacademy").id);
await p.evaluate((id) => window.__blr.select(id, false), uid); await p.waitForTimeout(600);
console.log("unacademy card:", await p.evaluate(() => { const c = [...document.querySelectorAll(".cardb")].pop(); return { roles: c.querySelectorAll(".role").length, more: c.querySelector(".more")?.textContent, moreHref: c.querySelector(".more")?.href }; }));
await p.screenshot({ path: `${out}/s6-cards.png` });
await b.close(); console.log("click test done");
