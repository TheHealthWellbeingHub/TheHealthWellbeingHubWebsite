#!/usr/bin/env python3
"""Builds index.html by reading the templates already in this directory.

WHAT CHANGED, AND WHY IT MATTERS
--------------------------------
This replaces generate.py, which used to *write* the template HTML from
Python. It no longer does, and nothing should: on 24 Aug 2026 the templates
were redesigned outside this repo and supplied as finished HTML. Those files
are now the source of truth.

Leaving generate.py in place would have been the dangerous option. It still
held the old design, so the next person to run it — reasonably, since its own
docstring told them to — would have silently overwritten every approved
template with the superseded design and reverted the merge fields. A generator
that no longer matches its output is a loaded gun, not a convenience.

So the direction is inverted. This script only reads the templates and rebuilds
the index from them. Edit a template by editing its HTML.

Run: python3 build_index.py
"""
import html
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))

# Labels are keyed by filename so the index cannot drift from what is on disk —
# the exact failure the runbook recorded, where display labels stopped matching
# the files they pointed at. A template with no entry here still appears, using
# its own <title>, rather than being silently dropped from the library.
LABELS = {
    "01-referrer-introduction.html": "Referrer introduction",
    "02-referral-received.html": "Referral received",
    "03-new-enquiry-acknowledgement.html": "New enquiry acknowledgement",
    "04-participant-welcome-onboarding.html": "Consent email",
    "05-appointment-confirmation.html": "Appointment confirmation",
    "06-support-worker-introduction.html": "Support worker introduction",
    "07-feedback-acknowledgement.html": "Feedback acknowledgement",
    "08-complaint-acknowledgement.html": "Complaint acknowledgement",
    "09-service-cancellation-exit.html": "Service cancellation and exit",
    "10-referral-outcome-considering.html": "Referral outcome — still deciding",
    "11-referral-outcome-declined.html": "Referral outcome — not proceeding",
    "12-welcome-pack.html": "Welcome email",
    "13-referral-outcome-going-ahead.html": "Referral outcome — going ahead",
}

TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S | re.I)
PREHEADER_RE = re.compile(
    r'<div style="display:none[^"]*">(.*?)</div>', re.S | re.I
)


def read_template(filename):
    with open(os.path.join(ROOT, filename), encoding="utf-8") as f:
        raw = f.read()
    title = TITLE_RE.search(raw)
    pre = PREHEADER_RE.search(raw)
    return {
        "filename": filename,
        "number": filename[:2],
        "label": LABELS.get(filename, title.group(1).strip() if title else filename),
        # The preheader is the one line already written to summarise the email,
        # so the index reuses it instead of inventing a second description that
        # would then need keeping in sync.
        "summary": html.unescape(pre.group(1).strip()) if pre else "",
    }


def collect():
    names = sorted(
        n for n in os.listdir(ROOT)
        if re.match(r"^\d{2}-.*\.html$", n)
    )
    return [read_template(n) for n in names]


def build_index(templates):
    cards = "\n    ".join(
        '<a class="card" href="{filename}">'
        '<span class="number">TEMPLATE {number}</span>'
        '<h2>{label}</h2>'
        '<p>{summary}</p>'
        '</a>'.format(
            filename=t["filename"], number=t["number"],
            label=html.escape(t["label"]), summary=html.escape(t["summary"]),
        )
        for t in templates
    )
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>H&amp;W NDIS Email Template Library</title>
  <style>
    *{{box-sizing:border-box}}body{{margin:0;background:#f7f4f7;color:#273963;font-family:Arial,Helvetica,sans-serif}}
    .hero{{padding:54px 22px;text-align:center;background:linear-gradient(120deg,#f8eff8,#f7f5ee,#f0f7e8)}}
    .hero h1{{margin:0;font:700 38px/1.2 Georgia,serif}}
    .hero p{{margin:14px auto 0;max-width:660px;color:#5f6681;line-height:1.6}}
    .grid{{width:100%;max-width:1000px;margin:0 auto;padding:34px 20px 60px;display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}}
    .card{{display:block;padding:22px;border:1px solid #eee7ef;border-radius:14px;background:#fff;color:#273963;text-decoration:none;box-shadow:0 5px 18px rgba(37,54,90,.06)}}
    .card:hover{{border-color:#85288d}}
    .number{{font-size:11px;font-weight:700;letter-spacing:.8px;color:#85288d}}
    .card h2{{margin:8px 0 7px;font:700 20px/1.3 Georgia,serif}}
    .card p{{margin:0;color:#6c7185;font-size:13px;line-height:1.5}}
    .note{{max-width:960px;margin:0 auto;padding:0 20px 44px;color:#6c7185;font-size:13px;line-height:1.6;text-align:center}}
  </style>
</head>
<body>
  <div class="hero"><h1>H&amp;W Email Template Library</h1><p>{count} responsive, branded NDIS email templates. Open any template to preview it, then replace the fields shown in double brackets before sending.</p></div>
  <main class="grid">
    {cards}
  </main>
  <p class="note">These files are hand-authored and are the source of truth — edit the HTML directly, then re-run <code>build_index.py</code> to refresh this page. Operational and compliance wording should be reviewed against H&amp;W&rsquo;s approved policies, service agreement and current NDIS requirements before production use.</p>
</body>
</html>
""".format(cards=cards, count=len(templates))


if __name__ == "__main__":
    templates = collect()
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(build_index(templates))
    print("Wrote index.html from {} templates on disk".format(len(templates)))
    missing = [t["filename"] for t in templates if t["filename"] not in LABELS]
    if missing:
        print("No label entry (using <title> instead): " + ", ".join(missing))
