// Fills lat/lng for curated offices (data/offices.json) from their address via Nominatim; keeps existing coords.
import { readFileSync, writeFileSync } from "node:fs";
const P = new URL("../data/offices.json", import.meta.url).pathname;
const o = JSON.parse(readFileSync(P, "utf8"));
const UA = { "user-agent": "backdoor-blr-map/1.0 (contact: neel@backdoorai.app)" };
const inBlr = (x) => +x.lat > 12.7 && +x.lat < 13.3 && +x.lon > 77.3 && +x.lon < 77.9;
for (const [d, e] of Object.entries(o)) {
  if (e.lat || !e.geocode) continue;
  for (const q of [e.geocode, e.geocode.replace(/,.*$/, "") + ", Bengaluru"]) {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=in&q=${encodeURIComponent(q)}`, { headers: UA });
    const j = r.ok ? await r.json() : []; await new Promise((s) => setTimeout(s, 1100));
    const hit = j.find(inBlr);
    if (hit) { e.lat = +(+hit.lat).toFixed(5); e.lng = +(+hit.lon).toFixed(5); e.geocoded_as = hit.display_name.split(",").slice(0, 3).join(","); console.log(d.padEnd(16), "->", e.lat, e.lng, "|", e.geocoded_as); break; }
  }
  if (!e.lat) console.log(d.padEnd(16), "-> NOT FOUND for", e.geocode);
}
writeFileSync(P, JSON.stringify(o, null, 1));
