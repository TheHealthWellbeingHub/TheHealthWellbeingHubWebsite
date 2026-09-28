// Workflow 03, automated (28 Sep 2026):
//  - sendOnboardingEmail: the Onboarding email (04, three forms attached)
//    goes out as soon as a participant is going ahead — no one presses Send.
//  - processFormReturns: forms the participant emails back (queued by the
//    hourly email agent in `onboarding_form_returns`) are ticked off; once
//    all three are back the participant is created or updated in ShiftCare
//    and Supabase, the Welcome pack (12) goes out, and staff get a task to
//    double-check the details that came from the forms.
// The Command Centre's onboarding page still does all of this by hand — it's
// the fallback whenever a step here can't finish (no email, no date of
// birth, ShiftCare refused), and every such case raises a task saying so.
const { rest, insertOne, updateOne, selectOne, selectMany } = require('./supabase');
const { sendParticipantEmail, looksLikeEmail } = require('./participant-email');

const CONTACT_NAME = process.env.ONBOARDING_CONTACT_NAME || 'Ibrahim Zakariya';
const CONTACT_ROLE = process.env.ONBOARDING_CONTACT_ROLE || 'Support Coordinator';
const TBC = 'To be confirmed';

const SHIFTCARE_ACCOUNT_ID = process.env.SHIFTCARE_ACCOUNT_ID || '291708';
const SHIFTCARE_API_KEY = process.env.SHIFTCARE_API_KEY || '';
const SHIFTCARE_BASE = 'https://api.shiftcare.com/api';

const FORMS = [
  { key: 'referral_form', label: 'Referral Form' },
  { key: 'consent_form', label: 'NDIS Consent form' },
  { key: 'service_agreement', label: 'Signed Service Agreement' },
];
const FORM_KEYS = FORMS.map((f) => f.key);
const formLabel = (k) => (FORMS.find((f) => f.key === k) || { label: k }).label;

const nowIso = () => new Date().toISOString();
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
const firstWord = (s) => (s || '').trim().split(/\s+/)[0] || '';
const restWords = (s) => (s || '').trim().split(/\s+/).slice(1).join(' ');

function ilikeExact(value) {
  return encodeURIComponent(String(value).trim().replace(/[\\%_]/g, (c) => `\\${c}`));
}

async function note(leadId, body) {
  await insertOne('lead_notes', { lead_id: leadId, body });
}

async function task(fields) {
  await insertOne('tasks', { status: 'action_required', ...fields });
}

async function closeTasks(leadId, statuses, subjectPrefix) {
  let q = `/tasks?lead_id=eq.${encodeURIComponent(leadId)}&status=in.(${statuses.join(',')})`;
  if (subjectPrefix) q += `&subject=ilike.${encodeURIComponent(subjectPrefix)}*`;
  await rest(q, { method: 'PATCH', body: JSON.stringify({ status: 'done', completed_at: nowIso() }) });
}

async function logSent({ kind, to, name, subject, participantId, meta }) {
  await insertOne('sent_emails', {
    kind,
    recipient_email: to,
    recipient_name: name || null,
    subject,
    participant_id: participantId || null,
    meta,
  }).catch((err) => console.error('sent_emails insert failed:', err.message));
}

// ---- ShiftCare ---------------------------------------------------------
async function shiftcare(pathname, method, body) {
  if (!SHIFTCARE_API_KEY) throw new Error('ShiftCare isn\'t configured on the website (SHIFTCARE_API_KEY missing)');
  const basic = Buffer.from(`${SHIFTCARE_ACCOUNT_ID}:${SHIFTCARE_API_KEY}`).toString('base64');
  const res = await fetch(`${SHIFTCARE_BASE}${pathname}`, {
    method,
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`ShiftCare ${method} ${pathname} failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  }
  return (data && (data.client || data)) || {};
}

// ---- Details from the returned forms ------------------------------------
// Only identity and contact details are written automatically. Clinical and
// risk details (diagnoses, risks, medications, emergency contacts) never
// come through here — the email agent proposes those for sign-off instead.
function cleanDetails(raw) {
  const d = {};
  const src = raw && typeof raw === 'object' ? raw : {};
  for (const k of ['first_name', 'family_name', 'preferred_name', 'email', 'mobile', 'phone', 'address', 'suburb', 'state', 'postcode']) {
    if (typeof src[k] === 'string' && src[k].trim()) d[k] = src[k].trim().slice(0, 200);
  }
  if (typeof src.date_of_birth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src.date_of_birth.trim())) {
    d.date_of_birth = src.date_of_birth.trim();
  }
  if (typeof src.ndis_number === 'string') {
    const n = src.ndis_number.replace(/\s+/g, '');
    if (/^\d{9}$/.test(n)) d.ndis_number = n;
  }
  if (d.email && !looksLikeEmail(d.email)) delete d.email;
  return d;
}

const PARTICIPANT_COLUMNS = 'id,shiftcare_client_id,full_name,preferred_name,date_of_birth,email,mobile,phone,address,suburb,state,postcode,ndis_number';

// Supabase column ← detail key, and the ShiftCare field it also goes to.
const FIELD_MAP = [
  { col: 'preferred_name', key: 'preferred_name', sc: 'preferred_name' },
  { col: 'date_of_birth', key: 'date_of_birth', sc: 'dob' },
  { col: 'ndis_number', key: 'ndis_number', sc: 'ndis_number' },
  { col: 'email', key: 'email', sc: 'email' },
  { col: 'mobile', key: 'mobile', sc: 'mobile_number' },
  { col: 'phone', key: 'phone' },
  { col: 'address', key: 'address', sc: 'address' },
  { col: 'suburb', key: 'suburb' },
  { col: 'state', key: 'state' },
  { col: 'postcode', key: 'postcode' },
];

// Brings an existing participant up to date with the forms: ShiftCare first,
// then Supabase, so the two never disagree. Returns "field: old → new" lines.
async function applyDetails(p, d) {
  const sb = {};
  const sc = {};
  const changes = [];
  if (d.first_name) {
    const full = [d.first_name, d.family_name].filter(Boolean).join(' ');
    if (full && full !== p.full_name) {
      sb.full_name = full;
      sc.first_name = d.first_name;
      if (d.family_name) sc.family_name = d.family_name;
      changes.push(`name: ${p.full_name || '—'} → ${full}`);
    }
  }
  for (const f of FIELD_MAP) {
    const v = d[f.key];
    if (!v || String(p[f.col] || '') === v) continue;
    sb[f.col] = v;
    if (f.sc) sc[f.sc] = v;
    changes.push(`${f.col.replace('_', ' ')}: ${p[f.col] || '—'} → ${v}`);
  }
  if (!changes.length) return { changes };
  if (Object.keys(sc).length && p.shiftcare_client_id) {
    await shiftcare(`/v3/clients/${encodeURIComponent(p.shiftcare_client_id)}`, 'PATCH', sc);
  }
  await updateOne('participants', p.id, { ...sb, updated_at: nowIso() });
  return { changes };
}

async function findMatchingParticipant({ ndisNumber, fullName, dob }) {
  if (ndisNumber) {
    const [byNdis] = await selectMany('participants', `ndis_number=eq.${encodeURIComponent(ndisNumber)}&limit=1`, PARTICIPANT_COLUMNS);
    if (byNdis) return byNdis;
  }
  if (fullName && dob) {
    const [byName] = await selectMany(
      'participants',
      `full_name=ilike.${ilikeExact(fullName)}&date_of_birth=eq.${encodeURIComponent(dob)}&limit=1`,
      PARTICIPANT_COLUMNS
    );
    if (byName) return byName;
  }
  return null;
}

// ---- Step 1: the Onboarding email --------------------------------------
async function sendOnboardingEmail(leadId) {
  const lead = await selectOne('leads', 'id', leadId);
  if (!lead) return { status: 'not_found' };
  if (lead.stage !== 'service_agreement_sent') return { status: 'wrong_stage' };
  if (lead.consent_email_sent_at) return { status: 'already_sent' };

  const who = lead.participant_name || lead.reference || 'participant';
  // Who it goes to (decided 25 Sep 2026): the participant's email; if we
  // only have a phone for them, the referrer's.
  let to = looksLikeEmail((lead.participant_contact || '').trim()) ? lead.participant_contact.trim() : '';
  if (!to && lead.referrer_id) {
    const r = await selectOne('referrers', 'id', lead.referrer_id, 'email');
    if (r && looksLikeEmail((r.email || '').trim())) to = r.email.trim();
  }
  if (!to) {
    await note(leadId, `The Onboarding email couldn't go automatically — there's no email address for ${who} or their referrer. Add one and send it from the onboarding page.`);
    return { status: 'no_email' };
  }

  const staff = lead.onboarding_staff_member || CONTACT_NAME;
  const role = lead.onboarding_staff_role || CONTACT_ROLE;
  let sent;
  try {
    sent = await sendParticipantEmail({
      template: 'consent',
      to,
      merge: {
        'Participant First Name': firstWord(lead.participant_name) || 'there',
        'Staff Member': staff,
        Role: role,
        Service: lead.service_needed || 'Your NDIS supports',
        Date: TBC,
        Schedule: TBC,
        Location: lead.suburb || TBC,
      },
    });
  } catch (err) {
    console.error('automatic onboarding email failed:', err.message);
    await note(leadId, `The Onboarding email didn't send automatically (${err.message}). Send it from the onboarding page.`)
      .catch(() => {});
    return { status: 'failed', error: err.message };
  }

  // Sent — record it the same way the Command Centre's page does.
  const now = nowIso();
  await updateOne('leads', leadId, {
    consent_email_sent_at: now,
    consent_email_to: to,
    onboarding_staff_member: staff,
    onboarding_staff_role: role,
    updated_at: now,
  });
  // Only the "send it" task — a going-ahead outcome can leave others open
  // (e.g. telling the referrer by phone) that still need doing.
  await closeTasks(leadId, ['action_required'], 'Send Onboarding email');
  await task({ subject: `Chase onboarding forms if not back — ${who}`, status: 'pending', lead_id: leadId, due_at: daysFromNow(7) });
  await note(
    leadId,
    `Onboarding email sent automatically to ${to} — "${sent.subject}", with the Referral Form, NDIS Consent form and Service Agreement attached. Signed by ${staff}, ${role}. Chase-up task due in 7 days.`
  );
  await logSent({ kind: 'consent_email', to, name: who, subject: sent.subject, meta: { lead_id: leadId, reference: lead.reference, template: 'consent', automatic: true } });
  return { status: 'sent', to, subject: sent.subject };
}

// ---- Step 2 and 3: forms back, participant, Welcome pack ---------------
async function findLeadForReturn(row) {
  if (row.lead_id) return selectOne('leads', 'id', row.lead_id);
  const from = (row.from_email || '').trim();
  if (!looksLikeEmail(from)) return null;
  for (const col of ['consent_email_to', 'participant_contact']) {
    const [lead] = await selectMany(
      'leads',
      `${col}=ilike.${ilikeExact(from)}&stage=eq.service_agreement_sent&order=created_at.desc&limit=1`
    );
    if (lead) return lead;
  }
  return null;
}

async function processOne(row) {
  const lead = await findLeadForReturn(row);
  if (!lead) {
    await task({ subject: `Forms emailed in by ${row.from_email || 'an unknown sender'} — no onboarding referral matches this address. Check who they belong to.` });
    return { status: 'skipped', result: 'No onboarding referral matches this sender' };
  }
  const who = lead.participant_name || lead.reference || 'participant';
  if (lead.stage !== 'service_agreement_sent') {
    await note(lead.id, `Forms arrived by email from ${row.from_email || 'the participant'}, but this referral is at "${lead.stage}", so nothing was changed.`);
    return { status: 'skipped', result: `Referral is at ${lead.stage}`, leadId: lead.id };
  }

  const incoming = (row.forms || []).filter((k) => FORM_KEYS.includes(k));
  const before = (lead.forms_received || []).filter((k) => FORM_KEYS.includes(k));
  const received = FORM_KEYS.filter((k) => before.includes(k) || incoming.includes(k));
  const missing = FORM_KEYS.filter((k) => !received.includes(k));
  await updateOne('leads', lead.id, { forms_received: received, updated_at: nowIso() });
  await closeTasks(lead.id, ['action_required', 'pending'], 'Chase');
  await note(
    lead.id,
    [
      `Forms received by email from ${row.from_email || 'the participant'}: ${incoming.map(formLabel).join(', ') || 'none recognised'}.`,
      missing.length ? `Still missing: ${missing.map(formLabel).join(', ')}.` : 'All three forms are back.',
    ].join('\n')
  );
  if (missing.length) {
    await task({
      subject: `Chase missing forms — ${who}: ${missing.map(formLabel).join(', ')}`,
      status: 'pending',
      lead_id: lead.id,
      due_at: daysFromNow(3),
    });
    return { status: 'done', result: `Still missing: ${missing.map(formLabel).join(', ')}`, leadId: lead.id };
  }

  // All three are back.
  const manualWelcome = async (why) => {
    await task({ subject: `Send Welcome pack — ${who}`, lead_id: lead.id, due_at: daysFromNow(1) });
    await note(lead.id, `${why} Finish on the onboarding page: Create participant & send Welcome pack.`);
  };
  const d = cleanDetails(row.details);
  let participantId = lead.participant_id;
  let participantNote;
  let changes = [];

  try {
    if (participantId) {
      const p = await selectOne('participants', 'id', participantId, PARTICIPANT_COLUMNS);
      if (p) ({ changes } = await applyDetails(p, d));
      participantNote = changes.length ? 'Participant already linked — details updated from the forms.' : 'Participant already linked — the forms matched what we had.';
    } else {
      const firstName = d.first_name || firstWord(lead.participant_name);
      const familyName = d.first_name ? d.family_name : restWords(lead.participant_name);
      if (!firstName || !d.date_of_birth) {
        await manualWelcome('All three forms are back, but the date of birth couldn\'t be read from them, so the participant wasn\'t created automatically.');
        return { status: 'done', result: 'All forms back; participant not created — no date of birth', leadId: lead.id };
      }
      const fullName = [firstName, familyName].filter(Boolean).join(' ');
      const existing = await findMatchingParticipant({ ndisNumber: d.ndis_number, fullName, dob: d.date_of_birth });
      if (existing) {
        participantId = existing.id;
        ({ changes } = await applyDetails(existing, { ...d, first_name: firstName, family_name: familyName }));
        participantNote = `Linked to the existing participant (ShiftCare ${existing.shiftcare_client_id}) — same ${d.ndis_number ? 'NDIS number' : 'name and date of birth'}, so no duplicate was created.`;
      } else {
        const client = await shiftcare('/v3/clients', 'POST', Object.fromEntries(Object.entries({
          first_name: firstName,
          family_name: familyName || undefined,
          preferred_name: d.preferred_name,
          dob: d.date_of_birth,
          email: d.email,
          mobile_number: d.mobile,
          address: d.address,
          ndis_number: d.ndis_number,
        }).filter(([, v]) => v)));
        if (!client.id) throw new Error('ShiftCare created the client but returned no id');
        const inserted = await insertOne('participants', {
          shiftcare_client_id: client.id,
          full_name: fullName,
          preferred_name: d.preferred_name || null,
          date_of_birth: d.date_of_birth,
          email: d.email || null,
          mobile: d.mobile || null,
          phone: d.phone || null,
          address: d.address || null,
          suburb: d.suburb || lead.suburb || null,
          state: d.state || null,
          postcode: d.postcode || null,
          ndis_number: d.ndis_number || null,
          status: 'active',
        });
        participantId = inserted.id;
        participantNote = `Participant created from the returned forms in ShiftCare (client ${client.id}) and the Participant Directory.`;
      }
      // Linked straight away, so a retry never creates them twice.
      await updateOne('leads', lead.id, { participant_id: participantId, updated_at: nowIso() });
    }
  } catch (err) {
    await manualWelcome(`All three forms are back, but the participant couldn't be created or updated automatically (${err.message}).`);
    return { status: 'error', result: err.message, leadId: lead.id, participantId };
  }

  if (lead.welcome_sent_at) {
    return { status: 'done', result: 'Welcome pack was already sent', leadId: lead.id, participantId };
  }
  const to = [lead.consent_email_to, d.email].find((e) => looksLikeEmail((e || '').trim()));
  const staff = lead.onboarding_staff_member || CONTACT_NAME;
  const role = lead.onboarding_staff_role || CONTACT_ROLE;
  if (!to) {
    await manualWelcome(`${participantNote} No email address to send the Welcome pack to.`);
    return { status: 'done', result: 'Participant ready; no address for the Welcome pack', leadId: lead.id, participantId };
  }
  let sent;
  try {
    sent = await sendParticipantEmail({
      template: 'welcome',
      to,
      merge: { 'Participant First Name': d.preferred_name || d.first_name || firstWord(lead.participant_name) || 'there', 'Staff Member': staff, Role: role },
    });
  } catch (err) {
    await manualWelcome(`${participantNote} The Welcome pack didn't send (${err.message}); the participant won't be created twice.`);
    return { status: 'error', result: `Welcome pack failed: ${err.message}`, leadId: lead.id, participantId };
  }

  const now = nowIso();
  await updateOne('leads', lead.id, {
    welcome_sent_at: now,
    participant_id: participantId,
    onboarding_staff_member: staff,
    onboarding_staff_role: role,
    stage: 'participant_onboarded',
    stage_updated_at: now,
    updated_at: now,
  });
  await closeTasks(lead.id, ['action_required', 'pending']);
  await note(
    lead.id,
    [
      `Welcome pack sent automatically to ${to} — "${sent.subject}", with the four easy-read guides.`,
      participantNote,
      changes.length ? `Updated from the forms:\n${changes.join('\n')}` : null,
      'Stage → Participant Onboarded.',
    ].filter(Boolean).join('\n')
  );
  await logSent({ kind: 'welcome_pack', to, name: who, subject: sent.subject, participantId, meta: { lead_id: lead.id, reference: lead.reference, template: 'welcome', automatic: true } });
  // A reminder, not a gate — everything above has already happened.
  await task({
    subject: `Double-check details from returned forms — ${who}`,
    lead_id: lead.id,
    participant_id: participantId,
    due_at: daysFromNow(1),
  });
  return { status: 'done', result: 'Participant ready and Welcome pack sent', leadId: lead.id, participantId };
}

async function processFormReturns({ id } = {}) {
  const filter = id ? `id=eq.${encodeURIComponent(id)}&` : '';
  const pending = await selectMany('onboarding_form_returns', `${filter}status=eq.pending&order=created_at.asc&limit=10`, 'id');
  const results = [];
  for (const { id: rowId } of pending) {
    // Claim the row, so two calls at once never process it twice.
    const claimed = await rest(`/onboarding_form_returns?id=eq.${encodeURIComponent(rowId)}&status=eq.pending`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'processing' }),
    });
    const row = claimed && claimed[0];
    if (!row) continue;
    let out;
    try {
      out = await processOne(row);
    } catch (err) {
      console.error('onboarding form return failed:', err.message);
      out = { status: 'error', result: err.message };
    }
    await updateOne('onboarding_form_returns', row.id, {
      status: out.status,
      result: out.result || null,
      lead_id: out.leadId || row.lead_id || null,
      participant_id: out.participantId || null,
      processed_at: nowIso(),
    });
    results.push({ id: row.id, ...out });
  }
  return results;
}

module.exports = { sendOnboardingEmail, processFormReturns, FORM_KEYS };
