# -*- coding: utf-8 -*-
"""
Build a branded, fillable (AcroForm) PDF of the NDIS Service Agreement
for The Health & Well-being Hub (participant-facing).

Same rendering engine/design system as build_agreement.py (the NDIS Support
Worker Agreement), extended with checkboxes and simple fillable tables for
the Schedule of Supports.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "hw-fonts")
OUT_PATH = os.path.join(HERE, "..", "NDIS Service Agreement (Fillable).pdf")

# ---------------------------------------------------------------------------
# Fonts
# ---------------------------------------------------------------------------
pdfmetrics.registerFont(TTFont("Playfair", os.path.join(FONT_DIR, "PlayfairDisplay-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Playfair-Bold", os.path.join(FONT_DIR, "PlayfairDisplay-Bold.ttf")))
pdfmetrics.registerFont(TTFont("DMSans", os.path.join(FONT_DIR, "DMSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("DMSans-Medium", os.path.join(FONT_DIR, "DMSans-Medium.ttf")))
pdfmetrics.registerFont(TTFont("DMSans-Bold", os.path.join(FONT_DIR, "DMSans-Bold.ttf")))

pdfmetrics.registerFontFamily(
    "Playfair", normal="Playfair", bold="Playfair-Bold", italic="Playfair", boldItalic="Playfair-Bold"
)
pdfmetrics.registerFontFamily(
    "DMSans", normal="DMSans", bold="DMSans-Bold", italic="DMSans", boldItalic="DMSans-Bold"
)

# ---------------------------------------------------------------------------
# Brand palette (matches build_agreement.py)
# ---------------------------------------------------------------------------
PURPLE = HexColor("#7B2D8B")
PURPLE_DARK = HexColor("#5C2068")
PURPLE_LIGHT = HexColor("#9B4DAB")
PURPLE_TINT = HexColor("#F5EDF8")
PURPLE_TINT2 = HexColor("#EAD8F0")
NAVY = HexColor("#1D3461")
NAVY_DARK = HexColor("#122040")
GREEN = HexColor("#4A7C3F")
GREEN_TINT = HexColor("#EAF3DE")
BODY = HexColor("#1a1a2e")
MUTED = HexColor("#5a5a7a")
HAIRLINE = HexColor("#E8E0ED")
WHITE = HexColor("#ffffff")
OFFWHITE = HexColor("#FAFAFA")
CREAM = HexColor("#F7EFE0")

# ---------------------------------------------------------------------------
# Page geometry
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = A4
MARGIN_L = 20 * mm
MARGIN_R = 20 * mm
MARGIN_TOP = 20 * mm
MARGIN_BOTTOM = 22 * mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

FOOTER_TEXT = (
    "The Health & Well-being Hub · NDIS Registered Provider #4050045262 · "
    "73 Jacaranda Avenue, Logan Central QLD 4114 · 0433 604 507"
)

BODY_SIZE = 10.2
BODY_LEADING = 14.6
BULLET_INDENT = 5.5 * mm


def wrap_text(text, font, size, max_width):
    words = text.split()
    lines = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(trial, font, size) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


# ---------------------------------------------------------------------------
# Document model
# ---------------------------------------------------------------------------
class Doc:
    def __init__(self):
        self.items = []

    def section(self, number, title):
        self.items.append(("section", number, title))

    def subheading(self, text):
        self.items.append(("subheading", text))

    def para(self, text, bold=False, space_after=3.2 * mm):
        self.items.append(("para", text, bold, space_after))

    def note(self, text):
        self.items.append(("note", text))

    def bullet(self, text):
        self.items.append(("bullet", text))

    def field_line(self, label, field_name, width=95 * mm, height=6.6 * mm):
        self.items.append(("field", label, field_name, width, height))

    def static_line(self, label, value):
        self.items.append(("staticline", label, value))

    def checkbox(self, text, field_name):
        self.items.append(("checkbox", text, field_name))

    def table(self, headers, widths, rows_count, field_prefix, row_h=7.4 * mm):
        self.items.append(("table", headers, widths, rows_count, field_prefix, row_h))

    def spacer(self, h):
        self.items.append(("spacer", h))

    def callout_start(self, tint):
        self.items.append(("callout_start", tint))

    def callout_end(self):
        self.items.append(("callout_end",))

    def signature_block(self, heading, rows):
        self.items.append(("sig_block", heading, rows))


# ---------------------------------------------------------------------------
# Build content
# ---------------------------------------------------------------------------
doc = Doc()

doc.para(
    "This document is an Agreement that relates to the provision of supports that the "
    "National Disability Insurance Scheme (NDIS) has agreed to pay for, as well as any "
    "additional NDIS-like supports not funded by the NDIS.",
    space_after=4.5 * mm,
)

# ---- 1. PARTIES -----------------------------------------------------------
doc.section("1", "Parties")
doc.para(
    "This Service Agreement (“Agreement”) is for the participant named below, "
    "a participant in the NDIS, and is made between:"
)
doc.field_line("Participant Name", "participant_name", width=110 * mm)
doc.static_line("“You”", "the Participant / Participant's representative (if involved)")
doc.field_line("Representative Name (if applicable)", "representative_name", width=100 * mm)
doc.spacer(1.5 * mm)
doc.static_line("And", "The Health and Wellbeing Hub — “the Provider”")
doc.spacer(2.5 * mm)
doc.field_line("Agreement Commencement Date", "commencement_date", width=60 * mm)
doc.field_line("Service Period — Start Date", "period_start", width=60 * mm)
doc.field_line("Service Period — End Date", "period_end", width=60 * mm)
doc.spacer(1.5 * mm)

# ---- 2. THE NDIS AND THIS SERVICE AGREEMENT --------------------------------
doc.section("2", "The NDIS and This Service Agreement")
doc.para(
    "This Service Agreement is made for the purpose of providing supports to you under "
    "your NDIS plan."
)
doc.para(
    "You and The Health and Wellbeing Hub both agree that this Agreement is consistent "
    "with the aims and policies of the NDIS, especially the aim to give Participants more "
    "choice about what support they need to achieve their goals and take part in the "
    "community."
)

# ---- 3. SUPPORTS -----------------------------------------------------------
doc.section("3", "Supports The Health and Wellbeing Hub Will Provide the Participant")
doc.para(
    "The Health and Wellbeing Hub agrees to provide you with supports in line with your "
    "NDIS plan, as set out in the attached Schedule of Supports. All prices are GST "
    "inclusive (if applicable) and include the cost of providing the supports."
)
doc.para(
    "Additional expenses (things that are not funded in your NDIS plan) are listed "
    "separately in your Schedule of Supports. Examples of non-NDIS funded expenses "
    "include — transport, meals, tickets, fares, fees etc."
)
doc.para(
    "Any additional NDIS-like supports you wish The Health and Wellbeing Hub to provide "
    "that are not funded in your NDIS plan will be your responsibility to pay."
)
doc.para(
    "On signing this Agreement, both parties agree to jointly make (or amend) a Service "
    "Booking on the NDIA portal so that The Health and Wellbeing Hub can commence "
    "providing supports on the date agreed. If it is not possible to sign the agreement, "
    "both parties agree to accept the Service Booking within a further 48 hours or advise "
    "the other of their intention not to accept the booking. This may result in the "
    "Service Agreement being amended or cancelled."
)

# ---- 4. RESPONSIBILITIES OF THE PROVIDER -----------------------------------
doc.section("4", "Responsibilities of the Provider")
doc.para("The Health and Wellbeing Hub agrees to:", space_after=1.6 * mm)
for b in [
    "provide you with the supports we have agreed to provide, at the agreed time, and in "
    "a manner consistent with all relevant laws, including the National Disability "
    "Insurance Scheme Act 2013 and rules, and the Australian Consumer Law;",
    "treat you politely and with respect and involve you in all decisions about how "
    "supports are provided;",
    "ensure our support staff are qualified and skilled in providing the supports you need;",
    "keep our scheduled appointments with you, or give you a minimum of 48 hours’ "
    "notice (or as much notice as possible) if we need to make a change to a scheduled "
    "appointment;",
    "review the provision of supports with you, at least every 6 months;",
    "listen to your feedback on how well we are doing so we can resolve problems quickly "
    "and continually improve the services provided to you;",
    "protect your privacy and make sure your personal information is safe and secure;",
]:
    doc.bullet(b)
doc.note(
    "We will clearly explain to you how we do this and will ask you for your consent to "
    "share your information (there may be times we are legally required to do this)."
)
for b in [
    "be honest with you if you want us to provide support that we believe another "
    "organisation may be better suited to provide, or where there is a potential or "
    "actual conflict with NDIA policies;",
]:
    doc.bullet(b)
doc.note(
    "We will always inform you of any situation where The Health and Wellbeing Hub has a "
    "potential conflict of interest so that you can make an informed decision in relation "
    "to your supports."
)
for b in [
    "keep accurate records on the supports we provide you and charge you correctly for "
    "the services we provide;",
    "ensure you have access to details of services delivered (e.g. through myplace) and "
    "the amount charged for those services as per the Terms of Business for Registered "
    "Providers; and",
    "explain our Cancellation Policy to you and give you information about how we manage "
    "complaints about our service or activate our cancellation policy (see section 9 below).",
]:
    doc.bullet(b)

# ---- 5. RESPONSIBILITIES OF THE PARTICIPANT --------------------------------
doc.section("5", "Responsibilities of the Participant / Participant's Representative")
doc.para(
    "When you sign this Service Agreement, it means that you agree to do the following "
    "things:",
    space_after=1.6 * mm,
)
for b in [
    "let The Health and Wellbeing Hub know about the supports you need and how you want "
    "to receive them;",
    "provide The Health and Wellbeing Hub with a copy of your NDIS plan so we can "
    "understand your goals and support needs and make plans to provide those supports;",
    "be polite and respectful to The Health and Wellbeing Hub staff;",
    "keep your scheduled appointments with us, or let us know if you can’t keep them "
    "or need to change arrangements. Under the current NDIS Pricing Arrangements and "
    "Price Limits, if 7 business days’ notice is not given, then the full fee may be "
    "charged (please see Cancellation clause);",
    "talk to us if you are unhappy with any part of our support services, or our support "
    "staff, as soon as you can;",
    "tell us if you change your contact details, like your phone number or address, as "
    "soon as possible;",
    "tell us if your NDIS plan changes or if you stop using the NDIS;",
    "pay The Health and Wellbeing Hub invoices within 14 days if you are self-managing "
    "funding for supports or request your Plan Nominee to do so; and",
    "give us 28 days’ notice if you no longer want The Health and Wellbeing Hub to "
    "provide you with support, or if you wish to change or end our Service Agreement.",
]:
    doc.bullet(b)

# ---- 6. PAYMENTS ------------------------------------------------------------
doc.section("6", "Payments")
doc.para(
    "The Health and Wellbeing Hub will seek payment for the supports we have provided to "
    "you after we have provided them, and once you have agreed that you received those "
    "supports."
)
doc.para(
    "Select which one or more of the following applies by ticking the relevant box(es) "
    "and completing the fields as appropriate.",
    space_after=1.8 * mm,
)
doc.checkbox(
    "You have nominated the NDIA to manage the funding for supports provided under this "
    "Service Agreement. After providing those supports, The Health and Wellbeing Hub "
    "will claim payment for those supports from the NDIA.",
    "pay_ndia_managed",
)
doc.para("AND / OR", bold=True, space_after=2.4 * mm)
doc.checkbox(
    "You have chosen to self-manage the funding for some or all your NDIS supports "
    "provided under this Service Agreement. The Health and Wellbeing Hub will provide "
    "you with an invoice for the supports we have provided you. You agree to pay The "
    "Health and Wellbeing Hub invoices within 14 days of receiving the invoice, by:",
    "pay_self_managed",
)
doc.field_line("Payment Method (cheque / cash / EFT)", "pay_self_managed_method", width=80 * mm)
doc.para("OR", bold=True, space_after=2.4 * mm)
doc.checkbox(
    "Your Plan Nominee manages the funding for NDIS supports provided under this Service "
    "Agreement. After providing those supports, The Health and Wellbeing Hub will send "
    "your Nominee an invoice for payment (contact details in Section 12). Your Nominee "
    "will pay the invoice within 14 days of receiving it, by:",
    "pay_nominee_managed",
)
doc.field_line("Plan Nominee Name", "pay_nominee_name", width=90 * mm)
doc.field_line("Payment Method (cash / cheque / EFT)", "pay_nominee_method", width=80 * mm)
doc.para("OR", bold=True, space_after=2.4 * mm)
doc.checkbox(
    "Your Plan Management Provider manages the funding for NDIS supports provided under "
    "this Service Agreement. After providing those supports, The Health and Wellbeing "
    "Hub will send your Plan Management Provider an invoice for payment (contact details "
    "in Section 12). They will pay the invoice within 14 days of receiving it, by:",
    "pay_plan_manager_managed",
)
doc.field_line("Plan Management Provider Name", "pay_plan_manager_name", width=90 * mm)
doc.field_line("Payment Method (cash / cheque / EFT)", "pay_plan_manager_method", width=80 * mm)
doc.spacer(1 * mm)
doc.para(
    "The Health and Wellbeing Hub will seek payment for any additional supports we have "
    "provided or expenses incurred that are not funded on your NDIS plan. You agree "
    "expenses will be invoiced to you, your Plan Nominee or your Plan Management "
    "Provider and will be paid within 14 days of receiving the invoice, by:",
    space_after=1.6 * mm,
)
doc.field_line("Payment Method for Additional Expenses", "pay_additional_method", width=90 * mm)

doc.subheading("Establishment Fee")
doc.para(
    "This fee applies to all new NDIS participants in their first plan where they "
    "receive at least 20 hours of personal care/community access support per month. "
    "This payment is to cover non-ongoing costs for The Health and Wellbeing Hub to "
    "establish arrangements and assist you in implementing your plan."
)
doc.para(
    "The establishment fee is claimable by the provider who assists the participant "
    "with the implementation of their NDIS Plan, delivers a minimum of 20 hours per "
    "month of personal care/community access support and has made an agreement with the "
    "participant to supply these services. Should this fee be applicable to this service "
    "agreement, the establishment fee will be itemised in the Schedule of Supports, and "
    "the fee in line with the NDIS Pricing Arrangements and Price Limits."
)

doc.subheading("Travel and Transport")
doc.para(
    "The Health and Wellbeing Hub may claim travel costs against your NDIS Plan to "
    "provide your service, however this must be with your agreement. Any transport "
    "costs to be claimed as part of your services will be clearly specified."
)
doc.para(
    "When providing community access supports, The Health and Wellbeing Hub may claim "
    "the cost of time spent accompanying and/or transporting you in the community. If we "
    "incur costs, in addition to the cost of a worker’s time, when accompanying you "
    "in the community (e.g. the cost of a ticket for public transport), The Health and "
    "Wellbeing Hub may negotiate with you for you to make a reasonable contribution "
    "towards these costs."
)

# ---- 7. CHANGES -------------------------------------------------------------
doc.section("7", "Changes to This Service Agreement")
doc.para(
    "If significant changes to the supports we provide are required, the parties agree "
    "to discuss the changes and review the Schedule of Supports and, if necessary, amend "
    "this Service Agreement. However, if changes are made to the Schedule of Supports "
    "that have an impact on the budget or service delivery arrangements, a change to "
    "this Service Agreement may be required."
)
doc.para(
    "The parties agree that any changes to this Service Agreement will be in writing, "
    "signed, and dated by the parties."
)

# ---- 8. ENDING --------------------------------------------------------------
doc.section("8", "Ending This Service Agreement")
doc.para(
    "Should either party wish to end this Service Agreement they must give the other "
    "party one month’s (or 28 days) notice."
)
doc.para(
    "The Service Agreement may be terminated as a result of a failure to pay for "
    "services provided or expenses incurred. If you fail to pay The Health and "
    "Wellbeing Hub invoices for supports and expenses that you have previously agreed to "
    "pay, you will receive a reminder. If payment is not made by the due date, we will "
    "contact you to discuss the problem and see if we can resolve the matter (for "
    "example, by establishing a direct debit payment plan). If invoices remain unpaid "
    "after 60 days, or an agreed payment plan is not established, this may result in the "
    "Service Agreement being terminated."
)
doc.para(
    "The Health and Wellbeing Hub reserves the right to terminate or withdraw supports "
    "under the following conditions:",
    space_after=1.6 * mm,
)
for b in [
    "You carry out an illegal activity within a Supported Independent Living or Short "
    "Term Accommodation home or organisational facility, which may include (but is not "
    "limited to) theft or damage of property, and use of alcohol or illicit drugs on the "
    "premises;",
    "You have not paid the Service Payment and do not pay these amounts within 60 days "
    "of receiving an overdue notice;",
    "You cease to be a Participant in the NDIS;",
    "If we are unable to continue to support you without serious risk of harm to "
    "yourself, other people or staff or a breach of our workplace health and safety "
    "obligations. We will not withdraw services purely on the basis of a dignity of risk "
    "decision.",
]:
    doc.bullet(b)

# ---- 9. CANCELLATION ---------------------------------------------------------
doc.section("9", "Cancellation of Supports")
doc.para(
    "The Health and Wellbeing Hub’s Cancellation Policy complies with all "
    "applicable laws (e.g. the Australian Consumer Law) and is consistent with the NDIS "
    "Pricing Arrangements and Price Limits."
)
doc.para(
    "The Health and Wellbeing Hub expects you (or someone on your behalf) to give The "
    "Health and Wellbeing Hub reasonable notice that services are no longer required or "
    "that you are unable to keep a scheduled appointment. If notice is not provided or "
    "you fail to attend a scheduled service, this may result in you being charged 100% "
    "of the applicable fee for the booked service."
)
doc.para(
    "Please note, where you attend for only part of the scheduled service, without "
    "providing advance notice, payment for the entire scheduled service may be charged. "
    "This fee will not exceed the price of the service we have specified in our Schedule "
    "of Supports. The Health and Wellbeing Hub will use its discretion in charging a fee."
)
doc.para(
    "In circumstances where you do not attend a scheduled service or provide advance "
    "notice to cancel the appointment (a “no show”), The Health and Wellbeing "
    "Hub will make every effort to contact you to determine if there is a problem and "
    "see if we can assist. If you are simply running late, The Health and Wellbeing Hub "
    "may need to reschedule the appointment if it means another Participant would be "
    "impacted by that delay."
)
doc.para(
    "If The Health and Wellbeing Hub has to cancel a service, 2 clear business days "
    "advance notice will be provided where possible and the service will be "
    "rescheduled. The Health and Wellbeing Hub acknowledges that there can be "
    "circumstances that are beyond either party’s control which mean that notice "
    "cannot be provided."
)
doc.para("A cancellation is a short notice cancellation if the participant:", space_after=1.6 * mm)
for b in [
    "does not show up for a scheduled support within a reasonable time, or is not "
    "present at the agreed place and within a reasonable time when the provider is "
    "travelling to deliver the support; or",
    "has given less than two (2) clear business days’ notice for disability support "
    "work services, or does not show up for a scheduled support within a reasonable time "
    "or is not present at the agreed place when the provider is travelling to deliver "
    "the support; or",
    "has given less than seven (7) clear days’ notice for a support for "
    "non-disability support work services, or does not show up for a scheduled support "
    "within a reasonable time or is not present at the agreed place — and the "
    "provider is not able to find alternative billable work for the relevant worker and "
    "is required to pay the worker for the time that would have been spent delivering "
    "the support.",
]:
    doc.bullet(b)
doc.para(
    "Under these circumstances we may charge 100% of the agreed fee associated with the "
    "activity."
)
doc.subheading("Audits Under the NDIS Commission")
doc.para(
    "As part of the requirements of the NDIS Practice Standards and continued "
    "registration, we must undertake an external audit periodically. As part of this "
    "audit, your views on our services are valued and important. Unless you opt out, you "
    "will automatically be included in the audit process for The Health and Wellbeing Hub."
)
doc.checkbox("I wish to opt out of the audit process.", "opt_out_audit")

# ---- 10. FEEDBACK, COMPLAINTS & DISPUTES ------------------------------------
doc.section("10", "Feedback, Complaints & Disputes")
doc.para(
    "The Health and Wellbeing Hub encourages you to give us feedback on any aspect of "
    "the support we provide. We would like you to let us know if you are happy with our "
    "support or unhappy."
)
doc.para(
    "If you wish to give us feedback or make a complaint, you can contact the Customer "
    "Service Officer by email, telephone, writing a letter or making a time to meet in "
    "person.",
    space_after=1.6 * mm,
)
doc.static_line("Telephone", "0433 604 507")
doc.static_line("Email", "thehealthwellbeinghub@gmail.com")
doc.spacer(1.5 * mm)
doc.para(
    "If you are not satisfied with our response you can request a meeting to discuss the "
    "matter further with the Director or their delegate on the details above."
)
doc.para(
    "If you are still not satisfied with the outcome of this process, you can contact "
    "the NDIS Quality and Safeguards Commission by phone or visit their website for "
    "further information. You can also lodge a complaint directly with the NDIS "
    "Commission.",
    space_after=1.6 * mm,
)
doc.static_line("Website", "www.ndiscommission.gov.au")
doc.static_line("Telephone", "1800 035 544")

# ---- 11. GST -----------------------------------------------------------------
doc.section("11", "Goods and Services Tax (GST)")
doc.para("For the purposes of GST legislation, the Parties confirm that:", space_after=1.6 * mm)
for b in [
    "a supply of supports under this Service Agreement is a supply of one or more of the "
    "reasonable and necessary supports specified in the statement included, under "
    "subsection 33(2) of the National Disability Insurance Scheme Act 2013 (NDIS Act), in "
    "your NDIS plan currently in effect under section 37 of the NDIS Act;",
    "your NDIS plan is expected to remain in effect during the period the supports are "
    "provided; and",
    "you or your representative will immediately notify The Health and Wellbeing Hub if "
    "your NDIS plan is replaced by a new plan or you stop being a participant in the NDIS.",
]:
    doc.bullet(b)

# ---- 12. CONTACT DETAILS ------------------------------------------------------
doc.section("12", "Contact Details")
doc.subheading("Participant's Contact Details")
doc.field_line("Phone (landline)", "participant_phone", width=70 * mm)
doc.field_line("Mobile", "participant_mobile", width=70 * mm)
doc.field_line("Email", "participant_email", width=90 * mm)
doc.field_line("Address", "participant_address", width=130 * mm)
doc.field_line("Alternative Contact Person", "participant_alt_contact", width=90 * mm)
doc.field_line("Alternative Contact Number", "participant_alt_contact_number", width=70 * mm)

doc.subheading("Participant Representative's Contact Details")
doc.para("(Plan Nominee or Plan Management Provider, if applicable)", space_after=2.4 * mm)
doc.field_line("Name", "rep_name", width=100 * mm)
doc.field_line("Phone (landline)", "rep_phone", width=70 * mm)
doc.field_line("Mobile", "rep_mobile", width=70 * mm)
doc.field_line("Email", "rep_email", width=90 * mm)
doc.field_line("Billing Address", "rep_billing_address", width=130 * mm)
doc.field_line("Alternative Contact Person", "rep_alt_contact", width=90 * mm)
doc.field_line("Alternative Contact Number", "rep_alt_contact_number", width=70 * mm)

doc.subheading("Provider's Contact Details")
doc.static_line("Contact Person", "Ibrahim Zakariya")
doc.static_line("Phone (business hours)", "0433 604 507")
doc.static_line("Mobile", "0433 604 507")
doc.static_line("Email", "thehealthwellbeinghub@gmail.com")
doc.static_line("Address", "73 Jacaranda Avenue, Logan Central QLD 4114")

# ---- 13. AGREEMENT SIGNATURES --------------------------------------------------
doc.section("13", "Agreement Signatures")
doc.para("The parties agree to the terms and conditions of this Service Agreement.")
doc.spacer(2 * mm)
doc.signature_block(
    "Participant / Participant's Representative",
    [
        ("Name", "field", "participant_sig_name"),
        ("Signature", "field", "participant_signature"),
        ("Date", "field", "participant_sig_date"),
    ],
)
doc.spacer(1.5 * mm)
doc.checkbox("I confirm that I have received a copy of the Service Agreement.", "confirm_received_copy")
doc.para("OR", bold=True, space_after=2.4 * mm)
doc.checkbox("I have opted not to receive a copy of the Service Agreement, for the reasons below:", "confirm_opted_out_copy")
doc.field_line("Reason", "opted_out_reason", width=140 * mm)
doc.spacer(4 * mm)
doc.signature_block(
    "Authorised Person from The Health and Wellbeing Hub (the Provider)",
    [
        ("Name", "static", "Ibrahim Zakariya"),
        ("Signature", "field", "provider_signature"),
        ("Date", "field", "provider_sig_date"),
    ],
)

# ---- 14 / 15 attachments -------------------------------------------------------
doc.section("14", "Copy of Participant's NDIS Plan")
doc.para("Attach a copy of the participant's NDIS plan.")

doc.section("15", "Client Consent Form")
doc.para("Attach the signed Consent form.")

# ---- 16. DEFINITION OF TERMS ---------------------------------------------------
doc.section("16", "Definition of Terms")
doc.para("This is what we mean by the following terms:", space_after=2.6 * mm)

TERMS = [
    ("NDIS", "The National Disability Insurance Scheme is a way of providing support for "
     "people with disability, their families and carers in Australia. The NDIS provides "
     "funding to Participants to purchase a range of supports aimed at increasing their "
     "independence, inclusion, and social and economic participation."),
    ("NDIA", "The National Disability Insurance Agency is the government agency that "
     "administers or manages the NDIS."),
    ("Participant (or NDIS participant)", "A Participant is a person who has been "
     "assessed by the NDIA as being eligible for the NDIS and is then registered as an "
     "NDIS Participant. For the purposes of this Agreement, the Participant has an "
     "approved NDIS plan for which funding has been allocated to purchase ‘reasonable "
     "and necessary’ supports."),
    ("Participant's NDIS Number", "Once a Participant has been registered with the NDIS, "
     "they are assigned a Participant Number. This number is a reference number that is "
     "used by the NDIA, the Participant and Providers in relation to the Participant’s "
     "plan, their supports or their payments."),
    ("NDIS Plan", "The NDIS Plan is an approved plan agreed to between the NDIA and the "
     "Participant. It specifies the ‘reasonable and necessary’ supports that the "
     "NDIA has agreed to pay for and the budget that has been allocated for those "
     "supports. It also specifies the Participant’s Goals for the things they most "
     "want to change or achieve in their Plan."),
    ("Plan Nominee", "A Plan Nominee is a person (friend, carer, family member) who can "
     "manage the Participant’s funding for their NDIS supports and help them make "
     "other decisions. A Plan Nominee can be the participant’s representative and "
     "enter into the Agreement for you."),
    ("Plan Management Provider", "The Plan Management Provider is an authorised person or "
     "entity responsible for managing the Participant’s funding for NDIS supports. "
     "They must be registered with the NDIA as the Participant’s Plan Management "
     "Provider. They can also be a participant’s representative."),
    ("Provider", "For this Service Agreement, the Provider is The Health and Wellbeing "
     "Hub. There may be other Providers who also have an agreement with the Participant "
     "to provide supports funded by the NDIS in the Participant’s Plan."),
    ("Supports", "Supports are the types of services or assistance identified in an NDIS "
     "Plan that a Participant can purchase out of their NDIS budget. There are three "
     "Support Purposes — Core, Capital or Capacity Building. They include a range of "
     "supports that enable a Participant to work towards their goals and build their "
     "independence and skills."),
    ("Goals", "Goals are the most important things the Participant wants to change or "
     "achieve over the next few years. The NDIS Plan and budget should be linked to these "
     "goals. The Supports that the Participant purchases with that funding should be "
     "aimed at helping them achieve their goals."),
    ("Support Worker", "A Support Worker is an employee of The Health and Wellbeing Hub "
     "who has been scheduled to provide a particular type of support/s to the "
     "Participant, as per the Schedule of Supports attached to this Service Agreement. "
     "The Support Worker will have the appropriate skills and/or qualifications required "
     "to provide that particular support type."),
    ("Schedule of Supports", "A schedule attached to the Service Agreement that specifies "
     "the type of support to be provided, the purpose of that support, the duration, "
     "frequency, location and timeframe (e.g. day/time) the support is provided."),
    ("NDIS Pricing Arrangements and Price Limits", "Specifies the pricing and associated "
     "arrangements that service providers should use when providing or billing for "
     "services. It also gives a brief description for each support item and includes a "
     "reference number that must be used for billing."),
    ("Myplace — NDIS Website", "A link or place on the NDIS website (called a "
     "Portal) where Participants and Providers can access information about their Plan "
     "or their Supports, including making Service Bookings or payments for the supports "
     "provided."),
    ("Service Bookings", "Making a Service Booking is like making an appointment. It can "
     "be made by either the Participant or the Provider. The appointment is made on the "
     "NDIS website, through the myplace portal, and includes information about the type "
     "of support required and the length of time the service is required for. Both "
     "parties must accept the booking on the portal. Once the service has been provided, "
     "it can then be charged for."),
    ("Transport", "Transport is when a Participant travels in a vehicle that is owned/"
     "maintained by The Health and Wellbeing Hub or a Support Worker during a Support "
     "service. Costs for providing transport are not included in the Support price and "
     "incur a separate charge. Transport costs must be agreed to by the Participant "
     "before they are incurred. Transport does not include provider travel by the "
     "Support Worker."),
    ("Cancellation", "Cancellation occurs when a scheduled service is not provided or is "
     "unable to be received. Advance notice for cancelling a scheduled service must be "
     "given to The Health and Wellbeing Hub by the Participant (or someone on their "
     "behalf) in order to avoid fees. Short notice: less than 7 business days’ "
     "advance notice is provided. Reasonable notice: 7 business days or more notice is "
     "provided. No notice (No Show): where a Participant does not attend a scheduled "
     "service, or is not at the agreed location at the agreed time, and provides no "
     "advance notice."),
    ("Conflict of Interest", "A potential conflict can arise if The Health and Wellbeing "
     "Hub is both a provider of coordination of support and other disability supports. "
     "The Health and Wellbeing Hub has a Conflict of Interest policy in place to ensure "
     "that this is appropriately managed. The Health and Wellbeing Hub will ensure the "
     "Participant is fully informed in these circumstances and can exercise choice and "
     "control."),
]
for term, definition in TERMS:
    doc.para(term, bold=True, space_after=0.8 * mm)
    doc.para(definition, space_after=2.6 * mm)

# ---- 17. SCHEDULE OF SUPPORTS ---------------------------------------------------
doc.section("17", "Schedule of Supports")
doc.para("Support Summary Statement", bold=True, space_after=2.4 * mm)
doc.field_line("Client Name", "sched_client_name", width=100 * mm)
doc.field_line("NDIS No.", "sched_ndis_no", width=70 * mm)
doc.field_line("D.O.B.", "sched_dob", width=50 * mm)
doc.field_line("Duration of Supports", "sched_duration", width=90 * mm)
doc.spacer(2 * mm)
doc.table(
    headers=["NDIS Line\nItem No.", "Description", "Schedule\nTime/Date", "Item\nPrice", "UOM", "Qty", "Total\nCost"],
    widths=[19 * mm, 46 * mm, 28 * mm, 18 * mm, 14 * mm, 14 * mm, 27 * mm],
    rows_count=6,
    field_prefix="sched_supports",
)
doc.spacer(1.5 * mm)
doc.field_line("Overall Cost", "sched_overall_cost", width=60 * mm)
doc.field_line("Additional Support Requirements", "sched_additional_requirements", width=150 * mm, height=12 * mm)
doc.field_line("Comments", "sched_comments", width=150 * mm, height=12 * mm)

# ---- 18. SCHEDULE OF SUPPORTS - AMENDMENTS ---------------------------------------
doc.section("18", "Schedule of Supports — Amendments")
doc.para("Review and Amendment Sheet", bold=True, space_after=2.4 * mm)
doc.field_line("Client Name", "amend_client_name", width=100 * mm)
doc.field_line("NDIS No.", "amend_ndis_no", width=70 * mm)
doc.spacer(2 * mm)
doc.table(
    headers=["Date of\nReview", "NDIS Line\nItem No.", "Description of\nAmendment/Service", "Unit\nPrice", "Total\nCost", "Client\nSignature", "Provider\nSignature"],
    widths=[19 * mm, 19 * mm, 43 * mm, 17 * mm, 19 * mm, 23 * mm, 26 * mm],
    rows_count=4,
    field_prefix="sched_amend",
)
doc.spacer(1.5 * mm)
doc.field_line("Comments", "amend_comments", width=150 * mm, height=12 * mm)

# ---- 19. EMERGENCY AND DISASTER MANAGEMENT PLAN -----------------------------------
doc.section("19", "Individual Emergency and Disaster Management Plan")
doc.para("If an emergency or disaster occurs, The Health and Wellbeing Hub will do the following:", space_after=1.6 * mm)
for b in [
    "contact you to advise of the emergency/disaster;",
    "check on your immediate safety, and link you with immediate supports if needed;",
    "tell you if the emergency/disaster may change the supports you receive;",
    "offer you alternative options for accessing support, including sending a different "
    "worker if your usual worker is not able to come, changing your in-person appointment "
    "to a phone or video appointment, changing the location of the appointment if the "
    "usual place has been affected by the emergency/disaster, or changing the time/date "
    "of the appointment.",
]:
    doc.bullet(b)
doc.para(
    "If you rely on The Health and Wellbeing Hub for daily living needs, high intensity "
    "supports, or if you live on your own and receive support from a sole worker only, "
    "The Health and Wellbeing Hub will make sure you continue to receive this support "
    "(tick below as appropriate):",
    space_after=1.8 * mm,
)
doc.checkbox("Reliance on The Health and Wellbeing Hub for daily living needs", "emerg_daily_living")
doc.checkbox("High intensity supports", "emerg_high_intensity")
doc.checkbox("Lives alone and accesses support from a sole worker", "emerg_lives_alone")
doc.spacer(1 * mm)
doc.para(
    "The Health and Wellbeing Hub will ensure that all services you receive follow "
    "recommended guidelines regarding infection control/prevention, social distancing, "
    "and other recommended emergency/disaster management guidelines."
)
doc.para(
    "The Health and Wellbeing Hub will keep you updated on how the emergency/disaster is "
    "affecting services, and when we expect services to return to normal."
)
doc.field_line("Other Arrangements — Please Specify", "emerg_other_arrangements", width=150 * mm, height=14 * mm)


# ---------------------------------------------------------------------------
# Rendering engine
# ---------------------------------------------------------------------------
class Renderer:
    def __init__(self, c, out_path):
        self.c = c
        self.form = c.acroForm
        self.page_num = 1
        self.y = 0
        self.in_callout = False
        self.callout_tint = None
        self.callout_top_y = None
        self._field_seq = 0

    def _unique(self, name):
        self._field_seq += 1
        return "%s__%d" % (name, self._field_seq)

    def new_page(self, first=False):
        if not first:
            self.c.showPage()
        if first:
            self._draw_cover_header()
        else:
            self._draw_running_header()
        self._draw_footer_and_border_placeholder()
        self.top_y = self.y

    def _draw_cover_header(self):
        c = self.c
        band_h = 3.2 * mm
        band_y = PAGE_H - band_h
        steps = 60
        for i in range(steps):
            t = i / (steps - 1)
            if t < 0.5:
                tt = t / 0.5
                col = blend(PURPLE, CREAM, tt)
            else:
                tt = (t - 0.5) / 0.5
                col = blend(CREAM, GREEN, tt)
            x0 = i * (PAGE_W / steps)
            c.setFillColor(col)
            c.rect(x0, band_y, PAGE_W / steps + 0.5, band_h, stroke=0, fill=1)

        y = PAGE_H - band_h - 13 * mm

        c.setFont("Playfair-Bold", 30)
        c.setFillColor(NAVY)
        c.drawString(MARGIN_L, y, "H & W")

        c.setFont("DMSans-Medium", 8.2)
        c.setFillColor(PURPLE)
        c.drawString(MARGIN_L, y - 5.4 * mm, "H E A L T H   &   W E L L - B E I N G")

        c.setFont("DMSans", 8.3)
        c.setFillColor(MUTED)
        c.drawRightString(PAGE_W - MARGIN_R, y - 1.2 * mm, "NDIS Registered Provider")
        c.drawRightString(PAGE_W - MARGIN_R, y - 1.2 * mm - 4.2 * mm, "Provider #4050045262")

        y -= 15 * mm

        c.setFont("Playfair-Bold", 25)
        c.setFillColor(NAVY_DARK)
        c.drawString(MARGIN_L, y, "NDIS Service Agreement")

        y -= 8.6 * mm
        c.setFont("DMSans", 11.5)
        c.setFillColor(PURPLE_DARK)
        c.drawString(MARGIN_L, y, "Participant Service Agreement")

        y -= 6.5 * mm
        c.setStrokeColor(HAIRLINE)
        c.setLineWidth(0.8)
        c.line(MARGIN_L, y, PAGE_W - MARGIN_R, y)

        self.y = y - 9 * mm

    def _draw_running_header(self):
        c = self.c
        y = PAGE_H - MARGIN_TOP + 6 * mm
        c.setFont("Playfair-Bold", 13)
        c.setFillColor(NAVY)
        c.drawString(MARGIN_L, y, "H & W")
        c.setFont("DMSans", 8.4)
        c.setFillColor(MUTED)
        c.drawRightString(PAGE_W - MARGIN_R, y, "NDIS Service Agreement")
        y -= 3.4 * mm
        c.setStrokeColor(HAIRLINE)
        c.setLineWidth(0.7)
        c.line(MARGIN_L, y, PAGE_W - MARGIN_R, y)
        self.y = y - 8 * mm

    def _draw_footer_and_border_placeholder(self):
        c = self.c
        fy = MARGIN_BOTTOM - 8 * mm
        c.setStrokeColor(HAIRLINE)
        c.setLineWidth(0.6)
        c.line(MARGIN_L, fy + 4.2 * mm, PAGE_W - MARGIN_R, fy + 4.2 * mm)
        c.setFont("DMSans", 6.8)
        c.setFillColor(MUTED)
        c.drawString(MARGIN_L, fy, FOOTER_TEXT)
        c.setFont("DMSans-Medium", 7.4)
        c.drawRightString(PAGE_W - MARGIN_R, fy, "Page %d" % self.page_num)

    def ensure_space(self, needed):
        if self.y - needed < MARGIN_BOTTOM:
            self._close_callout_for_pagebreak()
            self.page_num += 1
            self.new_page()
            if self._callout_pending_reopen:
                self._reopen_callout()

    _callout_pending_reopen = False

    def _close_callout_for_pagebreak(self):
        if self.in_callout:
            self._draw_callout_box(self.callout_top_y, self.y)
            self._callout_pending_reopen = True
        else:
            self._callout_pending_reopen = False

    def _reopen_callout(self):
        self.callout_top_y = self.y
        self._callout_pending_reopen = False

    def _draw_callout_box(self, top_y, bottom_y):
        c = self.c
        pad_top = 3.2 * mm
        pad_bottom = 3.0 * mm
        x0 = MARGIN_L - 4 * mm
        x1 = PAGE_W - MARGIN_R + 4 * mm
        c.saveState()
        c.setFillColor(self.callout_tint)
        c.roundRect(x0, bottom_y - pad_bottom, x1 - x0, (top_y - bottom_y) + pad_top + pad_bottom, 3 * mm, stroke=0, fill=1)
        c.restoreState()

    def section_heading(self, number, title):
        self.ensure_space(22 * mm)
        self.y -= 4.5 * mm
        c = self.c
        badge_r = 3.6 * mm
        badge_cx = MARGIN_L + badge_r
        badge_cy = self.y - 2.6 * mm
        c.setFillColor(PURPLE)
        c.circle(badge_cx, badge_cy, badge_r, stroke=0, fill=1)
        c.setFont("DMSans-Bold", 8.0)
        c.setFillColor(WHITE)
        c.drawCentredString(badge_cx, badge_cy - 1.5, number)

        title_lines = wrap_text(title, "Playfair-Bold", 14.5, CONTENT_W - badge_r - 3.5 * mm - 3.6 * mm)
        c.setFont("Playfair-Bold", 14.5)
        c.setFillColor(NAVY_DARK)
        c.drawString(badge_cx + badge_r + 3.5 * mm, self.y - 4.6 * mm + 1.3 * mm, title_lines[0])
        self.y -= 9.2 * mm
        for extra in title_lines[1:]:
            c.drawString(badge_cx + badge_r + 3.5 * mm, self.y - 4.6 * mm + 1.3 * mm, extra)
            self.y -= 6.6 * mm

        c.setStrokeColor(HAIRLINE)
        c.setLineWidth(0.6)
        c.line(MARGIN_L, self.y, PAGE_W - MARGIN_R, self.y)
        self.y -= 5.4 * mm

    def subheading(self, text):
        self.ensure_space(13 * mm)
        self.y -= 3.2 * mm
        c = self.c
        c.setFont("DMSans-Bold", 11.5)
        c.setFillColor(PURPLE_DARK)
        c.drawString(MARGIN_L, self.y - 3.6 * mm, text)
        self.y -= 8.4 * mm

    def paragraph(self, text, bold=False, space_after=3.2 * mm, indent=0):
        font = "DMSans-Bold" if bold else "DMSans"
        max_w = CONTENT_W - indent
        lines = wrap_text(text, font, BODY_SIZE, max_w)
        for line in lines:
            self.ensure_space(BODY_LEADING)
            self.c.setFont(font, BODY_SIZE)
            self.c.setFillColor(BODY)
            self.c.drawString(MARGIN_L + indent, self.y - BODY_LEADING + 3.2, line)
            self.y -= BODY_LEADING
        self.y -= space_after

    def note_block(self, text):
        max_w = CONTENT_W - 4 * mm
        lines = wrap_text(text, "DMSans", 9.2, max_w)
        c = self.c
        self.ensure_space(13.6)
        self.y -= 0.8 * mm
        for line in lines:
            self.ensure_space(13.6)
            c.setFont("DMSans", 9.2)
            c.setFillColor(MUTED)
            c.drawString(MARGIN_L + 4 * mm, self.y - 13.6 + 3.2, line)
            self.y -= 13.6
        self.y -= 3.2 * mm

    def bullet_item(self, text):
        max_w = CONTENT_W - BULLET_INDENT
        lines = wrap_text(text, "DMSans", BODY_SIZE, max_w)
        for i, line in enumerate(lines):
            self.ensure_space(BODY_LEADING)
            c = self.c
            if i == 0:
                c.setFillColor(PURPLE)
                c.setFont("DMSans-Bold", BODY_SIZE)
                c.drawString(MARGIN_L, self.y - BODY_LEADING + 3.2, "•")
            c.setFont("DMSans", BODY_SIZE)
            c.setFillColor(BODY)
            c.drawString(MARGIN_L + BULLET_INDENT, self.y - BODY_LEADING + 3.2, line)
            self.y -= BODY_LEADING
        self.y -= 2.4 * mm

    def static_line(self, label, value):
        max_w = CONTENT_W
        label_txt = label + ":"
        lw = pdfmetrics.stringWidth(label_txt, "DMSans-Bold", BODY_SIZE)
        lines = wrap_text(value, "DMSans", BODY_SIZE, max_w - lw - 2.2 * mm)
        c = self.c
        self.ensure_space(BODY_LEADING)
        c.setFont("DMSans-Bold", BODY_SIZE)
        c.setFillColor(NAVY)
        c.drawString(MARGIN_L, self.y - BODY_LEADING + 3.2, label_txt)
        c.setFont("DMSans", BODY_SIZE)
        c.setFillColor(BODY)
        c.drawString(MARGIN_L + lw + 2.2 * mm, self.y - BODY_LEADING + 3.2, lines[0])
        self.y -= BODY_LEADING
        for extra in lines[1:]:
            self.ensure_space(BODY_LEADING)
            c.setFont("DMSans", BODY_SIZE)
            c.setFillColor(BODY)
            c.drawString(MARGIN_L + lw + 2.2 * mm, self.y - BODY_LEADING + 3.2, extra)
            self.y -= BODY_LEADING
        self.y -= 1.8 * mm

    def _draw_field_box(self, field_name, label, x, y, width, height):
        c = self.c
        c.saveState()
        c.setFillColor(PURPLE_TINT)
        c.setStrokeColor(PURPLE_LIGHT)
        c.setLineWidth(0.7)
        c.roundRect(x, y, width, height, 1.4, stroke=1, fill=1)
        c.restoreState()
        self.form.textfield(
            name=self._unique(field_name),
            tooltip=label,
            x=x + 1.2,
            y=y + 1.2,
            width=width - 2.4,
            height=height - 2.4,
            borderStyle="underlined",
            borderWidth=0,
            fillColor=None,
            borderColor=None,
            textColor=BODY,
            fontSize=9.5,
            forceBorder=False,
        )

    def field_line(self, label, field_name, width, height):
        c = self.c
        label_txt = label + ":"
        lw = pdfmetrics.stringWidth(label_txt, "DMSans-Bold", BODY_SIZE)

        # If the label + field wouldn't fit on one line within the page's
        # content width, stack the field on its own line below the label
        # instead of letting it run off the right edge of the page.
        if lw + 3.5 * mm + width > CONTENT_W:
            effective_width = min(width, CONTENT_W)
            self.ensure_space(6.2 * mm + height + 3.0 * mm)
            c.setFont("DMSans-Bold", BODY_SIZE)
            c.setFillColor(NAVY)
            c.drawString(MARGIN_L, self.y - 3.6 * mm, label_txt)
            self.y -= 6.2 * mm
            field_y = self.y - height
            self._draw_field_box(field_name, label, MARGIN_L, field_y, effective_width, height)
            self.y = field_y - 3.0 * mm
            return

        self.ensure_space(height + 2.5 * mm)
        c.setFont("DMSans-Bold", BODY_SIZE)
        c.setFillColor(NAVY)
        c.drawString(MARGIN_L, self.y - 3.6 * mm, label_txt)
        field_x = MARGIN_L + lw + 3.5 * mm
        field_y = self.y - height
        self._draw_field_box(field_name, label, field_x, field_y, width, height)
        self.y = field_y - 3.0 * mm

    def checkbox_item(self, text, field_name):
        box_size = 4.2 * mm
        max_w = CONTENT_W - 8 * mm
        lines = wrap_text(text, "DMSans", BODY_SIZE, max_w)
        c = self.c
        self.ensure_space(BODY_LEADING)
        box_y = self.y - BODY_LEADING + 3.2 - 0.6 * mm
        self.form.checkbox(
            name=self._unique(field_name),
            tooltip=text[:60],
            x=MARGIN_L,
            y=box_y,
            size=box_size,
            buttonStyle="check",
            borderStyle="solid",
            borderWidth=0.8,
            borderColor=PURPLE,
            fillColor=WHITE,
            textColor=PURPLE_DARK,
            forceBorder=True,
        )
        for i, line in enumerate(lines):
            if i > 0:
                self.ensure_space(BODY_LEADING)
            c.setFont("DMSans", BODY_SIZE)
            c.setFillColor(BODY)
            c.drawString(MARGIN_L + 8 * mm, self.y - BODY_LEADING + 3.2, line)
            self.y -= BODY_LEADING
        self.y -= 2.6 * mm

    def table_block(self, headers, widths, rows_count, field_prefix, row_h):
        total_w = sum(widths)
        header_h = 9.5 * mm
        self.ensure_space(header_h + row_h)
        c = self.c
        y_top = self.y
        c.saveState()
        c.setFillColor(PURPLE_TINT2)
        c.rect(MARGIN_L, y_top - header_h, total_w, header_h, stroke=0, fill=1)
        c.restoreState()
        cx = MARGIN_L
        for h, w in zip(headers, widths):
            sub_lines = h.split("\n")
            ty = y_top - 3.4 * mm
            for line in sub_lines:
                c.setFont("DMSans-Bold", 7.4)
                c.setFillColor(NAVY_DARK)
                c.drawString(cx + 1.2 * mm, ty, line)
                ty -= 3.2 * mm
            cx += w
        c.setStrokeColor(HAIRLINE)
        c.setLineWidth(0.6)
        c.rect(MARGIN_L, y_top - header_h, total_w, header_h, stroke=1, fill=0)
        cx = MARGIN_L
        for w in widths[:-1]:
            cx += w
            c.line(cx, y_top - header_h, cx, y_top)
        self.y = y_top - header_h

        for r in range(rows_count):
            self.ensure_space(row_h)
            y_top = self.y
            c.setStrokeColor(HAIRLINE)
            c.setLineWidth(0.5)
            c.rect(MARGIN_L, y_top - row_h, total_w, row_h, stroke=1, fill=0)
            cx = MARGIN_L
            for ci, w in enumerate(widths):
                self.form.textfield(
                    name=self._unique("%s_r%d_c%d" % (field_prefix, r + 1, ci + 1)),
                    x=cx + 0.9 * mm,
                    y=y_top - row_h + 0.9 * mm,
                    width=w - 1.8 * mm,
                    height=row_h - 1.8 * mm,
                    borderStyle="none",
                    borderWidth=0,
                    fillColor=None,
                    borderColor=None,
                    textColor=BODY,
                    fontSize=7.4,
                    forceBorder=False,
                )
                cx += w
            cx = MARGIN_L
            for w in widths[:-1]:
                cx += w
                c.line(cx, y_top - row_h, cx, y_top)
            self.y = y_top - row_h
        self.y -= 2.6 * mm

    def signature_block(self, heading, rows):
        self.ensure_space(10 * mm)
        c = self.c
        c.setFont("DMSans-Bold", 10.8)
        c.setFillColor(PURPLE_DARK)
        label_lines = wrap_text(heading, "DMSans-Bold", 10.8, CONTENT_W)
        for i, line in enumerate(label_lines):
            c.drawString(MARGIN_L, self.y - 3.6 * mm - i * 4.6 * mm, line)
        self.y -= 8.6 * mm + (len(label_lines) - 1) * 4.6 * mm
        for label, kind, val in rows:
            if kind == "static":
                self.static_line(label, val)
            else:
                self.field_line(label, val, width=85 * mm, height=8 * mm)

    def spacer(self, h):
        self.ensure_space(h)
        self.y -= h

    def start_callout(self, tint):
        self.in_callout = True
        self.callout_tint = tint
        self.ensure_space(6 * mm)
        self.y -= 2.0 * mm
        self.callout_top_y = self.y

    def end_callout(self):
        if self.in_callout:
            self._draw_callout_box(self.callout_top_y, self.y)
        self.in_callout = False
        self.y -= 2.6 * mm


def blend(c1, c2, t):
    r = c1.red + (c2.red - c1.red) * t
    g = c1.green + (c2.green - c1.green) * t
    b = c1.blue + (c2.blue - c1.blue) * t
    return HexColor((int(r * 255) << 16) + (int(g * 255) << 8) + int(b * 255))


def dry_run_callout_ranges(items):
    dummy_c = canvas.Canvas("/dev/null", pagesize=A4)
    r = Renderer(dummy_c, "/dev/null")
    r.page_num = 1
    r.new_page(first=True)

    page_boxes = {1: []}

    def record_box(top_y, bottom_y, tint):
        page_boxes.setdefault(r.page_num, []).append((top_y, bottom_y, tint))

    def patched_draw(top_y, bottom_y):
        record_box(top_y, bottom_y, r.callout_tint)
    r._draw_callout_box = patched_draw

    render_items(r, items)
    return page_boxes


def render_items(r, items):
    for item in items:
        kind = item[0]
        if kind == "section":
            r.section_heading(item[1], item[2])
        elif kind == "subheading":
            r.subheading(item[1])
        elif kind == "para":
            r.paragraph(item[1], bold=item[2], space_after=item[3])
        elif kind == "note":
            r.note_block(item[1])
        elif kind == "bullet":
            r.bullet_item(item[1])
        elif kind == "field":
            r.field_line(item[1], item[2], item[3], item[4])
        elif kind == "staticline":
            r.static_line(item[1], item[2])
        elif kind == "checkbox":
            r.checkbox_item(item[1], item[2])
        elif kind == "table":
            r.table_block(item[1], item[2], item[3], item[4], item[5])
        elif kind == "spacer":
            r.spacer(item[1])
        elif kind == "callout_start":
            r.start_callout(item[1])
        elif kind == "callout_end":
            r.end_callout()
        elif kind == "sig_block":
            r.signature_block(item[1], item[2])


def build():
    page_boxes = dry_run_callout_ranges(doc.items)

    c = canvas.Canvas(OUT_PATH, pagesize=A4)
    c.setTitle("NDIS Service Agreement - The Health & Well-being Hub")
    c.setAuthor("The Health & Well-being Hub")
    c.setSubject("NDIS Service Agreement (Participant)")

    r = Renderer(c, OUT_PATH)
    r.page_num = 1

    def new_page_with_boxes(first=False):
        Renderer.new_page(r, first=first)
        for (top_y, bottom_y, tint) in page_boxes.get(r.page_num, []):
            c.saveState()
            c.setFillColor(tint)
            pad_top = 3.2 * mm
            pad_bottom = 3.0 * mm
            x0 = MARGIN_L - 4 * mm
            x1 = PAGE_W - MARGIN_R + 4 * mm
            c.roundRect(x0, bottom_y - pad_bottom, x1 - x0, (top_y - bottom_y) + pad_top + pad_bottom, 3 * mm, stroke=0, fill=1)
            c.restoreState()

    r.new_page = new_page_with_boxes
    r._draw_callout_box = lambda top_y, bottom_y: None

    r.new_page(first=True)
    render_items(r, doc.items)
    c.showPage()
    c.save()


if __name__ == "__main__":
    build()
    print("Wrote", OUT_PATH)
