// Builds the deployable site page (index.html) from the artifact source (artifact.html): the Claude artifact
// host wraps that fragment itself, a real web server needs the full document with head, meta and favicon.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../", import.meta.url).pathname;
const src = readFileSync(root + "artifact.html", "utf8");
const SITE = process.env.SITE_URL || "https://neeljoshi18.github.io/bangalore-startup-map-backdoor/";
const styleEnd = src.indexOf("</style>") + "</style>".length;
const head = src.slice(0, styleEnd).replace(/^<title>.*<\/title>\n<meta name="description"[^>]*>\n/, "");
const body = src.slice(styleEnd);
const title = "Who's hiring in Bengaluru right now · Backdoor";
const desc = "Every company hiring in Bengaluru, on one map. 80+ names you know, live roles from their job boards, and Backdoor to get you in.";
const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${SITE}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" type="image/png" sizes="48x48" href="assets/ghost-48.png">
<link rel="apple-touch-icon" href="assets/ghost-256.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Backdoor">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${SITE}assets/og.jpg">
<!-- Analytics: the page calls window.bdTrack(event, props) on every click that matters (see README).
     It forwards to window.dataLayer, plausible(), gtag(), posthog.capture() when any of them exist, so drop
     the production snippet here and events flow with no page changes. -->
${head}
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(root + "index.html", doc);
console.log("wrote index.html for", SITE, (doc.length / 1024).toFixed(0) + " KB");
