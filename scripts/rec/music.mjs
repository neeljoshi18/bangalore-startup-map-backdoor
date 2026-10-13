// Synthesises a light lo-fi soundtrack for the tour clip, with UI blips at the moments the chat
// and the tour do something. Everything is generated; nothing is sampled.
// usage: node music.mjs <events.json> <out.wav> [seconds]
import { readFileSync, writeFileSync } from "node:fs";
const [,, eventsPath, outPath, secS] = process.argv;
const ev = JSON.parse(readFileSync(eventsPath, "utf8"));
const SR = 44100, DUR = secS ? +secS : ev.duration, N = Math.floor(SR * DUR);
const mix = new Float64Array(N);
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };

function env(i, n, a, d, s, r) { // ADSR, i and n in samples
  const A = a * SR, D = d * SR, R = r * SR;
  if (i < A) return i / A;
  if (i < A + D) return 1 + (s - 1) * ((i - A) / D);
  if (i > n - R) return s * Math.max(0, (n - i) / R);
  return s;
}
function note(freq, start, length, { amp = 0.1, harmonics = [[1, 1], [2, .35], [3, .12], [4, .05]], vib = 0, a = .6, d = .4, s = .8, r = 1.2 } = {}) {
  const i0 = Math.floor(start * SR); if (i0 >= N) return; const n = Math.min(Math.floor(length * SR), N - i0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, ph = 2 * Math.PI * freq * t + vib * Math.sin(2 * Math.PI * 4.2 * t);
    let v = 0; for (const [h, w] of harmonics) v += w * Math.sin(h * ph);
    mix[i0 + i] += v * env(i, n, a, d, s, r) * amp;
  }
}
function noiseBurst(start, length, amp, hp) {
  const i0 = Math.floor(start * SR); if (i0 >= N) return; const n = Math.min(Math.floor(length * SR), N - i0);
  let prev = 0; for (let i = 0; i < n; i++) { const x = rnd() * 2; const y = hp ? (x - prev) * hp + x * (1 - hp) : x; prev = x; mix[i0 + i] += y * Math.exp(-i / (SR * length / 4)) * amp; }
}
function kick(start) {
  const i0 = Math.floor(start * SR), n = Math.floor(.16 * SR); if (i0 + n >= N) return;
  let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, f = 110 * Math.exp(-t * 18) + 48; ph += 2 * Math.PI * f / SR; mix[i0 + i] += Math.sin(ph) * Math.exp(-t * 16) * .16; }
}
function swell(start, length, amp) {
  const i0 = Math.floor(start * SR), n = Math.min(Math.floor(length * SR), N - i0); let acc = 0;
  for (let i = 0; i < n; i++) { const c = .002 + (.03 - .002) * (i / n); acc += c * (rnd() * 2 - acc); const shape = Math.sin(Math.PI * i / n) ** 1.5; mix[i0 + i] += acc * shape * amp * 6; }
}
function pop(start, f0 = 1040, f1 = 620, length = .09, amp = .14) {
  const i0 = Math.floor(start * SR), n = Math.floor(length * SR); if (i0 + n >= N) return;
  let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, f = f0 + (f1 - f0) * (t / length); ph += 2 * Math.PI * f / SR; mix[i0 + i] += Math.sin(ph) * Math.exp(-t * 38) * amp; }
}

// ---- harmony: a slow four-chord loop at 95 bpm, two bars per chord ----
const BPM = 95, beat = 60 / BPM, bar = 4 * beat, chordLen = 2 * bar;
const chords = [[62, 66, 69, 73, 76], [66, 69, 73, 76], [59, 62, 66, 69, 73], [55, 59, 62, 66, 69]]; // Dmaj9 | F#m7 | Bm7 | Gmaj7
for (let k = 0, start = 0; start < DUR; k++, start += chordLen) {
  const ch = chords[k % 4];
  ch.forEach((m, j) => note(midi(m), start + .03 * j, chordLen + .4, { amp: .055, vib: .004, a: .9, d: .6, s: .75, r: 1.4 }));
  for (const b of [0, 2, 4, 6]) note(midi(ch[0] - 24), start + b * beat, beat * 1.9, { amp: .11, harmonics: [[1, 1], [2, .15]], a: .02, d: .3, s: .6, r: .4 });
  for (const b of [1.5, 5.5]) note(midi(ch[ch.length - 1] + 12), start + b * beat, .6, { amp: .03, harmonics: [[1, 1], [2, .5], [3, .2]], a: .005, d: .25, s: .2, r: .3 });
}
// ---- percussion: brushed hats on the off-beats, a soft kick on 1 and 3 ----
for (let b = 0; b < DUR; b += bar) { noiseBurst(b + beat, .05, .035, .9); noiseBurst(b + 3 * beat, .05, .03, .9); kick(b); kick(b + 2 * beat); }
// ---- a gentle swell under the fly-in ----
swell(1.4, 3.6, .08);
// ---- UI blips synced to events: each bubble pops, the tour start gets a soft three-note chime ----
for (const e of ev.events) {
  if (e.kind === "msg") pop(e.t + .03);
  if (e.kind === "tour") [74, 78, 81].forEach((m, j) => note(midi(m), e.t + .08 * j, .9, { amp: .05, harmonics: [[1, 1], [2, .3]], a: .005, d: .3, s: .3, r: .5 }));
}
// ---- master: fade in/out, soft clip, normalise to about -1 dBFS ----
const fi = Math.floor(.8 * SR), fo = Math.floor(2.5 * SR);
for (let i = 0; i < fi; i++) mix[i] *= i / fi;
for (let i = 0; i < fo; i++) mix[N - 1 - i] *= i / fo;
let peak = 1e-9; for (let i = 0; i < N; i++) { mix[i] = Math.tanh(mix[i] * 1.6) / 1.6; peak = Math.max(peak, Math.abs(mix[i])); }
const g = .89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { const v = Math.round(mix[i] * g * 32767); buf.writeInt16LE(v, 44 + i * 4); buf.writeInt16LE(v, 46 + i * 4); }
writeFileSync(outPath, buf);
console.log("wrote", outPath, DUR.toFixed(1) + "s", "events", ev.events.length);
