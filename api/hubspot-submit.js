// Vercel serverless function — receives enquiry/referral form submissions
// from the website and creates the corresponding Contact, Deal (at "New
// Enquiry" in the Participant / Lead Pipeline), Note and follow-up Task
// in HubSpot. HUBSPOT_TOKEN lives only as a server-side Vercel env var —
// never sent to the browser, never committed to the repo.
//
// Stage IDs are fixed to the ones created for this pipeline; update them
// if Pipeline A is ever rebuilt and its stage IDs regenerate. This file
// only ever creates deals in Pipeline A — Pipeline B (Referral Partner
// Pipeline) is managed separately, this file just links a new lead's
// deal to its referrer's contact when the referrer is already tracked.
const NEW_ENQUIRY_STAGE_ID = '3607635399';
const CLOSED_STAGE_IDS = new Set(['3607504325', '3607504326']); // Participant Onboarded, Lost / Not Suitable
const HUBSPOT_BASE = 'https://api.hubapi.com';

// The Forms API bridge. A HubSpot form submission is the ONLY workflow
// enrolment trigger available on Starter, so after the CRM writes succeed
// this endpoint registers a genuine submission against a form that is
// published but deliberately never embedded. That fires the simple
// workflow, which sends the acknowledgement.
//
// Verified 18 Aug 2026: both api.hsforms.com and api-ap1.hsforms.com accept
// submissions for this ap1 portal and both return 200 (NOT 204 — that is the
// legacy v2 endpoint's response). api-ap1 is used because it matches the
// portal region explicitly.
// --- Abuse protection -----------------------------------------------------
//
// This endpoint is reachable by anyone and each successful call now sends an
// email from hello@thehealthwellbeinghub.com. That raises the stakes: a flood
// no longer just pollutes the CRM, it burns a young sending reputation and
// consumes the 1,000 marketing-contact allowance.
//
// Honest about what each layer is worth:
//   - Origin allowlist  stops casual cross-site embedding. Trivially spoofed
//                       by a script, so it is a filter, not a defence.
//   - Honeypot          stops naive bots that fill every field. Activates only
//                       if the form sends the field; harmless until then.
//   - Rate limit        the one that actually bounds a flood. In-memory, so it
//                       is per-instance and best-effort on serverless. If real
//                       abuse appears, move this to a KV store — do not mistake
//                       this for a hard limit.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://www.thehealthwellbeinghub.com,https://thehealthwellbeinghub.com')
  .split(',').map((o) => o.trim()).filter(Boolean);

const HONEYPOT_FIELD = 'company_website';
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 5);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const MAX_BODY_BYTES = 20 * 1024;

const rateLimitBuckets = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (rateLimitBuckets.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitBuckets.set(ip, hits);

  // Keep the map from growing without bound on a long-lived instance.
  if (rateLimitBuckets.size > 5000) {
    for (const [key, times] of rateLimitBuckets) {
      if (!times.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) rateLimitBuckets.delete(key);
    }
  }
  return hits.length > RATE_LIMIT_MAX;
}

const FORMS_API_BASE = process.env.HUBSPOT_FORMS_BASE || 'https://api-ap1.hsforms.com';
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '443542186';
const REFERRAL_FORM_GUID =
  process.env.HUBSPOT_REFERRAL_FORM_GUID || '98d9dea9-840e-42f5-864a-747f97456bb1';

async function hs(path, options = {}) {
  const res = await fetch(HUBSPOT_BASE + path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data && data.message ? data.message : `HubSpot API ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/);
  return { firstname: parts[0] || '', lastname: parts.slice(1).join(' ') || '' };
}

function looksLikeEmail(s) {
  return !!s && /\S+@\S+\.\S+/.test(s);
}

async function findContactByEmail(email) {
  if (!email) return null;
  const result = await hs('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      limit: 1,
    }),
  });
  return (result.results && result.results[0]) || null;
}

// The duplicate-contact fix. `participant_contact` is a single field that
// may hold either an email or a phone number. Looking up by email only means
// findContactByEmail(undefined) returns null for every phone-only referral,
// so a NEW contact was created on every submission — two referrals for the
// same person produced two contacts and two deals.
async function findContactByPhone(phone) {
  if (!phone) return null;
  const result = await hs('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'phone', operator: 'EQ', value: phone }] }],
      limit: 1,
    }),
  });
  return (result.results && result.results[0]) || null;
}

// Dates are written twice, deliberately.
//
// `latest_referral_date` is a HubSpot date property, so HubSpot renders it
// using the portal locale and the marketing email cannot override that —
// the rich-text module strips HubL, so a date filter in the template is
// removed rather than applied. It rendered as 08/18/2026 (US order), which
// on a real referral is ambiguous: 05/08/2026 reads as 8 May here and
// 5 August to HubSpot.
//
// So the date property keeps the machine-readable value for filtering and
// reporting, and a separate text property carries the string the referrer
// actually reads.
function referralDateIso(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }); // YYYY-MM-DD
}

function referralDateDisplay(d) {
  return d.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Brisbane',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }); // DD/MM/YYYY
}

async function upsertContact({ name, email, phone, company, extraProperties }) {
  const existing = looksLikeEmail(email)
    ? await findContactByEmail(email)
    : await findContactByPhone(phone);
  const { firstname, lastname } = splitName(name);
  const properties = {};
  if (firstname) properties.firstname = firstname;
  if (lastname) properties.lastname = lastname;
  if (email) properties.email = email;
  if (phone) properties.phone = phone;
  if (company) properties.company = company;
  Object.assign(properties, extraProperties || {});

  if (existing) {
    if (Object.keys(properties).length) {
      await hs(`/crm/v3/objects/contacts/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
    }
    return existing.id;
  }
  const created = await hs('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  });
  return created.id;
}

// A contact who already has an OPEN deal in the pipeline is continuing
// the same journey, not starting a parallel one — reuse that deal rather
// than opening a second one. A contact whose only deals are CLOSED
// (onboarded or lost) gets a fresh deal, since that's a genuinely new
// opportunity.
async function findOpenDealForContact(contactId) {
  const assoc = await hs(`/crm/v3/objects/contacts/${contactId}/associations/deals`);
  const dealIds = (assoc.results || []).map((r) => r.id);
  if (!dealIds.length) return null;

  const deals = await Promise.all(
    dealIds.map((id) =>
      hs(`/crm/v3/objects/deals/${id}?properties=dealstage`).catch(() => null)
    )
  );
  const open = deals.find((d) => d && !CLOSED_STAGE_IDS.has(d.properties.dealstage));
  return open ? open.id : null;
}

async function associateDefault(fromType, fromId, toType, toId) {
  await hs(`/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`, {
    method: 'PUT',
  });
}

async function createDeal({ dealname, contactId }) {
  const deal = await hs('/crm/v3/objects/deals', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        dealname,
        pipeline: 'default',
        dealstage: NEW_ENQUIRY_STAGE_ID,
      },
    }),
  });
  await associateDefault('deals', deal.id, 'contacts', contactId);
  return deal.id;
}

async function createNote({ body, contactId, dealId }) {
  const note = await hs('/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        hs_note_body: body,
        hs_timestamp: new Date().toISOString(),
      },
    }),
  });
  await associateDefault('notes', note.id, 'contacts', contactId);
  if (dealId) await associateDefault('notes', note.id, 'deals', dealId);
  return note.id;
}

async function createFollowUpTask({ subject, contactId, dealId }) {
  const task = await hs('/crm/v3/objects/tasks', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        hs_task_subject: subject,
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: 'HIGH',
        hs_task_type: 'CALL',
        hs_timestamp: new Date().toISOString(),
      },
    }),
  });
  await associateDefault('tasks', task.id, 'contacts', contactId);
  if (dealId) await associateDefault('tasks', task.id, 'deals', dealId);
  return task.id;
}

// Registers a real form submission so the Starter simple workflow enrols the
// referrer and sends the acknowledgement. Retried, because a transient
// failure here means the CRM record exists and the referrer hears nothing —
// which is invisible from our side and reads as being ignored from theirs.
async function submitReferralToFormsApi({ email, firstname, lastname }) {
  const url = `${FORMS_API_BASE}/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${REFERRAL_FORM_GUID}`;
  const fields = [{ name: 'email', value: email }];
  if (firstname) fields.push({ name: 'firstname', value: firstname });
  if (lastname) fields.push({ name: 'lastname', value: lastname });

  const body = JSON.stringify({
    fields,
    context: {
      pageUri: 'https://thehealthwellbeinghub.com/referrals/',
      pageName: 'Refer a participant',
    },
  });

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) return true;
      lastErr = new Error(`Forms API ${res.status}: ${await res.text()}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastErr || new Error('Forms API submission failed');
}

function buildEnquiryNote(f) {
  const lines = [
    `Website enquiry submitted ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`,
    f.enquirer_role ? `I am a: ${f.enquirer_role}` : null,
    f.service_needed ? `Service needed: ${f.service_needed}` : null,
    f.suburb ? `Suburb: ${f.suburb}` : null,
    f.preferred_language ? `Preferred language: ${f.preferred_language}` : null,
    f.preferred_contact_method ? `Preferred contact method: ${f.preferred_contact_method}` : null,
    f.additional_info ? `Additional info: ${f.additional_info}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function buildReferralNote(f) {
  const lines = [
    `Website referral submitted ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`,
    `Referred by: ${f.referrer_name || '(not given)'}${f.referrer_organisation ? ' — ' + f.referrer_organisation : ''}`,
    f.referrer_role ? `Referrer role: ${f.referrer_role}` : null,
    f.referrer_phone ? `Referrer phone: ${f.referrer_phone}` : null,
    f.referrer_email ? `Referrer email: ${f.referrer_email}` : null,
    f.service_needed ? `Service(s) required: ${f.service_needed}` : null,
    f.plan_type ? `Plan management type: ${f.plan_type}` : null,
    f.referral_details ? `Referral details: ${f.referral_details}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

module.exports = async (req, res) => {
  // Reflect only an allowlisted origin. Previously this was '*', which let any
  // site on the internet POST here from a browser.
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // A browser always sends Origin on a cross-origin POST, so a present-but-
  // unlisted Origin is a real signal and is refused. An absent Origin is not
  // treated as proof of anything — server-to-server callers simply omit it —
  // so those fall through to the rate limit rather than being waved past.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn('rejected submission from disallowed origin:', origin);
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    console.warn('rate limited submission from', ip);
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again shortly.' });
  }

  try {
    const f = req.body || {};

    // Honeypot: a hidden field no human fills in. Respond 200 and discard —
    // never tell a bot it failed, or it just adapts. Inert until the form
    // actually renders the field.
    if (typeof f[HONEYPOT_FIELD] === 'string' && f[HONEYPOT_FIELD].trim() !== '') {
      console.warn('honeypot triggered, discarding submission from', ip);
      return res.status(200).json({ ok: true });
    }

    if (JSON.stringify(f).length > MAX_BODY_BYTES) {
      return res.status(413).json({ ok: false, error: 'Submission too large' });
    }
    const formName = f.form_name || (f.participant_name ? 'referral' : 'enquiry');

    let contactId, dealId, noteBody, dealName;

    let referrerContactId = null;
    if (formName === 'referral') {
      const contact = f.participant_contact || '';
      contactId = await upsertContact({
        name: f.participant_name,
        email: looksLikeEmail(contact) ? contact : undefined,
        phone: looksLikeEmail(contact) ? undefined : contact,
      });
      dealName = `${f.participant_name || 'Referral'} — referred by ${f.referrer_name || 'unknown'}`;
      noteBody = buildReferralNote(f);

      // The referrer is UPSERTED every time, not merely looked up. Without
      // this a referrer who is not already tracked disappears entirely, and
      // "who refers us the most" stays unanswerable.
      //
      // This contact is also the one the acknowledgement is addressed to, so
      // it is where the email's merge values must live. HubSpot resolves
      // personalisation against the ENROLLED contact — values written to the
      // participant render blank, and the email sends looking fine.
      if (looksLikeEmail(f.referrer_email)) {
        referrerContactId = await upsertContact({
          name: f.referrer_name,
          email: f.referrer_email,
          phone: f.referrer_phone,
          company: f.referrer_organisation,
        }).catch((err) => {
          console.error('referrer upsert failed:', err.message);
          return null;
        });
      }
    } else {
      contactId = await upsertContact({ name: f.name, email: f.email, phone: f.phone });
      dealName = `${f.name || 'Website enquiry'} — ${f.service_needed || 'General enquiry'}`;
      noteBody = buildEnquiryNote(f);
    }

    const existingOpenDealId = await findOpenDealForContact(contactId);
    const isReturning = !!existingOpenDealId;
    dealId = existingOpenDealId || (await createDeal({ dealname: dealName, contactId }));

    if (referrerContactId) {
      await associateDefault('deals', dealId, 'contacts', referrerContactId).catch((err) => {
        console.error('referrer association failed:', err.message);
      });
    }

    await createNote({ body: noteBody, contactId, dealId });
    await createFollowUpTask({
      subject: `Contact ${isReturning ? 'returning' : 'new'} ${formName === 'referral' ? 'referral' : 'enquiry'}: ${f.name || f.participant_name || 'lead'}`,
      contactId,
      dealId,
    });

    // The reference needs the deal ID, so it cannot be minted any earlier.
    const reference = `REF-${new Date().getFullYear()}-${dealId}`;

    // Everything the acknowledgement email renders is written here, on the
    // REFERRER — the contact the Forms API will enrol. These four properties
    // are the only ones the email reads; see docs/hubspot-manual-setup.md.
    let acknowledgementStatus = 'not_applicable';
    if (formName === 'referral' && referrerContactId && looksLikeEmail(f.referrer_email)) {
      const now = new Date();
      const mergeProperties = {
        latest_referral_participant_name: f.participant_name || '',
        latest_referral_reference: reference,
        latest_referral_date: referralDateIso(now),
        latest_referral_service: f.service_needed || '',
      };

      const writeMergeProperties = (properties) =>
        hs(`/crm/v3/objects/contacts/${referrerContactId}`, {
          method: 'PATCH',
          body: JSON.stringify({ properties }),
        });

      // HubSpot rejects the entire PATCH if any one property is unknown, so
      // including the display field before it exists would silently blank all
      // of them. Try with it, fall back without — this works either side of
      // that property being created.
      try {
        await writeMergeProperties({
          ...mergeProperties,
          latest_referral_date_display: referralDateDisplay(now),
        });
      } catch (err) {
        console.error(
          'merge write with display date failed, retrying without it:',
          err.message
        );
        await writeMergeProperties(mergeProperties).catch((retryErr) =>
          console.error('referrer merge properties failed:', retryErr.message, retryErr.data || '')
        );
      }

      // Last, and deliberately so. CRM writes first means a mid-sequence
      // failure leaves "record exists, email missing" — recoverable by hand.
      // The reverse order risks "email sent, no record", where a referrer is
      // told we have their referral and nothing does.
      //
      // A failure here NEVER fails the request: the referrer submitted
      // successfully and the record exists. A missing acknowledgement is our
      // problem to fix, not an error to show them.
      const { firstname, lastname } = splitName(f.referrer_name);
      try {
        await submitReferralToFormsApi({ email: f.referrer_email, firstname, lastname });
        acknowledgementStatus = 'pending';
      } catch (err) {
        acknowledgementStatus = 'failed';
        console.error('ACKNOWLEDGEMENT NOT SENT — Forms API failed:', err.message);
        // Convert a silent system failure into a visible human one.
        await createFollowUpTask({
          subject: `ACKNOWLEDGE MANUALLY — automated email failed: ${f.referrer_name || f.referrer_email}`,
          contactId: referrerContactId,
          dealId,
        }).catch((taskErr) => console.error('fallback task failed:', taskErr.message));
      }
    }

    return res.status(200).json({
      ok: true,
      contactId,
      dealId,
      reference,
      isReturning,
      acknowledgementStatus,
    });
  } catch (err) {
    console.error('hubspot-submit error:', err.message, err.data || '');
    return res.status(502).json({ ok: false, error: 'CRM submission failed' });
  }
};
