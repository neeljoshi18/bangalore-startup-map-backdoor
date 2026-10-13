// Contact sheet of every logo tile as the map renders it, for a quick visual review.
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const data = JSON.parse(readFileSync(new URL("../../data/startups.json", import.meta.url), "utf8"));
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f3efe8;font:11px Inter,system-ui;padding:12px}.g{display:grid;grid-template-columns:repeat(10,1fr);gap:10px}.c{text-align:center}.t{width:56px;height:56px;border-radius:14px;background:#fff;border:1.5px solid #fff;box-shadow:0 8px 18px -8px rgba(0,0,0,.45);display:grid;place-items:center;overflow:hidden;margin:0 auto 4px}.t img{width:78%;height:78%;object-fit:contain}</style><div class="g">${data.startups.map((s) => `<div class="c"><div class="t">${s.logo ? `<img src="${s.logo}">` : "—"}</div>${s.name}</div>`).join("")}</div>`;
const b = await chromium.launch({ channel: "chrome", headless: true }); const p = await b.newPage({ viewport: { width: 1000, height: 1200 } });
await p.setContent(html); await p.waitForTimeout(500); await p.screenshot({ path: process.argv[2] || "sheet.png", fullPage: true }); await b.close(); console.log("sheet written");
