#!/usr/bin/env python3
"""Wraps the workflow pages into standalone HTML files the team can open.

WHY THIS EXISTS

The workflow pages are authored as Artifact sources, which means they are a
document *fragment*: styles and body content, with no <!doctype>, <html> or
<head>. The Artifact platform supplies that skeleton when it publishes, so the
published page is complete and correct.

Opened straight from disk, the same file is not. Without <meta charset>, a
browser guesses the encoding, and every em dash and curly quote on the page
renders as mojibake — "â€"" instead of "—". The content is valid UTF-8; the
declaration is simply missing, because the artifact wrapper was providing it.

So a file that is right in one context is wrong in the other. This script
resolves that by generating the standalone version rather than maintaining a
second copy: one source, two outputs, no drift.

Run: python3 build_team_pages.py
"""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "team")

# source fragment -> (output filename, browser tab title)
PAGES = {
    "workflow-01-referral-journey.html": ("referral-workflow.html", "Referral Received — how it works"),
    "workflows-overview.html": ("all-workflows.html", "The Eight Workflows"),
}

SHELL = """<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{title}</title>
<link rel="icon" href="/favicon.ico" sizes="48x48">
</head>
<body>
{body}
</body>
</html>
"""


def build(src_name, out_name, title):
    with open(os.path.join(ROOT, src_name), encoding="utf-8") as f:
        body = f.read()

    # The fragment carries its own <title> for the Artifact gallery. A full
    # document may only have one, and it belongs in <head>, so drop it here.
    body = re.sub(r"^\s*<title>.*?</title>\s*", "", body, count=1, flags=re.S | re.I)

    html = SHELL.format(title=title, body=body.strip())
    os.makedirs(OUT, exist_ok=True)
    dest = os.path.join(OUT, out_name)
    # Explicit encoding, never the locale default — the whole point of this file.
    with open(dest, "w", encoding="utf-8") as f:
        f.write(html)
    return dest, len(html)


if __name__ == "__main__":
    for src, (out, title) in PAGES.items():
        dest, size = build(src, out, title)
        print("wrote {} ({:,} bytes)".format(os.path.relpath(dest, ROOT), size))
