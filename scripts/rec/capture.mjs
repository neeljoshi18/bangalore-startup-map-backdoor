// Deterministic capture: timesnap/timecut step a virtual clock; CSS animations are driven by hand each frame.
// usage: node capture.mjs <mode:test|video> <fps> <seconds> <outPathOrDir> [tourAt=7.6]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const timecut = require("timecut"), timesnap = require("timesnap");
const [,, mode = "test", fpsS = "30", durS = "2", out = "frames", tourAtS = "7.6"] = process.argv;
const fps = +fpsS, duration = +durS, tourAt = +tourAtS;
const events = [];
let msgs = 0, tourStarted = false;
const common = {
  url: "http://127.0.0.1:8790/standalone.html", viewport: { width: 1600, height: 900 }, fps, duration, startDelay: 1.5,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  launchArguments: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--window-size=1600,900", "--hide-scrollbars", "--force-device-scale-factor=1", "--no-sandbox"],
  preparePage: async (page) => {
    await page.waitForFunction(() => window.__blr && window.__blr.state.data && document.fonts.status === "loaded", { timeout: 60000 });
    await page.evaluate(() => { window.__capture = true; });
  },
  preparePageForScreenshot: async (page, frame) => {
    const vt = frame / fps;
    if (!tourStarted && vt >= tourAt) { tourStarted = true; await page.evaluate(() => window.__blr.toggleTour()); events.push({ t: vt, kind: "tour" }); }
    const r = await page.evaluate(() => {
      const now = performance.now();
      for (const a of document.getAnimations()) { if (a.__vs === undefined) { a.__vs = now; a.pause(); } try { a.currentTime = Math.max(0, now - a.__vs); } catch {} }
      return { msgs: [...document.querySelectorAll(".msg")].filter((m) => !m.querySelector(".typing")).length, cards: document.querySelectorAll(".card").length, loaded: !!(window.__blr.map && window.__blr.map.loaded()), now };
    });
    if (r.msgs > msgs) { for (let i = msgs; i < r.msgs; i++) events.push({ t: vt, kind: "msg" }); msgs = r.msgs; }
    if (frame % (fps * 5) === 0) console.error(`frame ${frame} vt ${vt.toFixed(1)}s msgs ${r.msgs} cards ${r.cards} loaded ${r.loaded} real ${(Date.now() - T0) / 1000 | 0}s`);
  },
};
const T0 = Date.now();
if (mode === "test") await timesnap({ ...common, outputDirectory: out, outputPattern: "f-%04d.png" });
else await timecut({ ...common, output: out, pixFmt: "yuv420p", outputOptions: ["-crf", "17", "-preset", "medium", "-movflags", "+faststart"], frameCache: true, quiet: true });
writeFileSync(out.replace(/\.mp4$/, "") + ".events.json", JSON.stringify({ fps, duration, events }, null, 1));
console.error("done in", ((Date.now() - T0) / 1000).toFixed(0), "s; events", events.length);
