// Vercel function behind the /download form. It adds the HubSpot token (kept in the environment, never
// shipped to the browser), checks the input again, and forwards it to the HubSpot Forms secure-submit API.
//
// Required env var:  HUBSPOT_FORMS_TOKEN   (private app token with the `forms` scope)
// Optional env vars: HUBSPOT_PORTAL_ID, HUBSPOT_FORM_GUID  (default to the PaidHR report form)

const PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || "26055346";
const FORM_GUID = process.env.HUBSPOT_FORM_GUID || "9b0ce4b6-9649-4f03-8015-6ec2856106ff";
const SUBMIT_URL = `https://api.hsforms.com/submissions/v3/integration/secure/submit/${PORTAL_ID}/${FORM_GUID}`;

// Values the Category dropdown on the form may send (HubSpot's internal option values).
const CATEGORIES = new Set(["JOKUPjVcGqqIk0fsk3YOw", "js2XLfA5ihRoZBRPEfEpo", "Founder", "C-Suite Executive"]);

// Client key → HubSpot property and the object it belongs to (0-1 contact, 0-2 company).
const FIELDS = [
  ["firstname", "firstname", "0-1"],
  ["lastname", "lastname", "0-1"],
  ["email", "email", "0-1"],
  ["phone", "phone", "0-1"],
  ["category", "category", "0-1"],
  ["company", "name", "0-2"],
];

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function validate(body) {
  const errors = {};
  const clean = {};
  for (const [key] of FIELDS) clean[key] = text(body[key], key === "email" ? 254 : 120);

  if (!clean.firstname) errors.firstname = "Enter your first name.";
  if (!clean.lastname) errors.lastname = "Enter your last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean.email)) errors.email = "Enter a valid email address.";
  if (!/^\+\d{8,15}$/.test(clean.phone)) errors.phone = "Enter a valid phone number.";
  if (!CATEGORIES.has(clean.category)) errors.category = "Choose the category that fits you.";
  if (!clean.company) errors.company = "Enter your company name.";
  return { clean, errors };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }
  if (!process.env.HUBSPOT_FORMS_TOKEN) {
    console.error("download-submit: HUBSPOT_FORMS_TOKEN is not set");
    return res.status(500).json({ ok: false });
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const { clean, errors } = validate(body);
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  const payload = {
    fields: FIELDS.map(([key, name, objectTypeId]) => ({ objectTypeId, name, value: clean[key] })),
    context: { pageUri: text(body.pageUri, 500), pageName: text(body.pageName, 200) },
  };

  try {
    const upstream = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.HUBSPOT_FORMS_TOKEN}` },
      body: JSON.stringify(payload),
    });
    if (!upstream.ok) {
      console.error("download-submit: HubSpot", upstream.status, await upstream.text());
      return res.status(502).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("download-submit:", err);
    return res.status(502).json({ ok: false });
  }
};
