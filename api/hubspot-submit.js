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
// The public limit is sized for one person filling in one form. Staff entering
// referrals that arrived by phone or email share an office connection, so the
// same ceiling would block the second or third worker of the morning. A
// deliberate separate number, not an exemption — it is still a limit.
const STAFF_RATE_LIMIT_MAX = Number(process.env.STAFF_RATE_LIMIT_MAX || 40);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const MAX_BODY_BYTES = 20 * 1024;

const rateLimitBuckets = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function isRateLimited(ip, max = RATE_LIMIT_MAX) {
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
  return hits.length > max;
}

const FORMS_API_BASE = process.env.HUBSPOT_FORMS_BASE || 'https://api-ap1.hsforms.com';
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '443542186';
const REFERRAL_FORM_GUID =
  process.env.HUBSPOT_REFERRAL_FORM_GUID || '98d9dea9-840e-42f5-864a-747f97456bb1';
// Enquiry acknowledgement (workflow 02). Separate form from the referral one
// because Starter allows a single workflow per form. If this is ever cleared,
// the endpoint still records the enquiry correctly and raises a visible task
// rather than skipping the acknowledgement silently — see the not_configured
// branch below.
const ENQUIRY_FORM_GUID =
  process.env.HUBSPOT_ENQUIRY_FORM_GUID || '1d577457-30f7-4041-bcb4-4c996103b07a';
// Feedback and complaint acknowledgements (workflow 07). Two more forms, same
// Starter one-workflow-per-form reason as ENQUIRY_FORM_GUID above — a single
// on-page form posts one of two submission_type values, and each type needs
// its own HubSpot form/workflow so the right template (07 vs 08) sends. No
// hardcoded fallback GUID: unlike referral/enquiry, neither form has been
// created in HubSpot yet — see docs/hubspot-manual-setup.md.
const FEEDBACK_FORM_GUID = process.env.HUBSPOT_FEEDBACK_FORM_GUID || '';
const COMPLAINT_FORM_GUID = process.env.HUBSPOT_COMPLAINT_FORM_GUID || '';

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

// --- Triage properties ----------------------------------------------------
//
// Gap 1 in docs/hubspot-configuration.md: the forms already collect language,
// plan type, suburb and role, but all of it went into free text on a Note.
// Text inside a note cannot be filtered, counted, reported on, or mapped into
// ShiftCare — so it gets re-typed by a person on the day someone becomes a
// client. This writes the same values to properties as well. The note stays;
// narrative context is still worth keeping.
//
// Two things make this safe to ship before the properties exist:
//
//   1. The live contact schema is read once per cold start. Only properties
//      that actually exist are written, so each one starts populating the
//      moment it is created in HubSpot — no redeploy needed.
//   2. HubSpot rejects an ENTIRE patch if one enumeration value is not a
//      valid option. The form's wording and the property options do not match
//      (the form says "Agency managed", the property expects "Agency-managed";
//      the language options carry a native-script suffix). So values are
//      mapped below AND validated against the live options, and anything that
//      still does not match is dropped rather than failing the whole write.
//
// The form wording is deliberately plain because participants and families
// read it. The property vocabulary is deliberately the NDIS standard because
// reporting uses it. This table is where those two meet, and it is the thing
// to update if either side changes.
const LANGUAGE_MAP = {
  'English': 'English',
  'Arabic': 'Arabic',
  'Somali': 'Somali',
  'Dari': 'Dari',
  'Amharic': 'Amharic',
  'Other': 'Other',
};

const PLAN_TYPE_MAP = {
  'Agency managed': 'Agency-managed',
  'Plan managed': 'Plan-managed',
  'Self managed': 'Self-managed',
  'Not sure': 'Unknown',
};

const ENQUIRER_ROLE_MAP = {
  'NDIS Participant': 'Participant themselves',
  'Support Coordinator': 'Support coordinator',
  // A plan manager administers NDIS funds. A plan nominee is a legally
  // appointed decision-maker. Mapping one to the other overstated a stranger's
  // authority on the exact field used to decide who may receive participant
  // information — so they are now distinct options.
  'Plan Manager': 'Plan manager',
  'GP / Health professional': 'Health professional',
  'Other': 'Other',
  // "Parent / Family member / Carer" is deliberately absent. The form conflates
  // two distinct property options with different privacy weight — a parent and
  // a paid carer are not the same relationship, and authority to act differs.
  // Guessing would put wrong data in a field used to decide who may receive
  // participant information. Left unmapped so a person sets it.
};

// Who is this contact? Both the referrer and the participant land in the same
// Contacts object with no way to tell them apart, which makes "who refers us
// the most" unanswerable and makes it easy to email the wrong person.
//
// The referral form is unambiguous: whoever submits it is a referral partner
// by definition, and whoever it is about is a participant. The enquiry form is
// inferred from the role the enquirer picked, and left unset where the form
// cannot tell — "Other" could be anyone, and a wrong value here is worse than
// an empty one on a field used to decide how someone is contacted.
const CONTACT_TYPE_FROM_ENQUIRER_ROLE = {
  'NDIS Participant': 'Participant',
  'Parent / Family member / Carer': 'Family or carer',
  'Support Coordinator': 'Referral partner',
  'Plan Manager': 'Referral partner',
  'GP / Health professional': 'Referral partner',
};

const SERVICE_LINE_MAP = {
  'Support Coordination': 'Support Coordination',
  'Core Supports & Daily Living': 'Core Supports & Daily Living',
  'Community Participation': 'Community Participation',
  'Therapy Services': 'Therapy Services',
  // "Multiple / not sure" and "Not sure — please advise" have no target option;
  // they mean the question is still open, which is not the same as any value.
};

// The form appends native script, e.g. "Arabic — العربية". Take what precedes
// the em dash so the option matches.
function normaliseLanguage(value) {
  if (!value) return null;
  const base = String(value).split('—')[0].trim();
  return LANGUAGE_MAP[base] || null;
}

let contactSchemaCache = null;
async function getContactSchema() {
  if (contactSchemaCache) return contactSchemaCache;
  try {
    const data = await hs('/crm/v3/properties/contacts');
    const byName = new Map();
    for (const prop of data.results || []) {
      byName.set(prop.name, {
        type: prop.type,
        options: (prop.options || []).map((o) => o.value),
      });
    }
    contactSchemaCache = byName;
  } catch (err) {
    console.error('could not read contact schema, skipping triage properties:', err.message);
    contactSchemaCache = new Map();
  }
  return contactSchemaCache;
}

// Drop anything the portal does not have, and any enumeration value that is
// not a valid option. A dropped value is logged, never fatal.
function filterToWritable(desired, schema) {
  const writable = {};
  for (const [name, value] of Object.entries(desired)) {
    if (value === null || value === undefined || value === '') continue;
    const prop = schema.get(name);
    if (!prop) continue; // property not created yet
    if (prop.type === 'enumeration' && prop.options.length) {
      const parts = String(value).split(';').filter((v) => prop.options.includes(v));
      if (!parts.length) {
        console.warn(`dropped ${name}: "${value}" is not a valid option`);
        continue;
      }
      writable[name] = parts.join(';');
    } else {
      writable[name] = value;
    }
  }
  return writable;
}

// How the referral reached us. Without this a phone referral is indistinguishable
// from a website one, and "which channels actually bring people in" stays
// unanswerable — which is the whole reason for capturing the other two.
const REFERRAL_CHANNEL_MAP = {
  'Direct email': 'Direct email',
  'Phone call': 'Phone call',
  'Text message': 'Text message',
  'In person': 'In person',
};

function buildTriageProperties(f, formName, receivedAt, isStaffEntry = false) {
  const isReferral = formName === 'referral';
  const serviceLine = SERVICE_LINE_MAP[(f.service_needed || '').replace('&amp;', '&')] || null;

  return {
    primary_language: normaliseLanguage(f.preferred_language),
    // The referral form's option values are already the property's option
    // values, so these pass straight through. filterToWritable still validates
    // them, so a future wording change on the form fails safe.
    interpreter_required: f.interpreter_required || null,
    gender_matched_worker: f.gender_matched_worker || null,
    plan_management_type: PLAN_TYPE_MAP[f.plan_type] || null,
    service_lines_required: serviceLine,
    service_suburb: f.suburb || null,
    enquirer_relationship: isReferral ? null : (ENQUIRER_ROLE_MAP[f.enquirer_role] || null),
    contact_type: isReferral
      ? 'Participant'
      : (CONTACT_TYPE_FROM_ENQUIRER_ROLE[f.enquirer_role] || null),
    // Recorded because it was validated above, so by this point it is true.
    privacy_consent: 'true',
    // Its own checkbox on the referral form — deliberately separate from the
    // privacy consent, which is required and so would always read "ticked".
    // This one is optional and unticked by default, so an absent value means
    // the referrer did not confirm it, which is recorded as false rather than
    // left blank: "not confirmed" is the state the team has to act on. A stale
    // cached page that predates the split also lands here, and false is the
    // safe direction to be wrong in — it never claims a consent nobody gave.
    participant_consent_confirmed: isReferral
      ? String(isAffirmative(f.participant_consent_confirmed))
      : null,
    enquiry_type: isReferral ? 'Referral' : 'New enquiry',
    enquiry_received_at: receivedAt,
    referral_source_detail: isReferral ? (f.referrer_name || null) : null,
    // A website referral is the only one that can arrive without a worker, so
    // it is the default rather than something the public form has to send.
    // An unrecognised value maps to null instead of passing through — the form
    // is the only legitimate source and filterToWritable would reject it anyway.
    referral_channel: isReferral
      ? (isStaffEntry ? (REFERRAL_CHANNEL_MAP[f.referral_channel] || null) : 'Website form')
      : null,
    // Who typed it in. Blank on a website referral because nobody did.
    referral_taken_by: isStaffEntry ? (f.referral_taken_by || null) : null,
    // Keeps the consent record honest. Both values mean consent was given; they
    // differ in who said so, and that difference matters if it is ever queried.
    consent_capture_method: isReferral
      ? (isStaffEntry ? 'Recorded by worker' : 'Referrer ticked online')
      : null,
  };
}

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/);
  return { firstname: parts[0] || '', lastname: parts.slice(1).join(' ') || '' };
}

// An HTML checkbox posts "on" when ticked and is simply absent when not, so a
// truthiness check has to accept several shapes. Anything else is not consent.
function isAffirmative(v) {
  if (v === true) return true;
  if (typeof v !== 'string') return false;
  return ['on', 'true', 'yes', '1', 'checked'].includes(v.trim().toLowerCase());
}

// Compares two contact details for "is this the same person's detail". Emails
// compare case-insensitively; phones compare on digits alone, treating +61…
// and 0… as the same Australian number, because a worker typing a referrer's
// mobile twice will rarely type it the same way twice.
function normaliseDetail(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!t) return '';
  if (t.includes('@')) return t;
  const digits = t.replace(/\D/g, '');
  return digits.length > 9 && digits.startsWith('61') ? '0' + digits.slice(2) : digits;
}

function sameContactDetail(a, b) {
  const x = normaliseDetail(a);
  return !!x && x === normaliseDetail(b);
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
  // Lead Status is deliberately NOT seeded here. Deal stage is the single
  // source of truth for "where is this person up to" — participants in the
  // Participant / Lead Pipeline, partners in the Referral Partner Pipeline.
  // A contact-level status duplicates that, and duplicated state diverges:
  // someone advances the deal, forgets the contact field, and neither can be
  // trusted afterwards. One field, updated in one place.
  // Contact status is seeded on CREATION only. It answers "whose move is it
  // next", so overwriting it on every submission would stomp a status the team
  // has deliberately set — someone marked "On hold" should stay on hold.
  //
  // Note the option VALUES are underscore-separated (Needs_first_contact), not
  // the labels shown in the UI. Writing the label would be dropped.
  const created = await hs('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        // Default FIRST so an explicitly-passed value wins. Spread the other
        // way round and this silently overwrites the caller — which is exactly
        // what it did: a newly created referrer was passed "We owe a reply"
        // and got "Needs first contact" instead. A default must lose to an
        // explicit value, not beat it.
        ...filterToWritable({ contact_status: 'Needs_first_contact' }, await getContactSchema()),
        ...properties,
      },
    }),
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
// contact and sends the acknowledgement. Retried, because a transient failure
// here means the CRM record exists and the person hears nothing — which is
// invisible from our side and reads as being ignored from theirs.
//
// One helper, two forms. Starter allows only one workflow per form, so
// referrals and enquiries need separate forms and separate GUIDs; everything
// else about the call is identical.
// The enquiry form appears on two pages — the homepage and /contact/ — so a
// hardcoded pageUri would file every homepage enquiry under /contact/ and make
// the two indistinguishable in HubSpot's form analytics. The Referer is only
// trusted when it is on an allowlisted origin, which is the same check the
// request itself already had to pass; anything else falls back to the default.
function submissionPageUri(req, fallback) {
  const referer = req.headers.referer || req.headers.referrer;
  if (typeof referer !== 'string') return fallback;
  try {
    const url = new URL(referer);
    return ALLOWED_ORIGINS.includes(url.origin) ? url.origin + url.pathname : fallback;
  } catch {
    return fallback;
  }
}

// Campaign tags, as sent by the browser. Client-supplied and therefore
// sanitised the same way the page title is: control characters stripped,
// whitespace collapsed, length capped. They are reporting dimensions — they
// land in a note and in text properties, and nothing branches on them.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

function cleanTag(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 100) : null;
}

function collectUtms(f) {
  const out = {};
  for (const key of UTM_KEYS) {
    const value = cleanTag(f[key]);
    if (value) out[key] = value;
  }
  return out;
}

// "referrer-outreach-2026-08 (hubspot / email)" — one line, readable at a
// glance on the record. Without this the campaign is only visible to whoever
// remembers to open form analytics, which in practice is nobody.
function campaignSummary(utms) {
  if (!utms.utm_campaign && !utms.utm_source) return null;
  const name = utms.utm_campaign || 'untitled campaign';
  const via = [utms.utm_source, utms.utm_medium].filter(Boolean).join(' / ');
  const detail = utms.utm_content ? `, ${utms.utm_content}` : '';
  return via ? `${name} (${via}${detail})` : `${name}${detail}`;
}

// A readable name for the page the form was on. The browser sends the real
// document title, which is the only source that stays correct when a form is
// dropped onto a page nobody thought about here. It is client-supplied, so it
// is trimmed, stripped of control characters and capped before it goes
// anywhere — it lands in HubSpot's form analytics and in a note, never in a
// field anything branches on.
function submissionPageName(f, req, fallback) {
  const raw = typeof f.page_title === 'string' ? f.page_title : '';
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned) return cleaned.slice(0, 120);

  // No title (an old cached page, or a client that stripped it) — derive
  // something honest from the path rather than claiming a page it wasn't on.
  const uri = submissionPageUri(req, '');
  if (uri) {
    try {
      const path = new URL(uri).pathname.replace(/^\/|\/$/g, '');
      if (!path) return 'Home';
      return path.split('/').join(' — ').replace(/-/g, ' ');
    } catch {
      /* fall through */
    }
  }
  return fallback;
}

async function submitToFormsApi({ formGuid, email, firstname, lastname, pageUri, pageName }) {
  const url = `${FORMS_API_BASE}/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${formGuid}`;
  const fields = [{ name: 'email', value: email }];
  if (firstname) fields.push({ name: 'firstname', value: firstname });
  if (lastname) fields.push({ name: 'lastname', value: lastname });

  const body = JSON.stringify({
    fields,
    context: { pageUri, pageName },
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

// A staff entry with no referrer at all is a participant who came to us
// directly — the referrer section of the intake form is optional for exactly
// that case. No referrer to acknowledge, no referrer to go back to.
function isDirectEntry(f) {
  return f.form_name === 'staff_referral' && !(f.referrer_name || '').trim() && !(f.referrer_email || '').trim();
}

function consentTaskSubject(f, formName, isReturning) {
  const who = f.name || f.participant_name || 'lead';
  if (formName !== 'referral') {
    return `Contact ${isReturning ? 'returning' : 'new'} enquiry: ${who}`;
  }
  // Direct contact: the participant supplied their own details, which is
  // consent to hear from us — the "go back to the referrer" branch would
  // point workers at a referrer who does not exist.
  if (isDirectEntry(f) || isAffirmative(f.participant_consent_confirmed)) {
    return `Contact participant: ${who}`;
  }
  return `Contact REFERRER — participant consent not confirmed: ${who}`;
}

function buildEnquiryNote(f, sourcePage, campaign) {
  const lines = [
    `Website enquiry submitted ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`,
    sourcePage ? `Submitted from: ${sourcePage}` : null,
    campaign ? `Campaign: ${campaign}` : null,
    f.enquirer_role ? `I am a: ${f.enquirer_role}` : null,
    f.service_needed ? `Service needed: ${f.service_needed}` : null,
    f.suburb ? `Suburb: ${f.suburb}` : null,
    f.preferred_language ? `Preferred language: ${f.preferred_language}` : null,
    f.preferred_contact_method ? `Preferred contact method: ${f.preferred_contact_method}` : null,
    f.additional_info ? `Additional info: ${f.additional_info}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function buildReferralNote(f, sourcePage, campaign, isStaffEntry = false, contactWasReferrers = false) {
  const stamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' });
  const lines = [
    isStaffEntry
      ? `Referral entered by a worker ${stamp}`
      : `Website referral submitted ${stamp}`,
    // First line of the note after the stamp, because it changes how the rest
    // is read: on a staff entry every value below is second-hand.
    isStaffEntry ? `Arrived by: ${f.referral_channel || '(not given)'}` : null,
    isStaffEntry ? `Taken by: ${f.referral_taken_by || '(not given)'}` : null,
    sourcePage && !isStaffEntry ? `Submitted from: ${sourcePage}` : null,
    campaign ? `Campaign: ${campaign}` : null,
    isDirectEntry(f)
      ? 'Direct enquiry — the participant contacted us themselves, no referrer.'
      : `Referred by: ${f.referrer_name || '(not given)'}${f.referrer_organisation ? ' — ' + f.referrer_organisation : ''}`,
    f.referrer_role ? `Referrer role: ${f.referrer_role}` : null,
    f.referrer_phone ? `Referrer phone: ${f.referrer_phone}` : null,
    f.referrer_email ? `Referrer email: ${f.referrer_email}` : null,
    f.service_needed ? `Service(s) required: ${f.service_needed}` : null,
    f.plan_type ? `Plan management type: ${f.plan_type}` : null,
    f.referral_details ? `Referral details: ${f.referral_details}` : null,
    // The task says "contact participant", so the worker has to be told when
    // there is no way to reach them directly — otherwise they ring the number
    // on the record and get the referrer.
    contactWasReferrers
      ? 'NOTE: no contact detail for the participant — the one given belongs to the referrer. Reach them through the referrer.'
      : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function buildFeedbackComplaintNote(f, sourcePage, campaign) {
  const stamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' });
  const isComplaint = f.submission_type === 'Complaint';
  const lines = [
    `${isComplaint ? 'Complaint' : 'Feedback'} submitted ${stamp}`,
    sourcePage ? `Submitted from: ${sourcePage}` : null,
    campaign ? `Campaign: ${campaign}` : null,
    f.relates_to ? `Relates to: ${f.relates_to}` : null,
    f.response_wanted ? `Response wanted: ${f.response_wanted}` : null,
    f.preferred_language ? `Preferred language: ${f.preferred_language}` : null,
    // Both contact fields are optional on this form (see complaint_form.html) —
    // NDIS Practice Standards expect an anonymous option. Recorded plainly so
    // whoever reads the note does not go looking for a reply that cannot be sent.
    !looksLikeEmail(f.email) && !f.phone ? 'Submitted anonymously — no way to reply.' : null,
    '',
    'Details:',
    f.details || '(none given)',
  ].filter((l) => l !== null);
  return lines.join('\n');
}

function feedbackComplaintTaskSubject(f) {
  const isComplaint = f.submission_type === 'Complaint';
  const who = f.name || (isComplaint ? 'anonymous complaint' : 'anonymous feedback');
  if (!isComplaint) {
    return f.response_wanted === 'Yes' ? `Reply to feedback: ${who}` : `Review feedback (no reply requested): ${who}`;
  }
  return `Investigate complaint: ${who}`;
}

// A coarse business-day estimate for the "next update by" / feedback response
// date, computed in Brisbane's calendar regardless of the server's own
// timezone (Vercel runs in UTC). Deliberately not exact to the hour — this
// backs a draft compliance sentence, not the confirmed "2 business hour"
// enquiry response promise, and it is flagged as such in docs/workflow-07.md
// pending review of what NDIS Practice Standards actually require here.
function addBusinessDaysBrisbane(date, days) {
  const d = new Date(date.getTime());
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.toLocaleDateString('en-US', { timeZone: 'Australia/Brisbane', weekday: 'short' });
    if (weekday !== 'Sat' && weekday !== 'Sun') added += 1;
  }
  return d;
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
  // Read before the body is otherwise touched so the limit can differ by form.
  // A caller could claim to be staff to get the higher ceiling; that buys 40
  // submissions per ten minutes instead of 5, and every other check — honeypot,
  // consent, origin — still applies. Worth the trade to keep the office working.
  const staffEntry = (req.body || {}).form_name === 'staff_referral';
  if (isRateLimited(ip, staffEntry ? STAFF_RATE_LIMIT_MAX : RATE_LIMIT_MAX)) {
    console.warn('rate limited submission from', ip);
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again shortly.' });
  }

  try {
    const f = req.body || {};
    // Server time, never the client's. A submitted timestamp is
    // attacker-controlled and would corrupt the SLA measurement.
    const receivedAt = new Date().toISOString();

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

    // `required` on the checkbox is a client-side hint only. This endpoint is
    // reachable directly, so without a server-side check a submission can
    // create a CRM record carrying no consent at all — and the record would
    // look identical to a consented one.
    // A referral typed in by a worker cannot carry the referrer's own tick —
    // nobody can read a privacy policy on someone else's behalf. The staff form
    // asks the worker to attest that they told the referrer instead, which is a
    // different fact and is recorded as one (consent_capture_method below).
    // Consent is still mandatory; only the person making the statement changes.
    const isStaffEntry = f.form_name === 'staff_referral';
    if (!isAffirmative(isStaffEntry ? f.staff_consent_attested : f.privacy_consent)) {
      console.warn('rejected submission without privacy consent from', ip);
      return res.status(400).json({
        ok: false,
        error: isStaffEntry
          ? 'Please confirm you told the referrer how their details will be used.'
          : 'Please confirm you have read the Privacy Policy before submitting.',
      });
    }

    // Normalised to 'referral' immediately, so every branch below — records,
    // deal, note, task, acknowledgement email, Forms API enrolment — runs the
    // referral path unchanged. A staff-entered referral is not a different kind
    // of referral; it only arrived a different way.
    const formName = isStaffEntry
      ? 'referral'
      : f.form_name || (f.participant_name ? 'referral' : 'enquiry');

    let contactId, dealId, noteBody, dealName;

    // Which page the form was actually on. Computed once and used everywhere,
    // so a form dropped onto a service or location page later is attributed to
    // that page rather than inheriting whichever page was hardcoded here.
    const sourcePage = submissionPageName(f, req, '');
    const sourceUrl = submissionPageUri(req, '');
    const utms = collectUtms(f);
    const campaign = campaignSummary(utms);

    let referrerContactId = null;
    if (formName === 'referral') {
      // A contact detail belonging to the REFERRER must never be written onto
      // the participant. upsertContact dedupes on email or phone, so when a
      // worker enters the referrer's own email as the participant's contact —
      // which happens whenever the participant has no email of their own — the
      // referrer upsert that follows finds the record just created for the
      // participant and overwrites its name. Two people collapse into one, the
      // deal ends up with a single associated contact, and the participant is
      // the one destroyed. Verified happening on REF-2026-287797535216.
      //
      // Recording no contact detail is the honest outcome: the participant does
      // not have one. The referrer's details stay on the referrer's record, and
      // the note tells the worker to reach the participant through them.
      const givenContact = (f.participant_contact || '').trim();
      const contactBelongsToReferrer =
        sameContactDetail(givenContact, f.referrer_email) ||
        sameContactDetail(givenContact, f.referrer_phone);
      if (contactBelongsToReferrer) {
        console.warn(
          'participant contact matches the referrer — not written to the participant record'
        );
      }
      const contact = contactBelongsToReferrer ? '' : givenContact;
      contactId = await upsertContact({
        name: f.participant_name,
        email: looksLikeEmail(contact) ? contact : undefined,
        phone: looksLikeEmail(contact) ? undefined : contact,
      });
      dealName = isDirectEntry(f)
        ? `${f.participant_name || 'Participant'} — came to us directly`
        : `${f.participant_name || 'Referral'} — referred by ${f.referrer_name || 'unknown'}`;
      noteBody = buildReferralNote(f, sourcePage, campaign, isStaffEntry, contactBelongsToReferrer);

      // The referrer is UPSERTED every time, not merely looked up. Without
      // this a referrer who is not already tracked disappears entirely, and
      // "who refers us the most" stays unanswerable.
      //
      // This contact is also the one the acknowledgement is addressed to, so
      // it is where the email's merge values must live. HubSpot resolves
      // personalisation against the ENROLLED contact — values written to the
      // participant render blank, and the email sends looking fine.
      if (looksLikeEmail(f.referrer_email)) {
        // Anyone submitting this form is a referral partner by definition, so
        // this is a constant, not something read from the request body — a
        // client cannot override it. Same schema guard as everything else, so
        // it is inert until contact_type exists and starts populating the
        // moment it does.
        const referrerSchema = await getContactSchema();
        // contact_status here is set on EVERY referral, not just creation —
        // unlike the participant. A returning referrer who sends a new referral
        // has created a fresh obligation on us regardless of what their status
        // was before, so "We owe a reply" is correct even if they were
        // previously Closed or Waiting on them. That is the field working, not
        // drifting.
        const referrerExtras = filterToWritable(
          {
            contact_type: 'Referral partner',
            referrer_role: f.referrer_role || null,
            referrer_wants_updates: 'false',
            contact_status: 'We_owe_a_reply',
          },
          referrerSchema
        );

        referrerContactId = await upsertContact({
          name: f.referrer_name,
          email: f.referrer_email,
          phone: f.referrer_phone,
          company: f.referrer_organisation,
          extraProperties: referrerExtras,
        }).catch((err) => {
          console.error('referrer upsert failed:', err.message);
          return null;
        });
      }
    } else if (formName === 'feedback_complaint') {
      // No deal here — Pipeline A tracks the journey to becoming a
      // participant, and a complaint or a compliment is not that journey.
      // Deliberately narrower than the referral/enquiry paths: Contact + Note
      // + Task only. dealId stays undefined for the rest of this handler,
      // and every call below that touches it already tolerates that (see the
      // `formName !== 'feedback_complaint'` guards further down).
      contactId = await upsertContact({
        name: f.name,
        email: looksLikeEmail(f.email) ? f.email : undefined,
        phone: f.phone || undefined,
      });
      noteBody = buildFeedbackComplaintNote(f, sourcePage, campaign);
    } else {
      // Set on EVERY enquiry, not only on creation. Someone who enquires has
      // asked us a question and is waiting — that is true whether or not we
      // have spoken to them before, so a returning enquirer whose status had
      // moved on is correctly pulled back to "We owe a reply".
      //
      // This differs from the referral path on purpose: there, the person who
      // submits is the referrer and the participant has not asked us for
      // anything yet, so the participant stays "Needs first contact". Here the
      // person who submitted IS the contact.
      const enquirerExtras = filterToWritable(
        { contact_status: 'We_owe_a_reply' },
        await getContactSchema()
      );
      contactId = await upsertContact({
        name: f.name,
        email: f.email,
        phone: f.phone,
        extraProperties: enquirerExtras,
      });
      dealName = `${f.name || 'Website enquiry'} — ${f.service_needed || 'General enquiry'}`;
      noteBody = buildEnquiryNote(f, sourcePage, campaign);
    }

    // Write the triage values as PROPERTIES as well as into the note. Same
    // submission, both destinations — see buildTriageProperties above for why.
    // Skipped for feedback/complaint: buildTriageProperties assumes referral
    // or enquiry shape (service lines, plan type, enquirer role) and none of
    // it applies here — the feedback/complaint-specific merge properties are
    // written separately, below, alongside the acknowledgement email.
    if (formName !== 'feedback_complaint') {
      try {
        const schema = await getContactSchema();
        const desired = {
          ...buildTriageProperties(f, formName, receivedAt, isStaffEntry),
          // Which page converted them. Schema-filtered like everything else, so
          // these stay inert until the properties are created and start
          // populating the moment they are — see docs/hubspot-manual-setup.md.
          source_page: sourcePage || null,
          source_page_url: sourceUrl || null,
          latest_utm_source: utms.utm_source || null,
          latest_utm_medium: utms.utm_medium || null,
          latest_utm_campaign: utms.utm_campaign || null,
          latest_utm_content: utms.utm_content || null,
        };
        const writable = filterToWritable(desired, schema);
        if (Object.keys(writable).length) {
          await hs(`/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            body: JSON.stringify({ properties: writable }),
          });
        } else {
          console.info('no triage properties written — none of the target properties exist yet');
        }
      } catch (err) {
        // Never fail a referral over reporting metadata. The note still holds
        // the narrative and the record still exists.
        console.error('triage property write failed:', err.message, err.data || '');
      }
    }

    // No deal for feedback/complaint — see the branch above. isReturning has
    // no meaning without a deal to be returning to, so it stays false.
    let isReturning = false;
    if (formName !== 'feedback_complaint') {
      const existingOpenDealId = await findOpenDealForContact(contactId);
      isReturning = !!existingOpenDealId;
      dealId = existingOpenDealId || (await createDeal({ dealname: dealName, contactId }));

      if (referrerContactId) {
        await associateDefault('deals', dealId, 'contacts', referrerContactId).catch((err) => {
          console.error('referrer association failed:', err.message);
        });
      }
    }

    await createNote({ body: noteBody, contactId, dealId });
    await createFollowUpTask({
      // Per workflow-01-referral.md §D, consent gates OUTREACH, not intake.
      // Recording the flag achieves nothing unless it changes what happens
      // next: without this branch someone eventually opens the deal, sees a
      // name and a number, and phones a person who never agreed to hear from
      // us. Until the form asks separately the flag is null, which is treated
      // as "not confirmed" — the cautious reading, deliberately.
      subject: formName === 'feedback_complaint'
        ? feedbackComplaintTaskSubject(f)
        : consentTaskSubject(f, formName, isReturning),
      contactId,
      dealId,
    });

    // The reference needs the deal ID (or, for feedback/complaint, the
    // contact ID — there is no deal), so it cannot be minted any earlier.
    // Distinct prefixes because all three appear in emails people reply
    // quoting: "REF-2026-…" on a referral acknowledgement, "ENQ-2026-…" on an
    // enquiry one, "FB-2026-…" / "CMP-2026-…" here. Distinguishable at a glance.
    let referencePrefix = 'ENQ';
    let referenceId = dealId;
    if (formName === 'referral') {
      referencePrefix = 'REF';
    } else if (formName === 'feedback_complaint') {
      referencePrefix = f.submission_type === 'Complaint' ? 'CMP' : 'FB';
      referenceId = contactId;
    }
    const reference = `${referencePrefix}-${new Date().getFullYear()}-${referenceId}`;

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
        await submitToFormsApi({
          formGuid: REFERRAL_FORM_GUID,
          email: f.referrer_email,
          firstname,
          lastname,
          pageUri: submissionPageUri(req, 'https://www.thehealthwellbeinghub.com/referrals/'),
          pageName: submissionPageName(f, req, 'Refer a participant'),
        });
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

    // Enquiry acknowledgement — workflow 02. Same shape as the referral above,
    // with one structural difference: on an enquiry the person who submitted
    // IS the contact, so the merge values go on `contactId` directly. There is
    // no second record to get wrong.
    if (formName === 'enquiry') {
      // Email is OPTIONAL on the enquiry form — phone is the required field,
      // because a participant without an email address must still be able to
      // ask for help. So "no acknowledgement" is a normal outcome here, not a
      // failure, and it must not raise an alarm. The follow-up task created
      // above already tells the team to call them.
      if (!looksLikeEmail(f.email)) {
        acknowledgementStatus = 'no_email';
      } else if (!ENQUIRY_FORM_GUID) {
        // Fail loudly rather than silently. Without the form there is no
        // enrolment trigger, so nothing sends — and an enquirer who was
        // promised a reply within 2 business hours hears nothing at all.
        acknowledgementStatus = 'not_configured';
        console.error('ENQUIRY FORM GUID NOT SET — no acknowledgement can send');
        await createFollowUpTask({
          subject: `ACKNOWLEDGE MANUALLY — enquiry form not configured: ${f.name || f.email}`,
          contactId,
          dealId,
        }).catch((taskErr) => console.error('fallback task failed:', taskErr.message));
      } else {
        const now = new Date();
        // "Not sure — please advise" is a real and common answer on this form,
        // and it posts as an empty string. Left blank the email would read
        // "your enquiry about ." — so it falls back to wording that is true
        // whatever they picked.
        const enquiryService = f.service_needed || 'NDIS supports';
        const mergeProperties = filterToWritable(
          {
            latest_enquiry_reference: reference,
            latest_enquiry_date: referralDateIso(now),
            latest_enquiry_date_display: referralDateDisplay(now),
            latest_enquiry_service: enquiryService,
          },
          await getContactSchema()
        );

        // Schema-filtered rather than sent blind: HubSpot rejects the WHOLE
        // patch if one property does not exist, which would blank every merge
        // value and send an email full of empty spaces.
        if (Object.keys(mergeProperties).length) {
          await hs(`/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            body: JSON.stringify({ properties: mergeProperties }),
          }).catch((err) =>
            console.error('enquiry merge properties failed:', err.message, err.data || '')
          );
        }

        // Last, deliberately — same ordering argument as the referral path.
        const { firstname, lastname } = splitName(f.name);
        try {
          await submitToFormsApi({
            formGuid: ENQUIRY_FORM_GUID,
            email: f.email,
            firstname,
            lastname,
            pageUri: submissionPageUri(req, 'https://www.thehealthwellbeinghub.com/contact/'),
            pageName: submissionPageName(f, req, 'Make an NDIS enquiry'),
          });
          acknowledgementStatus = 'pending';
        } catch (err) {
          acknowledgementStatus = 'failed';
          console.error('ACKNOWLEDGEMENT NOT SENT — Forms API failed:', err.message);
          await createFollowUpTask({
            subject: `ACKNOWLEDGE MANUALLY — automated email failed: ${f.name || f.email}`,
            contactId,
            dealId,
          }).catch((taskErr) => console.error('fallback task failed:', taskErr.message));
        }
      }
    }

    // Feedback/complaint acknowledgement — workflow 07. Same shape again, with
    // two more differences: contact details are OPTIONAL (an anonymous
    // submission is a normal outcome here, not a failure — see the note built
    // above), and which of the two forms/templates is used depends on the
    // submission_type the person picked, not on formName itself.
    if (formName === 'feedback_complaint') {
      const isComplaint = f.submission_type === 'Complaint';
      const formGuid = isComplaint ? COMPLAINT_FORM_GUID : FEEDBACK_FORM_GUID;

      if (!looksLikeEmail(f.email)) {
        acknowledgementStatus = 'no_email';
      } else if (!formGuid) {
        // Same fail-loudly reasoning as the enquiry path above — until a
        // human creates these two forms in HubSpot (docs/hubspot-manual-setup.md)
        // this is the expected state, not a bug, so it raises a task rather
        // than an alarm on every submission.
        acknowledgementStatus = 'not_configured';
        console.error(`${isComplaint ? 'COMPLAINT' : 'FEEDBACK'} FORM GUID NOT SET — no acknowledgement can send`);
        await createFollowUpTask({
          subject: `ACKNOWLEDGE MANUALLY — ${isComplaint ? 'complaint' : 'feedback'} form not configured: ${f.name || f.email}`,
          contactId,
          dealId,
        }).catch((taskErr) => console.error('fallback task failed:', taskErr.message));
      } else {
        const now = new Date();
        // Draft compliance sentence, not the confirmed 2-business-hour promise
        // — see addBusinessDaysBrisbane's own comment. Feedback with no reply
        // requested gets the other half of the same bracketed choice that used
        // to sit unresolved in the template itself.
        const updateByDisplay = referralDateDisplay(addBusinessDaysBrisbane(now, 5));
        const mergeProperties = isComplaint
          ? {
              latest_complaint_reference: reference,
              latest_complaint_date_display: referralDateDisplay(now),
              // The participant's own words, not a paraphrase — nothing here
              // is invented, so it is safe to send without a human rewriting
              // it first. Capped the same way UTM tags are, defensively.
              latest_complaint_description: (f.details || '').slice(0, 300),
              latest_complaint_update_date_display: updateByDisplay,
            }
          : {
              latest_feedback_reference: reference,
              latest_feedback_date_display: referralDateDisplay(now),
              latest_feedback_regarding: f.relates_to || 'your feedback',
              latest_feedback_response_line: f.response_wanted === 'No'
                ? 'No response was requested, so no further action is required.'
                : `We will contact you by ${updateByDisplay} with an update.`,
            };

        const writable = filterToWritable(mergeProperties, await getContactSchema());
        if (Object.keys(writable).length) {
          await hs(`/crm/v3/objects/contacts/${contactId}`, {
            method: 'PATCH',
            body: JSON.stringify({ properties: writable }),
          }).catch((err) =>
            console.error('feedback/complaint merge properties failed:', err.message, err.data || '')
          );
        }

        const { firstname, lastname } = splitName(f.name);
        try {
          await submitToFormsApi({
            formGuid,
            email: f.email,
            firstname,
            lastname,
            pageUri: submissionPageUri(req, 'https://www.thehealthwellbeinghub.com/complaints-feedback/'),
            pageName: submissionPageName(f, req, 'Complaints & Feedback'),
          });
          acknowledgementStatus = 'pending';
        } catch (err) {
          acknowledgementStatus = 'failed';
          console.error('ACKNOWLEDGEMENT NOT SENT — Forms API failed:', err.message);
          await createFollowUpTask({
            subject: `ACKNOWLEDGE MANUALLY — automated email failed: ${f.name || f.email}`,
            contactId,
            dealId,
          }).catch((taskErr) => console.error('fallback task failed:', taskErr.message));
        }
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
