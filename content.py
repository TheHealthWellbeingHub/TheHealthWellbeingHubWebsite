"""All page copy for The Health & Well-being Hub site, kept separate from
the template/rendering logic in build.py. Every factual claim here
(registration numbers, ABN, team size, participant numbers, response
times) is carried over from the client's existing published website —
nothing has been invented for SEO purposes. General statements about how
the NDIS works are educational background, not individual advice, and
should be verified against ndis.gov.au before publishing.
"""

# ---------------------------------------------------------------------------
# SERVICES
# ---------------------------------------------------------------------------

SERVICES = [
    {
        "slug": "support-coordination",
        "name": "Support Coordination",
        "card_desc": "Making your NDIS plan work for you — in your language, at your pace. We navigate the system so you don't have to.",
        "icon": "🧭",
        "hero_gradient": "linear-gradient(135deg,#5C2068,#7B2D8B)",
        "eyebrow": "NDIS Capacity Building",
        "meta_title": "NDIS Support Coordination in Logan & Brisbane | The Health & Well-being Hub",
        "meta_description": "NDIS registered support coordination in Logan, Logan Central and Brisbane. Multilingual coordinators, all plan types accepted, response within 2 business hours. Call 0433 604 507.",
        "h1": "NDIS Support Coordination in Logan & Brisbane",
        "intro": [
            "If your NDIS plan includes funding for Support Coordination, our job is to make that plan actually work in real life — not just on paper. We help you understand what you've been funded for, connect you with the right providers, and keep every part of your support working together.",
            "Our coordinators are based in Logan Central and work with participants across Logan, Brisbane and South East Queensland, including families who feel more comfortable discussing their plan in Arabic, Somali, Dari or Amharic.",
        ],
        "what_is_heading": "What is NDIS Support Coordination?",
        "what_is": [
            "Support Coordination is a type of NDIS capacity-building funding that helps you put your plan into action. Depending on your plan, this can range from general Support Connection through to Coordination of Supports or Specialist Support Coordination for more complex situations.",
            "A support coordinator doesn't provide your day-to-day care themselves — instead, they help you find and set up the right providers (including ourselves, where appropriate), sort out service agreements, and troubleshoot problems as they come up. Exactly what's included depends on the wording and funding level in your individual plan, so we always start by reviewing your plan with you.",
        ],
        "included_heading": "What's included",
        "included_categories": [
            {
                "title": "Plan implementation",
                "icon": "📋",
                "items": [
                    "Understand your NDIS plan and what each funding category covers",
                    "Connect you with the right providers for your goals",
                    "Set up service agreements and bookings",
                    "Coordinate all your supports so they work together, not against each other",
                ],
            },
            {
                "title": "Ongoing support",
                "icon": "🤝",
                "items": [
                    "Attend meetings and appointments with you, or on your behalf",
                    "Resolve issues with existing providers",
                    "Build your skills and confidence to manage more of your own supports over time",
                    "Prepare for NDIS plan reviews and planning meetings",
                ],
            },
        ],
        "who_for_heading": "Who this service is for",
        "who_for": [
            "People who are new to the NDIS and aren't sure where to start",
            "Families and carers navigating a plan on behalf of a loved one",
            "People from Arabic-, Somali-, Dari- or Amharic-speaking backgrounds who want to discuss their plan in their own language",
            "Anyone who feels their current provider isn't listening or isn't the right fit",
        ],
        "how_we_work_heading": "How our support coordinators work",
        "how_we_work": [
            "We start with a conversation, not a form — understanding your goals, your funding, and what's not working with your current setup (if you have one). From there we build a simple action plan, make the introductions and bookings you need, and stay involved to make sure things are actually happening, not just scheduled.",
            "Because we're also a direct provider of core supports, community participation and therapy services, we can coordinate seamlessly with our own team where that's the right fit for you — or connect you with other trusted providers where it isn't. Your goals decide the plan, not ours.",
        ],
        "multilingual_heading": "Multilingual and culturally responsive support",
        "multilingual": "Our coordinators speak Arabic, Somali, Amharic and Dari as well as English. We understand diverse family structures, cultural and religious considerations, and the specific barriers many culturally and linguistically diverse (CALD) families face when navigating the NDIS. Tell us your preferred language when you enquire and we'll connect you with a team member who speaks it.",
        "why_choose": [
            "Fully NDIS registered provider — registration #4050045262",
            "Coordinators who speak Arabic, Somali, Dari and Amharic",
            "We work with all plan types: agency managed, plan managed and self managed",
            "Based in Logan Central with participants across QLD, NSW, VIC and WA",
            "We respond to enquiries and referrals within 2 business hours",
        ],
        "get_started_steps": [
            "Call, WhatsApp or submit an enquiry — no NDIS number required to start the conversation",
            "We call you back, usually within 2 business hours",
            "We review your current plan and funding with you",
            "We match you with a coordinator and agree an action plan",
            "Support coordination begins — often within the same week",
        ],
        "faqs": [
            {"q": "Do I need Support Coordination funding in my plan already?", "a": "Yes — Support Coordination is only funded if it's included in your NDIS plan under Capacity Building Supports. If you're not sure whether you have it, bring your plan to your first conversation with us, or call and we can help you check."},
            {"q": "Can you help if I already have a support coordinator I'm not happy with?", "a": "Yes. You're free to change support coordinators at any time — it's your choice under the NDIS. We can take over with minimal disruption to your existing supports."},
            {"q": "Do you coordinate supports outside Queensland?", "a": "Yes, we currently support participants in Queensland, New South Wales, Victoria and Western Australia."},
            {"q": "Will my support coordinator speak my language?", "a": "Our team speaks English, Arabic, Somali, Dari and Amharic. Let us know your preferred language when you enquire."},
        ],
        "highlight": {
            "label": "Our difference",
            "color": "purple",
            "text": "Our coordinators speak Arabic, Somali, Amharic and Dari, and understand diverse family structures, cultural considerations and individual values — delivering coordination that genuinely fits your world, not a generic template.",
        },
    },
    {
        "slug": "core-supports-daily-living",
        "name": "Core Supports & Daily Living",
        "card_desc": "In-home support for everyday tasks — delivered with dignity, cultural understanding and genuine care.",
        "icon": "🏠",
        "hero_gradient": "linear-gradient(135deg,#1D3461,#2a4a80)",
        "eyebrow": "NDIS Core Supports",
        "meta_title": "NDIS Core Supports & Daily Living Logan | The Health & Well-being Hub",
        "meta_description": "NDIS daily living support in Logan, Logan Central and Brisbane — personal care, household tasks, transport and overnight support. Gender-matched workers available. Call 0433 604 507.",
        "h1": "NDIS Core Supports & Daily Living in Logan",
        "intro": [
            "Core Supports funding covers the everyday, practical help that makes independent living possible — personal care, household tasks, transport and, where needed, overnight support. We deliver this support in a way that respects your routines, your culture and your independence, not a fixed roster that suits us more than you.",
            "Support workers are based in and around Logan Central and travel to participants across Logan, Brisbane and surrounding South East Queensland suburbs.",
        ],
        "what_is_heading": "What are NDIS Core Supports?",
        "what_is": [
            "Core Supports is the most flexible category of NDIS funding — it's designed for the day-to-day supports that help you live your daily life and work toward your goals, including assistance with daily life (personal care and household tasks), transport, and consumables. Exactly what's approved and how it can be used depends on your individual plan.",
        ],
        "included_heading": "What's included",
        "included_categories": [
            {
                "title": "Personal care",
                "icon": "🧴",
                "items": [
                    "Showering, grooming and personal hygiene",
                    "Dressing and undressing",
                    "Continence support",
                    "Mobility and transfers",
                    "Medication prompting",
                ],
            },
            {
                "title": "Household tasks",
                "icon": "🧹",
                "items": [
                    "Cleaning and tidying",
                    "Laundry and ironing",
                    "Meal preparation, with dietary needs respected",
                    "Grocery shopping and errands",
                ],
            },
            {
                "title": "Transport",
                "icon": "🚗",
                "items": [
                    "Transport to appointments",
                    "Community activities and events",
                    "Accompaniment on outings",
                ],
            },
            {
                "title": "Overnight support",
                "icon": "🌙",
                "items": [
                    "Sleepover support",
                    "Active overnight care",
                    "High intensity daily personal activities (where the support worker holds the required qualifications)",
                ],
            },
        ],
        "who_for_heading": "Who this service is for",
        "who_for": [
            "Participants who want to stay living independently at home with the right support",
            "Families wanting culturally and religiously appropriate in-home care for a loved one",
            "Anyone who has been offered a generic roster by another provider and wants support that actually fits their routine",
        ],
        "how_we_work_heading": "How our support workers work",
        "how_we_work": [
            "We start by understanding your routine, your preferences and what dignity and independence look like for you specifically. Support is then scheduled around your life, with the same familiar faces wherever possible rather than a rotating roster of strangers.",
        ],
        "multilingual_heading": "Multilingual and culturally responsive support",
        "multilingual": "Gender-matched support workers are available on request, dietary requirements and cultural needs are respected, and religious observances are accommodated as part of everyday support — not treated as a special request. Our team speaks Arabic, Somali, Dari and Amharic as well as English.",
        "why_choose": [
            "Fully NDIS registered — registration #4050045262",
            "Gender-matched support workers available",
            "Dietary, cultural and religious needs respected as standard",
            "All NDIS plan types accepted",
            "Support available 7 days a week",
        ],
        "get_started_steps": [
            "Call or submit an enquiry — tell us what daily support you need",
            "We call you back, usually within 2 business hours",
            "We complete a short needs assessment, in your preferred language if needed",
            "We match you with the right support worker(s)",
            "Support begins — often within the same week",
        ],
        "faqs": [
            {"q": "Can I choose a male or female support worker?", "a": "Yes. Many of our participants and families have a preference for this, and we do our best to match you with a support worker of your preferred gender."},
            {"q": "Can support workers accommodate religious practices, like prayer times or halal meal preparation?", "a": "Yes — we ask about this as a standard part of onboarding, not as a special request, so your worker knows what to expect from day one."},
            {"q": "Is overnight support included?", "a": "It can be, if your plan includes funding for it. Overnight support ranges from a sleepover to active overnight care, depending on your assessed needs."},
            {"q": "How quickly can daily living support start?", "a": "In most cases we can begin within the same week as your first enquiry, once a needs assessment is complete."},
        ],
        "highlight": {
            "label": "Care that respects your values",
            "color": "green",
            "text": "Gender-matched support workers available on request, dietary requirements and cultural needs respected, religious observances accommodated. Your values matter to us — whatever they are.",
        },
    },
    {
        "slug": "community-participation",
        "name": "Community Participation",
        "card_desc": "Getting out, building connections, attending community events — we support the life you want to live.",
        "icon": "🎉",
        "hero_gradient": "linear-gradient(135deg,#27500A,#4A7C3F)",
        "eyebrow": "NDIS Capacity Building",
        "meta_title": "NDIS Community Participation Logan & Brisbane | The Health & Well-being Hub",
        "meta_description": "NDIS community participation support in Logan and Brisbane — social outings, cultural and faith activities, education and life skills. Culturally responsive team. Call 0433 604 507.",
        "h1": "NDIS Community Participation in Logan & Brisbane",
        "intro": [
            "Community Participation funding exists because social connection, faith, culture and independence are directly linked to health and wellbeing. We help participants use this funding for things that genuinely matter to them — not generic group outings picked to fill a roster.",
        ],
        "what_is_heading": "What does Community Participation cover under the NDIS?",
        "what_is": [
            "Community Participation is generally funded under Core Supports or, for skill-building activities, Capacity Building Supports in your plan. It's intended to help you take part in social, recreational, religious, cultural and educational activities in your community. What's specifically approved depends on your plan and goals, so we always work from what's actually written into your funding.",
        ],
        "included_heading": "What's included",
        "included_categories": [
            {
                "title": "Social & recreational",
                "icon": "🎊",
                "items": [
                    "Social outings and group activities",
                    "Attending community events and festivals",
                    "Sports, fitness and recreational activities",
                    "Arts, crafts and creative activities",
                    "Day trips and excursions",
                ],
            },
            {
                "title": "Faith & cultural",
                "icon": "🕌",
                "items": [
                    "Attending any place of worship — church, temple, mosque or community centre",
                    "Eid, Christmas, Diwali and other cultural or religious celebrations",
                    "Cultural festivals and multicultural community events",
                ],
            },
            {
                "title": "Education & skills",
                "icon": "🎓",
                "items": [
                    "TAFE courses or workshops",
                    "Life skills development",
                    "Volunteering and community contribution",
                ],
            },
        ],
        "who_for_heading": "Who this service is for",
        "who_for": [
            "Participants who want to build friendships and community connections locally in Logan and Brisbane",
            "People who want support to keep attending their place of worship or cultural community",
            "Participants working toward greater independence through everyday life and social skills",
        ],
        "how_we_work_heading": "How our team works",
        "how_we_work": [
            "We ask what a good week looks like for you — which people, places and activities matter — and build support around that, rather than slotting you into a fixed group program.",
        ],
        "multilingual_heading": "Multilingual and culturally responsive support",
        "multilingual": "Our team includes Arabic, Somali, Dari and Amharic speakers who understand the cultural and religious context behind the activities you want to take part in, from mosque attendance to specific community celebrations.",
        "why_choose": [
            "Fully NDIS registered — registration #4050045262",
            "Support built around your community, culture and faith, not a fixed group program",
            "Multilingual team across QLD, NSW, VIC and WA",
            "Gender-matched support workers available for outings",
        ],
        "get_started_steps": [
            "Tell us what community involvement matters to you",
            "We call you back, usually within 2 business hours",
            "We check your available Community Participation funding",
            "We build a plan around your interests and schedule",
            "Support begins — often within the same week",
        ],
        "faqs": [
            {"q": "Can community participation support include attending religious services?", "a": "Yes — accompaniment to a mosque, church, temple or other place of worship is a common and legitimate use of this funding where it's included in your plan."},
            {"q": "Is this the same as core supports?", "a": "It overlaps — some community participation is funded under Core Supports, and skill-building components can sit under Capacity Building. We'll check what's in your specific plan."},
            {"q": "Can I do activities one-on-one rather than in a group?", "a": "Yes, depending on your funding and goals — many participants prefer one-on-one outings, and we plan around that preference."},
        ],
        "highlight": {
            "label": "Why it matters",
            "color": "green",
            "text": "The NDIS funds community participation because social connection is directly linked to health, wellbeing and independence. We help you use your funding for things that genuinely matter to you.",
        },
    },
    {
        "slug": "therapy-services",
        "name": "Therapy Services",
        "card_desc": "OT, physiotherapy, psychology and allied health — clinically excellent, culturally informed.",
        "icon": "🩺",
        "hero_gradient": "linear-gradient(135deg,#122040,#1D3461)",
        "eyebrow": "NDIS Capacity Building — Therapy",
        "meta_title": "NDIS Therapy Services Logan & Brisbane | OT, Physio, Psychology",
        "meta_description": "NDIS allied health in Logan and Brisbane — occupational therapy, physiotherapy, psychology and speech pathology. All plan types, referrals answered within 2 business hours.",
        "h1": "NDIS Therapy Services in Logan & Brisbane",
        "intro": [
            "Our allied health team delivers occupational therapy, physiotherapy, psychology and speech pathology to NDIS participants across Logan, Brisbane and South East Queensland — combining clinical rigour with a genuine understanding of participants' cultural and language needs.",
        ],
        "what_is_heading": "NDIS therapy supports, explained",
        "what_is": [
            "Therapy supports are generally funded under Capacity Building — Improved Daily Living in an NDIS plan, and are intended to help you build skills and independence, not just manage symptoms. The specific therapies and hours funded depend on your assessed needs and plan.",
        ],
        "included_heading": "What we offer",
        "included_categories": [
            {
                "title": "Occupational therapy",
                "icon": "🧑‍🦽",
                "items": [
                    "Functional capacity assessments",
                    "Assistive technology recommendations",
                    "Home modification assessments",
                    "Independent living skills",
                ],
            },
            {
                "title": "Physiotherapy",
                "icon": "🏃",
                "items": [
                    "Injury and chronic condition treatment",
                    "Exercise programmes",
                    "Falls prevention",
                ],
            },
            {
                "title": "Psychology",
                "icon": "🧠",
                "items": [
                    "Individual therapy and counselling",
                    "Trauma-informed care",
                    "Culturally sensitive mental health support",
                ],
            },
            {
                "title": "Speech pathology",
                "icon": "💬",
                "items": [
                    "Communication assessment and therapy",
                    "Swallowing and feeding support",
                    "Augmentative and alternative communication (AAC) support",
                ],
            },
        ],
        "who_for_heading": "Who this service is for",
        "who_for": [
            "Participants with an active NDIS plan funding one or more allied health therapies",
            "GPs and health professionals seeking a culturally diverse allied health team for referrals in Logan and Brisbane",
            "Families wanting therapy delivered in a culturally and linguistically sensitive way",
        ],
        "how_we_work_heading": "How our therapy team works",
        "how_we_work": [
            "Every therapy pathway starts with an assessment against your NDIS goals, delivered by a clinician who understands both the clinical evidence and the cultural context you're working within. We coordinate with your support coordinator or plan manager to keep therapy aligned with your broader plan.",
        ],
        "multilingual_heading": "Multilingual and culturally responsive support",
        "multilingual": "For health professionals and families from Arabic-, Somali-, Dari- and Amharic-speaking communities, we can provide therapy and communication in-language where a team member with that language is available — ask when you enquire or refer.",
        "why_choose": [
            "Fully NDIS registered — registration #4050045262",
            "We accept all plan types: agency managed, plan managed and self managed",
            "Operating across QLD, NSW, VIC and WA",
            "Referrals from GPs and health professionals answered within 2 business hours",
        ],
        "get_started_steps": [
            "Submit an enquiry or professional referral",
            "We confirm receipt within 2 business hours",
            "Initial assessment is scheduled",
            "A therapy programme is developed against your NDIS goals",
            "Ongoing progress updates are provided to you and, with consent, your referrer",
        ],
        "faqs": [
            {"q": "Do you accept GP and allied health referrals?", "a": "Yes — use our referral form or email us directly. We respond to professional referrals within 2 business hours."},
            {"q": "Do I need a specific referral to access NDIS-funded therapy?", "a": "You need therapy funding included in your NDIS plan under Capacity Building. A GP or specialist referral can support the therapy but isn't always required by the NDIS itself — check your plan or ask us to confirm."},
            {"q": "Can therapy be delivered at home?", "a": "In many cases, yes, depending on the therapy type and your plan. Ask our team when you enquire."},
        ],
        "highlight": {
            "label": "For health professionals",
            "color": "purple",
            "text": "We're fully NDIS registered (#4050045262), accept all plan types, and operate across QLD, NSW, VIC and WA. We respond to all referrals within 2 business hours.",
        },
    },
]

SERVICE_BY_SLUG = {s["slug"]: s for s in SERVICES}

# ---------------------------------------------------------------------------
# LOCATIONS
# ---------------------------------------------------------------------------

LOCATIONS = [
    {
        "slug": "logan-central",
        "name": "Logan Central",
        "region_tag": "Home base",
        "meta_title": "NDIS Provider Logan Central, QLD | Support Coordination & Daily Living",
        "meta_description": "NDIS registered provider based in Logan Central, QLD. Support coordination, daily living, community participation and therapy. Multilingual team. Call 0433 604 507.",
        "h1": "NDIS Provider in Logan Central",
        "intro": [
            "The Health & Well-being Hub is based at 73 Jacaranda Avenue in Logan Central — this is genuinely our home turf, not a service area added for search visibility. Logan Central is one of Queensland's most culturally diverse communities, and it's exactly why our founder built a multilingual, culturally responsive NDIS provider here.",
            "Because we're local, response times for Logan Central participants are fast, and our team already understands the community — from local support networks to the cultural and faith communities many participants are part of.",
        ],
        "local_note": "Being based in Logan Central means we can typically meet new participants in person early on, rather than only over the phone — something families often tell us they value when they're deciding whether to trust a new provider.",
        "faqs": [
            {"q": "Is The Health & Well-being Hub actually based in Logan Central?", "a": "Yes — our office is at 73 Jacaranda Avenue, Logan QLD 4114, in Logan Central."},
            {"q": "How quickly can support start in Logan Central?", "a": "In most cases we can begin support within the same week as your first enquiry, since our team is already local."},
            {"q": "Can I switch to The Health & Well-being Hub from my current Logan Central provider?", "a": "Yes — you can change NDIS providers at any time. We handle the transition and can usually avoid any gap in your support."},
        ],
    },
    {
        "slug": "logan",
        "name": "Logan",
        "region_tag": "Home base",
        "meta_title": "NDIS Provider Logan, QLD | The Health & Well-being Hub",
        "meta_description": "Local NDIS provider serving Logan, QLD. Support coordination, core supports, community participation and therapy from a Logan Central based, multilingual team.",
        "h1": "NDIS Provider in Logan",
        "intro": [
            "From our base in Logan Central, our team supports NDIS participants right across the broader Logan region — including support coordination, daily living support, community participation and allied health therapy.",
            "Logan is home to a large and culturally diverse population, including many Arabic-, Somali-, Dari- and Amharic-speaking families. We built our team to reflect that, so participants can discuss their plan and their support needs in a language they're comfortable with.",
        ],
        "local_note": "Because we're based locally in Logan Central rather than operating out of a call centre elsewhere, we can generally start support faster and coordinate more easily with other local services and community organisations across Logan.",
        "faqs": [
            {"q": "What NDIS services are available in Logan?", "a": "We offer support coordination, core supports and daily living, community participation, and therapy services (occupational therapy, physiotherapy, psychology and speech pathology) to participants across Logan."},
            {"q": "Do you offer gender-matched support workers in Logan?", "a": "Yes — we do our best to match participants with a support worker of their preferred gender."},
            {"q": "How do I change NDIS providers in Logan?", "a": "You have the right to change providers at any time. Call us on 0433 604 507 or submit an enquiry and we'll manage the transition, aiming for no gap in your support."},
        ],
    },
    {
        "slug": "brisbane",
        "name": "Brisbane",
        "region_tag": "Actively servicing",
        "meta_title": "NDIS Provider Brisbane | Multilingual & Culturally Diverse Team",
        "meta_description": "NDIS provider servicing Brisbane from our Logan Central base. Multilingual team speaking Arabic, Somali, Dari and Amharic. Support coordination, daily living, therapy.",
        "h1": "NDIS Provider in Brisbane",
        "intro": [
            "The Health & Well-being Hub is based just south of Brisbane in Logan Central, and our team regularly supports NDIS participants throughout greater Brisbane — bringing the same person-centred, multilingual approach into the city.",
            "For Brisbane's Arabic-speaking, Somali, Afghan and Ethiopian communities in particular, finding an NDIS provider who understands language, faith and culture can be difficult. That gap is exactly why The Health & Well-being Hub was founded.",
        ],
        "local_note": "We travel into Brisbane for support coordination meetings, community participation outings and, where appropriate, in-home and therapy support — while keeping the responsiveness of a locally based team.",
        "faqs": [
            {"q": "Is The Health & Well-being Hub an NDIS provider Brisbane participants can actually use, even though you're based in Logan?", "a": "Yes — we actively support NDIS participants throughout Brisbane from our Logan Central base."},
            {"q": "Do you have Arabic speaking staff for Brisbane participants?", "a": "Yes, our team includes Arabic speakers, along with Somali, Dari and Amharic speakers."},
            {"q": "Which Brisbane services do you offer?", "a": "Support coordination, core supports and daily living, community participation, and therapy services (OT, physiotherapy, psychology, speech pathology)."},
        ],
    },
    {
        "slug": "gold-coast",
        "name": "Gold Coast",
        "region_tag": "Actively servicing",
        "meta_title": "NDIS Provider Gold Coast | The Health & Well-being Hub",
        "meta_description": "NDIS support services extending to the Gold Coast from our Logan Central base — support coordination, daily living and community participation. Call 0433 604 507.",
        "h1": "NDIS Provider Servicing the Gold Coast",
        "intro": [
            "From our Logan Central base, The Health & Well-being Hub extends NDIS support into the Gold Coast, including support coordination, core supports and community participation.",
            "As with all our service areas, we confirm exact coverage and available support workers for your specific Gold Coast suburb when you enquire, since availability can vary by location and the type of support you need.",
        ],
        "local_note": "If you're on the Gold Coast, call us or submit an enquiry and we'll confirm what we can offer at your address before you commit to anything.",
        "faqs": [
            {"q": "Do you service all Gold Coast suburbs?", "a": "Coverage can vary by suburb and support type. Call 0433 604 507 or submit an enquiry and we'll confirm availability for your specific location."},
            {"q": "What support is available on the Gold Coast?", "a": "Support coordination, core supports and daily living, and community participation are our primary Gold Coast offerings. Ask us about therapy services availability in your area."},
        ],
    },
    {
        "slug": "ipswich",
        "name": "Ipswich",
        "region_tag": "Actively servicing",
        "meta_title": "NDIS Provider Ipswich | The Health & Well-being Hub",
        "meta_description": "NDIS support services extending to Ipswich from our Logan Central base — support coordination, daily living and community participation. Call 0433 604 507.",
        "h1": "NDIS Provider Servicing Ipswich",
        "intro": [
            "The Health & Well-being Hub extends NDIS support from Logan Central out to Ipswich, including support coordination, core supports and community participation for local participants.",
            "As with all our service areas outside our immediate Logan Central base, we confirm exact coverage and available support workers for your Ipswich suburb when you enquire.",
        ],
        "local_note": "If you're in Ipswich, call us or submit an enquiry and we'll confirm what we can offer at your address before you commit to anything.",
        "faqs": [
            {"q": "Do you service all Ipswich suburbs?", "a": "Coverage can vary by suburb and support type. Call 0433 604 507 or submit an enquiry and we'll confirm availability for your specific location."},
            {"q": "What support is available in Ipswich?", "a": "Support coordination, core supports and daily living, and community participation are our primary Ipswich offerings. Ask us about therapy services availability in your area."},
        ],
    },
]

LOCATION_BY_SLUG = {l["slug"]: l for l in LOCATIONS}

# ---------------------------------------------------------------------------
# HOMEPAGE FAQ (also used in FAQPage schema)
# ---------------------------------------------------------------------------

HOME_FAQS = [
    {"q": "Can I switch from my current NDIS provider?", "a": "Yes — you have the right to change providers at any time. It's your plan and your choice. We can help make the transition seamless, often with no gap in support."},
    {"q": "How quickly can I start?", "a": "In most cases we can begin support within the same week as your first enquiry. Call 0433 604 507 today."},
    {"q": "Do you offer gender-matched support workers?", "a": "Yes. We understand the importance of this for many of our participants and families. We do our best to match participants with a support worker of their preferred gender."},
    {"q": "Do you accommodate cultural and religious needs?", "a": "Yes. Our team is sensitive to all cultural and religious values. We offer gender-matched support workers, accommodate dietary requirements, respect religious observances and schedules, and work to ensure every participant feels seen and respected."},
    {"q": "What languages do your team speak?", "a": "Our team speaks Arabic, Somali, Amharic, Dari and English. When you enquire, let us know your preferred language and we'll match you with a team member who speaks it."},
    {"q": "What plan types do you work with?", "a": "We work with all NDIS plan types — agency managed, plan managed, and self managed."},
    {"q": "Do you service my area?", "a": "We operate across QLD, NSW, VIC and WA. Call 0433 604 507 or submit an enquiry and we'll confirm coverage for your location."},
    {"q": "Are you NDIS registered?", "a": "Yes — fully registered NDIS provider. Registration number: 4050045262. We meet all NDIS Practice Standards and are fully insured and compliant."},
]

DIRECTORY_FAQS = [
    {"q": "What is an NDIS registered provider?", "a": "An NDIS registered provider has been independently audited against the NDIS Practice Standards and approved by the NDIS Quality and Safeguards Commission to deliver supports. Registration is required if a participant's plan is agency managed, and is one signal (not the only one) that a provider meets consistent quality and safety benchmarks."},
    {"q": "Do I have to use an NDIS registered provider?", "a": "It depends on how your plan is managed. Agency managed funds can only be used with registered providers. Plan managed and self managed funds can generally be used with both registered and unregistered providers, giving you more choice — always check your plan's management type if you're unsure."},
    {"q": "How do I choose the right allied health or NDIS provider?", "a": "Check their registration status and specific service categories, ask about experience with your specific needs, confirm availability and wait times in your area, and read reviews where available. It's also reasonable to ask providers directly about their approach before committing."},
    {"q": "Is this directory free to use?", "a": "Yes — searching and filtering the directory is completely free, with no obligation to use any listed provider."},
]

TESTIMONIALS = [
    {
        "text": "Highly recommend The Health Wellbeing Hub. The staff are very friendly, supportive, and genuinely care about the people they help. They have great morals and always prioritise people in need. You can tell they are passionate about making a positive difference in the community.",
        "name": "Karim Mohamed",
        "initials": "KM",
    },
    {
        "text": "I can't speak highly enough about The Health & Well-Being Hub. From the moment I walked in, I felt welcomed, supported, and genuinely cared for. The team is incredibly knowledgeable, compassionate, and truly committed to helping you feel your best.",
        "name": "Michael Sanders",
        "initials": "MS",
    },
    {
        "text": "It's rare to find a provider that balances efficiency with genuine empathy, but The Health & Well-Being Hub does just that. They've helped me feel more confident and independent, which is exactly what good support should do.",
        "name": "James Weston",
        "initials": "JW",
    },
]

LANGUAGES = [
    {"code": "ar", "name": "Arabic", "flag": "🇸🇦", "native": "دعمك. بطريقتك.", "gradient": "linear-gradient(135deg,#006C35,#0a3d20)"},
    {"code": "so", "name": "Somali", "flag": "🇸🇴", "native": "Taageeradaada. Habkaaga.", "gradient": "linear-gradient(135deg,#4189DD,#1d3f6e)"},
    {"code": "fa-af", "name": "Dari", "flag": "🇦🇫", "native": "حمایت شما. به شیوه شما.", "gradient": "linear-gradient(135deg,#2b2b2b,#000)"},
    {"code": "am", "name": "Amharic", "flag": "🇪🇹", "native": "የእርስዎ ድጋፍ።", "gradient": "linear-gradient(135deg,#078930,#043d15)"},
]

# ---------------------------------------------------------------------------
# BLOG
# ---------------------------------------------------------------------------

BLOG_POSTS = [
    {
        "slug": "how-to-choose-an-ndis-provider-in-logan",
        "category": "Choosing a provider",
        "title": "How to Choose an NDIS Provider in Logan",
        "dek": "Eight practical questions to ask before you sign up with an NDIS provider in Logan or Logan Central — from registration checks to language support.",
        "meta_title": "How to Choose an NDIS Provider in Logan | The Health & Well-being Hub",
        "meta_description": "A practical guide to choosing an NDIS provider in Logan and Logan Central — what to check, what to ask, and the questions many families forget.",
        "read_time": "6 min read",
        "body": [
            {"type": "p", "text": "Choosing an NDIS provider is a big decision — you're trusting someone with your day-to-day support, your goals, and often your family's wellbeing. If you're searching for an NDIS provider in Logan or Logan Central, here's what's actually worth checking before you commit."},
            {"type": "h2", "text": "1. Are they actually NDIS registered?"},
            {"type": "p", "text": "Registration isn't just a formality — registered providers are audited against the NDIS Practice Standards and must meet specific quality and safeguarding requirements. You can ask any provider for their NDIS registration number directly, or search the NDIS Provider Register. If you're self-managed, you can use unregistered providers too, but registration is still a useful trust signal."},
            {"type": "h2", "text": "2. Do they actually service your suburb?"},
            {"type": "p", "text": "Some providers list broad coverage areas online but struggle to actually roster staff in every suburb they claim. Ask directly: how many support workers do they currently have available in your specific area, and how far will they need to travel?"},
            {"type": "h2", "text": "3. Can they support you in your preferred language?"},
            {"type": "p", "text": "Logan is one of Queensland's most culturally diverse local government areas. If English isn't your first language, or your family member's, ask whether the provider has staff who speak your language — not just whether they \"can arrange an interpreter.\" There's a real difference between the two."},
            {"type": "h2", "text": "4. Will they match support workers to your preferences?"},
            {"type": "p", "text": "Many participants have valid reasons for wanting a support worker of a specific gender, or one who understands particular cultural or religious practices. Ask how the provider handles these preferences, and whether it's treated as a standard part of onboarding or an awkward special request."},
            {"type": "h2", "text": "5. How quickly can support actually start?"},
            {"type": "p", "text": "Ask for a realistic timeframe, not a marketing promise. A locally based provider with staff already in your area can often start faster than one coordinating from interstate."},
            {"type": "h2", "text": "6. What plan types do they accept?"},
            {"type": "p", "text": "Confirm the provider works with your plan management type — agency managed, plan managed, or self managed — before you get too far into the process."},
            {"type": "h2", "text": "7. How do they handle complaints or issues?"},
            {"type": "p", "text": "Ask what happens if something goes wrong — a missed shift, a support worker who isn't the right fit, a billing question. A provider with a clear, simple complaints process is generally a safer bet than one without one."},
            {"type": "h2", "text": "8. Can you actually change providers if it doesn't work out?"},
            {"type": "p", "text": "Yes, always — as an NDIS participant you can change providers at any time. Ask any new provider how they'd help make that transition smooth if you ever needed to switch again."},
            {"type": "h2", "text": "Our approach in Logan and Logan Central"},
            {"type": "p", "text": "We're a locally based, NDIS registered provider (registration #4050045262) at 73 Jacaranda Avenue, Logan Central. Our team speaks English, Arabic, Somali, Dari and Amharic, offers gender-matched support workers on request, and responds to enquiries within 2 business hours."},
        ],
        "related_service": "support-coordination",
        "related_location": "logan-central",
    },
    {
        "slug": "how-to-change-ndis-providers",
        "category": "Switching providers",
        "title": "How to Change NDIS Providers (Without Losing Support)",
        "dek": "You can change NDIS providers at any time. Here's how to do it without a gap in your support, step by step.",
        "meta_title": "How to Change NDIS Providers | The Health & Well-being Hub",
        "meta_description": "You can switch NDIS providers at any time. A step-by-step guide to changing providers smoothly, without losing support along the way.",
        "read_time": "5 min read",
        "body": [
            {"type": "p", "text": "One of the most common questions we hear is some version of: \"Can I actually leave my current NDIS provider?\" The answer is always yes — it's your NDIS plan, and provider choice sits with you (or your nominee), not the provider."},
            {"type": "h2", "text": "Step 1: Check your service agreement"},
            {"type": "p", "text": "Most NDIS service agreements include a notice period for ending services — commonly a few weeks. Check yours so you know the timeline, and to help plan a smooth handover rather than an abrupt stop."},
            {"type": "h2", "text": "Step 2: Choose your new provider first"},
            {"type": "p", "text": "Line up your new provider before formally ending the old one, so there's minimal — ideally no — gap in support. A good new provider will help you plan this transition rather than leaving you to manage it alone."},
            {"type": "h2", "text": "Step 3: Notify your current provider in writing"},
            {"type": "p", "text": "A short email or letter is usually enough, referencing your service agreement's notice period. Keep a copy for your records."},
            {"type": "h2", "text": "Step 4: Update your plan manager or the NDIA"},
            {"type": "p", "text": "If you're plan managed, let your plan manager know about the change so future invoices go to the right provider. If you're agency managed, your new provider will generally handle the necessary NDIS system updates."},
            {"type": "h2", "text": "Step 5: Transfer relevant information"},
            {"type": "p", "text": "With your consent, your new provider can request relevant plan and support information from your previous one, so you don't have to explain your entire situation from scratch."},
            {"type": "h2", "text": "What if I'm worried about confrontation with my current provider?"},
            {"type": "p", "text": "You're not obligated to justify your decision in detail. A simple, polite notice referencing your service agreement is sufficient. If you'd feel more comfortable, a new support coordinator can help manage this communication for you."},
            {"type": "h2", "text": "Switching to The Health & Well-being Hub"},
            {"type": "p", "text": "If you're considering a switch, we can talk through the process with you — including in Arabic, Somali, Dari or Amharic if that's more comfortable — and aim for no gap in your support. Call 0433 604 507 or submit an enquiry to start the conversation."},
        ],
        "related_service": "support-coordination",
        "related_location": "logan",
    },
    {
        "slug": "what-does-an-ndis-support-coordinator-do",
        "category": "NDIS explained",
        "title": "What Does an NDIS Support Coordinator Do?",
        "dek": "A plain-English explanation of Support Coordination funding, what a coordinator actually does day to day, and how it differs from plan management.",
        "meta_title": "What Does an NDIS Support Coordinator Do? | The Health & Well-being Hub",
        "meta_description": "A plain-English guide to what NDIS support coordinators actually do, the different levels of Support Coordination, and how to know if you have this funding.",
        "read_time": "5 min read",
        "body": [
            {"type": "p", "text": "\"Support Coordination\" is one of the more confusing terms in the NDIS, partly because it's easy to mix up with plan management. Here's what a support coordinator actually does."},
            {"type": "h2", "text": "The short version"},
            {"type": "p", "text": "A support coordinator helps you understand and use your NDIS plan. They don't manage your funding or pay invoices (that's plan management), and they don't usually provide hands-on daily support themselves (that's core supports). Instead, they help you find the right providers, set up services, and keep everything working together."},
            {"type": "h2", "text": "The three levels of Support Coordination"},
            {"type": "p", "text": "The NDIS funds Support Coordination at different levels depending on your assessed needs:"},
            {"type": "ul", "items": [
                "Support Connection — building your ability to connect with informal, community and funded supports",
                "Coordination of Supports — helping you design and use a mix of supports to pursue your goals and live more independently",
                "Specialist Support Coordination — for participants with more complex situations, delivered by a specialist practitioner",
            ]},
            {"type": "p", "text": "Which level (if any) you have is set out in your NDIS plan — it's worth checking your plan document or asking your NDIA planner if you're unsure."},
            {"type": "h2", "text": "What a support coordinator actually does week to week"},
            {"type": "ul", "items": [
                "Explains what your plan funding actually covers, in plain language",
                "Researches and connects you with providers that suit your goals",
                "Helps set up service agreements and bookings",
                "Attends appointments or meetings with you when useful",
                "Steps in if a provider relationship isn't working",
                "Helps you prepare for plan reviews",
            ]},
            {"type": "h2", "text": "Support Coordination vs Plan Management"},
            {"type": "p", "text": "These are commonly confused but serve different purposes. A plan manager handles the financial and administrative side of your plan — paying invoices and tracking your budget. A support coordinator helps you use your plan in practice — finding services and keeping them working. Some participants have both, some have one, and some have neither (self-managing everything themselves)."},
            {"type": "h2", "text": "How we approach support coordination"},
            {"type": "p", "text": "Our coordinators are based in Logan Central and speak English, Arabic, Somali, Dari and Amharic. We respond to enquiries within 2 business hours and can usually begin within the same week."},
        ],
        "related_service": "support-coordination",
        "related_location": "logan-central",
    },
    {
        "slug": "finding-a-multilingual-ndis-provider-in-brisbane",
        "category": "Multilingual support",
        "title": "Finding a Multilingual NDIS Provider in Brisbane",
        "dek": "Why language matters when choosing an NDIS provider, and what to ask before committing — for Arabic, Somali, Dari and Amharic speaking families in Brisbane and Logan.",
        "meta_title": "Finding a Multilingual NDIS Provider in Brisbane | The Health & Well-being Hub",
        "meta_description": "A guide for Arabic, Somali, Dari and Amharic speaking families searching for a multilingual, culturally responsive NDIS provider in Brisbane and Logan.",
        "read_time": "5 min read",
        "body": [
            {"type": "p", "text": "For many families in Brisbane and Logan, the hardest part of the NDIS isn't the paperwork — it's doing all of it in a second or third language, about something as personal as a family member's care."},
            {"type": "h2", "text": "Why \"we can arrange an interpreter\" isn't the same as a multilingual team"},
            {"type": "p", "text": "Most large providers will tell you they can book an interpreter for meetings. That's useful, but it's different from having team members who speak your language day to day — for quick phone calls, for support workers who can talk with your family member directly, and for the small cultural context that gets lost in formal interpreting."},
            {"type": "h2", "text": "Questions worth asking a prospective provider"},
            {"type": "ul", "items": [
                "Do you have staff who personally speak my language, not just access to an interpreter service?",
                "Can my support worker communicate directly with my family member in their own language?",
                "How do you handle cultural or religious considerations — is it built into onboarding, or something I have to keep re-explaining?",
                "Can I request a support worker of a specific gender for cultural or religious reasons?",
            ]},
            {"type": "h2", "text": "Our team"},
            {"type": "p", "text": "The Health & Well-being Hub was founded in Logan Central by Kholoud Abdalla, who saw first-hand how many Arabic-speaking, Somali, Afghan and Ethiopian families in Brisbane's diverse communities struggled to find an NDIS provider who understood their culture, faith and language. Our team speaks English, Arabic, Somali, Dari and Amharic, and we serve participants across Brisbane, Logan and surrounding South East Queensland."},
            {"type": "p", "text": "This page is written in English. When you call or enquire, tell us your preferred language and we'll connect you with a team member who speaks it directly."},
            {"type": "h2", "text": "A note on what we don't claim"},
            {"type": "p", "text": "We don't currently publish fully translated versions of this website in Arabic, Somali, Dari or Amharic — we'd rather be upfront about that than imply otherwise. What we do have is team members who speak these languages and can support you directly, by phone, WhatsApp or in person."},
        ],
        "related_service": "support-coordination",
        "related_location": "brisbane",
    },
]

BLOG_BY_SLUG = {p["slug"]: p for p in BLOG_POSTS}

CONTENT_OPPORTUNITIES = [
    "What Does an NDIS Support Coordinator Do? vs Plan Manager — comparison deep dive",
    "Support Coordination vs Plan Management: Which Do I Need?",
    "What Are NDIS Core Supports? A Full Breakdown",
    "What Does Community Participation Cover Under NDIS?",
    "Can I Choose My Own NDIS Support Worker?",
    "Can I Request a Female or Male NDIS Support Worker?",
    "NDIS Support for Culturally Diverse Families in Brisbane",
    "What to Ask Before Choosing an NDIS Provider (Checklist)",
    "NDIS Services Available in Logan: Full Guide",
    "How Quickly Can You Change NDIS Providers?",
    "Agency Managed vs Plan Managed vs Self Managed NDIS Plans",
    "A Guide to NDIS Support for Somali Families in Brisbane",
    "A Guide to NDIS Support for Afghan (Dari-speaking) Families in Queensland",
    "A Guide to NDIS Support for Ethiopian (Amharic-speaking) Families in Brisbane",
    "What Happens at Your First NDIS Planning Meeting?",
    "How to Prepare for an NDIS Plan Review",
    "Occupational Therapy Under the NDIS: What to Expect",
    "NDIS Support for Muslim Families: Faith-Sensitive Care Explained",
    "Community Participation Ideas for NDIS Participants in Logan",
    "How Plan Managers and Support Coordinators Work Together",
]
