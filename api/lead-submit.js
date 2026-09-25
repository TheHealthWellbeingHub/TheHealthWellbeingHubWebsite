// Vercel serverless function — receives enquiry/referral/feedback/complaint
// form submissions from the website and writes them to Supabase instead of
// HubSpot (retired 21 Sep 2026 — see docs/account-migration.md §6 and
// docs/workflow-build-notes.md). Replaces api/hubspot-submit.js.
//
// Same anti-abuse layer as the file it replaces (origin allowlist, honeypot,
// rate limit — see that file's own comment for what each is actually worth),
// same consent gating, same triage-property mapping and note-building. What's
// different: records go in Supabase's `referrers` / `leads` / `lead_notes` /
// `tasks` / `feedback_submissions` tables, and the acknowledgement email
// sends directly over SMTP (api/_lib/mailer.js) the moment the record is
// written — no more "resubmit to a hidden HubSpot form to trigger a
// workflow" detour, because there is no workflow to trigger any more.
const { insertOne, updateOne, selectOne, selectMany } = require('./_lib/supabase');
const { sendTemplateEmail } = require('./_lib/mailer');

// --- Abuse protection (identical to hubspot-submit.js) --------------------
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://www.thehealthwellbeinghub.com,https://thehealthwellbeinghub.com')
  .split(',').map((o) => o.trim()).filter(Boolean);

const HONEYPOT_FIELD = 'company_website';
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 5);
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
  if (rateLimitBuckets.size > 5000) {
    for (const [key, times] of rateLimitBuckets) {
      if (!times.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) rateLimitBuckets.delete(key);
    }
  }
  return hits.length > max;
}

// --- Triage value mapping (same vocabulary as hubspot-submit.js) ----------
const LANGUAGE_MAP = {
  'English': 'English', 'Arabic': 'Arabic', 'Somali': 'Somali',
  'Dari': 'Dari', 'Amharic': 'Amharic', 'Other': 'Other',
};
const PLAN_TYPE_MAP = {
  'Agency managed': 'Agency-managed', 'Plan managed': 'Plan-managed',
  'Self managed': 'Self-managed', 'Not sure': 'Unknown',
};
const ENQUIRER_ROLE_MAP = {
  'NDIS Participant': 'Participant themselves',
  'Support Coordinator': 'Support coordinator',
  'Plan Manager': 'Plan manager',
  'GP / Health professional': 'Health professional',
  'Other': 'Other',
};
const SERVICE_LINE_MAP = {
  'Support Coordination': 'Support Coordination',
  'Core Supports & Daily Living': 'Core Supports & Daily Living',
  'Community Participation': 'Community Participation',
  'Therapy Services': 'Therapy Services',
};
const REFERRAL_CHANNEL_MAP = {
  'Direct email': 'Direct email', 'Phone call': 'Phone call',
  'Text message': 'Text message', 'In person': 'In person',
  'Came directly': 'Came directly',
};

function normaliseLanguage(value) {
  if (!value) return null;
  const base = String(value).split('—')[0].trim();
  return LANGUAGE_MAP[base] || null;
}

function isAffirmative(v) {
  if (v === true) return true;
  if (typeof v !== 'string') return false;
  return ['on', 'true', 'yes', '1', 'checked'].includes(v.trim().toLowerCase());
}

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

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/);
  return { firstname: parts[0] || '', lastname: parts.slice(1).join(' ') || '' };
}

function referralDateIso(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
}

function referralDateDisplay(d) {
  return d.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Brisbane', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

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

// --- Referrer upsert (replaces HubSpot Contact upsert) ---------------------
// PostgREST ilike treats % and _ as wildcards; escape them so an address
// like first_last@x.com only ever matches itself (case-insensitively).
function ilikeExact(value) {
  return encodeURIComponent(String(value).trim().replace(/[\\%_]/g, (c) => `\\${c}`));
}

async function findReferrer({ email, phone, name, company }) {
  if (looksLikeEmail(email)) {
    const [byEmail] = await selectMany('referrers', `email=ilike.${ilikeExact(email)}&limit=1`);
    if (byEmail) return byEmail;
  }
  if (phone) {
    const byPhone = await selectOne('referrers', 'phone', phone);
    if (byPhone) return byPhone;
  }
  // A referrer given by name only (no email or phone): match the same name
  // at the same organisation, so a repeat referrer isn't added twice.
  if (!looksLikeEmail(email) && !phone && name) {
    const { firstname, lastname } = splitName(name);
    if (firstname) {
      let q = `firstname=ilike.${ilikeExact(firstname)}`;
      q += lastname ? `&lastname=ilike.${ilikeExact(lastname)}` : '&lastname=is.null';
      if (company) q += `&company=ilike.${ilikeExact(company)}`;
      const [byName] = await selectMany('referrers', `${q}&limit=1`);
      if (byName) return byName;
    }
  }
  return null;
}

async function upsertReferrer({ name, email, phone, company, extra = {} }) {
  const existing = await findReferrer({ email, phone, name, company });
  const { firstname, lastname } = splitName(name);
  const properties = { ...extra };
  if (firstname) properties.firstname = firstname;
  if (lastname) properties.lastname = lastname;
  if (email) properties.email = email;
  if (phone) properties.phone = phone;
  if (company) properties.company = company;

  if (existing) {
    if (Object.keys(properties).length) {
      return updateOne('referrers', existing.id, properties);
    }
    return existing;
  }
  return insertOne('referrers', {
    contact_status: 'Needs_first_contact',
    ...properties,
  });
}

// The same referrer re-sending the same participant while that referral is
// still open is continuing the same journey. A different participant from
// the same referrer is a new referral and always gets its own lead.
async function findOpenLeadForReferrer(referrerId, participantName) {
  if (!referrerId || !(participantName || '').trim()) return null;
  const rows = await selectMany(
    'leads',
    `referrer_id=eq.${referrerId}&participant_name=ilike.${ilikeExact(participantName)}` +
      '&stage=not.in.(participant_onboarded,lost_not_suitable)&order=created_at.desc&limit=1'
  );
  return rows[0] || null;
}

// Someone who enquires again while their last enquiry is still open is the
// same enquiry, matched on their email or phone.
async function findOpenEnquiry(email, phone) {
  const open = 'type=eq.enquiry&stage=not.in.(participant_onboarded,lost_not_suitable)&order=created_at.desc&limit=1';
  if (looksLikeEmail(email)) {
    const [byEmail] = await selectMany('leads', `participant_contact=ilike.${ilikeExact(email)}&${open}`);
    if (byEmail) return byEmail;
  }
  if (phone && String(phone).trim()) {
    const [byPhone] = await selectMany('leads', `participant_contact=eq.${encodeURIComponent(String(phone).trim())}&${open}`);
    if (byPhone) return byPhone;
  }
  return null;
}

// A support coordinator, plan manager or health professional who enquires
// is a potential referrer: they're saved as a lead in the Referrers
// directory (contact_type Referral partner, has_referred untouched), with
// their latest enquiry. Never fails the submission.
const PROFESSIONAL_ENQUIRERS = {
  'Support Coordinator': 'Support Coordinator',
  'Plan Manager': 'Plan Manager',
  'GP / Health professional': null,
};
async function saveProfessionalAsLead(f, lead, serviceNeeded) {
  if (!Object.prototype.hasOwnProperty.call(PROFESSIONAL_ENQUIRERS, f.enquirer_role)) return null;
  const email = looksLikeEmail(f.email) ? f.email : '';
  if (!email && !f.phone && !(f.name || '').trim()) return null;
  const role = PROFESSIONAL_ENQUIRERS[f.enquirer_role];
  try {
    return await upsertReferrer({
      name: f.name,
      email,
      phone: f.phone,
      company: f.organisation,
      extra: {
        contact_type: 'Referral partner',
        ...(role ? { referrer_role: role } : { jobtitle: f.enquirer_role }),
        contact_status: 'We_owe_a_reply',
        latest_enquiry_date: new Date().toISOString().slice(0, 10),
        latest_enquiry_reference: lead.reference || null,
        latest_enquiry_service: serviceNeeded || null,
      },
    });
  } catch (err) {
    console.error('professional enquirer save failed:', err.message);
    return null;
  }
}

// Keeps the Referral Partners directory current: how many people this
// partner has referred and the latest one. Never fails the submission.
async function recordReferralOnReferrer(referrerId, lead, serviceNeeded) {
  if (!referrerId) return;
  try {
    const referrals = await selectMany('leads', `referrer_id=eq.${referrerId}&type=eq.referral`, 'id');
    await updateOne('referrers', referrerId, {
      has_referred: true,
      number_of_referred: referrals.length,
      contact_type: 'Referral partner',
      is_active: true,
      latest_referral_date: new Date().toISOString().slice(0, 10),
      latest_referral_reference: lead.reference || null,
      latest_referral_service: serviceNeeded || null,
      latest_referral_participant_name: lead.participant_name || null,
    });
  } catch (err) {
    console.error('referrer referral stats update failed:', err.message);
  }
}

async function createLead(fields) {
  return insertOne('leads', fields);
}

async function createNote(leadId, body) {
  if (!leadId) return null;
  return insertOne('lead_notes', { lead_id: leadId, body });
}

async function createTask({ subject, leadId, referrerId, feedbackSubmissionId }) {
  return insertOne('tasks', {
    subject,
    lead_id: leadId || null,
    referrer_id: referrerId || null,
    feedback_submission_id: feedbackSubmissionId || null,
    due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });
}

function isDirectEntry(f) {
  return f.form_name === 'staff_referral' && !(f.referrer_name || '').trim() && !(f.referrer_email || '').trim();
}

function consentTaskSubject(f, formName, isReturning) {
  const who = f.name || f.participant_name || 'lead';
  if (formName !== 'referral') {
    return `Contact ${isReturning ? 'returning' : 'new'} enquiry: ${who}`;
  }
  if (isDirectEntry(f) || isAffirmative(f.participant_consent_confirmed)) {
    return `Contact participant: ${who}`;
  }
  return `Contact REFERRER — participant consent not confirmed: ${who}`;
}

function buildEnquiryNote(f, sourcePage, campaign) {
  const lines = [
    f.form_name === 'staff_enquiry'
      ? `Enquiry logged by ${f.referral_taken_by || 'staff'}${f.enquiry_channel ? ` (${f.enquiry_channel})` : ''} ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`
      : `Website enquiry submitted ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`,
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

function buildReferralNote(f, sourcePage, campaign, isStaffEntry, contactWasReferrers) {
  const stamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' });
  const lines = [
    isStaffEntry ? `Referral entered by a worker ${stamp}` : `Website referral submitted ${stamp}`,
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
function campaignSummary(utms) {
  if (!utms.utm_campaign && !utms.utm_source) return null;
  const name = utms.utm_campaign || 'untitled campaign';
  const via = [utms.utm_source, utms.utm_medium].filter(Boolean).join(' / ');
  const detail = utms.utm_content ? `, ${utms.utm_content}` : '';
  return via ? `${name} (${via}${detail})` : `${name}${detail}`;
}

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

function submissionPageName(f, req, fallback) {
  const raw = typeof f.page_title === 'string' ? f.page_title : '';
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned) return cleaned.slice(0, 120);
  const uri = submissionPageUri(req, '');
  if (uri) {
    try {
      const path = new URL(uri).pathname.replace(/^\/|\/$/g, '');
      if (!path) return 'Home';
      return path.split('/').join(' — ').replace(/-/g, ' ');
    } catch { /* fall through */ }
  }
  return fallback;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn('rejected submission from disallowed origin:', origin);
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  const ip = clientIp(req);
  const staffEntry = ['staff_referral', 'staff_enquiry'].includes((req.body || {}).form_name);
  if (isRateLimited(ip, staffEntry ? STAFF_RATE_LIMIT_MAX : RATE_LIMIT_MAX)) {
    console.warn('rate limited submission from', ip);
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again shortly.' });
  }

  try {
    const f = req.body || {};

    if (typeof f[HONEYPOT_FIELD] === 'string' && f[HONEYPOT_FIELD].trim() !== '') {
      console.warn('honeypot triggered, discarding submission from', ip);
      return res.status(200).json({ ok: true });
    }
    if (JSON.stringify(f).length > MAX_BODY_BYTES) {
      return res.status(413).json({ ok: false, error: 'Submission too large' });
    }

    // Staff routes: staff_referral / staff_enquiry are the same as the public
    // forms, logged by a worker (Command Centre or Claude) who attests the
    // person was told how their details will be used.
    const isStaffEntry = f.form_name === 'staff_referral' || f.form_name === 'staff_enquiry';
    if (!isAffirmative(isStaffEntry ? f.staff_consent_attested : f.privacy_consent)) {
      console.warn('rejected submission without privacy consent from', ip);
      return res.status(400).json({
        ok: false,
        error: isStaffEntry
          ? `Please confirm you told the ${f.form_name === 'staff_enquiry' ? 'person enquiring' : 'referrer'} how their details will be used.`
          : 'Please confirm you have read the Privacy Policy before submitting.',
      });
    }

    const formName = f.form_name === 'staff_referral'
      ? 'referral'
      : f.form_name === 'staff_enquiry'
        ? 'enquiry'
        : f.form_name || (f.participant_name ? 'referral' : 'enquiry');

    const sourcePage = submissionPageName(f, req, '');
    const sourceUrl = submissionPageUri(req, '');
    const utms = collectUtms(f);
    const campaign = campaignSummary(utms);
    const now = new Date();

    // ---- Feedback / complaint: its own table, no lead -------------------
    if (formName === 'feedback_complaint') {
      const isComplaint = f.submission_type === 'Complaint';
      const submission = await insertOne('feedback_submissions', {
        submission_type: isComplaint ? 'Complaint' : 'Feedback',
        name: f.name || null,
        email: looksLikeEmail(f.email) ? f.email : null,
        phone: f.phone || null,
        relates_to: f.relates_to || null,
        response_wanted: f.response_wanted || null,
        preferred_language: f.preferred_language || null,
        details: f.details || null,
        source_page: sourcePage || null,
        source_page_url: sourceUrl || null,
        utm_source: utms.utm_source || null,
        utm_medium: utms.utm_medium || null,
        utm_campaign: utms.utm_campaign || null,
        utm_content: utms.utm_content || null,
      });
      const reference = `${isComplaint ? 'CMP' : 'FB'}-${now.getFullYear()}-${submission.seq}`;
      // The note lives on the submission itself here — HubSpot used a
      // separate Note object, but there's no lead to attach it to.
      await updateOne('feedback_submissions', submission.id, {
        reference,
        details: buildFeedbackComplaintNote(f, sourcePage, campaign),
      });
      await createTask({
        subject: feedbackComplaintTaskSubject(f),
        feedbackSubmissionId: submission.id,
      });

      let acknowledgementStatus = 'not_applicable';
      if (!looksLikeEmail(f.email)) {
        acknowledgementStatus = 'no_email';
      } else {
        const { firstname } = splitName(f.name);
        const updateByDisplay = referralDateDisplay(addBusinessDaysBrisbane(now, 5));
        try {
          if (isComplaint) {
            await sendTemplateEmail({
              templateFile: '08-complaint-acknowledgement.html',
              to: f.email,
              subjectTemplate: 'We have received your complaint',
              values: {
                'First Name': firstname || 'there',
                'Reference': reference,
                'Date Received': referralDateDisplay(now),
                'Complaint Summary': f.relates_to || 'the matter you raised',
                'Assigned Staff Member': 'our complaints officer',
                'Update Due Date': updateByDisplay,
                'Escalation Contact': 'our Director',
                'unsubscribe_url': 'mailto:officethehealthwellbeinghub@gmail.com?subject=Unsubscribe',
              },
              text: `Hi ${firstname || 'there'},\n\nWe have received your complaint (reference ${reference}). We will provide an update by ${updateByDisplay}.\n\nThe Health & Well-being Hub`,
            });
          } else {
            await sendTemplateEmail({
              templateFile: '07-feedback-acknowledgement.html',
              to: f.email,
              subjectTemplate: 'Thank you for your feedback',
              values: {
                'First Name': firstname || 'there',
                'Reference': reference,
                'Date Received': referralDateDisplay(now),
                'Regarding': f.relates_to || 'your feedback',
                'Assigned Staff Member': 'our team',
                'Response Line': f.response_wanted === 'No'
                  ? 'No response was requested, so no further action is required.'
                  : `We will contact you by ${updateByDisplay} with an update.`,
                'unsubscribe_url': 'mailto:officethehealthwellbeinghub@gmail.com?subject=Unsubscribe',
              },
              text: `Hi ${firstname || 'there'},\n\nThank you for your feedback (reference ${reference}).\n\nThe Health & Well-being Hub`,
            });
          }
          acknowledgementStatus = 'sent';
        } catch (err) {
          acknowledgementStatus = 'failed';
          console.error('ACKNOWLEDGEMENT NOT SENT:', err.message);
          await createTask({
            subject: `ACKNOWLEDGE MANUALLY — automated email failed: ${f.name || f.email}`,
            feedbackSubmissionId: submission.id,
          }).catch((taskErr) => console.error('fallback task failed:', taskErr.message));
        }
      }

      return res.status(200).json({ ok: true, reference, acknowledgementStatus });
    }

    // ---- Referral / enquiry: a lead, optionally a referrer --------------
    let referrer = null;
    let contactBelongsToReferrer = false;
    if (formName === 'referral' && !isDirectEntry(f)) {
      const givenContact = (f.participant_contact || '').trim();
      contactBelongsToReferrer =
        sameContactDetail(givenContact, f.referrer_email) || sameContactDetail(givenContact, f.referrer_phone);
      if (contactBelongsToReferrer) {
        console.warn('participant contact matches the referrer — not written to the participant record');
      }
      const hasReferrerDetail = looksLikeEmail(f.referrer_email) || f.referrer_phone ||
        (f.referrer_name || '').trim() || (f.referrer_organisation || '').trim();
      if (hasReferrerDetail) {
        referrer = await upsertReferrer({
          name: f.referrer_name,
          email: f.referrer_email,
          phone: f.referrer_phone,
          company: f.referrer_organisation,
          extra: {
            contact_type: 'Referral partner',
            referrer_role: f.referrer_role || null,
            contact_status: 'We_owe_a_reply',
          },
        }).catch((err) => {
          console.error('referrer upsert failed:', err.message);
          return null;
        });
      }
    }

    const dealName = formName === 'referral'
      ? (isDirectEntry(f)
          ? `${f.participant_name || 'Participant'} — came to us directly`
          : `${f.participant_name || 'Referral'} — referred by ${f.referrer_name || 'unknown'}`)
      : `${f.name || 'Website enquiry'} — ${f.service_needed || 'General enquiry'}`;

    const participantContact = formName === 'referral'
      ? (contactBelongsToReferrer ? '' : (f.participant_contact || '').trim())
      : null;

    const existingOpenLead = formName === 'referral'
      ? await findOpenLeadForReferrer(referrer && referrer.id, f.participant_name)
      : await findOpenEnquiry(f.email, f.phone);
    const isReturning = !!existingOpenLead;

    const serviceLine = SERVICE_LINE_MAP[(f.service_needed || '').replace('&amp;', '&')] || null;

    let lead = existingOpenLead;
    if (!lead) {
      lead = await createLead({
        type: formName === 'referral' ? 'referral' : 'enquiry',
        participant_name: formName === 'referral' ? (f.participant_name || null) : (f.name || null),
        participant_contact: formName === 'referral' ? (participantContact || null) : (f.email || f.phone || null),
        referrer_id: referrer ? referrer.id : null,
        is_direct_entry: formName === 'referral' ? isDirectEntry(f) : false,
        service_needed: serviceLine || f.service_needed || null,
        plan_management_type: PLAN_TYPE_MAP[f.plan_type] || null,
        suburb: f.suburb || null,
        primary_language: normaliseLanguage(f.preferred_language),
        interpreter_required: f.interpreter_required || null,
        gender_matched_worker: f.gender_matched_worker || null,
        enquirer_role: formName !== 'referral' ? (ENQUIRER_ROLE_MAP[f.enquirer_role] || f.enquirer_role || null) : null,
        referral_details: f.referral_details || null,
        referral_channel: formName === 'referral'
          ? (isStaffEntry ? (REFERRAL_CHANNEL_MAP[f.referral_channel] || null) : 'Website form')
          : null,
        referral_taken_by: isStaffEntry ? (f.referral_taken_by || null) : null,
        consent_capture_method: formName === 'referral'
          ? (isStaffEntry ? 'Recorded by worker' : 'Referrer ticked online')
          : null,
        participant_consent_confirmed: formName === 'referral'
          ? isAffirmative(f.participant_consent_confirmed)
          : null,
        source_page: sourcePage || null,
        source_page_url: sourceUrl || null,
        utm_source: utms.utm_source || null,
        utm_medium: utms.utm_medium || null,
        utm_campaign: utms.utm_campaign || null,
        utm_content: utms.utm_content || null,
      });
      await updateOne('leads', lead.id, { reference: `${formName === 'referral' ? 'REF' : 'ENQ'}-${now.getFullYear()}-${lead.seq}` });
      lead.reference = `${formName === 'referral' ? 'REF' : 'ENQ'}-${now.getFullYear()}-${lead.seq}`;
    }

    if (formName === 'referral' && referrer) {
      await recordReferralOnReferrer(referrer.id, lead, serviceLine || f.service_needed);
    }
    const professionalLead = formName === 'enquiry'
      ? await saveProfessionalAsLead(f, lead, serviceLine || f.service_needed)
      : null;

    const noteBody = formName === 'referral'
      ? buildReferralNote(f, sourcePage, campaign, isStaffEntry, contactBelongsToReferrer)
      : buildEnquiryNote(f, sourcePage, campaign);
    await createNote(lead.id, noteBody);

    await createTask({
      subject: consentTaskSubject(f, formName, isReturning),
      leadId: lead.id,
      referrerId: referrer ? referrer.id : null,
    });

    const reference = lead.reference;

    // ---- Acknowledgement, sent directly, no HubSpot workflow needed -----
    let acknowledgementStatus = 'not_applicable';
    if (formName === 'referral' && referrer && looksLikeEmail(f.referrer_email)) {
      const { firstname } = splitName(f.referrer_name);
      try {
        await sendTemplateEmail({
          templateFile: '02-referral-received.html',
          to: f.referrer_email,
          subjectTemplate: 'Referral received',
          values: {
            'Referrer First Name': firstname || 'there',
            'Participant First Name': splitName(f.participant_name).firstname || 'the participant',
            'Reference': reference,
            'Date Received': referralDateDisplay(now),
            'Service': f.service_needed || 'NDIS supports',
            'unsubscribe_url': 'mailto:officethehealthwellbeinghub@gmail.com?subject=Unsubscribe',
          },
          text: `Hi ${firstname || 'there'},\n\nThank you for referring ${f.participant_name || 'the participant'} to The Health & Well-being Hub. Reference: ${reference}.\n\nThe Health & Well-being Hub`,
        });
        acknowledgementStatus = 'sent';
      } catch (err) {
        acknowledgementStatus = 'failed';
        console.error('ACKNOWLEDGEMENT NOT SENT:', err.message);
        await createTask({
          subject: `ACKNOWLEDGE MANUALLY — automated email failed: ${f.referrer_name || f.referrer_email}`,
          leadId: lead.id,
          referrerId: referrer.id,
        }).catch((taskErr) => console.error('fallback task failed:', taskErr.message));
      }
    }

    if (formName === 'enquiry') {
      if (!looksLikeEmail(f.email)) {
        acknowledgementStatus = 'no_email';
      } else {
        const { firstname } = splitName(f.name);
        try {
          await sendTemplateEmail({
            templateFile: '03-new-enquiry-acknowledgement.html',
            to: f.email,
            subjectTemplate: "We've received your enquiry",
            values: {
              'First Name': firstname || 'there',
              'Service': f.service_needed || 'NDIS supports',
              'Reference': reference,
              'Date Received': referralDateDisplay(now),
              'unsubscribe_url': 'mailto:officethehealthwellbeinghub@gmail.com?subject=Unsubscribe',
            },
            text: `Hi ${firstname || 'there'},\n\nWe've received your enquiry (reference ${reference}). We'll be in touch within 2 business hours.\n\nThe Health & Well-being Hub`,
          });
          acknowledgementStatus = 'sent';
        } catch (err) {
          acknowledgementStatus = 'failed';
          console.error('ACKNOWLEDGEMENT NOT SENT:', err.message);
          await createTask({
            subject: `ACKNOWLEDGE MANUALLY — automated email failed: ${f.name || f.email}`,
            leadId: lead.id,
          }).catch((taskErr) => console.error('fallback task failed:', taskErr.message));
        }
      }
    }

    return res.status(200).json({
      ok: true,
      leadId: lead.id,
      referrerId: referrer ? referrer.id : null,
      reference,
      isReturning,
      acknowledgementStatus,
      savedAsLeadContact: Boolean(professionalLead),
    });
  } catch (err) {
    console.error('lead-submit error:', err.message, err.data || '');
    return res.status(502).json({ ok: false, error: 'Submission failed' });
  }
};
