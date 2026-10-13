// Scrapes public job-board APIs for roles located in Bengaluru, fetches logos,
// and geocodes offices from OpenStreetMap. Output: raw/scrape.json + assets/logos/*.png
// Run: node scripts/scrape.mjs            (takes a few minutes; network needed)
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const here = (p) => new URL(p, import.meta.url);
const OUT = here("../raw/scrape.json").pathname, LOGOS = here("../assets/logos/").pathname;
mkdirSync(LOGOS, { recursive: true });

const BLR = /bengaluru|bangalore|karnataka/i;
const UA = { "user-agent": "Mozilla/5.0 (Macintosh) backdoor-blr-map/1.0 (contact: neel@backdoorai.app)", accept: "application/json,*/*" };
async function get(url, opts = {}, ms = 20000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) }, signal: ac.signal, redirect: "follow" }); }
  catch (e) { return { ok: false, status: 0, error: e.message }; } finally { clearTimeout(t); }
}
const json = async (r) => { try { return await r.json(); } catch { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

// name, domain, tagline, sector, stage, ats slugs to probe, known Bengaluru area (optional)
const C = (name, domain, tagline, sector, stage, slugs, area) => ({ name, domain, tagline, sector, stage, slugs, area });
const CANDIDATES = [
  // global tech + AI labs with Bengaluru offices
  C("OpenAI", "openai.com", "The research lab behind ChatGPT.", "AI", "Late stage", ["openai"]),
  C("Anthropic", "anthropic.com", "AI safety company behind Claude.", "AI", "Late stage", ["anthropic"]),
  C("Stripe", "stripe.com", "Payments infrastructure for the internet.", "Fintech", "Late stage", ["stripe"]),
  C("Cloudflare", "cloudflare.com", "The connectivity cloud securing and speeding up the internet.", "Devtools", "Public", ["cloudflare"]),
  C("Databricks", "databricks.com", "Data and AI platform built on the lakehouse.", "AI", "Late stage", ["databricks"]),
  C("Rippling", "rippling.com", "HR, IT and finance in one platform.", "SaaS", "Late stage", ["rippling"]),
  C("Rubrik", "rubrik.com", "Zero-trust data security.", "SaaS", "Public", ["rubrik"]),
  C("Atlassian", "atlassian.com", "Jira, Confluence and the tools software teams run on.", "SaaS", "Public", ["atlassian"]),
  C("Twilio", "twilio.com", "Communications APIs for messaging, voice and email.", "Devtools", "Public", ["twilio"]),
  C("MongoDB", "mongodb.com", "The developer data platform.", "Devtools", "Public", ["mongodb"]),
  C("Elastic", "elastic.co", "Search, observability and security on one stack.", "Devtools", "Public", ["elastic"]),
  C("Confluent", "confluent.io", "Data streaming platform built on Apache Kafka.", "Devtools", "Public", ["confluent"]),
  C("Okta", "okta.com", "Identity for the internet.", "SaaS", "Public", ["okta"]),
  C("HashiCorp", "hashicorp.com", "Infrastructure automation: Terraform, Vault, Consul.", "Devtools", "Public", ["hashicorp"]),
  C("Harness", "harness.io", "AI-native software delivery platform.", "Devtools", "Late stage", ["harness"]),
  C("ThoughtSpot", "thoughtspot.com", "AI-powered analytics for everyone.", "SaaS", "Late stage", ["thoughtspot"]),
  C("Cohesity", "cohesity.com", "AI-powered data security and management.", "SaaS", "Late stage", ["cohesity"]),
  C("Pure Storage", "purestorage.com", "All-flash data storage.", "Deeptech", "Public", ["purestorage"]),
  C("Glean", "glean.com", "Work AI platform: enterprise search and agents.", "AI", "Late stage", ["glean", "gleanwork"]),
  C("Moveworks", "moveworks.com", "Agentic AI assistant for employees.", "AI", "Late stage", ["moveworks"]),
  C("Notion", "notion.so", "The connected workspace for docs, wikis and projects.", "SaaS", "Late stage", ["notion"]),
  C("Figma", "figma.com", "Collaborative design platform.", "SaaS", "Public", ["figma"]),
  C("Sprinklr", "sprinklr.com", "Unified customer experience management.", "SaaS", "Public", ["sprinklr"]),
  C("Nutanix", "nutanix.com", "Hybrid multicloud infrastructure.", "SaaS", "Public", ["nutanix"]),
  C("Coinbase", "coinbase.com", "Crypto exchange and wallet.", "Fintech", "Public", ["coinbase"]),
  C("Perplexity", "perplexity.ai", "The AI answer engine.", "AI", "Late stage", ["perplexity-ai", "perplexity", "perplexityai"]),
  C("Scale AI", "scale.com", "The data engine for AI.", "AI", "Late stage", ["scaleai"]),
  C("Mercor", "mercor.com", "AI-powered hiring and expert marketplace.", "AI", "Growth", ["mercor"]),
  C("ElevenLabs", "elevenlabs.io", "AI voice and audio research.", "AI", "Growth", ["elevenlabs"]),
  C("Grafana Labs", "grafana.com", "Open-source observability.", "Devtools", "Late stage", ["grafanalabs", "grafana"]),
  C("GitLab", "gitlab.com", "The DevSecOps platform.", "Devtools", "Public", ["gitlab"]),
  C("Netskope", "netskope.com", "Cloud security (SASE).", "SaaS", "Late stage", ["netskope"]),
  C("Zendesk", "zendesk.com", "Customer service platform.", "SaaS", "Late stage", ["zendesk"]),
  C("Snowflake", "snowflake.com", "The AI data cloud.", "Devtools", "Public", ["snowflake", "snowflakecomputing"]),
  C("Chargebee", "chargebee.com", "Subscription billing and revenue growth.", "SaaS", "Late stage", ["chargebee"]),
  C("Freshworks", "freshworks.com", "Customer and employee experience software.", "SaaS", "Public", ["Freshworks", "freshworks"]),
  C("BrowserStack", "browserstack.com", "Cross-browser testing cloud.", "Devtools", "Late stage", ["browserstack"]),
  C("Postman", "postman.com", "The API platform used by 35M+ developers.", "Devtools", "Late stage", ["postman"]),
  C("Hasura", "hasura.io", "Instant GraphQL and data APIs.", "Devtools", "Series C", ["hasura"]),
  C("InMobi", "inmobi.com", "Advertising and consumer tech (Glance).", "Consumer", "Late stage", ["inmobi"], "Kadubeesanahalli"),
  C("Amagi", "amagi.com", "Cloud broadcast and streaming technology.", "SaaS", "Late stage", ["amagi"]),
  C("Whatfix", "whatfix.com", "Digital adoption platform.", "SaaS", "Series E", ["whatfix"]),
  C("Yellow.ai", "yellow.ai", "Conversational AI for enterprises.", "AI", "Series C", ["yellowai", "yellow-ai", "yellowmessenger"]),
  C("Observe.AI", "observe.ai", "AI for contact centres.", "AI", "Series C", ["observeai", "observe-ai"]),
  C("Turing", "turing.com", "AGI infrastructure and AI talent.", "AI", "Late stage", ["turing"]),
  C("Uniphore", "uniphore.com", "Enterprise AI for customer experience.", "AI", "Late stage", ["uniphore"]),
  C("Gupshup", "gupshup.io", "Conversational messaging platform.", "SaaS", "Late stage", ["gupshup"]),
  C("LeadSquared", "leadsquared.com", "Sales execution CRM.", "SaaS", "Series C", ["leadsquared"]),
  C("Capillary", "capillarytech.com", "Loyalty and customer engagement SaaS.", "SaaS", "Late stage", ["capillary", "capillarytech"]),
  C("Sigmoid", "sigmoid.com", "Data engineering and AI services.", "AI", "Growth", ["sigmoid"]),
  C("Tredence", "tredence.com", "AI and analytics consulting.", "AI", "Growth", ["tredence"]),
  C("Hevo Data", "hevodata.com", "No-code data pipelines.", "Devtools", "Series B", ["hevodata", "hevo"]),
  C("SigNoz", "signoz.io", "Open-source observability.", "Devtools", "Seed", ["signoz"]),
  C("Appsmith", "appsmith.com", "Open-source internal tools builder.", "Devtools", "Series B", ["appsmith"]),
  C("ToolJet", "tooljet.com", "Open-source low-code platform.", "Devtools", "Seed", ["tooljet"]),
  C("Dyte", "dyte.io", "Live video and audio SDKs.", "Devtools", "Series A", ["dyte"]),
  C("100ms", "100ms.live", "Live video infrastructure.", "Devtools", "Series A", ["100ms"]),
  C("Last9", "last9.io", "Managed observability.", "Devtools", "Seed", ["last9"]),
  C("Facets.cloud", "facets.cloud", "Self-serve DevOps platform.", "Devtools", "Seed", ["facets", "facetscloud"]),
  C("Zenduty", "zenduty.com", "Incident management.", "Devtools", "Seed", ["zenduty"]),
  C("TrueFoundry", "truefoundry.com", "AI/ML deployment platform.", "AI", "Series A", ["truefoundry"]),
  C("Kombai", "kombai.com", "AI that turns designs into code.", "AI", "Seed", ["kombai"]),
  C("Nurix AI", "nurix.ai", "Custom AI agents for enterprises.", "AI", "Series A", ["nurix", "nurixai"]),
  C("SpotDraft", "spotdraft.com", "Contract lifecycle management.", "SaaS", "Series B", ["spotdraft"]),
  C("HyperVerge", "hyperverge.co", "AI identity verification.", "AI", "Growth", ["hyperverge"]),
  C("CommerceIQ", "commerceiq.ai", "Retail ecommerce management.", "AI", "Series D", ["commerceiq"]),
  C("Locus", "locus.sh", "Last-mile logistics software.", "Logistics", "Series C", ["locus"]),
  C("Entropik", "entropik.io", "AI consumer research.", "AI", "Series B", ["entropik"]),
  C("Ushur", "ushur.com", "Customer experience automation.", "AI", "Series C", ["ushur"]),
  C("Atlan", "atlan.com", "Active metadata platform.", "Devtools", "Series C", ["atlan"]),
  C("Sprinto", "sprinto.com", "Compliance automation.", "SaaS", "Series B", ["sprinto"]),
  C("DevRev", "devrev.ai", "AgentOS for support and product.", "AI", "Series A", ["devrev"]),
  C("Zluri", "zluri.com", "SaaS management platform.", "SaaS", "Series B", ["zluri"]),
  C("Skyflow", "skyflow.com", "Data privacy vault.", "Devtools", "Series B", ["skyflow"]),
  C("Composio", "composio.dev", "Integration platform for AI agents.", "AI", "Series A", ["composio"]),
  C("Ema", "ema.co", "Universal AI employee.", "AI", "Series A", ["ema", "emaunlimited"]),
  C("Exotel", "exotel.com", "Customer engagement cloud.", "SaaS", "Series D", ["exotel"]),
  C("Plivo", "plivo.com", "Cloud communications APIs.", "Devtools", "Growth", ["plivo"]),
  C("Netradyne", "netradyne.com", "AI fleet safety.", "AI", "Series D", ["netradyne"]),
  C("Tracxn", "tracxn.com", "Private market intelligence.", "SaaS", "Public", ["tracxn"]),
  // Indian consumer, fintech and more
  C("Razorpay", "razorpay.com", "Payments and banking for Indian businesses.", "Fintech", "Series F", ["razorpaysoftwareprivatelimited", "razorpay"], "Koramangala"),
  C("Paytm", "paytm.com", "Payments, UPI and financial services.", "Fintech", "Public", ["paytm"]),
  C("Airbnb", "airbnb.com", "Travel marketplace.", "Consumer", "Public", ["airbnb"]),
  C("CRED", "cred.club", "Rewards for credit card bills, now a fintech super app.", "Fintech", "Series G", ["cred"], "Koramangala"),
  C("Swiggy", "swiggy.com", "Food delivery, Instamart and more.", "Consumer", "Public", ["swiggy"], "Bellandur"),
  C("Zepto", "zeptonow.com", "10-minute grocery delivery.", "Consumer", "Series G", ["zepto", "zeptonow"]),
  C("PhonePe", "phonepe.com", "India's largest UPI app.", "Fintech", "Late stage", ["phonepe"], "Bellandur"),
  C("Groww", "groww.in", "Investing app for 10M+ Indians.", "Fintech", "Public", ["groww"], "Bellandur"),
  C("Meesho", "meesho.com", "Social commerce for Bharat.", "Consumer", "Public", ["meesho"], "Domlur"),
  C("Flipkart", "flipkart.com", "India's homegrown e-commerce giant.", "Consumer", "Late stage", ["flipkart"], "Bellandur"),
  C("Juspay", "juspay.in", "Payments infrastructure powering 50M+ transactions a day.", "Fintech", "Series D", ["juspay"], "Koramangala"),
  C("Slice", "sliceit.com", "Credit and banking for young India.", "Fintech", "Late stage", ["slice", "sliceit"]),
  C("Jar", "myjar.app", "Daily savings in digital gold.", "Fintech", "Series B", ["jar", "myjar", "changejar"]),
  C("Khatabook", "khatabook.com", "Business ledger app for MSMEs.", "Fintech", "Series C", ["khatabook"]),
  C("Sarvam AI", "sarvam.ai", "Building India's sovereign LLMs.", "AI", "Series A", ["sarvam", "sarvamai", "sarvam-ai"]),
  C("Krutrim", "olakrutrim.com", "Ola's AI lab building Indian LLMs and silicon.", "AI", "Series A", ["krutrim", "olakrutrim"]),
  C("cult.fit", "cult.fit", "Fitness and wellness.", "Consumer", "Late stage", ["curefit", "cultfit"]),
  C("Unacademy", "unacademy.com", "Online learning platform.", "Edtech", "Late stage", ["unacademy"]),
  C("Practo", "practo.com", "Doctors, labs and medicines in one app.", "Healthtech", "Late stage", ["practo"]),
  C("Ola", "olacabs.com", "Mobility, Ola Electric and more.", "Consumer", "Public", ["ola", "olacabs", "olaelectric"], "Koramangala"),
  C("Ather Energy", "atherenergy.com", "Electric scooters designed and made in India.", "Deeptech", "Public", ["atherenergy", "ather"], "Bannerghatta Road"),
  C("Udaan", "udaan.com", "B2B commerce for kiranas.", "Consumer", "Late stage", ["udaan"]),
  C("Setu", "setu.co", "Fintech APIs, part of Pine Labs.", "Fintech", "Growth", ["setu"]),
  C("smallcase", "smallcase.com", "Thematic investing.", "Fintech", "Series D", ["smallcase"]),
  C("Fi", "fi.money", "Neobank for salaried millennials.", "Fintech", "Series C", ["epifi", "fi", "fimoney"]),
  C("Jupiter", "jupiter.money", "Digital bank account.", "Fintech", "Series C", ["jupiter", "jupitermoney"]),
  C("Navi", "navi.com", "Loans, insurance and UPI.", "Fintech", "Late stage", ["navi", "navitechnologies"]),
  C("Pixxel", "pixxel.space", "Hyperspectral earth-imaging satellites.", "Deeptech", "Series B", ["pixxel"]),
  C("Ultrahuman", "ultrahuman.com", "Smart ring and metabolic health.", "Consumer", "Series B", ["ultrahuman"]),
  C("Niyo", "goniyo.com", "Travel-first neobank.", "Fintech", "Series C", ["niyo", "goniyo"]),
  C("Zeta", "zeta.tech", "Banking technology for issuers.", "Fintech", "Late stage", ["zeta", "zetatech"]),
  C("Plum", "plumhq.com", "Employee health insurance.", "Fintech", "Series B", ["plumhq", "plum"]),
  C("Scapia", "scapia.cards", "Travel credit card.", "Fintech", "Series B", ["scapia"]),
  C("Rapido", "rapido.bike", "Bike taxis and autos.", "Consumer", "Late stage", ["rapido"]),
  C("Porter", "porter.in", "Intra-city logistics.", "Logistics", "Late stage", ["porter", "theporter"]),
  C("MPL", "mpl.live", "Mobile gaming platform.", "Consumer", "Late stage", ["mpl", "mobilepremierleague"]),
  C("Pocket FM", "pocketfm.com", "Audio series platform.", "Consumer", "Series D", ["pocketfm"]),
  C("CoinSwitch", "coinswitch.co", "Crypto and stocks investing.", "Fintech", "Series C", ["coinswitch"]),
  C("CoinDCX", "coindcx.com", "Crypto exchange.", "Fintech", "Series D", ["coindcx"]),
  C("Dailyhunt", "dailyhunt.in", "News and short video (Josh).", "Consumer", "Late stage", ["dailyhunt", "versesinnovation", "verse"]),
  C("NoBroker", "nobroker.in", "Brokerage-free real estate.", "Consumer", "Late stage", ["nobroker"]),
  C("HealthifyMe", "healthifyme.com", "AI nutrition and fitness coach.", "Healthtech", "Series C", ["healthifyme"]),
  C("Eka Care", "eka.care", "Health records and clinic software.", "Healthtech", "Series A", ["ekacare", "eka"]),
  C("Even", "even.in", "Healthcare membership.", "Healthtech", "Series A", ["even", "evenhealthcare"]),
  C("Pratilipi", "pratilipi.com", "Storytelling in Indian languages.", "Consumer", "Series D", ["pratilipi"]),
  C("Toddle", "toddleapp.com", "Teaching and learning platform for schools.", "Edtech", "Series A", ["toddle", "toddleapp"]),
  C("Quizizz", "quizizz.com", "Gamified learning used in most US schools.", "Edtech", "Series B", ["quizizz", "wayground"]),
  C("Leap", "leapscholar.com", "Study-abroad platform.", "Edtech", "Series E", ["leap", "leapscholar", "leapfinance"]),
  C("Scaler", "scaler.com", "Tech upskilling (Scaler, InterviewBit).", "Edtech", "Series B", ["scaler", "interviewbit"]),
  C("Newton School", "newtonschool.co", "Outcome-based tech education.", "Edtech", "Series B", ["newtonschool"]),
  C("Licious", "licious.in", "Fresh meat and seafood, delivered.", "Consumer", "Series F", ["licious"]),
  C("Wakefit", "wakefit.co", "Mattresses and furniture D2C.", "Consumer", "Series D", ["wakefit"]),
  C("Third Wave Coffee", "thirdwavecoffee.in", "Specialty coffee chain.", "Consumer", "Series C", ["thirdwavecoffee"]),
  C("KreditBee", "kreditbee.in", "Personal loans app.", "Fintech", "Series D", ["kreditbee"]),
  C("Zoomcar", "zoomcar.com", "Car sharing marketplace.", "Consumer", "Public", ["zoomcar"]),
  C("Exponent Energy", "exponentenergy.com", "15-minute rapid charging for EVs.", "Deeptech", "Series B", ["exponentenergy", "exponent"]),
  C("Digantara", "digantara.co.in", "Space situational awareness.", "Deeptech", "Series A", ["digantara"]),
  C("GalaxEye", "galaxeye.space", "Multi-sensor earth observation satellites.", "Deeptech", "Series A", ["galaxeye"]),
  C("Signzy", "signzy.com", "Digital onboarding and KYC.", "Fintech", "Series B", ["signzy"]),
  C("Bureau", "bureau.id", "Identity and fraud decisioning.", "Fintech", "Series B", ["bureau", "bureauid"]),
  C("Perfios", "perfios.com", "Financial data analytics.", "Fintech", "Late stage", ["perfios"]),
  C("Open", "open.money", "Business banking platform.", "Fintech", "Series D", ["open", "openfinancial", "bankopen"]),
  C("Stable Money", "stablemoney.in", "Fixed-income investing.", "Fintech", "Series B", ["stablemoney"]),
  C("Vance", "vance.tech", "Cross-border money for NRIs.", "Fintech", "Series B", ["vance"]),
  C("Simpl", "getsimpl.com", "Pay-later checkout.", "Fintech", "Series B", ["simpl", "getsimpl"]),
  C("Clear", "cleartax.in", "Tax and finance SaaS.", "Fintech", "Series C", ["cleartax", "clear"]),
  C("ShareChat", "sharechat.com", "Indian-language social media (Moj).", "Consumer", "Late stage", ["sharechat"]),
  C("Spinny", "spinny.com", "Used cars, done right.", "Consumer", "Late stage", ["spinny"]),
  C("Vedantu", "vedantu.com", "Live online tutoring.", "Edtech", "Late stage", ["vedantu"]),
  C("Yulu", "yulu.bike", "Shared electric mobility.", "Consumer", "Series B", ["yulu"]),
  C("Ninjacart", "ninjacart.in", "Agri supply chain.", "Logistics", "Series D", ["ninjacart"]),
  C("Zetwerk", "zetwerk.com", "Contract manufacturing platform.", "Logistics", "Late stage", ["zetwerk"]),
  C("BlackBuck", "blackbuck.com", "Trucking platform.", "Logistics", "Public", ["blackbuck", "zinka"]),
  C("Shadowfax", "shadowfax.in", "Last-mile logistics.", "Logistics", "Public", ["shadowfax"]),
  C("bigbasket", "bigbasket.com", "Online grocery, part of Tata.", "Consumer", "Late stage", ["bigbasket"]),
  C("Headout", "headout.com", "Experiences marketplace.", "Consumer", "Series C", ["headout"]),
  C("River", "rivermobility.com", "Electric scooters with utility.", "Deeptech", "Series B", ["river", "rivermobility"]),
  C("Teachmint", "teachmint.com", "School operating system.", "Edtech", "Series B", ["teachmint"]),
  C("Cuemath", "cuemath.com", "Math learning.", "Edtech", "Series C", ["cuemath"]),
  C("Simplilearn", "simplilearn.com", "Online certifications.", "Edtech", "Late stage", ["simplilearn"]),
  C("Dukaan", "mydukaan.io", "Online store builder.", "SaaS", "Series A", ["dukaan"]),
  C("FamPay", "fampay.in", "Payments for teens.", "Fintech", "Series A", ["fampay"]),
  C("Bounce", "bounce.bike", "Electric scooters and swapping.", "Consumer", "Series D", ["bounce"]),
];

// Recognisable names: these get priority in cluster stacks and define the video frame.
const FAMOUS = new Set(["samsung.com", "cisco.com", "oracle.com", "sap.com", "ibm.com", "dell.com", "amd.com", "qualcomm.com", "walmart.com", "goldmansachs.com", "jpmorgan.com", "morganstanley.com", "visa.com", "atlassian.com", "linkedin.com", "intuit.com", "cloudflare.com", "rippling.com", "postman.com", "bigbasket.com", "licious.in", "porter.in", "mpl.live", "sharechat.com", "dailyhunt.in", "navi.com", "sliceit.com", "jupiter.money", "healthifyme.com", "vedantu.com", "scaler.com", "olakrutrim.com", "twilio.com", "zscaler.com", "udaan.com", "yulu.bike", "ultrahuman.com", "zerodha.com", "nvidia.com", "github.com",
  "openai.com", "anthropic.com", "stripe.com", "google.com", "microsoft.com", "apple.com", "amazon.com", "nvidia.com", "adobe.com", "uber.com", "airbnb.com", "figma.com", "coinbase.com", "databricks.com", "snowflake.com", "gitlab.com", "mongodb.com", "elastic.co", "okta.com", "intel.com", "salesforce.com", "paypal.com", "target.com", "swiggy.com", "zomato.com", "blinkit.com", "zeptonow.com", "flipkart.com", "myntra.com", "phonepe.com", "paytm.com", "razorpay.com", "cred.club", "groww.in", "meesho.com", "olacabs.com", "rapido.bike", "cult.fit", "practo.com", "unacademy.com", "sarvam.ai", "juspay.in", "zeta.tech", "inmobi.com", "udaan.com", "nobroker.in", "bigbasket.com", "pocketfm.com", "atherenergy.com", "freshworks.com", "rubrik.com", "purestorage.com", "netskope.com"]);

// Brands whose careers sites have no public API (JS apps, bot walls, Darwinbox). They go on the map
// with a careers link and no role list, clearly marked as unverified in the data.
const BRANDS = [
  ["Flipkart", "flipkart.com", "India's homegrown e-commerce giant.", "Consumer", "Late stage", "https://www.flipkartcareers.com/#!/joblist", "Bellandur"],
  ["Myntra", "myntra.com", "Fashion e-commerce, part of Flipkart.", "Consumer", "Late stage", "https://jobs.myntra.com/home", "Kudlu Gate"],
  ["Zomato", "zomato.com", "Food delivery, now part of Eternal.", "Consumer", "Public", "https://www.eternal.com/careers/", null],
  ["Blinkit", "blinkit.com", "10-minute delivery, part of Eternal.", "Consumer", "Public", "https://www.eternal.com/careers/", null],
  ["Zepto", "zeptonow.com", "10-minute grocery delivery.", "Consumer", "Series G", "https://zepto.darwinbox.in/ms/candidatev2/main/careers/home", null],
  ["Google", "google.com", "Search, Android, Cloud, DeepMind.", "AI", "Public", "https://www.google.com/about/careers/applications/jobs/results?location=Bengaluru%2C%20India", "Mahadevapura"],
  ["Microsoft", "microsoft.com", "Azure, Copilot, GitHub and Windows.", "SaaS", "Public", "https://jobs.careers.microsoft.com/global/en/search?lc=Bengaluru%2C%20Karnataka%2C%20India", "Bellandur"],
  ["Apple", "apple.com", "iPhone, Mac and the services around them.", "Consumer", "Public", "https://jobs.apple.com/en-in/search?location=bengaluru-BLR", "MG Road"],
  ["Uber", "uber.com", "Mobility and delivery platform.", "Consumer", "Public", "https://www.uber.com/us/en/careers/list/?location=IND-Karnataka-Bangalore", null],
  ["Ola", "olacabs.com", "Mobility, Ola Electric and Krutrim.", "Consumer", "Public", "https://www.olacabs.com/careers", "Koramangala"],
  ["Rapido", "rapido.bike", "Bike taxis and autos.", "Consumer", "Late stage", "https://www.rapido.bike/careers", null],
  ["cult.fit", "cult.fit", "Fitness and wellness.", "Consumer", "Late stage", "https://careers.cult.fit/cult/", null],
  ["Practo", "practo.com", "Doctors, labs and medicines in one app.", "Healthtech", "Late stage", "https://www.practo.com/company/careers", null],
  ["Juspay", "juspay.in", "Payments infrastructure behind Namma Yatri and 50M+ transactions a day.", "Fintech", "Series D", "https://juspay.io/careers", "Koramangala"],
  ["Samsung R&D", "samsung.com", "Samsung's largest R&D centre outside Korea.", "Deeptech", "Public", "https://www.samsung.com/in/about-us/careers/", "Bagmane Tech Park"],
  ["Cisco", "cisco.com", "Networking, security and collaboration.", "Devtools", "Public", "https://jobs.cisco.com/jobs/SearchJobs/Bangalore", "Kadubeesanahalli"],
  ["Oracle", "oracle.com", "Cloud and database software.", "SaaS", "Public", "https://careers.oracle.com/jobs/#en/sites/jobsearch/jobs?location=Bengaluru", null],
  ["SAP Labs", "sap.com", "Enterprise software; SAP's second-largest lab.", "SaaS", "Public", "https://jobs.sap.com/search/?q=&locationsearch=Bangalore", "Whitefield"],
  ["IBM", "ibm.com", "Hybrid cloud, AI and consulting.", "SaaS", "Public", "https://www.ibm.com/careers/search?field_keyword_18[0]=Bangalore", "Manyata Tech Park"],
  ["Dell", "dell.com", "Infrastructure and PCs.", "Deeptech", "Public", "https://jobs.dell.com/en/search-jobs/Bangalore", null],
  ["AMD", "amd.com", "CPUs, GPUs and the people who design them.", "Deeptech", "Public", "https://careers.amd.com/careers-home/jobs?location=Bengaluru", null],
  ["Qualcomm", "qualcomm.com", "Wireless and compute silicon.", "Deeptech", "Public", "https://careers.qualcomm.com/careers?location=Bangalore", null],
  ["Walmart Global Tech", "walmart.com", "The tech behind the world's largest retailer.", "Consumer", "Public", "https://careers.walmart.com/results?q=&l=Bengaluru", null],
  ["Goldman Sachs", "goldmansachs.com", "Investment banking; Bengaluru is its biggest office outside New York.", "Fintech", "Public", "https://higher.gs.com/roles?location=Bengaluru", "Old Airport Road"],
  ["JPMorgan Chase", "jpmorgan.com", "Banking and technology.", "Fintech", "Public", "https://careers.jpmorgan.com/us/en/search-results?location=Bengaluru", null],
  ["Morgan Stanley", "morganstanley.com", "Investment banking and technology.", "Fintech", "Public", "https://morganstanley.eightfold.ai/careers?location=Bengaluru", null],
  ["Visa", "visa.com", "Global payments network.", "Fintech", "Public", "https://corporate.visa.com/en/jobs/?location=Bangalore", null],
  ["Atlassian", "atlassian.com", "Jira, Confluence and the tools software teams run on.", "SaaS", "Public", "https://www.atlassian.com/company/careers/all-jobs?location=Bengaluru", null],
  ["LinkedIn", "linkedin.com", "The professional network.", "Consumer", "Public", "https://careers.linkedin.com/jobs?location=Bengaluru", null],
  ["Intuit", "intuit.com", "TurboTax, QuickBooks, Mailchimp.", "Fintech", "Public", "https://jobs.intuit.com/search-jobs/Bengaluru", null],
  ["Cloudflare", "cloudflare.com", "The connectivity cloud.", "Devtools", "Public", "https://www.cloudflare.com/careers/jobs/?location=Bengaluru", null],
  ["Rippling", "rippling.com", "HR, IT and finance in one platform.", "SaaS", "Late stage", "https://www.rippling.com/careers/open-roles?location=Bangalore", null],
  ["Postman", "postman.com", "The API platform, born in Bengaluru.", "Devtools", "Late stage", "https://www.postman.com/company/careers/open-positions/", null],
  ["bigbasket", "bigbasket.com", "Online grocery, part of Tata.", "Consumer", "Late stage", "https://www.bigbasket.com/careers/", null],
  ["Licious", "licious.in", "Fresh meat and seafood, delivered.", "Consumer", "Series F", "https://www.licious.in/careers", null],
  ["Porter", "porter.in", "Intra-city logistics.", "Logistics", "Late stage", "https://porter.in/careers", null],
  ["MPL", "mpl.live", "Mobile gaming platform.", "Consumer", "Late stage", "https://www.mpl.live/careers", null],
  ["ShareChat", "sharechat.com", "Indian-language social media (Moj).", "Consumer", "Late stage", "https://sharechat.com/careers", null],
  ["Dailyhunt", "dailyhunt.in", "News and short video (Josh).", "Consumer", "Late stage", "https://www.dailyhunt.in/careers", null],
  ["Navi", "navi.com", "Loans, insurance and UPI.", "Fintech", "Late stage", "https://navi.com/careers", null],
  ["slice", "sliceit.com", "Credit and banking for young India.", "Fintech", "Late stage", "https://www.sliceit.com/careers", null],
  ["Jupiter", "jupiter.money", "Digital bank account.", "Fintech", "Series C", "https://jupiter.money/careers/", null],
  ["HealthifyMe", "healthifyme.com", "AI nutrition and fitness coach.", "Healthtech", "Series C", "https://www.healthifyme.com/careers/", null],
  ["Vedantu", "vedantu.com", "Live online tutoring.", "Edtech", "Late stage", "https://www.vedantu.com/careers", null],
  ["Scaler", "scaler.com", "Tech upskilling (Scaler, InterviewBit).", "Edtech", "Series B", "https://www.scaler.com/careers/", null],
  ["Krutrim", "olakrutrim.com", "Ola's AI lab building Indian LLMs and silicon.", "AI", "Series A", "https://www.olakrutrim.com/careers", "Koramangala"],
  ["Twilio", "twilio.com", "Communications APIs.", "Devtools", "Public", "https://www.twilio.com/en-us/company/jobs?location=Bengaluru", null],
  ["Zscaler", "zscaler.com", "Zero trust security cloud.", "SaaS", "Public", "https://www.zscaler.com/careers/search?location=Bengaluru", null],
  ["Udaan", "udaan.com", "B2B commerce for kiranas.", "Consumer", "Late stage", "https://udaan.com/careers", null],
  ["Yulu", "yulu.bike", "Shared electric mobility.", "Consumer", "Series B", "https://www.yulu.bike/careers", null],
  ["Ultrahuman", "ultrahuman.com", "Smart ring and metabolic health.", "Consumer", "Series B", "https://www.ultrahuman.com/careers/", null],
  ["Ather Energy", "atherenergy.com", "Electric scooters designed and made in India.", "Deeptech", "Public", "https://www.atherenergy.com/careers", "Bannerghatta Road"],
  ["GitHub", "github.com", "Where the world builds software; now part of Microsoft.", "Devtools", "Public", "https://www.github.careers/careers-home/jobs?location=Bengaluru", null],
];

// Workday tenants (community-known public CXS endpoints) and careers APIs for the biggest names.
const WORKDAY = [
  ["NVIDIA", "nvidia.com", "Accelerated computing and AI.", "Deeptech", "Public", "nvidia", "wd5", "NVIDIAExternalCareerSite"],
  ["Salesforce", "salesforce.com", "The customer company.", "SaaS", "Public", "salesforce", "wd12", "External_Career_Site"],
  ["Adobe", "adobe.com", "Creative, document and marketing clouds.", "SaaS", "Public", "adobe", "wd5", "external_experienced"],
  ["Intuit", "intuit.com", "TurboTax, QuickBooks, Mailchimp.", "Fintech", "Public", "intuit", "wd1", "Intuit"],
  ["Walmart Global Tech", "walmart.com", "Tech behind the world's largest retailer.", "Consumer", "Public", "walmart", "wd5", "WalmartExternal"],
  ["Target", "target.com", "Target in India: tech and data.", "Consumer", "Public", "target", "wd5", "targetcareers"],
  ["PayPal", "paypal.com", "Digital payments.", "Fintech", "Public", "paypal", "wd1", "jobs"],
  ["Autodesk", "autodesk.com", "Design and make software.", "SaaS", "Public", "autodesk", "wd1", "Ext"],
  ["Qualcomm", "qualcomm.com", "Wireless and compute silicon.", "Deeptech", "Public", "qualcomm", "wd5", "External"],
  ["Workday", "workday.com", "Finance and HR cloud.", "SaaS", "Public", "workday", "wd5", "Workday"],
  ["Uber", "uber.com", "Mobility and delivery platform.", "Consumer", "Public", "uber", "wd1", "Uber"],
  ["Visa", "visa.com", "Global payments network.", "Fintech", "Public", "visa", "wd1", "Visa_Careers"],
  ["Dell Technologies", "dell.com", "Infrastructure and PCs.", "Deeptech", "Public", "dell", "wd1", "External"],
  ["Palo Alto Networks", "paloaltonetworks.com", "Cybersecurity leader.", "SaaS", "Public", "paloaltonetworks", "wd1", "External"],
  ["Zscaler", "zscaler.com", "Zero trust security cloud.", "SaaS", "Public", "zscaler", "wd5", "zscaler"],
  ["ServiceNow", "servicenow.com", "Enterprise workflow platform.", "SaaS", "Public", "servicenow", "wd1", "ServiceNow"],
  ["Intel", "intel.com", "Chips and the engineering behind them.", "Deeptech", "Public", "intel", "wd1", "External"],
];

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const job = (title, url, location, dept, type, posted, extra = {}) => ({ title: norm(title), url, location: norm(location), dept: norm(dept) || null, type: type || null, posted: posted ? new Date(posted).toISOString().slice(0, 10) : null, ...extra });

async function greenhouse(slug) {
  const r = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`); if (!r.ok) return null;
  const d = await json(r); if (!d?.jobs) return null;
  const jobs = d.jobs.filter((j) => BLR.test(j.location?.name || "") || (j.offices || []).some((o) => BLR.test(o.name || "")))
    .map((j) => job(j.title, j.absolute_url, j.location?.name, j.departments?.[0]?.name, null, j.updated_at));
  return { ats: "greenhouse", board: `https://boards.greenhouse.io/${slug}`, total: d.jobs.length, jobs };
}
async function lever(slug) {
  const r = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`); if (!r.ok) return null;
  const d = await json(r); if (!Array.isArray(d)) return null;
  const jobs = d.filter((j) => BLR.test(j.categories?.location || "") || (j.categories?.allLocations || []).some((l) => BLR.test(l)))
    .map((j) => job(j.text, j.hostedUrl, j.categories?.location, j.categories?.team, j.categories?.commitment, j.createdAt));
  return { ats: "lever", board: `https://jobs.lever.co/${slug}`, total: d.length, jobs };
}
async function ashby(slug) {
  const r = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`); if (!r.ok) return null;
  const d = await json(r); if (!d?.jobs) return null;
  const jobs = d.jobs.filter((j) => BLR.test(j.location || "") || (j.secondaryLocations || []).some((l) => BLR.test(l.location || "")))
    .map((j) => job(j.title, j.jobUrl, j.location, j.department, j.employmentType, j.publishedAt));
  return { ats: "ashby", board: `https://jobs.ashbyhq.com/${slug}`, total: d.jobs.length, jobs };
}
async function workable(slug) {
  const r = await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}`); if (!r.ok) return null;
  const d = await json(r); if (!d?.jobs) return null;
  const jobs = d.jobs.filter((j) => BLR.test([j.city, j.state, j.country].join(" ")))
    .map((j) => job(j.title, j.url, [j.city, j.country].filter(Boolean).join(", "), j.department, j.employment_type, j.published_on));
  return { ats: "workable", board: `https://apply.workable.com/${slug}`, total: d.jobs.length, jobs };
}
async function smartrecruiters(slug) {
  const r = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`); if (!r.ok) return null;
  const d = await json(r); if (!d?.content) return null;
  const jobs = d.content.filter((j) => BLR.test([j.location?.city, j.location?.region].join(" ")))
    .map((j) => job(j.name, `https://jobs.smartrecruiters.com/${slug}/${j.id}`, j.location?.city, j.department?.label, j.typeOfEmployment?.label, j.releasedDate));
  return { ats: "smartrecruiters", board: `https://careers.smartrecruiters.com/${slug}`, total: d.totalFound, jobs };
}
async function workday(tenant, wd, site) {
  const url = `https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  let d = null;
  for (const searchText of ["Bangalore", "Bengaluru"]) {
    for (let attempt = 0; attempt < 2 && !d; attempt++) {
      const r = await get(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText }) }, 40000);
      if (r.ok) { const j = await json(r); if (j?.jobPostings) d = j; } else await sleep(4000);
    }
    if (d?.jobPostings?.some((j) => BLR.test(j.locationsText || ""))) break;
  }
  if (!d?.jobPostings) return null;
  const jobs = d.jobPostings.filter((j) => BLR.test(j.locationsText || ""))
    .map((j) => job(j.title, `https://${tenant}.${wd}.myworkdayjobs.com/en-US/${site}${j.externalPath}`, j.locationsText, null, null, null, { postedText: j.postedOn }));
  return { ats: "workday", board: `https://${tenant}.${wd}.myworkdayjobs.com/${site}`, total: d.total, jobs };
}
async function google() {
  const r = await get("https://careers.google.com/api/v3/search/?location=Bengaluru%2C%20Karnataka%2C%20India&page=1&page_size=20"); if (!r.ok) return null;
  const d = await json(r); if (!d?.jobs) return null;
  const jobs = d.jobs.filter((j) => (j.locations || []).some((l) => BLR.test(l.display || "")))
    .map((j) => job(j.title, j.apply_url || `https://www.google.com/about/careers/applications/jobs/results/${j.id?.split("/").pop()}`, j.locations?.find((l) => BLR.test(l.display))?.display, j.categories?.[0], null, j.publish_date));
  return { ats: "google", board: "https://www.google.com/about/careers/applications/jobs/results/?location=Bengaluru", total: d.count, jobs };
}
async function phonepe() {
  const r = await get("https://www.phonepe.com/apollo/job-postings/latest.json"); if (!r.ok) return null;
  const d = await json(r); if (!d?.results) return null;
  const pub = d.results.filter((j) => j.status === "PUBLIC" && j.applyUrl);
  const jobs = pub.filter((j) => BLR.test(j.location || "")).map((j) => job(j.title, j.applyUrl, j.location, j.department, j.type, j.updatedAt?.match(/\d{10,}/)?.[0] ? +j.updatedAt.match(/\d{10,}/)[0] : null));
  return { ats: "phonepe", board: "https://www.phonepe.com/careers/job-openings/", total: pub.length, jobs };
}
async function googleHtml() {
  const jobs = [];
  for (const page of [1, 2, 3]) {
    const r = await get(`https://www.google.com/about/careers/applications/jobs/results?location=Bengaluru%2C%20India&page=${page}`, { headers: { accept: "text/html" } }); if (!r.ok) break;
    const html = await r.text();
    for (const tag of html.match(/<a [^>]*jobs\/results\/[^>]*>/g) || []) {
      const href = tag.match(/href="(jobs\/results\/[^"]+)"/)?.[1], title = tag.match(/aria-label="Learn more about ([^"]+)"/)?.[1];
      if (href && title) jobs.push(job(title.replace(/&amp;/g, "&").replace(/&#39;/g, "'"), "https://www.google.com/about/careers/applications/" + href.replace(/&amp;/g, "&"), "Bengaluru, Karnataka, India", null, null, null));
    }
    if (!/page=\d+/.test(html) && page > 1) break;
  }
  const seen = new Set(); const uniq = jobs.filter((j) => !seen.has(j.url) && seen.add(j.url));
  return uniq.length ? { ats: "google", board: "https://www.google.com/about/careers/applications/jobs/results?location=Bengaluru%2C%20India", total: null, jobs: uniq } : null;
}
async function microsoft() {
  const r = await get("https://gcsservices.careers.microsoft.com/search/api/v1/search?lc=Bengaluru%2C%20Karnataka%2C%20India&l=en_us&pg=1&pgSz=20&o=Recent&flt=true"); if (!r.ok) return null;
  const d = await json(r); const list = d?.operationResult?.result?.jobs; if (!list) return null;
  const jobs = list.map((j) => job(j.title, `https://jobs.careers.microsoft.com/global/en/job/${j.jobId}`, (j.properties?.locations || []).find((l) => BLR.test(l)) || "Bengaluru, India", j.properties?.profession, j.properties?.employmentType, j.postingDate));
  return { ats: "microsoft", board: "https://jobs.careers.microsoft.com/global/en/search?lc=Bengaluru%2C%20Karnataka%2C%20India", total: d.operationResult.result.totalJobs, jobs };
}
async function amazon() {
  const r = await get("https://www.amazon.jobs/en/search.json?loc_query=Bengaluru%2C%20India&result_limit=20&sort=recent&latitude=&longitude=&country=IND"); if (!r.ok) return null;
  const d = await json(r); if (!d?.jobs) return null;
  const jobs = d.jobs.filter((j) => BLR.test(j.location || j.normalized_location || "")).map((j) => job(j.title, `https://www.amazon.jobs${j.job_path}`, j.normalized_location || j.location, j.job_category, j.job_schedule_type, j.posted_date));
  return { ats: "amazon", board: "https://www.amazon.jobs/en/search?loc_query=Bengaluru", total: d.hits, jobs };
}

// ---------- stage A: boards ----------
console.log(`probing ${CANDIDATES.length} ATS candidates + ${WORKDAY.length} Workday tenants + 3 careers APIs`);
const found = [];
await pool(CANDIDATES, 8, async (c) => {
  for (const slug of c.slugs) {
    for (const fn of [greenhouse, lever, ashby, workable, smartrecruiters]) {
      const res = await fn(slug);
      if (res && res.total === 0 && !res.jobs.length) continue;
      if (res) { found.push({ ...c, ...res, slug }); console.log(`  ✓ ${c.name.padEnd(18)} ${res.ats.padEnd(14)} ${String(res.jobs.length).padStart(3)} BLR / ${res.total}`); return; }
    }
  }
  console.log(`  · ${c.name.padEnd(18)} no public board found`);
});
for (const [name, domain, tagline, sector, stage, tenant, wd, site] of WORKDAY) {
  const res = await workday(tenant, wd, site); await sleep(1500);
  if (res) { found.push({ name, domain, tagline, sector, stage, slugs: [], ...res }); console.log(`  ✓ ${name.padEnd(18)} workday        ${String(res.jobs.length).padStart(3)} BLR / ${res.total}`); }
  else console.log(`  · ${name.padEnd(18)} workday endpoint not reachable`);
}
for (const [name, domain, tagline, sector, fn] of [
  ["Google", "google.com", "Search, Android, Cloud, DeepMind.", "AI", googleHtml],
  ["PhonePe", "phonepe.com", "India's largest UPI app.", "Fintech", phonepe],
  ["Amazon", "amazon.com", "AWS and the everything store.", "Consumer", amazon],
]) { const res = await fn(); if (res) { found.push({ name, domain, tagline, sector, stage: "Public", slugs: [], ...res }); console.log(`  ✓ ${name.padEnd(18)} ${res.ats.padEnd(14)} ${String(res.jobs.length).padStart(3)} BLR / ${res.total}`); } else console.log(`  · ${name.padEnd(18)} careers API not reachable`); }

for (const [name, domain, tagline, sector, stage, careers, area] of BRANDS) {
  const got = found.find((c) => c.domain === domain && c.jobs.length);
  if (got) continue;
  found.push({ name, domain, tagline, sector, stage, slugs: [], area, ats: "careers", board: careers, total: null, jobs: [], unverified: true });
  console.log(`  ~ ${name.padEnd(18)} careers page only (no public API)`);
}
const hiring = found.filter((c) => c.jobs.length > 0 || c.unverified);
for (const c of hiring) c.famous = FAMOUS.has(c.domain);
console.log(`\n${found.length} boards reachable, ${hiring.filter((c) => !c.unverified).length} with Bengaluru roles (${hiring.reduce((n, c) => n + c.jobs.length, 0)} roles), ${hiring.filter((c) => c.unverified).length} careers-page brands`);

// ---------- stage B: geocoding lives in scripts/geocode.mjs ----------

// ---------- stage C: logos ----------
async function logo(domain) {
  const file = `${LOGOS}${domain}.png`; if (existsSync(file)) return true;
  for (const url of [`https://logo.clearbit.com/${domain}?size=128`, `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, `https://icons.duckduckgo.com/ip3/${domain}.ico`]) {
    const r = await get(url, {}, 15000); if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer()); const ct = r.headers.get("content-type") || "";
    if (buf.length < 600 || !/image/.test(ct)) continue;
    // Google's placeholder globe is a known tiny asset; skip it
    if (url.includes("google.com") && buf.length < 1200) continue;
    writeFileSync(file, buf); return true;
  }
  return false;
}
let logos = 0; await pool(hiring, 6, async (c) => { c.logo = await logo(c.domain); if (c.logo) logos++; });

console.log(`logos saved: ${logos}/${hiring.length}`);

writeFileSync(OUT, JSON.stringify({ scraped_at: new Date().toISOString(), companies: hiring }, null, 1));
console.log("wrote", OUT);
