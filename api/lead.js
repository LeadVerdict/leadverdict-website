// POST /api/lead — every LeadVerdict form lands here and becomes a HubSpot contact.
// Needs one Vercel env var: HUBSPOT_TOKEN (a HubSpot private app token with
// crm.objects.contacts.read + crm.objects.contacts.write). Node 18+ runtime (global fetch).

const HUBSPOT = "https://api.hubapi.com/crm/v3/objects/contacts";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES = { audit: "Free marketing audit", newsletter: "Newsletter signup", case: "GBP case review" };
const ALLOWED_ORIGINS = /^https:\/\/(leadverdict\.vercel\.app|leadverdict-[a-z0-9-]+-lead-verdict\.vercel\.app)$/;

const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

function hubspot(path, method, body) {
  return fetch(HUBSPOT + path, {
    method,
    headers: { Authorization: "Bearer " + process.env.HUBSPOT_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "POST only" }); }
  const origin = req.headers.origin || "";
  if (origin && !ALLOWED_ORIGINS.test(origin)) return res.status(403).json({ ok: false, error: "Unknown origin" });
  if (!process.env.HUBSPOT_TOKEN) return res.status(503).json({ ok: false, error: "Lead storage isn't configured yet" });

  const b = req.body && typeof req.body === "object" ? req.body : {};
  if (b.company_site) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden fields

  const type = TYPES[b.type] ? b.type : null;
  const email = clip(b.email, 200).toLowerCase();
  if (!type) return res.status(400).json({ ok: false, error: "Unknown form" });
  if (!EMAIL.test(email)) return res.status(400).json({ ok: false, error: "Enter a valid email address" });

  const name = clip(b.name, 120);
  const [first, ...rest] = name.split(/\s+/);
  const details = [
    "Form: " + TYPES[type],
    b.business && "Business: " + clip(b.business, 160),
    b.websiteUrl && "Website: " + clip(b.websiteUrl, 300),
    b.problem && "Problem: " + clip(b.problem, 120),
    b.profile && "Google profile: " + clip(b.profile, 300),
    b.details && "Details: " + clip(b.details, 3000),
    "Page: " + clip(b.page, 200),
    "Received: " + new Date().toISOString(),
  ].filter(Boolean).join("\n");

  const props = { email, message: details, hs_lead_status: "NEW" };
  if (first) props.firstname = first;
  if (rest.length) props.lastname = rest.join(" ");
  if (b.phone) props.phone = clip(b.phone, 40);
  if (b.business) props.company = clip(b.business, 160);
  if (b.websiteUrl) props.website = clip(b.websiteUrl, 300);

  try {
    let r = await hubspot("", "POST", { properties: { ...props, lifecyclestage: "lead" } });
    if (r.status === 409) {
      r = await hubspot("/" + encodeURIComponent(email) + "?idProperty=email", "PATCH", { properties: props });
    }
    if (!r.ok) {
      console.error("HubSpot error", r.status, (await r.text()).slice(0, 500));
      return res.status(502).json({ ok: false, error: "Couldn't save right now" });
    }
    const message = type === "newsletter" ? "You're subscribed." : type === "audit" ? "Got it. Your audit goes to " + email + "." : "Sent. The reply goes to " + email + ".";
    return res.status(200).json({ ok: true, message });
  } catch (e) {
    console.error("Lead handler failed", e && e.message);
    return res.status(502).json({ ok: false, error: "Couldn't save right now" });
  }
};
