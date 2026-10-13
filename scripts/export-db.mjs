import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/Users/neelvaanjoshi/Projects/backdoor/package.json");
const { Client } = require("pg");
const out = process.argv[2];
const u = new URL(process.env.READONLY_DATABASE_URL); if (process.env.DB_PORT) u.port = process.env.DB_PORT; console.log("connecting to", u.hostname + ":" + u.port);
const c = new Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
await c.connect();
await c.query("BEGIN READ ONLY");
const tot = (await c.query("select (select count(*) from companies)::int c, (select count(*) from job_postings)::int p, (select count(*) from company_signals)::int s")).rows[0];
const byCountry = (await c.query("select hq_country, count(*)::int n from companies group by 1 order by 2 desc limit 15")).rows;
const companies = (await c.query(`
  select id, canonical_domain, name, website, summary, hq_country, funding_summary, funding_stage, hiring_status, freshness_tier, last_verified_at, metadata
  from companies
  where hq_country = 'IN'
     or id in (select company_id from job_postings where 'IN' = any(countries))
     or summary ilike '%bangalore%' or summary ilike '%bengaluru%' or metadata::text ilike '%bangalore%' or metadata::text ilike '%bengaluru%'
`)).rows;
const ids = companies.map(x => x.id);
const postings = (await c.query(`select id, company_id, source_url, title, employment_type, work_mode, countries, remote_countries, posted_on, last_seen_at from job_postings where company_id = any($1::uuid[])`, [ids])).rows;
const signals = (await c.query(`select id, company_id, kind, title, summary, source_url, source_name, confidence, observed_at from company_signals where company_id = any($1::uuid[])`, [ids])).rows;
await c.query("ROLLBACK");
await c.end();
writeFileSync(out, JSON.stringify({ exported_at: new Date().toISOString(), totals: tot, byCountry, companies, postings, signals }, null, 1));
console.log("DONE totals=", JSON.stringify(tot), "byCountry=", JSON.stringify(byCountry), "IN companies=", companies.length, "postings=", postings.length, "signals=", signals.length, "->", out);
