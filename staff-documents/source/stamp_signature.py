"""Stamps Ibrahim Zakariya's signature into the H&W representative's
signature box on the fillable agreements, in place. The signature becomes
page content and that one field is removed, so it can't be typed over;
every other field stays fillable. Re-running is harmless: a form whose
field is already gone is skipped."""
import io
import os
import sys

from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SIGNATURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ibrahim-zakariya-signature.png")
SIGNER = "Ibrahim Zakariya"

FORMS = [
    ("staff-documents/The Health & Well-being Hub - Support Worker Agreement (Fillable).pdf", "company_signature", None),
    ("participant-documents/The Health & Well-being Hub - Service Agreement (Fillable).pdf", "provider_signature", "provider_signature_name"),
]


def unshare_appearances(writer):
    """The generator gave many text fields one shared blank-box appearance,
    so filling one field in place (as pypdf and some viewers do) paints its
    text into every field sharing it. Give each text field its own copy."""
    seen = set()
    for page in writer.pages:
        for annot in page.get("/Annots") or []:
            obj = annot.get_object()
            ap = obj.get("/AP")
            if obj.get("/FT") != "/Tx" or not ap or "/N" not in ap:
                continue
            ref = ap.raw_get("/N")
            key = getattr(ref, "idnum", None)
            if key is None or key not in seen:
                seen.add(key)
                continue
            own = ap["/N"].get_object().clone(writer, force_duplicate=True)
            obj[NameObject("/AP")] = DictionaryObject({NameObject("/N"): own.indirect_reference})


def stamp(rel_path, sig_field, name_field):
    path = os.path.join(ROOT, rel_path)
    reader = PdfReader(path)
    writer = PdfWriter(clone_from=reader)
    target = None
    for page_index, page in enumerate(writer.pages):
        for annot in page.get("/Annots") or []:
            obj = annot.get_object()
            if obj.get("/T") == sig_field:
                target = (page_index, annot, [float(v) for v in obj["/Rect"]])
    if not target:
        print(f"skip (already signed): {rel_path}")
        return
    page_index, annot_ref, (x1, y1, x2, y2) = target
    page = writer.pages[page_index]

    # The pink box is the field's own appearance, so it goes with the field.
    # In its place: a signing line, with the signature sitting on it, far
    # enough right that its top stroke clears the "Signature" label.
    img = ImageReader(SIGNATURE)
    iw, ih = img.getSize()
    height = 42
    width = height * iw / ih
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(float(page.mediabox.width), float(page.mediabox.height)))
    c.setStrokeColorRGB(0.72, 0.66, 0.76)
    c.setLineWidth(0.8)
    c.line(x1, y1 + 2, x2, y1 + 2)
    c.drawImage(img, x1 + 56, y1 - 6, width=width, height=height, mask="auto")
    c.save()
    buf.seek(0)
    page.merge_page(PdfReader(buf).pages[0])

    page[NameObject("/Annots")] = type(page["/Annots"])(
        a for a in page["/Annots"] if a.get_object().get("/T") != sig_field
    )
    acro = writer._root_object["/AcroForm"]
    acro[NameObject("/Fields")] = type(acro["/Fields"])(
        f for f in acro["/Fields"] if f.get_object().get("/T") != sig_field
    )

    unshare_appearances(writer)
    if name_field:
        writer.update_page_form_field_values(page, {name_field: SIGNER}, auto_regenerate=False)

    with open(path, "wb") as fh:
        writer.write(fh)
    print(f"signed: {rel_path}")


if __name__ == "__main__":
    for form in FORMS:
        stamp(*form)
    sys.exit(0)
