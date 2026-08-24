"""Registers every page to be rendered by build.py, with titles, meta
descriptions, breadcrumbs and JSON-LD wired up per page."""
import schema as S


def crumbs(*pairs):
    """pairs like (name, path) -> breadcrumb list, always starting at Home."""
    out = [{"name": "Home", "url": "/"}]
    for name, path in pairs:
        out.append({"name": name, "url": path})
    return out


def build(render, SITE, C):
    org_id = SITE["base_url"] + "/#organization"

    # ------------------------------------------------------------------
    # HOMEPAGE
    # ------------------------------------------------------------------
    home_schema = S.graph(
        S.organization_graph(SITE),
        S.website_graph(SITE),
        S.webpage_node(SITE, "/", "NDIS Provider Logan Central | The Health & Well-being Hub",
                        "A person-centred, multilingual NDIS provider based in Logan Central, servicing Logan, Brisbane and South East Queensland."),
        S.faqpage_node(SITE, "/", C.HOME_FAQS),
    )
    render(
        "home.html", "/",
        title="NDIS Provider Logan Central | The Health & Well-being Hub",
        meta_description="NDIS registered provider based in Logan Central, QLD. Multilingual team speaking Arabic, Somali, Dari & Amharic. Support can often begin this week. Call 0433 604 507.",
        og_title="NDIS Provider Logan Central | The Health & Well-being Hub",
        og_description="Person-centred NDIS support from a multilingual team in Logan Central, servicing Logan, Brisbane and South East Queensland.",
        home_faqs=C.HOME_FAQS,
        testimonials=C.TESTIMONIALS,
        languages=C.LANGUAGES,
        schema_json=home_schema,
        priority="1.0",
        changefreq="weekly",
    )

    # ------------------------------------------------------------------
    # SERVICES INDEX
    # ------------------------------------------------------------------
    path = "/services/"
    render(
        "services_index.html", path,
        title="NDIS Services in Logan & Brisbane | The Health & Well-being Hub",
        meta_description="Support coordination, core supports & daily living, community participation and therapy services for NDIS participants in Logan, Logan Central and Brisbane.",
        breadcrumbs=crumbs(("Services", path)),
        schema_json=S.graph(
            S.webpage_node(SITE, path, "NDIS Services in Logan & Brisbane", "Overview of NDIS services offered by The Health & Well-being Hub."),
            S.breadcrumb_node(SITE, path, crumbs(("Services", path))),
        ),
        priority="0.9",
    )

    # ------------------------------------------------------------------
    # SERVICE PAGES
    # ------------------------------------------------------------------
    for svc in C.SERVICES:
        path = f"/services/{svc['slug']}/"
        bc = crumbs(("Services", "/services/"), (svc["name"], path))
        render(
            "service_page.html", path,
            svc=svc,
            title=svc["meta_title"],
            meta_description=svc["meta_description"],
            breadcrumbs=bc,
            schema_json=S.graph(
                S.webpage_node(SITE, path, svc["h1"], svc["meta_description"]),
                S.breadcrumb_node(SITE, path, bc),
                S.service_node(SITE, svc, path),
                S.faqpage_node(SITE, path, svc["faqs"]),
            ),
            priority="0.9",
        )

    # ------------------------------------------------------------------
    # LOCATION PAGES
    # ------------------------------------------------------------------
    for loc in C.LOCATIONS:
        path = f"/locations/{loc['slug']}/"
        bc = crumbs((f"NDIS Provider {loc['name']}", path))
        render(
            "location_page.html", path,
            loc=loc,
            title=loc["meta_title"],
            meta_description=loc["meta_description"],
            breadcrumbs=bc,
            schema_json=S.graph(
                S.webpage_node(SITE, path, loc["h1"], loc["meta_description"]),
                S.breadcrumb_node(SITE, path, bc),
                S.faqpage_node(SITE, path, loc["faqs"]),
            ),
            priority="0.9",
        )

    # ------------------------------------------------------------------
    # ABOUT
    # ------------------------------------------------------------------
    path = "/about/"
    render(
        "about.html", path,
        title="About Us | NDIS Provider Logan Central — The Health & Well-being Hub",
        meta_description="Meet The Health & Well-being Hub — an NDIS registered provider founded in Logan Central by Kholoud Abdalla, serving culturally diverse families across Brisbane.",
        breadcrumbs=crumbs(("About", path)),
        schema_json=S.graph(
            S.webpage_node(SITE, path, "About The Health & Well-being Hub", "Our story, founder and credentials."),
            S.breadcrumb_node(SITE, path, crumbs(("About", path))),
        ),
        priority="0.7",
    )

    # ------------------------------------------------------------------
    # CONTACT
    # ------------------------------------------------------------------
    path = "/contact/"
    render(
        "contact.html", path,
        title="Contact Us — NDIS Enquiry | The Health & Well-being Hub",
        meta_description="Contact The Health & Well-being Hub — NDIS registered provider in Logan Central. Call 0433 604 507, WhatsApp, or send an enquiry. We respond within 2 business hours.",
        breadcrumbs=crumbs(("Contact", path)),
        schema_json=S.graph(
            S.webpage_node(SITE, path, "Contact The Health & Well-being Hub", "Contact details and enquiry form."),
            S.breadcrumb_node(SITE, path, crumbs(("Contact", path))),
        ),
        priority="0.9",
    )

    # ------------------------------------------------------------------
    # REFERRALS
    # ------------------------------------------------------------------
    path = "/referrals/"
    render(
        "referrals.html", path,
        title="Refer an NDIS Participant | The Health & Well-being Hub",
        meta_description="Refer an NDIS participant to The Health & Well-being Hub. NDIS #4050045262, all plan types accepted, referrals answered within 2 business hours.",
        breadcrumbs=crumbs(("Referrals", path)),
        schema_json=S.graph(
            S.webpage_node(SITE, path, "Refer an NDIS Participant", "Referral pathway for plan managers, support coordinators and health professionals."),
            S.breadcrumb_node(SITE, path, crumbs(("Referrals", path))),
        ),
        priority="0.8",
    )

    # ------------------------------------------------------------------
    # STAFF REFERRAL INTAKE
    #
    # Unlisted, not linked from anywhere, noindex, and kept out of the sitemap.
    # That is obscurity, not authentication: anyone holding the URL can open it,
    # exactly as anyone can open /referrals/. The token exists so the address
    # cannot be guessed or crawled, and can be rotated by changing it here.
    # ------------------------------------------------------------------
    path = "/staff/8d7c6ee2286d20b7/"
    render(
        "staff_referral.html", path,
        title="Enter a referral | Team use only",
        meta_description="Internal referral intake form for The Health & Well-being Hub team.",
        robots="noindex, nofollow",
        sitemap=False,
    )

    # ------------------------------------------------------------------
    # PROVIDER DIRECTORY
    # ------------------------------------------------------------------
    path = "/provider-directory/"
    render(
        "directory.html", path,
        title="Allied Health & NDIS Provider Directory Logan & Brisbane | The Health & Well-being Hub",
        meta_description="Search allied health professionals and NDIS service providers across Logan, Brisbane and South East Queensland. Filter by location, state, service type and NDIS registration.",
        og_title="Allied Health & NDIS Provider Directory | The Health & Well-being Hub",
        og_description="A searchable directory of allied health professionals and NDIS service providers across Logan, Brisbane and South East Queensland.",
        breadcrumbs=crumbs(("Provider Directory", path)),
        directory_faqs=C.DIRECTORY_FAQS,
        schema_json=S.graph(
            S.webpage_node(
                SITE, path,
                "Allied Health & NDIS Provider Directory",
                "Searchable directory of allied health professionals and NDIS service providers in South East Queensland.",
                page_type="CollectionPage",
            ),
            S.breadcrumb_node(SITE, path, crumbs(("Provider Directory", path))),
            S.faqpage_node(SITE, path, C.DIRECTORY_FAQS),
        ),
        priority="0.7",
        changefreq="weekly",
        # Listings are still fictional placeholder data (see templates/directory.html) —
        # keep this out of search results and the sitemap until real, verified
        # providers replace the demo rows, so Google never indexes fabricated
        # businesses under this domain. Remove both once the data is real.
        robots="noindex, follow",
        sitemap=False,
    )

    # ------------------------------------------------------------------
    # MULTILINGUAL
    # ------------------------------------------------------------------
    path = "/multilingual-ndis-support/"
    render(
        "multilingual.html", path,
        title="Multilingual & Multicultural NDIS Provider Brisbane | Arabic, Somali, Dari, Amharic",
        meta_description="Culturally diverse NDIS provider in Brisbane & Logan. Team members speak Arabic, Somali, Dari and Amharic. Gender-matched, faith-sensitive support. Call 0433 604 507.",
        languages=C.LANGUAGES,
        breadcrumbs=crumbs(("Multilingual Support", path)),
        schema_json=S.graph(
            S.webpage_node(SITE, path, "Multilingual & Culturally Responsive NDIS Support", "Multilingual and multicultural NDIS support in Logan and Brisbane."),
            S.breadcrumb_node(SITE, path, crumbs(("Multilingual Support", path))),
        ),
        priority="0.8",
    )

    # ------------------------------------------------------------------
    # BLOG INDEX + POSTS
    # ------------------------------------------------------------------
    path = "/blog/"
    render(
        "blog_index.html", path,
        title="NDIS Resources & Guides | The Health & Well-being Hub",
        meta_description="Plain-English NDIS guides for participants, families and support coordinators in Logan and Brisbane — choosing a provider, switching providers, and more.",
        breadcrumbs=crumbs(("Blog", path)),
        schema_json=S.graph(
            S.webpage_node(SITE, path, "NDIS Resources & Guides", "NDIS educational articles and guides."),
            S.breadcrumb_node(SITE, path, crumbs(("Blog", path))),
        ),
        priority="0.7",
    )
    for post in C.BLOG_POSTS:
        path = f"/blog/{post['slug']}/"
        bc = crumbs(("Blog", "/blog/"), (post["title"], path))
        render(
            "blog_post.html", path,
            post=post,
            title=post["meta_title"],
            meta_description=post["meta_description"],
            breadcrumbs=bc,
            schema_json=S.graph(
                S.webpage_node(SITE, path, post["title"], post["meta_description"]),
                S.breadcrumb_node(SITE, path, bc),
                S.article_node(SITE, post, path),
            ),
            priority="0.6",
        )

    # ------------------------------------------------------------------
    # TRUST / POLICY PAGES
    # ------------------------------------------------------------------
    _render_privacy(render, SITE)
    _render_complaints(render, SITE)
    _render_participant_rights(render, SITE)


def _render_privacy(render, SITE):
    path = "/privacy-policy/"
    html = f"""
    <h2>Overview</h2>
    <p>The Health &amp; Well-being Hub ("we", "us", "our") is committed to protecting the privacy of the personal information you share with us, in line with the Australian Privacy Principles under the Privacy Act 1988 (Cth) and the NDIS Practice Standards.</p>

    <h2>What we collect</h2>
    <p>When you make an enquiry, submit a referral, or otherwise contact us, we may collect information such as your name, phone number, email address, suburb, preferred language, and details about the NDIS support you're seeking. We only ask for the information needed to respond to your enquiry — our general enquiry form does not request detailed health information.</p>

    <h2>How we use your information</h2>
    <ul>
      <li>To respond to your enquiry or referral</li>
      <li>To assess and, where you proceed with us, deliver NDIS supports</li>
      <li>To meet our obligations as an NDIS registered provider</li>
      <li>To communicate with your plan manager or support coordinator, where you've consented to this</li>
    </ul>
    <p>We do not sell your information, and we do not use it for marketing purposes beyond responding to your own enquiry.</p>

    <h2>Who we share information with</h2>
    <p>We may share relevant information with your nominated plan manager, support coordinator or other NDIS providers involved in your support, but only with your consent or as required by law or the NDIS Practice Standards.</p>

    <h2>How we store your information</h2>
    <p>We take reasonable steps to keep your personal information secure and to protect it from misuse, loss, and unauthorised access.</p>

    <h2>Your rights</h2>
    <p>You can ask to see the personal information we hold about you, ask us to correct it, or ask us to explain how we've used it. To do this, contact us using the details below.</p>

    <h2>Contact us about privacy</h2>
    <p>Privacy Officer, The Health &amp; Well-being Hub<br>
    {SITE['address_full']}<br>
    Phone: <a href="tel:{SITE['phone_tel']}">{SITE['phone_display']}</a><br>
    Email: <a href="mailto:{SITE['email']}">{SITE['email']}</a></p>

    <p>If you're not satisfied with our response, you can contact the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au, or the NDIS Quality and Safeguards Commission at ndiscommission.gov.au.</p>
    """
    render(
        "policy_page.html", path,
        page_h1="Privacy Policy",
        page_sub="How we collect, use and protect your personal information.",
        policy_html=html,
        title="Privacy Policy | The Health & Well-being Hub",
        meta_description="How The Health & Well-being Hub collects, uses and protects your personal information as an NDIS registered provider.",
        breadcrumbs=[{"name": "Home", "url": "/"}, {"name": "Privacy Policy", "url": path}],
        schema_json=S.graph(
            S.webpage_node(SITE, path, "Privacy Policy", "How The Health & Well-being Hub collects, uses and protects personal information."),
            S.breadcrumb_node(SITE, path, [{"name": "Home", "url": "/"}, {"name": "Privacy Policy", "url": path}]),
        ),
        priority="0.3",
        changefreq="yearly",
    )


def _render_complaints(render, SITE):
    path = "/complaints-feedback/"
    html = f"""
    <h2>We want to hear from you</h2>
    <p>Whether it's positive feedback or a concern, we want to know. Raising an issue never affects the support you receive from us.</p>

    <h2>How to give feedback or make a complaint</h2>
    <ol>
      <li>Speak with your support worker or coordinator directly, if you're comfortable doing so</li>
      <li>Call us on <a href="tel:{SITE['phone_tel']}">{SITE['phone_display']}</a></li>
      <li>Email us at <a href="mailto:{SITE['email']}">{SITE['email']}</a></li>
      <li>Write to us at {SITE['address_full']}</li>
    </ol>
    <p>You're welcome to raise a complaint in Arabic, Somali, Dari or Amharic — let us know your preferred language and we'll connect you with a team member who speaks it. You can also ask a family member, advocate or support coordinator to raise it on your behalf.</p>

    <h2>What happens after you raise a concern</h2>
    <ul>
      <li>We'll acknowledge your complaint and confirm we've received it</li>
      <li>We'll look into what happened and, where appropriate, discuss it with the people involved</li>
      <li>We'll get back to you with an outcome or next steps</li>
      <li>We'll keep a record of the complaint and how it was resolved, in line with the NDIS Practice Standards</li>
    </ul>

    <h2>External complaints</h2>
    <p>If you're not comfortable raising a concern with us directly, or you're not satisfied with our response, you can contact the <strong>NDIS Quality and Safeguards Commission</strong>:</p>
    <ul>
      <li>Phone: 1800 035 544 (free call)</li>
      <li>Website: <a href="https://www.ndiscommission.gov.au" target="_blank" rel="noopener">ndiscommission.gov.au</a></li>
    </ul>
    <p>You will never be disadvantaged for making a complaint, to us or to the NDIS Commission.</p>
    """
    render(
        "policy_page.html", path,
        page_h1="Complaints & Feedback",
        page_sub="How to raise a concern, give feedback, or make a complaint — and what happens next.",
        policy_html=html,
        title="Complaints & Feedback | The Health & Well-being Hub",
        meta_description="How to give feedback or make a complaint to The Health & Well-being Hub, and how to contact the NDIS Quality and Safeguards Commission.",
        breadcrumbs=[{"name": "Home", "url": "/"}, {"name": "Complaints & Feedback", "url": path}],
        schema_json=S.graph(
            S.webpage_node(SITE, path, "Complaints & Feedback", "How to give feedback or make a complaint to The Health & Well-being Hub."),
            S.breadcrumb_node(SITE, path, [{"name": "Home", "url": "/"}, {"name": "Complaints & Feedback", "url": path}]),
        ),
        priority="0.3",
        changefreq="yearly",
    )


def _render_participant_rights(render, SITE):
    path = "/participant-rights/"
    html = """
    <h2>As a participant, you have the right to:</h2>
    <ul>
      <li>Be treated with dignity and respect, regardless of your background, culture, faith, gender or beliefs</li>
      <li>Make your own decisions about your support, or be supported by a nominee to do so</li>
      <li>Choose and change your providers at any time</li>
      <li>Request a support worker of a particular gender, where reasonably possible</li>
      <li>Have your cultural, religious and dietary needs respected</li>
      <li>Access your own information and ask questions about your support</li>
      <li>Give feedback or make a complaint without it affecting your support</li>
      <li>Have your privacy protected, as set out in our Privacy Policy</li>
      <li>Be supported in your preferred language wherever a team member who speaks it is available</li>
      <li>Be safe from abuse, neglect, violence, exploitation and discrimination</li>
    </ul>

    <h2>Our commitment to you</h2>
    <p>These rights reflect the NDIS Practice Standards and the National Disability Insurance Scheme Act 2013. As a registered NDIS provider (registration #4050045262), we're required to uphold them — but more than that, they reflect the reason The Health &amp; Well-being Hub was founded.</p>

    <h2>Questions about your rights</h2>
    <p>If you have any questions about your rights as a participant, or feel any of them haven't been upheld, please see our <a href="/complaints-feedback/">Complaints &amp; Feedback</a> page, or contact us directly.</p>
    """
    render(
        "policy_page.html", path,
        page_h1="Participant Rights",
        page_sub="What you can expect as an NDIS participant supported by The Health & Well-being Hub.",
        policy_html=html,
        title="Participant Rights | The Health & Well-being Hub",
        meta_description="Your rights as an NDIS participant supported by The Health & Well-being Hub, including choice, dignity, cultural respect and complaint pathways.",
        breadcrumbs=[{"name": "Home", "url": "/"}, {"name": "Participant Rights", "url": path}],
        schema_json=S.graph(
            S.webpage_node(SITE, path, "Participant Rights", "Your rights as an NDIS participant supported by The Health & Well-being Hub."),
            S.breadcrumb_node(SITE, path, [{"name": "Home", "url": "/"}, {"name": "Participant Rights", "url": path}]),
        ),
        priority="0.3",
        changefreq="yearly",
    )
