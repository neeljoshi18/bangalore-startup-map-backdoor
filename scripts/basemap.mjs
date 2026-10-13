// Bakes a real basemap (OpenFreeMap "liberty" style, OpenStreetMap data) into a few large JPEGs so the
// page can show a normal-looking map without any tile server (the artifact sandbox blocks tiles).
// Run from scripts/rec (where playwright is installed): node ../basemap.mjs
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire(new URL("./rec/package.json", import.meta.url));
const { chromium } = require("playwright");
const OUT = new URL("../data/", import.meta.url).pathname; mkdirSync(OUT, { recursive: true });

// name, [west, south, east, north], width, height  (px/degree sets the effective zoom)
const LEVELS = [
  ["region", [76.95, 12.40, 78.30, 13.55], 3000, 2600],   // ~z11.3, under the pitched intro
  ["city",   [77.44, 12.80, 77.80, 13.13], 3600, 3300],   // ~z13.8
  ["core",   [77.57, 12.88, 77.74, 13.01], 4800, 3760],   // ~z15.3, the belt where the tour lives
];
const html = `<!doctype html><meta charset="utf-8"><script src="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js"></script>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css"><style>html,body{margin:0;background:#fff}#m{position:absolute;left:0;top:0}</style>
<div id="m"></div><script>window.ready=false;</script>`;
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-device-scale-factor=1"] });
const meta = { style: "OpenFreeMap liberty (OpenMapTiles, OpenStreetMap contributors)", levels: {} };
for (const [name, bbox, W, H] of LEVELS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("  [page]", m.text().slice(0, 160)); });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 160)));
  await page.setContent(html, { waitUntil: "load" });
  const t0 = Date.now();
  await page.evaluate(([bbox, W, H]) => {
    const el = document.getElementById("m"); el.style.width = W + "px"; el.style.height = H + "px";
    const map = new maplibregl.Map({ container: "m", style: "https://tiles.openfreemap.org/styles/liberty", attributionControl: false, pixelRatio: 1, maxCanvasSize: [8192, 8192], fadeDuration: 0, interactive: false });
    window.map = map; window.mapErr = null;
    map.on("error", (e) => { window.mapErr = String(e?.error?.message || e); });
    map.once("load", () => { map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 0, duration: 0 }); window.fitted = true; });
  }, [bbox, W, H]);
  await page.waitForFunction(() => window.fitted, null, { timeout: 120000 });
  console.log(name, "style loaded after", ((Date.now() - t0) / 1000).toFixed(0), "s; waiting for tiles");
  await page.waitForFunction(() => map.loaded() && map.areTilesLoaded() && !map.isMoving(), null, { timeout: 300000, polling: 500 });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => map.loaded() && map.areTilesLoaded(), null, { timeout: 120000, polling: 500 });
  const err = await page.evaluate(() => window.mapErr); if (err) console.log("  map error:", err);
  console.log(name, "tiles loaded after", ((Date.now() - t0) / 1000).toFixed(0), "s");
  const b = await page.evaluate(() => { const b = map.getBounds(); return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: map.getZoom(), bg: map.getPaintProperty("background", "background-color") }; });
  await page.screenshot({ path: `${OUT}basemap-${name}.jpg`, type: "jpeg", quality: 84, clip: { x: 0, y: 0, width: W, height: H } });
  meta.levels[name] = { file: `data/basemap-${name}.jpg`, width: W, height: H, zoom: b.zoom, coordinates: [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]] };
  meta.background = b.bg;
  console.log(name, "zoom", b.zoom.toFixed(2), "bounds", b.west.toFixed(4), b.south.toFixed(4), b.east.toFixed(4), b.north.toFixed(4));
  await page.close();
}
await browser.close();
writeFileSync(`${OUT}basemap.json`, JSON.stringify(meta, null, 1));
console.log("wrote", OUT + "basemap.json");
