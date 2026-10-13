// Point-in-water test from the Overpass dump used for the basemap (raw/water.json: natural=water ways and relations).
import { readFileSync } from "node:fs";
const raw = JSON.parse(readFileSync(new URL("../raw/water.json", import.meta.url), "utf8")).elements;
const rings = [];
const ring = (g) => g.map((p) => [p.lon, p.lat]);
for (const el of raw) {
  const t = el.tags || {}; if (t.natural !== "water") continue;
  if (el.type === "way" && el.geometry?.length > 3) rings.push(ring(el.geometry));
  if (el.type === "relation" && el.members) { // stitch outer ways into closed rings
    const segs = el.members.filter((m) => m.role === "outer" && m.geometry).map((m) => ring(m.geometry));
    let cur = null;
    while (segs.length || cur) {
      if (!cur) cur = segs.shift(); if (!cur) break;
      const last = cur[cur.length - 1]; let joined = false;
      for (let i = 0; i < segs.length; i++) { const s = segs[i]; if (s[0][0] === last[0] && s[0][1] === last[1]) { cur = cur.concat(s.slice(1)); segs.splice(i, 1); joined = true; break; } if (s[s.length - 1][0] === last[0] && s[s.length - 1][1] === last[1]) { cur = cur.concat(s.slice(0, -1).reverse()); segs.splice(i, 1); joined = true; break; } }
      if (!joined || (cur[0][0] === cur[cur.length - 1][0] && cur[0][1] === cur[cur.length - 1][1])) { if (cur.length > 3) rings.push(cur); cur = null; }
    }
  }
}
const boxes = rings.map((r) => { let w = 180, s = 90, e = -180, n = -90; for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; } return [w, s, e, n]; });
function inRing(x, y, r) { let inside = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; }
export function waterAt(lat, lng) { for (let i = 0; i < rings.length; i++) { const b = boxes[i]; if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue; if (inRing(lng, lat, rings[i])) return true; } return false; }
/** true if the point or any point within `m` metres is water */
export function nearWater(lat, lng, m = 60) {
  if (waterAt(lat, lng)) return true;
  const dLat = m / 111000, dLng = m / (111000 * Math.cos((lat * Math.PI) / 180));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 2 * Math.PI; if (waterAt(lat + Math.sin(a) * dLat, lng + Math.cos(a) * dLng)) return true; }
  return false;
}
/** nudge a point to the nearest dry spot (spiral search), or return it unchanged if already dry */
export function dryPoint(lat, lng, m = 60) {
  if (!nearWater(lat, lng, m)) return { lat, lng, moved: false };
  for (let r = 80; r <= 1500; r += 60) for (let k = 0; k < 16; k++) { const a = (k / 16) * 2 * Math.PI; const la = lat + (Math.sin(a) * r) / 111000, lo = lng + (Math.cos(a) * r) / (111000 * Math.cos((lat * Math.PI) / 180)); if (!nearWater(la, lo, m)) return { lat: +la.toFixed(5), lng: +lo.toFixed(5), moved: true, metres: r }; }
  return { lat, lng, moved: false };
}
export const waterRings = rings.length;
