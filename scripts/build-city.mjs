// Overpass JSON -> compact GeoJSON layers for the map (no network at runtime).
import { readFileSync, writeFileSync } from "node:fs";
const R = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const roads = R("../raw/roads.json").elements, tert = R("../raw/tert.json").elements, misc = R("../raw/water.json").elements;

// Douglas-Peucker on [lon,lat] arrays, tolerance in degrees (~1e-4 deg ≈ 11 m)
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const sq = tol * tol;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py; const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sq && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const q = (v) => Math.round(v * 1e5) / 1e5;
const lineLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
const line = (el) => el.geometry.map((g) => [q(g.lon), q(g.lat)]);
const feat = (geom, props = {}) => ({ type: "Feature", properties: props, geometry: geom });
const fc = (features) => ({ type: "FeatureCollection", features });

const major = [], minor = [], tertiary = [], rail = [], runway = [], water = [], parks = [];
for (const el of roads) {
  if (!el.geometry) continue; const h = el.tags.highway;
  const pts = dp(line(el), 3.2e-4); if (pts.length < 2) continue;
  const f = feat({ type: "LineString", coordinates: pts }, { c: h.startsWith("motorway") || h.startsWith("trunk") ? "a" : h === "primary" ? "b" : "c", n: el.tags.name || undefined });
  (f.properties.c === "c" ? minor : major).push(f);
}
for (const el of tert) { if (!el.geometry) continue; const pts = dp(line(el), 6e-4); if (pts.length > 1 && lineLen(pts) > 0.0018) tertiary.push(feat({ type: "LineString", coordinates: pts })); }
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(a / 2); };
function poly(el, tol) {
  if (el.type === "way" && el.geometry) { const pts = dp(line(el), tol); if (pts.length < 4) return null; if (pts[0][0] !== pts.at(-1)[0] || pts[0][1] !== pts.at(-1)[1]) pts.push(pts[0]); return [[pts]]; }
  if (el.type === "relation" && el.members) {
    const outers = el.members.filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry.map((g) => [q(g.lon), q(g.lat)]));
    // stitch outer segments into rings
    const rings = []; let cur = null;
    const segs = outers.slice();
    while (segs.length) {
      if (!cur) cur = segs.shift();
      const last = cur.at(-1); let found = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i]; if (s[0][0] === last[0] && s[0][1] === last[1]) { cur = cur.concat(s.slice(1)); segs.splice(i, 1); found = true; break; }
        if (s.at(-1)[0] === last[0] && s.at(-1)[1] === last[1]) { cur = cur.concat(s.slice(0, -1).reverse()); segs.splice(i, 1); found = true; break; }
      }
      if (!found || (cur[0][0] === cur.at(-1)[0] && cur[0][1] === cur.at(-1)[1])) { if (cur.length > 3) { if (cur[0][0] !== cur.at(-1)[0] || cur[0][1] !== cur.at(-1)[1]) cur.push(cur[0]); rings.push(dp(cur, tol)); } cur = null; }
    }
    if (!rings.length) return null; return rings.filter((r) => r.length > 3).map((r) => [r]);
  }
  return null;
}
for (const el of misc) {
  const t = el.tags || {};
  if (t.railway === "rail" && el.geometry) { if (t.service) continue; const pts = dp(line(el), 3e-4); if (pts.length > 1) rail.push(feat({ type: "LineString", coordinates: pts })); continue; }
  if (t.aeroway === "runway" && el.geometry) { runway.push(feat({ type: "LineString", coordinates: line(el) })); continue; }
  if (t.natural === "water") { const p = poly(el, 2e-4); if (!p) continue; const polys = p.filter((pp) => ringArea(pp[0]) > 4e-6); for (const pp of polys) water.push(feat({ type: "Polygon", coordinates: pp }, { n: t.name })); continue; }
  if (t.leisure === "park") { const p = poly(el, 3e-4); if (!p) continue; for (const pp of p) if (ringArea(pp[0]) > 1.2e-5) parks.push(feat({ type: "Polygon", coordinates: pp }, { n: t.name })); }
}
const out = { major: fc(major), minor: fc(minor), tertiary: fc(tertiary), rail: fc(rail), runway: fc(runway), water: fc(water), parks: fc(parks) };
const s = JSON.stringify(out);
writeFileSync(new URL("../data/city.json", import.meta.url), s);
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.features.length])), "bytes", s.length);
