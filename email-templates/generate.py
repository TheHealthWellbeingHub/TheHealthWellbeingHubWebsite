#!/usr/bin/env python3
"""Generates the nine H&W NDIS email templates + the library index.

Standalone static HTML, no build step at send time (consistent with the
rest of the site) — HubSpot or whatever sends these can pull the raw HTML
directly. Table-based layout and inline-safe styling throughout since
these render inside email clients, not a browser: Outlook in particular
ignores most CSS Grid/Flexbox and much of an external/embedded <style>
block, so structural styling is inlined on every element that matters,
with the <style> block kept only for things safe to lose (hover, media
query font-size tweaks) in clients that strip it.

Merge fields use {{double_brackets}} per the project convention — this is
NOT the same syntax HubSpot's own personalization tokens use, so anything
pasted into HubSpot needs those converted first, not assumed compatible.

Run: python3 generate.py   (writes the sibling .html files in this dir)

WARNING — this generator is no longer the source of truth for every template.
On 24 Aug 2026 templates 01, 02, 03, 04, 05 and 07 were replaced by hand with
designs supplied by the user. Running this script WILL overwrite those six files
and revert them to the generated design. Either port the new designs into the
builders below before running it again, or run it only for the three templates
that are still generated: 06, 08, 09.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

BRAND = {
    "purple": "#7B2D8B",
    "purple_dark": "#5C2068",
    "navy": "#1D3461",
    "green": "#4A7C3F",
    "bg": "#F7F4F7",
    "card": "#FFFFFF",
    "border": "#EADFEC",
    "muted": "#5F6681",
    "phone": "0433 604 507",
    "phone_tel": "+61433604507",
    "whatsapp_url": "https://wa.me/61433604507",
    "email": "thehealthwellbeinghub@gmail.com",
    "address": "73 Jacaranda Avenue, Logan QLD 4114",
    "reg_number": "4050045262",
    "domain": "https://www.thehealthwellbeinghub.com",
}

# Every clinical/operational claim below is written to be reviewed, not
# sent as-is — see the disclaimer baked into FOOTER. Nothing here asserts
# NDIS funding eligibility or what a specific plan covers.

FOOTER = """
      <tr>
        <td style="background:{navy};padding:28px 32px;" bgcolor="{navy}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#C9D2E8;">
                <strong style="color:#ffffff;">The Health &amp; Well-being Hub</strong><br>
                NDIS Registered Provider — Registration #{reg_number}<br>
                {address}<br>
                <a href="tel:{phone_tel}" style="color:#C9D2E8;text-decoration:underline;">{phone}</a>
                &nbsp;·&nbsp;
                <a href="{whatsapp_url}" style="color:#C9D2E8;text-decoration:underline;">WhatsApp</a>
                &nbsp;·&nbsp;
                <a href="mailto:{email}" style="color:#C9D2E8;text-decoration:underline;">{email}</a>
              </td>
            </tr>
            <tr><td style="height:16px;line-height:16px;font-size:1px;">&nbsp;</td></tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8B96B8;border-top:1px solid #2E4270;padding-top:14px;">
                We can respond in English, Arabic, Somali, Dari or Amharic — let us know your preferred language.<br>
                This message was sent to {{{{recipient_email}}}} because you're in contact with The Health &amp; Well-being Hub about NDIS supports.
              </td>
            </tr>
          </table>
        </td>
      </tr>
""".format(**BRAND)

def shell(preheader, eyebrow, title, body_html, cta_label=None, cta_url=None):
    cta_block = ""
    if cta_label and cta_url:
        cta_block = """
              <tr><td style="height:8px;line-height:8px;font-size:1px;">&nbsp;</td></tr>
              <tr>
                <td align="center" style="padding:6px 0 4px;">
                  <a href="{cta_url}" style="display:inline-block;background:{purple};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:999px;">{cta_label}</a>
                </td>
              </tr>
""".format(cta_url=cta_url, cta_label=cta_label, **BRAND)

    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>{title}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body,table,td {{ font-family: Arial, Helvetica, sans-serif; }}
  body {{ margin:0; padding:0; background:{bg}; }}
  .wrap {{ width:100%; background:{bg}; }}
  .card {{ background:{card}; border:1px solid {border}; border-radius:14px; overflow:hidden; }}
  h1 {{ font-family: Georgia, 'Playfair Display', serif; }}
  @media (max-width:620px) {{
    .container {{ width:100% !important; }}
    .px {{ padding-left:20px !important; padding-right:20px !important; }}
  }}
</style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
  <table role="presentation" class="wrap" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="container card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
          <tr>
            <td style="background:linear-gradient(120deg,{purple} 0%,{purple_dark} 100%);background-color:{purple};padding:30px 32px;" bgcolor="{purple}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:15px;color:#ffffff;letter-spacing:.02em;">
                    The Health &amp; Well-being Hub
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:36px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:{purple};padding-bottom:8px;">
                    {eyebrow}
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:{navy};">{title}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#333A4D;">
                    {body_html}
                  </td>
                </tr>
{cta_block}
              </table>
            </td>
          </tr>
{footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""".format(
        title=title, preheader=preheader, eyebrow=eyebrow, body_html=body_html,
        cta_block=cta_block, footer=FOOTER, **BRAND
    )


def p(text):
    return '<p style="margin:0 0 16px;">{}</p>'.format(text)


def info_box(rows_html):
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="background:#F7F1F8;border-radius:10px;margin:4px 0 20px;">'
        '<tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;'
        'line-height:1.8;color:#333A4D;">{}</td></tr></table>'
    ).format(rows_html)


TEMPLATES = []


def add(filename, number, label, subject, preheader, eyebrow, title, body_html, cta=None):
    TEMPLATES.append({
        "filename": filename, "number": number, "label": label, "subject": subject,
        "preheader": preheader,
    })
    cta_label, cta_url = cta if cta else (None, None)
    html = shell(preheader, eyebrow, title, body_html, cta_label, cta_url)
    with open(os.path.join(ROOT, filename), "w") as f:
        f.write(html)


# 01 — Referrer introduction (was ../hw-ndis-referral-email.html, outside
# the directory under a different naming convention — moved in and
# renamed to close that gap the runbook flagged).
add(
    "01-referrer-introduction.html",
    "01", "Referrer introduction",
    subject="Introducing The Health & Well-being Hub — NDIS supports for your clients",
    preheader="A registered NDIS provider for clients who'd value culturally responsive, multilingual support.",
    eyebrow="For referral partners",
    title="A provider for clients who need more than a generic fit",
    body_html=(
        p("Hi {{referrer_first_name}},")
        + p(
            "I wanted to introduce The Health &amp; Well-being Hub, a registered NDIS provider "
            "based in Logan Central. We work across Support Coordination, Core Supports &amp; "
            "Daily Living, Community Participation and Therapy Services, with particular depth "
            "supporting Arabic-, Somali-, Dari- and Amharic-speaking participants and families."
        )
        + p(
            "If you have a client whose plan, culture or family situation hasn't fit well with a "
            "previous provider, we'd welcome the referral — including complex or previously "
            "unsuccessful matches."
        )
        + info_box(
            "Registration&nbsp;#{{reg_number}} · All plan types accepted (agency, plan or self-managed) "
            "· Response within 2 business hours · Gender-matched workers on request"
        )
        + p("Happy to talk through a specific client, or send more detail on any service line.")
    ),
    cta=("Send a referral", "{{referral_form_url}}"),
)

# 02 — Referral received
add(
    "02-referral-received.html",
    "02", "Referral received",
    subject="We've received your referral for {{participant_first_name}}",
    preheader="Thanks for the referral — here's what happens next.",
    eyebrow="Referral received",
    title="Thanks — we've received this referral",
    body_html=(
        p("Hi {{referrer_first_name}},")
        + p(
            "This confirms we've received your referral for {{participant_first_name}} "
            "{{participant_last_name}}. A member of our team will review it and reach out "
            "directly within 2 business hours."
        )
        + info_box(
            "Referral date: {{referral_date}}<br>"
            "Service requested: {{service_requested}}<br>"
            "Reference: {{referral_reference}}"
        )
        + p(
            "If there's anything urgent we should know before we make contact, reply to this "
            "email or call us directly."
        )
    ),
    cta=("Call us", "tel:+61433604507"),
)

# 03 — New enquiry acknowledgement
add(
    "03-new-enquiry-acknowledgement.html",
    "03", "New enquiry",
    subject="Thanks for reaching out to The Health & Well-being Hub",
    preheader="We've got your enquiry and will be in touch within 2 business hours.",
    eyebrow="Enquiry received",
    title="Thanks for getting in touch, {{first_name}}",
    body_html=(
        p("We've received your enquiry and someone from our team will contact you within "
          "2 business hours — sooner if it's urgent.")
        + p(
            "You don't need an NDIS number to start the conversation. If you'd prefer to speak "
            "in Arabic, Somali, Dari or Amharic, let us know and we'll connect you with a team "
            "member who speaks it."
        )
        + info_box(
            "What you asked about: {{enquiry_topic}}<br>"
            "Best way to reach you: {{preferred_contact_method}}"
        )
        + p("In the meantime, feel free to call, WhatsApp or reply to this email with any more detail.")
    ),
    cta=("WhatsApp us", "{{whatsapp_url}}"),
)

# 04 — Welcome and onboarding
add(
    "04-participant-welcome-onboarding.html",
    "04", "Welcome and onboarding",
    subject="Welcome to The Health & Well-being Hub, {{participant_first_name}}",
    preheader="Here's your key contact and what to expect as we get started.",
    eyebrow="Welcome",
    title="Welcome, {{participant_first_name}}",
    body_html=(
        p(
            "We're glad to have you with us. This email introduces your key contact and what "
            "to expect over the next few weeks as we get your supports underway."
        )
        + info_box(
            "Your key contact: {{coordinator_name}}<br>"
            "Direct contact: {{coordinator_phone}} · {{coordinator_email}}<br>"
            "Services starting: {{services_starting}}<br>"
            "First session: {{first_session_date}}"
        )
        + p("<strong>Documents we may need from you:</strong>")
        + p("{{required_documents_list}}")
        + p(
            "If anything here doesn't match what you expected, or you'd like to go through this "
            "in Arabic, Somali, Dari or Amharic, just reply or call — we're easy to reach."
        )
    ),
    cta=("Contact your coordinator", "mailto:{{coordinator_email}}"),
)

# 05 — Appointment confirmation
add(
    "05-appointment-confirmation.html",
    "05", "Appointment confirmation",
    subject="Confirmed: {{appointment_type}} on {{appointment_date}}",
    preheader="Your appointment is confirmed — details and how to prepare below.",
    eyebrow="Appointment confirmed",
    title="Your appointment is confirmed",
    body_html=(
        p("Hi {{participant_first_name}},")
        + p("This confirms your upcoming appointment:")
        + info_box(
            "Type: {{appointment_type}}<br>"
            "With: {{provider_name}}<br>"
            "Date &amp; time: {{appointment_date}}, {{appointment_time}}<br>"
            "Location: {{appointment_location}}"
        )
        + p("<strong>Before your appointment:</strong> {{preparation_notes}}")
        + p(
            "Need to reschedule? Reply to this email or call us as soon as you can so we can "
            "offer the time to someone else."
        )
    ),
    cta=("Reschedule or cancel", "{{reschedule_url}}"),
)

# 06 — Support-worker introduction (label/filename now match — was
# "TEMPLATE 06" pointing at a "07-*" file)
add(
    "06-support-worker-introduction.html",
    "06", "Support-worker introduction",
    subject="Meet {{support_worker_name}} — your support worker",
    preheader="Introducing your support worker ahead of your first session together.",
    eyebrow="Support worker introduction",
    title="Meet {{support_worker_name}}",
    body_html=(
        p("Hi {{participant_first_name}},")
        + p(
            "Ahead of your first session, we wanted to introduce {{support_worker_name}}, who'll "
            "be supporting you with {{support_type}}."
        )
        + info_box(
            "Support worker: {{support_worker_name}}<br>"
            "Languages: {{support_worker_languages}}<br>"
            "First session: {{first_session_date}}, {{first_session_time}}<br>"
            "Location: {{session_location}}"
        )
        + p(
            "If you'd prefer a different gender match or have any other preference, let us know "
            "before the first session and we'll do our best to accommodate it."
        )
    ),
    cta=("Any questions? Contact us", "tel:+61433604507"),
)

# 07 — Feedback acknowledgement (was "TEMPLATE 07" -> filename 08-*)
add(
    "07-feedback-acknowledgement.html",
    "07", "Feedback acknowledgement",
    subject="Thank you for your feedback",
    preheader="We've received your feedback and here's what happens next.",
    eyebrow="Feedback received",
    title="Thank you for telling us",
    body_html=(
        p("Hi {{first_name}},")
        + p(
            "Thank you for taking the time to share your feedback. We take all feedback "
            "seriously, whether it's a compliment we can pass on to the team or something we "
            "need to improve."
        )
        + info_box(
            "Feedback reference: {{feedback_reference}}<br>"
            "Date received: {{feedback_date}}<br>"
            "What happens next: {{next_step_description}}"
        )
        + p(
            "If you'd like to discuss this further or add anything, reply to this email or call "
            "us directly — we're glad to talk it through in whichever language is easiest for you."
        )
    ),
)

# 08 — Complaint acknowledgement (was "TEMPLATE 08" -> filename 09-*)
add(
    "08-complaint-acknowledgement.html",
    "08", "Complaint acknowledgement",
    subject="We've received your complaint — reference {{complaint_reference}}",
    preheader="Your complaint has been received. Here's what happens next and your rights.",
    eyebrow="Complaint received",
    title="We've received your complaint",
    body_html=(
        p("Hi {{first_name}},")
        + p(
            "This confirms we've received your complaint and it's being looked into. We take "
            "every complaint seriously and you have the right to raise concerns without it "
            "affecting your supports."
        )
        + info_box(
            "Reference: {{complaint_reference}}<br>"
            "Date received: {{complaint_date}}<br>"
            "Expected response by: {{response_due_date}}<br>"
            "Handled by: {{complaint_handler_name}}"
        )
        + p(
            "You can also raise this directly with the NDIS Quality and Safeguards Commission "
            "at any time — we can give you those details if you'd like them."
        )
    ),
    cta=("Talk to us about this", "tel:+61433604507"),
)

# 09 — Cancellation or exit (was "TEMPLATE 09" -> filename 10-*)
add(
    "09-service-cancellation-exit.html",
    "09", "Cancellation or exit",
    subject="Confirming the end of {{service_name}} with us",
    preheader="Confirming service-end arrangements and what happens with your information.",
    eyebrow="Service ending",
    title="Confirming this service is ending",
    body_html=(
        p("Hi {{participant_first_name}},")
        + p(
            "This confirms {{service_name}} with The Health &amp; Well-being Hub will end on "
            "{{end_date}}. We want to make sure the transition is smooth, wherever your supports "
            "continue from here."
        )
        + info_box(
            "Service ending: {{service_name}}<br>"
            "Last day of support: {{end_date}}<br>"
            "Reason recorded: {{exit_reason}}<br>"
            "Handover contact (if applicable): {{handover_contact}}"
        )
        + p(
            "If you're moving to a new provider, let us know if there's anything you'd like us "
            "to pass on to make that handover easier. And if anything changes, you're always "
            "welcome to come back."
        )
    ),
    cta=("Speak to someone about this", "tel:+61433604507"),
)


def build_index():
    cards = []
    for t in TEMPLATES:
        cards.append(
            '<a class="card" href="{filename}">'
            '<span class="number">TEMPLATE {number}</span>'
            '<h2>{label}</h2>'
            '<p>{subject}</p>'
            '</a>'.format(**t)
        )
    html = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>H&amp;W NDIS Email Template Library</title>
  <style>
    *{{box-sizing:border-box}}body{{margin:0;background:#f7f4f7;color:#1D3461;font-family:Arial,Helvetica,sans-serif}}
    .hero{{padding:54px 22px;text-align:center;background:linear-gradient(120deg,#f8eff8,#f7f5ee,#f0f7e8)}}
    .hero h1{{margin:0;font:700 38px/1.2 Georgia,serif}}
    .hero p{{margin:14px auto 0;max-width:660px;color:#5f6681;line-height:1.6}}
    .grid{{width:100%;max-width:1000px;margin:0 auto;padding:34px 20px 60px;display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}}
    .card{{display:block;padding:22px;border:1px solid #eadfec;border-radius:14px;background:#fff;color:#1D3461;text-decoration:none;box-shadow:0 5px 18px rgba(37,54,90,.06)}}
    .card:hover{{border-color:#7B2D8B;transform:translateY(-1px)}}
    .number{{font-size:11px;font-weight:700;letter-spacing:.8px;color:#7B2D8B}}
    .card h2{{margin:8px 0 7px;font:700 20px/1.3 Georgia,serif}}
    .card p{{margin:0;color:#6c7185;font-size:13px;line-height:1.5}}
    .note{{max-width:960px;margin:0 auto;padding:0 20px 30px;color:#6c7185;font-size:13px;line-height:1.6;text-align:center}}
  </style>
</head>
<body>
  <div class="hero"><h1>H&amp;W Email Template Library</h1><p>Nine responsive, branded NDIS email templates. Open any template to preview it, then replace the fields shown in double brackets before sending.</p></div>
  <main class="grid">
    {cards}
  </main>
  <p class="note">Operational and compliance wording should be reviewed against H&amp;W&rsquo;s approved policies, service agreement and current NDIS requirements before production use. Numbering has been straightened out so every label now matches its filename — template 01 also moved into this directory (it previously lived one level up under a different naming convention).</p>
</body>
</html>
""".format(cards="\n    ".join(cards))
    with open(os.path.join(ROOT, "index.html"), "w") as f:
        f.write(html)


if __name__ == "__main__":
    build_index()
    print("Wrote index.html + {} templates".format(len(TEMPLATES)))
