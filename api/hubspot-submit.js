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

async function upsertContact({ name, email, phone }) {
  const existing = await findContactByEmail(email);
  const { firstname, lastname } = splitName(name);
  const properties = {};
  if (firstname) properties.firstname = firstname;
  if (lastname) properties.lastname = lastname;
  if (email) properties.email = email;
  if (phone) properties.phone = phone;

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const f = req.body || {};
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

      // If the referrer's email matches an existing contact (e.g. a tracked
      // referral partner), link this new lead's deal to them too, so
      // "how many leads has this partner sent us" is a real, countable
      // association instead of a guess.
      if (looksLikeEmail(f.referrer_email)) {
        const referrer = await findContactByEmail(f.referrer_email).catch(() => null);
        if (referrer) referrerContactId = referrer.id;
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

    return res.status(200).json({ ok: true, contactId, dealId, isReturning });
  } catch (err) {
    console.error('hubspot-submit error:', err.message, err.data || '');
    return res.status(502).json({ ok: false, error: 'CRM submission failed' });
  }
};
