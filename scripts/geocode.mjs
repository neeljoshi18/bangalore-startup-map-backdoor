// Geocodes the companies in raw/scrape.json against OpenStreetMap office POIs
// (Overpass, then Nominatim for the rest) and writes the coordinates back.
import { readFileSync, writeFileSync } from "node:fs";
const here = (p) => new URL(p, import.meta.url);
const FILE = here("../raw/scrape.json").pathname;
const d = JSON.parse(readFileSync(FILE, "utf8"));
const UA = { "user-agent": "backdoor-blr-map/1.0 (contact: neel@backdoorai.app)", accept: "application/json,*/*" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, opts = {}, ms = 200000) { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms); try { return await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) }, signal: ac.signal }); } catch (e) { return { ok: false, error: e.message }; } finally { clearTimeout(t); } }
const simple = (s) => String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/\b(pvt|private|ltd|limited|inc|llc|technologies|technology|software|india|solutions|labs|office|hq|headquarters|corporation|services|global|systems)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const BBOX = "(12.80,77.42,13.14,77.82)";

// Overpass, two passes: office=company (fast), then the other office=* values
let pois = [];
for (const sel of [`nwr["office"="company"]["name"]${BBOX}`, `nwr["office"]["office"!="company"]["name"]${BBOX}`, `nwr["brand"]["office"]${BBOX}`]) {
  const ql = `[out:json][timeout:170];${sel};out center tags;`;
  for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    const r = await get(host, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(ql) });
    if (r.ok) { const j = await r.json().catch(() => null); if (j?.elements) { pois.push(...j.elements); console.log(`overpass ${sel.slice(0, 40)}… -> ${j.elements.length}`); break; } }
    console.log("overpass miss on", host); await sleep(1500);
  }
}
console.log("office POIs:", pois.length);
const CENTERS = (() => { try { return JSON.parse(readFileSync(here("../data/startups.json").pathname, "utf8")).areaCenters; } catch { return {}; } })();
const km = (a, b) => Math.hypot((a.lng - b.lng) * 108.5, (a.lat - b.lat) * 111);
const toHit = (e) => ({ lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, osm: e.tags?.name || e.tags?.brand, addr: [e.tags?.["addr:street"], e.tags?.["addr:suburb"], e.tags?.["addr:neighbourhood"]].filter(Boolean).join(", ") });
let n = 0;
for (const c of d.companies) {
  delete c.geo; delete c.offices; delete c.lat; delete c.lng;
  const nm = simple(c.name), first = nm.split(" ")[0]; if (!nm || first.length < 3) continue;
  const hits = pois.filter((e) => { const t = simple(e.tags?.name), b = simple(e.tags?.brand || e.tags?.operator); return t === nm || b === nm || t.startsWith(nm + " ") || (first.length >= 4 && nm.split(" ").length === 1 && t.split(" ")[0] === first); }).map(toHit).filter((h) => h.lat && h.lng);
  // exact name matches first; with a curated area, the office nearest that area wins and far-away hits are rejected
  hits.sort((a, b) => (simple(b.osm) === nm) - (simple(a.osm) === nm));
  const ctr = c.area && CENTERS[c.area];
  if (ctr) { hits.sort((a, b) => km(a, ctr) - km(b, ctr)); if (hits.length && km(hits[0], ctr) > 4) hits.length = 0; }
  if (hits.length) { c.offices = hits.slice(0, 8); c.lat = hits[0].lat; c.lng = hits[0].lng; c.geo = "osm"; n++; }
}
console.log(`overpass matched ${n}/${d.companies.length}`);
for (const c of d.companies.filter((x) => !x.geo)) {
  const r = await get(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(c.name.replace(/\s*\(.*\)/, "") + " Bengaluru")}`, {}, 15000);
  const j = r.ok ? await r.json().catch(() => []) : []; await sleep(1100);
  const nm = simple(c.name);
  const hit = (j || []).find((x) => +x.lat > 12.8 && +x.lat < 13.14 && +x.lon > 77.42 && +x.lon < 77.82 && /office|company|commercial|building/.test(x.category + " " + x.type) && simple(x.name) === nm && (!(c.area && CENTERS[c.area]) || km({ lat: +x.lat, lng: +x.lon }, CENTERS[c.area]) <= 4));
  if (hit) { c.offices = [{ lat: +hit.lat, lng: +hit.lon, osm: hit.name, addr: hit.display_name.split(",").slice(1, 4).join(",").trim() }]; c.lat = +hit.lat; c.lng = +hit.lon; c.geo = "nominatim"; n++; console.log("  nominatim:", c.name, "->", hit.name, "|", hit.display_name.slice(0, 70)); }
}
console.log(`geocoded ${n}/${d.companies.length}; unplaced: ${d.companies.filter((x) => !x.geo).map((x) => x.name).join(", ")}`);
writeFileSync(FILE, JSON.stringify(d, null, 1));
