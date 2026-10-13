// Builds data/startups.json for the map by merging three sources (any may be missing):
//   raw/india.json   – Backdoor's cached research DB export (scripts/export-db.mjs)
//   raw/scrape.json  – live job boards scraped by scripts/scrape.mjs (logos in assets/logos/)
//   the repo's research fixture (evals/fixtures/contact-benchmark-companies.json)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const here = (p) => new URL(p, import.meta.url);
const P = (p) => here(p).pathname;
const FIXTURE = "/Users/neelvaanjoshi/Projects/backdoor/evals/fixtures/contact-benchmark-companies.json";

// Bengaluru localities -> [lat, lng]
export const AREAS = {
  "Koramangala": [12.9352, 77.6245], "HSR Layout": [12.9116, 77.6389], "Indiranagar": [12.9784, 77.6408],
  "Whitefield": [12.9698, 77.7500], "Electronic City": [12.8452, 77.6602], "Bellandur": [12.9260, 77.6762],
  "Marathahalli": [12.9569, 77.7011], "MG Road": [12.9757, 77.6060], "JP Nagar": [12.9063, 77.5857],
  "Jayanagar": [12.9308, 77.5838], "Domlur": [12.9611, 77.6387], "Sarjapur Road": [12.9100, 77.6870],
  "Manyata Tech Park": [13.0450, 77.6200], "Hebbal": [13.0358, 77.5970], "BTM Layout": [12.9166, 77.6101],
  "Yelahanka": [13.1007, 77.5963], "Malleshwaram": [13.0031, 77.5643], "Rajajinagar": [12.9915, 77.5521],
  "Bannerghatta Road": [12.8900, 77.5970], "Bommanahalli": [12.9070, 77.6230], "Mahadevapura": [12.9910, 77.6880],
  "Richmond Town": [12.9630, 77.6030], "Ulsoor": [12.9810, 77.6200], "Cunningham Road": [12.9880, 77.5940],
  "Church Street": [12.9750, 77.6080], "Vasanth Nagar": [12.9880, 77.5900], "Sadashivanagar": [13.0070, 77.5800],
  "Old Airport Road": [12.9590, 77.6480], "Kalyan Nagar": [13.0250, 77.6400], "Hennur": [13.0350, 77.6440],
  "Varthur": [12.9400, 77.7430], "Kadubeesanahalli": [12.9350, 77.6950], "Haralur": [12.9050, 77.6680],
  "Kudlu Gate": [12.8880, 77.6440], "Hosur Road": [12.8900, 77.6400], "Bagmane Tech Park": [12.9800, 77.6700],
  "Embassy Tech Village": [12.9340, 77.6920], "Ecoworld": [12.9250, 77.6830], "Prestige Tech Park": [12.9460, 77.6940],
  "ITPL": [12.9870, 77.7360], "Peenya": [13.0280, 77.5200], "Yeshwanthpur": [13.0220, 77.5550],
  "Basavanagudi": [12.9420, 77.5750], "Wilson Garden": [12.9500, 77.5960], "Shanthinagar": [12.9570, 77.5990],
  "Langford Town": [12.9560, 77.6050], "Frazer Town": [12.9980, 77.6140], "Banashankari": [12.9250, 77.5460],
  "Jakkur": [13.0780, 77.6060], "Thanisandra": [13.0560, 77.6300], "Kengeri": [12.9080, 77.4850],
  "Hoodi": [12.9920, 77.7150], "KR Puram": [13.0070, 77.6960], "Nagawara": [13.0400, 77.6200],
  "Sahakar Nagar": [13.0620, 77.5830], "Rajarajeshwari Nagar": [12.9270, 77.5190], "Kasavanahalli": [12.9120, 77.6760],
  "Ejipura": [12.9420, 77.6270], "Austin Town": [12.9580, 77.6170], "Benson Town": [13.0030, 77.6000],
  "Lavelle Road": [12.9710, 77.5970], "Residency Road": [12.9700, 77.6030], "Infantry Road": [12.9820, 77.6020],
  "Shivajinagar": [12.9850, 77.6050], "Vijayanagar": [12.9720, 77.5320], "Adugodi": [12.9430, 77.6100],
  "Bengaluru": [12.9716, 77.5946],
};
const ALT = { "HSR Layout": "HSR", "BTM Layout": "BTM", "Sarjapur Road": "Sarjapur", "Bannerghatta Road": "Bannerghatta", "Old Airport Road": "HAL", "Ulsoor": "Halasuru", "Manyata Tech Park": "Manyata", "Mahadevapura": "Mahadevpura", "KR Puram": "Krishnarajapuram", "Electronic City": "Electronics City", "Bellandur": "Outer Ring Road|ORR" };
const AREA_RX = Object.keys(AREAS).filter((a) => a !== "Bengaluru").map((a) => [a, new RegExp("\\b(" + a.replace(/ /g, "\\s*") + (ALT[a] ? "|" + ALT[a] : "") + ")\\b", "i")]);
const BLR_RX = /\b(bengaluru|bangalore)\b/i;

const SECTORS = [
  ["AI", /\b(ai|artificial intelligence|llm|machine learning|ml|agents?|gpt|copilot|voice ai)\b/i],
  ["Fintech", /\b(fintech|payments?|lending|credit|bank|wealth|trading|insurance|upi|neobank|nbfc|invest)/i],
  ["Devtools", /\b(developer|devtools?|api|sdk|infra(structure)?|cloud|open[- ]source|observability|kubernetes|ci\/cd)\b/i],
  ["Healthtech", /\b(health|clinic|doctor|patient|medical|pharma|hospital|wellness|diagnos)/i],
  ["Edtech", /\b(edtech|learning|students?|education|school|college|tutor|upskill)/i],
  ["Logistics", /\b(logistics|shipping|supply chain|freight|delivery|fleet|warehouse|mobility)/i],
  ["Consumer", /\b(consumer|d2c|brand|retail|e-?commerce|marketplace|social|media|content|creator|audio|gaming|food|beverage|coffee)/i],
  ["Deeptech", /\b(robotics|semiconductor|hardware|space|drone|iot|battery|energy|climate|biotech|material)/i],
  ["SaaS", /\b(saas|b2b|software|platform|automation|workflow|enterprise|crm|hr|analytics)/i],
];
const sectorOf = (t) => (SECTORS.find(([, rx]) => rx.test(t)) || ["SaaS"])[0];
const STAGE = { pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A", series_b: "Series B", series_c: "Series C", series_d_plus: "Series C+", public: "Public", bootstrapped: "Bootstrapped", unknown: "" };
const stageFromText = (t) => /series\s*[d-z]/i.test(t) ? "Series C+" : /series\s*c/i.test(t) ? "Series C" : /series\s*b/i.test(t) ? "Series B" : /series\s*a/i.test(t) ? "Series A" : /\bseed\b/i.test(t) ? "Seed" : /pre-?seed/i.test(t) ? "Pre-seed" : /bootstrap/i.test(t) ? "Bootstrapped" : /\bYC\b|Y Combinator/i.test(t) ? "Seed" : "";
const hash = (s) => parseInt(createHash("md5").update(s).digest("hex").slice(0, 8), 16);
const jitter = (seed, scale) => (((seed % 1000) / 1000) - 0.5) * scale;
const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
const firstSentence = (s, max) => { const t = clean(s); const m = t.match(/^(.{20,}?[.!?])(\s|$)/); const r = m ? m[1] : t; return r.length > max ? r.slice(0, max - 1).replace(/\s\S*$/, "") + "…" : r; };
const km = (a, b) => { const dx = (a[1] - b[1]) * 108.5, dy = (a[0] - b[0]) * 111; return Math.hypot(dx, dy); };
const nearestArea = (lat, lng) => { let best = ["Bengaluru", 9]; for (const [a, c] of Object.entries(AREAS)) { if (a === "Bengaluru") continue; const d = km([lat, lng], c); if (d < best[1]) best = [a, d]; } return best[1] <= 2.2 ? best[0] : "Bengaluru"; };

function place(name, text, known, exact) {
  if (exact) return { area: nearestArea(exact.lat, exact.lng), exact: true, lat: +exact.lat.toFixed(5), lng: +exact.lng.toFixed(5) };
  let area = known || null;
  if (!area) for (const [a, rx] of AREA_RX) if (rx.test(text)) { area = a; break; }
  const key = area || "Bengaluru";
  // unplaced companies spread over the startup belt (Koramangala–Domlur–Bellandur), not the whole city
  const [lat, lng] = area ? AREAS[key] : [12.947, 77.647];
  const seed = hash(name);
  const spread = area ? 0.007 : 0.06;
  return { area: key, exact: false, lat: +(lat + jitter(seed, spread)).toFixed(5), lng: +(lng + jitter(seed >>> 3, spread)).toFixed(5) };
}

// logos: assets/logos/<domain>.png -> data URI (downscaled to 96px when large)
function logoFor(domain) {
  const file = P(`../assets/logos/${domain}.png`); if (!existsSync(file)) return null;
  let buf = readFileSync(file);
  if (buf.length > 24000) { try { execFileSync("sips", ["-Z", "96", file, "--out", "/tmp/_logo.png"], { stdio: "ignore" }); buf = readFileSync("/tmp/_logo.png"); } catch {} }
  const sig = buf.subarray(0, 4).toString("hex");
  const mime = sig.startsWith("89504e47") ? "image/png" : sig.startsWith("ffd8") ? "image/jpeg" : sig.startsWith("3c73") || buf.subarray(0, 5).toString() === "<?xml" ? "image/svg+xml" : sig.startsWith("52494646") ? "image/webp" : sig.startsWith("0000") ? "image/x-icon" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const now = Date.now(), week = 7 * 864e5;
const freshRole = (r) => r.posted && now - new Date(r.posted).getTime() < week;
const roleType = (r) => /intern/i.test(r.title) ? "internship" : r.type && /intern/i.test(r.type) ? "internship" : r.type && /contract/i.test(r.type) ? "contract" : "full_time";
const roleMode = (r) => /remote/i.test(r.title + " " + (r.location || "")) ? "remote" : /hybrid/i.test(r.location || "") ? "hybrid" : "onsite";

// ---------- source: scrape ----------
const REMOTE_FIRST = new Set(["gitlab.com", "elastic.co", "turing.com"]);
const KNOWN_AREA = { "groww.in": "Bellandur" };
const STALE_DAYS = 120; // a posting older than this is not shown; a company left with none links to its careers page instead
function fromScrape() {
  const f = P("../raw/scrape.json"); if (!existsSync(f)) return [];
  const d = JSON.parse(readFileSync(f, "utf8"));
  return d.companies.map((c) => {
    const roles = c.jobs.filter((j) => !j.posted || now - new Date(j.posted).getTime() < STALE_DAYS * 864e5)
      .map((j) => ({ title: j.title, url: j.url, type: roleType(j), mode: roleMode(j), dept: j.dept, comp: null, posted: j.posted, location: j.location })).sort((a, b) => (b.posted || "").localeCompare(a.posted || ""));
    if (!roles.length && c.jobs.length) c.unverified = true; // everything it listed was stale
    return {
      id: c.domain, name: c.name, domain: c.domain, website: `https://${c.domain}`, tagline: c.tagline, summary: c.tagline,
      stage: c.stage || "", funding: "", employees: null, founded: null, sector: c.sector, tags: [REMOTE_FIRST.has(c.domain) && "Remote-first"].filter(Boolean),
      ...place(c.name, c.tagline, c.area || KNOWN_AREA[c.domain] || null, c.geo ? { lat: c.lat, lng: c.lng } : null),
      roles, signals: [], fresh: roles.some(freshRole), verified: c.unverified ? null : d.scraped_at, source: c.ats, board: c.board, totalOpen: c.total,
      office: c.offices?.[0]?.osm || null, famous: !!c.famous, careersOnly: !!c.unverified,
    };
  });
}

// ---------- source: fixture ----------
function fromFixture() {
  if (!existsSync(FIXTURE)) return [];
  const rows = JSON.parse(readFileSync(FIXTURE, "utf8")); const out = [];
  for (const c of rows) {
    const text = (c.summary || "") + "\n" + (c.signal_text || ""); if (!BLR_RX.test(text)) continue;
    const head = clean((c.summary || "").split("\n")[0]); const m = head.match(/^(.*?)\s+at\s+(.*?)(\s*\|.*)?$/i); const roleTitle = m ? m[1] : null;
    const sig = clean(c.signal_text);
    let blurb = sig.match(/is an? ([A-Z].*?)(?:\.|$)/)?.[1]; if (!blurb || blurb.length < 25) blurb = firstSentence(c.summary.replace(/^.*?\n/, "").replace(/^[#\s]+/, ""), 160);
    const funding = sig.match(/Has (\$[\d.]+[KMB]) in total funding/)?.[1], employees = sig.match(/employs (\d+) people/)?.[1], founded = sig.match(/founded in (\d{4})/)?.[1];
    const yc = /Y Combinator|\(YC /i.test(text);
    out.push({
      id: c.domain, name: c.name.replace(/\s*\(.*?\)\s*$/, ""), domain: c.domain, website: c.website, tagline: firstSentence(blurb.charAt(0).toUpperCase() + blurb.slice(1), 150), summary: null,
      stage: stageFromText(text) || (funding ? "Seed" : ""), funding: funding ? `${funding} raised` : yc ? "Backed by Y Combinator" : "", employees: employees ? +employees : null, founded: founded ? +founded : null,
      sector: sectorOf(text), tags: [yc && "YC"].filter(Boolean), ...place(c.name, text, null, null),
      roles: roleTitle ? [{ title: roleTitle, url: c.signal_url || c.website, type: /intern/i.test(roleTitle) ? "internship" : "full_time", mode: /remote/i.test(c.summary) ? "remote" : "onsite", dept: null, comp: c.summary.match(/\$[\d,.]+K?\s*-\s*\$[\d,.]+K?/)?.[0] || null, posted: null }] : [],
      signals: [], fresh: false, verified: null, source: "backdoor-research",
    });
  }
  return out;
}

// ---------- source: DB export ----------
function fromExport() {
  const f = P("../raw/india.json"); if (!existsSync(f)) return { list: [], exported_at: null };
  const d = JSON.parse(readFileSync(f, "utf8"));
  const postings = new Map(), signals = new Map();
  for (const p of d.postings) (postings.get(p.company_id) || postings.set(p.company_id, []).get(p.company_id)).push(p);
  for (const s of d.signals) (signals.get(s.company_id) || signals.set(s.company_id, []).get(s.company_id)).push(s);
  const list = [];
  for (const c of d.companies) {
    const ps = postings.get(c.id) || [], ss = signals.get(c.id) || [];
    const text = [c.summary, c.funding_summary, JSON.stringify(c.metadata), ...ps.map((p) => p.title), ...ss.map((s) => s.title + " " + s.summary)].join("\n");
    if (!BLR_RX.test(text) && !AREA_RX.some(([, rx]) => rx.test(text))) continue;
    const roles = ps.map((p) => ({ title: p.title, url: p.source_url, type: p.employment_type === "unknown" ? "full_time" : p.employment_type, mode: p.work_mode === "unknown" ? "onsite" : p.work_mode, dept: null, comp: null, posted: p.posted_on || p.last_seen_at })).sort((a, b) => (b.posted || "").localeCompare(a.posted || ""));
    const sigs = ss.filter((s) => s.kind !== "contact").sort((a, b) => (b.observed_at || "").localeCompare(a.observed_at || "")).slice(0, 5).map((s) => ({ kind: s.kind, title: clean(s.title), source: s.source_name, date: s.observed_at, url: s.source_url }));
    list.push({
      id: c.canonical_domain, name: c.name, domain: c.canonical_domain, website: c.website, tagline: firstSentence(c.summary, 150), summary: clean(c.summary).slice(0, 420),
      stage: STAGE[c.funding_stage] || stageFromText(text), funding: clean(c.funding_summary).slice(0, 120), employees: c.metadata?.employees ?? null, founded: c.metadata?.founded ?? null,
      sector: sectorOf(text), tags: [c.hiring_status === "hiring" && "Hiring"].filter(Boolean), ...place(c.name, text, null, null), roles, signals: sigs,
      fresh: ps.some((p) => now - new Date(p.last_seen_at).getTime() < week), verified: c.last_verified_at, source: "backdoor-research",
    });
  }
  return { list, exported_at: d.exported_at };
}

// ---------- merge ----------
// Research cache (fixture + DB export) is off unless USE_RESEARCH=1: the map is built from live boards.
const USE_RESEARCH = process.env.USE_RESEARCH === "1";
const scrape = fromScrape(), fixture = USE_RESEARCH ? fromFixture() : [], db = USE_RESEARCH ? fromExport() : { list: [], exported_at: null };
const byDomain = new Map();
const key = (d) => d.replace(/^www\./, "").toLowerCase();
for (const s of [...scrape, ...fixture, ...db.list]) {
  const k = key(s.domain), prev = byDomain.get(k);
  if (!prev) { byDomain.set(k, s); continue; }
  // merge: keep live roles from both, prefer the richer summary and exact coordinates
  const seen = new Set(prev.roles.map((r) => r.title.toLowerCase()));
  prev.roles.push(...s.roles.filter((r) => !seen.has(r.title.toLowerCase())));
  prev.signals = prev.signals.length ? prev.signals : s.signals;
  prev.summary = prev.summary || s.summary; prev.funding = prev.funding || s.funding; prev.stage = prev.stage || s.stage;
  prev.employees = prev.employees ?? s.employees; prev.founded = prev.founded ?? s.founded; prev.fresh = prev.fresh || s.fresh;
  if (!prev.exact && s.exact) Object.assign(prev, { lat: s.lat, lng: s.lng, area: s.area, exact: true });
  prev.source = prev.source === s.source ? prev.source : `${prev.source}+${s.source}`;
}
// FAMOUS_ONLY (default on): the map shows only recognisable names; set FAMOUS_ONLY=0 to keep everything the scraper found.
const FAMOUS_ONLY = process.env.FAMOUS_ONLY !== "0";
const startups = [...byDomain.values()].filter((s) => !FAMOUS_ONLY || s.famous).map((s) => ({ ...s, logo: logoFor(s.domain) }))
  // a recognisable name needs a recognisable mark: in famous-only mode, no logo (or a 16 px favicon) means no pin
  .filter((s) => !FAMOUS_ONLY || (s.logo && s.logo.length > 1400));
startups.sort((a, b) => b.roles.length - a.roles.length || a.name.localeCompare(b.name));
// Video frame: the box that holds the recognisable names (used by the V key and the README)
const fam = startups.filter((s) => s.famous);
// trimmed to the 6th–94th percentile so one outlier office (e.g. Manyata in the north) does not widen the shot
const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))]; };
const box = fam.length ? [pct(fam.map((s) => s.lng), .06), pct(fam.map((s) => s.lat), .06), pct(fam.map((s) => s.lng), .94), pct(fam.map((s) => s.lat), .94)] : null;
const inFrame = box ? fam.filter((s) => s.lng >= box[0] && s.lng <= box[2] && s.lat >= box[1] && s.lat <= box[3]).length : 0;
const areas = {}; for (const s of startups) areas[s.area] = (areas[s.area] || 0) + 1;
const data = {
  built_at: new Date().toISOString(), exported_at: db.exported_at, scraped_at: scrape.length ? JSON.parse(readFileSync(P("../raw/scrape.json"), "utf8")).scraped_at : null,
  sources: { scrape: scrape.length, fixture: fixture.length, db: db.list.length },
  counts: { startups: startups.length, roles: startups.reduce((n, s) => n + s.roles.length, 0), areas: Object.keys(areas).filter((a) => a !== "Bengaluru").length, logos: startups.filter((s) => s.logo).length },
  areaCenters: Object.fromEntries(Object.entries(AREAS).map(([k, [lat, lng]]) => [k, { lat, lng }])), areas, videoFrame: box, startups,
};
writeFileSync(P("../data/startups.json"), JSON.stringify(data));
console.log("sources:", data.sources, "| companies:", data.counts.startups, "| roles:", data.counts.roles, "| logos:", data.counts.logos, "| areas:", data.counts.areas, "| bytes:", JSON.stringify(data).length);
console.log("famous:", fam.length, "| in video frame:", inFrame, "| careers-only:", startups.filter((s) => s.careersOnly).length, "| video frame:", box);
console.log("placement:", { exact: startups.filter((s) => s.exact).length, byLocality: startups.filter((s) => !s.exact && s.area !== "Bengaluru").length, spread: startups.filter((s) => s.area === "Bengaluru").length });
