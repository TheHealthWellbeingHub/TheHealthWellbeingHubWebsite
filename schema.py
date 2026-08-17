"""JSON-LD builders. Every entity is tied together with consistent @id
references rooted at ORG_ID / WEBSITE_ID so Google can connect them into
one entity graph, per the site's structured-data strategy. No ratings,
reviews or review counts are added to schema — only what's verifiable."""
import json


def _org_id(site):
    return site["base_url"] + "/#organization"


def _website_id(site):
    return site["base_url"] + "/#website"


def organization_graph(site):
    org_id = _org_id(site)
    return {
        "@type": ["LocalBusiness", "MedicalBusiness"],
        "@id": org_id,
        "name": site["name"],
        "url": site["base_url"] + "/",
        "telephone": site["phone_e164"],
        "email": site["email"],
        "priceRange": "$$",
        "founder": {"@type": "Person", "name": site["founder_name"]},
        "address": {
            "@type": "PostalAddress",
            "streetAddress": site["address_street"],
            "addressLocality": site["address_locality"],
            "addressRegion": site["address_region"],
            "postalCode": site["address_postcode"],
            "addressCountry": "AU",
        },
        "identifier": [
            {"@type": "PropertyValue", "name": "NDIS Registration Number", "value": site["ndis_reg_number"]},
            {"@type": "PropertyValue", "name": "ABN", "value": site["abn"]},
        ],
        "openingHoursSpecification": [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "opens": "08:00",
                "closes": "17:00",
            }
        ],
        "areaServed": [
            {"@type": "State", "name": "Queensland"},
            {"@type": "State", "name": "New South Wales"},
            {"@type": "State", "name": "Victoria"},
            {"@type": "State", "name": "Western Australia"},
        ],
        "availableLanguage": [
            {"@type": "Language", "name": "English"},
            {"@type": "Language", "name": "Arabic"},
            {"@type": "Language", "name": "Somali"},
            {"@type": "Language", "name": "Dari"},
            {"@type": "Language", "name": "Amharic"},
        ],
    }


def website_graph(site):
    return {
        "@type": "WebSite",
        "@id": _website_id(site),
        "url": site["base_url"] + "/",
        "name": site["name"],
        "publisher": {"@id": _org_id(site)},
    }


def webpage_node(site, path, name, description, page_type="WebPage"):
    return {
        "@type": page_type,
        "@id": site["base_url"] + path + "#webpage",
        "url": site["base_url"] + path,
        "name": name,
        "description": description,
        "isPartOf": {"@id": _website_id(site)},
        "about": {"@id": _org_id(site)},
        "inLanguage": "en-AU",
    }


def breadcrumb_node(site, path, crumbs):
    items = []
    for i, c in enumerate(crumbs, start=1):
        items.append(
            {
                "@type": "ListItem",
                "position": i,
                "name": c["name"],
                "item": site["base_url"] + c["url"] if not c["url"].startswith("http") else c["url"],
            }
        )
    return {
        "@type": "BreadcrumbList",
        "@id": site["base_url"] + path + "#breadcrumb",
        "itemListElement": items,
    }


def faqpage_node(site, path, faqs):
    return {
        "@type": "FAQPage",
        "@id": site["base_url"] + path + "#faq",
        "mainEntity": [
            {
                "@type": "Question",
                "name": f["q"],
                "acceptedAnswer": {"@type": "Answer", "text": f["a"]},
            }
            for f in faqs
        ],
    }


def service_node(site, svc, path):
    return {
        "@type": "Service",
        "@id": site["base_url"] + path + "#service",
        "name": svc["h1"],
        "serviceType": svc["name"],
        "description": svc["meta_description"],
        "provider": {"@id": _org_id(site)},
        "areaServed": [
            {"@type": "State", "name": "Queensland"},
            {"@type": "State", "name": "New South Wales"},
            {"@type": "State", "name": "Victoria"},
            {"@type": "State", "name": "Western Australia"},
        ],
        "url": site["base_url"] + path,
    }


def article_node(site, post, path):
    return {
        "@type": "Article",
        "@id": site["base_url"] + path + "#article",
        "headline": post["title"],
        "description": post["dek"],
        "author": {"@id": _org_id(site)},
        "publisher": {"@id": _org_id(site)},
        "mainEntityOfPage": site["base_url"] + path,
        "inLanguage": "en-AU",
    }


def graph(*nodes):
    return json.dumps({"@context": "https://schema.org", "@graph": list(nodes)}, indent=2, ensure_ascii=False)
