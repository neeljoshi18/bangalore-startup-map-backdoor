# Handoff: Bengaluru hiring map → backdoorai.app

A static page, no backend. Everything it needs is in this folder; nothing is fetched from third parties at
runtime except MapLibre (unpkg) and Inter (Google Fonts). It can live at `backdoorai.app/bengaluru` as-is.

## What the page does

- iMessage thread with Backdoor on the left (our iOS 26 kit from `app/_components/landing/IMessage.tsx`),
  a real Bengaluru basemap on the right with company logos as pins (83 recognisable names, ~830 live roles).
- "Get me in" on each card opens backdoorai.app (utm_source=bengaluru-map, utm_content=<domain>; event `cta_clicked`). The compose row, the "+" and Backdoor's last bubble open Messages to the public line
  (`+14154907396`, from `/api/public-line`) with `Hey Backdoor, I want to work at <Company> as <Role>.`
  If Messages does not open (Android, in-app browsers) a sheet shows the number and the message with copy buttons.
- Share buttons compose tweets: the top one for the map, each card for that company's roles with a `#<domain>`
  deep link that reopens the page on that card.
- Hidden keys for recording: `R` replay, `V` video frame, `P` tour, `H` map only.

## Dropping it into the Next.js app

Option A (fastest, zero code): copy `index.html`, `data/`, `assets/` into `public/bengaluru/` and ship.
Next serves it at `/bengaluru/`. Relative paths in the page already assume a folder.

Option B (route in the app): make `app/(marketing)/bengaluru/page.tsx` a client component that renders the
same markup; or keep it static and add a `rewrites()` entry from `/bengaluru` to `/bengaluru/index.html`.
Either way, set `SITE_URL=https://backdoorai.app/bengaluru/ node scripts/build-site.mjs` first so the canonical,
OG and share URLs point at the real address.

## Analytics

Every click that matters is tracked. The page sends each event to `window.visitors.track` (visitors.now) and
`window.datafast` directly, the same globals `app/_components/Analytics.tsx` uses, so on backdoorai.app the
events land in the existing dashboards with no wiring. It also calls `window.bdTrack(event, props)` if defined
(bridge: `window.bdTrack = trackEvent`), and falls through to `dataLayer`, `plausible`, `gtag`, `posthog` if present.
Every event carries `surface: "bengaluru_map"`.

Events: `sms_link_opened` {source: compose|plus|bubble|card|fallback, company, role} — same name our
MessageCTA uses, so the Reddit "Lead" mapping applies; `imessage_fallback_shown`; `pin_click` {company};
`card_open` {company, roles, careers_only}; `share_click` {scope: map|company, company}; `role_click`
{company, title}; `careers_click` {company}; `tour_start`; `intro_done` {companies, roles}; `copy` {what}.

## Office locations

Every pin rests on `data/offices.json`, checked by hand against company pages, lease/opening reports or
directories, with the source URL stored per company and shown on the card. Companies whose Bengaluru office
could not be confirmed (Zomato, Blinkit, Coinbase, MongoDB, Elastic), all-remote ones (GitLab) and OpenAI
(New Delhi office, Bengaluru office announced but not confirmed open; its "Bengaluru" roles are remote) are
kept on the map but shown with a dashed pin, a "location approx." label and a note. GitHub was removed: no
current Bengaluru roles or office. When you learn a better address, edit offices.json and rebuild.

## Refreshing the data

```bash
cd scripts/rec && npm i        # once: playwright + timecut
cd ../.. && node scripts/scrape.mjs && node scripts/geocode.mjs && node scripts/logos.mjs && node scripts/logos-brands.mjs && node scripts/build-data.mjs && node scripts/build-site.mjs
```

`scripts/scrape.mjs` probes the public job-board APIs of ~200 companies (Greenhouse, Lever, Ashby, Workable,
SmartRecruiters, Workday, PhonePe's feed, Google's careers HTML) and keeps Bengaluru roles; `BRANDS` lists the
household names whose careers sites have no API (careers-page link only); `FAMOUS` is the allow-list for the map.
Postings older than 120 days are dropped. `scripts/basemap.mjs` re-bakes the map images if the style or area changes.

## Recording the launch clip

`scripts/rec/capture.mjs` renders the page frame by frame with a virtual clock (60 fps, no stutter) and
`scripts/rec/music.mjs` synthesises the soundtrack with pops synced to the chat. See README, "Recording the tour".

## Licences and attribution

Basemap images: OpenFreeMap "liberty" style, OpenMapTiles, data © OpenStreetMap contributors (ODbL). Keep the
attribution line that is on the map. Logos belong to their companies and are used to identify them.
