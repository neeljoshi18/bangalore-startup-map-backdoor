// Fetches company logos. Order of preference: the site's own apple-touch-icon / large icon link,
// Google's favicon service at 256px, DuckDuckGo. `--all` refetches every company; otherwise only missing ones.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const here = (p) => new URL(p, import.meta.url).pathname;
const LOGOS = here("../assets/logos/");
const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", accept: "*/*" };
async function get(url, ms = 20000) { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms); try { return await fetch(url, { headers: UA, signal: ac.signal, redirect: "follow" }); } catch { return { ok: false }; } finally { clearTimeout(t); } }
const dims = (buf) => { // png / jpeg / ico width, best effort
  if (buf.subarray(1, 4).toString() === "PNG") return buf.readUInt32BE(16);
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1) return buf[6] || 256;
  if (buf[0] === 0xff && buf[1] === 0xd8) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) return 0; const m = buf[i + 1]; if (m >= 0xc0 && m <= 0xc3) return buf.readUInt16BE(i + 7); i += 2 + buf.readUInt16BE(i + 2); } }
  return 0;
};
async function fetchImg(url) { const r = await get(url); if (!r.ok) return null; const buf = Buffer.from(await r.arrayBuffer()); const ct = r.headers.get("content-type") || ""; if (buf.length < 700 || !/image|octet/.test(ct)) return null; return { buf, ct, w: /svg/.test(ct) ? 512 : dims(buf) }; }
async function logo(domain, all) {
  const file = `${LOGOS}${domain}.png`; if (!all && existsSync(file)) return "kept";
  const cands = [];
  const r = await get(`https://${domain}/`);
  if (r.ok) { const html = await r.text(), base = r.url || `https://${domain}/`;
    for (const m of html.matchAll(/<link[^>]+rel="[^"]*(?:apple-touch-icon|icon)[^"]*"[^>]*>/gi)) { const h = m[0].match(/href="([^"]+)"/)?.[1]; const sz = +(m[0].match(/sizes="(\d+)/)?.[1] || (/apple-touch/.test(m[0]) ? 180 : 32)); if (h && !/\.svg$/i.test(h)) cands.push({ url: new URL(h, base).href, sz }); }
  }
  cands.sort((a, b) => b.sz - a.sz);
  let best = null;
  for (const c of cands.slice(0, 3)) { const img = await fetchImg(c.url); if (img && img.w >= 96) { best = img; break; } }
  if (!best) { const img = await fetchImg(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`); if (img && img.buf.length > 1200) best = img; }
  if (!best) { const img = await fetchImg(`https://icons.duckduckgo.com/ip3/${domain}.ico`); if (img) best = img; }
  if (!best && existsSync(file)) return "kept-old";
  if (!best) return "none";
  writeFileSync(file, best.buf); return `${best.w || "?"}px ${best.ct.split(";")[0]}`;
}
const all = process.argv.includes("--all");
const data = JSON.parse(readFileSync(here("../data/startups.json"), "utf8"));
const args = process.argv.slice(2).filter((a) => a.includes(".")); const domains = args.length ? args : data.startups.map((s) => s.domain);
let i = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (i < domains.length) { const d = domains[i++]; console.log(d.padEnd(22), await logo(d, all)); } }));
