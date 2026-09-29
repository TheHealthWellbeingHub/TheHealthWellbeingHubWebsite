// Fills and sends the email-templates/ emails. Shared by the hand-send
// endpoint (api/send-participant-email.js) and the automatic onboarding steps
// (api/_lib/onboarding.js), so both send the one approved copy of each
// template with the same fixed attachments.
//
// Merge fields live in the templates as {{Key}} (required) or
// {{Key|fallback}} (optional — the fallback renders if no value is given).
// Required fields are read from the template itself, so the template stays
// the single source of truth for what an email needs.
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../_mail');

const DOCS_DIR = path.join(process.cwd(), 'participant-documents');
const STAFF_DOCS_DIR = path.join(process.cwd(), 'staff-documents');
const TEMPLATES_DIR = path.join(process.cwd(), 'email-templates');

// A mailto because these are one-to-one operational sends from the mailbox —
// there is no subscription-preference page behind them.
const UNSUBSCRIBE_URL = 'mailto:officethehealthwellbeinghub@gmail.com?subject=Unsubscribe';

// Subject defaults to the template's own <title>. Attachments are enforced
// here rather than trusted to callers — the Onboarding email always carries
// all three documents, never a subset (docs/workflow-03-new-participant.md). `required`
// adds keys whose template fallback would read wrongly in that email, e.g.
// "Welcome to the family, the participant".
const TEMPLATES = {
  'referrer-introduction': { file: '01-referrer-introduction.html' },
  'referral-received': { file: '02-referral-received.html' },
  'enquiry-acknowledgement': { file: '03-new-enquiry-acknowledgement.html' },
  consent: {
    file: '04-participant-welcome-onboarding.html',
    // Names the participant because one referrer can receive this for
    // several participants, and identical subjects are indistinguishable.
    subject: "{{Participant First Name}}'s forms and service agreement",
    attachments: [
      'The Health & Well-being Hub - Referral Form (Fillable).pdf',
      'NDIS Consent for Your Information (Fillable).pdf',
      'The Health & Well-being Hub - Service Agreement (Fillable).pdf',
    ],
    required: ['Participant First Name', 'Staff Member', 'Role', 'Service'],
  },
  'appointment-confirmation': { file: '05-appointment-confirmation.html' },
  'support-worker-introduction': { file: '06-support-worker-introduction.html' },
  'feedback-acknowledgement': { file: '07-feedback-acknowledgement.html' },
  'complaint-acknowledgement': { file: '08-complaint-acknowledgement.html' },
  'service-exit': { file: '09-service-cancellation-exit.html' },
  'referral-considering': { file: '10-referral-outcome-considering.html' },
  'referral-declined': { file: '11-referral-outcome-declined.html' },
  welcome: {
    file: '12-welcome-pack.html',
    attachments: [
      'Privacy & Confidentiality (Easy Read Guide).pdf',
      'Feedback & Complaints (Easy Read Guide).pdf',
      'Your Rights & Responsibilities (Easy Read Guide).pdf',
      'Incident Management (Easy Read Guide).pdf',
    ],
    required: ['Participant First Name', 'Staff Member', 'Role'],
  },
  'referral-going-ahead': { file: '13-referral-outcome-going-ahead.html' },
  // For participants whose Consent email went out before it carried the
  // service agreement.
  'service-agreement-followup': {
    file: '13-service-agreement-followup.html',
    subject: 'Sorry, {{Participant First Name}} — your Service Agreement',
    attachments: ['The Health & Well-being Hub - Service Agreement (Fillable).pdf'],
  },
  // Sent to a new support worker, not a participant — its attachment lives
  // in staff-documents/, which is never served on the public site.
  'worker-welcome': {
    file: '14-new-support-worker-welcome.html',
    subject: 'Welcome to the team, {{Worker First Name}}',
    docsDir: STAFF_DOCS_DIR,
    attachments: ['The Health & Well-being Hub - Support Worker Agreement (Fillable).pdf'],
  },
  // Weekly, to each support worker, from the Command Centre
  // (lib/pay-breakdown.js). Its shift and summary lines are repeat blocks.
  'pay-breakdown': {
    file: '15-support-worker-pay-breakdown.html',
    subject: 'Your pay breakdown — {{Week}}',
  },
};

// A block written <!--repeat:Name-->…<!--/repeat:Name--> in a template is
// copied once per row of `merge[Name]` (an array of objects), each copy
// filled from its own row — for lists such as a week's shifts.
const REPEAT_RE = /<!--repeat:([A-Za-z][\w ]*?)-->([\s\S]*?)<!--\/repeat:\1-->/g;
const TOKEN_RE = /\{\{\s*([^{}|]+?)\s*(?:\|([^{}]*))?\}\}/g;
// H&W's own details, filled here rather than by the caller. Templates from
// before 25 Sep name the unsubscribe link `unsubscribe_url`; both work.
const SERVER_TOKENS = {
  'Phone Number': '0433 604 507',
  'Email Address': 'officethehealthwellbeinghub@gmail.com',
  'Unsubscribe Link': UNSUBSCRIBE_URL,
  unsubscribe_url: UNSUBSCRIBE_URL,
};

function looksLikeEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && !/[\r\n]/.test(s);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&middot;/g, '·')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Expands the repeat blocks. Row values are escaped here, braces included,
// because the page is filled again afterwards for the other fields.
function expandRepeats(html, merge, { preview }) {
  const missing = [];
  const out = html.replace(REPEAT_RE, (m, name, block) => {
    let rows = Array.isArray(merge[name]) ? merge[name].filter((r) => r && typeof r === 'object') : [];
    if (!rows.length) {
      if (!preview) {
        missing.push(name);
        return '';
      }
      rows = [{}];
    }
    const keys = requiredKeys(block);
    return rows
      .map((row, i) => {
        const vals = {};
        for (const [k, v] of Object.entries(row)) {
          if (v != null && String(v).trim()) vals[k] = escapeHtml(String(v).trim()).replace(/[{}]/g, (c) => (c === '{' ? '&#123;' : '&#125;'));
        }
        for (const k of keys) {
          if (k in vals) continue;
          if (preview) vals[k] = `[${k}]`;
          else missing.push(`${name} row ${i + 1}: ${k}`);
        }
        return fill(block, vals, { html: true });
      })
      .join('');
  });
  return { html: out, missing };
}

// Keys a template needs from the caller: every token without a fallback.
function requiredKeys(...sources) {
  const keys = new Set();
  for (const src of sources) {
    for (const [, key, fallback] of src.matchAll(TOKEN_RE)) {
      if (fallback === undefined && !(key in SERVER_TOKENS)) keys.add(key);
    }
  }
  return [...keys];
}

// `values` holds caller input already in the target form (HTML-escaped for
// the body, raw for the subject). Fallbacks are template HTML, so the
// subject decodes them.
function fill(src, values, { html }) {
  return src.replace(TOKEN_RE, (m, key, fallback) => {
    if (key in SERVER_TOKENS) return SERVER_TOKENS[key];
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
    if (fallback !== undefined) return html ? fallback : decodeEntities(fallback);
    return m;
  });
}

function htmlToText(html) {
  const body = html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<div style="display:none[\s\S]*?<\/div>/i, '');
  return decodeEntities(
    body
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, label) =>
        href.startsWith('mailto:') || href === '#' ? label : `${label} (${href})`)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h1|h2|h3|tr|li|table)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function templateSpec(template) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, template) ? TEMPLATES[template] : null;
}

// Reads the template and works out what's missing. `preview` fills missing
// fields as [Field Name] instead of leaving the braces.
function prepare({ template, merge, preview = false }) {
  const spec = templateSpec(template);
  if (!spec) throw new Error(`Unknown template — use one of: ${Object.keys(TEMPLATES).join(', ')}`);
  const source = fs.readFileSync(path.join(TEMPLATES_DIR, spec.file), 'utf-8');
  const repeats = expandRepeats(source, merge && typeof merge === 'object' ? merge : {}, { preview });
  const html = repeats.html;
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  const subjectSrc = spec.subject || (title ? title[1].trim() : '');
  const attachments = spec.attachments || [];

  const raw = {};
  for (const [key, v] of Object.entries(merge && typeof merge === 'object' ? merge : {})) {
    if (typeof v === 'string' && v.trim()) raw[key] = v.trim();
  }
  const needed = new Set([...requiredKeys(html, subjectSrc), ...(spec.required || [])]);
  const missing = [...[...needed].filter((k) => !(k in raw)), ...repeats.missing];

  const values = { ...raw };
  if (preview) for (const k of missing) values[k] = `[${k}]`;
  const escaped = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, escapeHtml(v)]));
  const filled = fill(html, escaped, { html: true });
  // Newlines stripped so a merge value can never smuggle in a MIME header.
  const subject = decodeEntities(fill(subjectSrc, values, { html: false })).replace(/[\r\n]+/g, ' ');
  return { spec, html: filled, subject, attachments, needed: [...needed], missing };
}

// Sends for real. Throws with `.missing` when merge values are missing and
// refuses to send any leftover {{braces}}.
async function sendParticipantEmail({ template, to, merge }) {
  if (!looksLikeEmail(to)) throw new Error('Invalid recipient address');
  const p = prepare({ template, merge });
  if (p.missing.length) {
    const err = new Error(`Missing merge values: ${p.missing.join(', ')}`);
    err.missing = p.missing;
    throw err;
  }
  const leftover = [...p.html.matchAll(TOKEN_RE), ...p.subject.matchAll(TOKEN_RE)].map((m) => m[0]);
  if (leftover.length) {
    console.error('unresolved template tokens:', leftover);
    const err = new Error('Template has unresolved tokens');
    err.tokens = leftover;
    throw err;
  }
  await sendEmail({
    to,
    subject: p.subject,
    html: p.html,
    text: htmlToText(p.html),
    attachments: p.attachments.map((name) => ({ path: path.join(p.spec.docsDir || DOCS_DIR, name), filename: name })),
  });
  return { subject: p.subject, attachments: p.attachments };
}

module.exports = { TEMPLATES, looksLikeEmail, templateSpec, prepare, sendParticipantEmail };
