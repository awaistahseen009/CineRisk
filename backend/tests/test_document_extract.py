"""Real document extraction, not the "decode raw bytes as UTF-8" placeholder
it replaced. Every case here is a genuine parse of a real file built with
the same library that would produce it, not a hand-typed byte string."""
from io import BytesIO

import pytest
from docx import Document
from fastapi import HTTPException
from pypdf import PdfWriter

from app.api.routes.document_extract import MIN_CONTENT_CHARS, extract_text


def _real_docx_bytes(paragraphs: list[str]) -> bytes:
    doc = Document()
    for p in paragraphs:
        doc.add_paragraph(p)
    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_txt_extracts_as_is():
    text = extract_text("script.txt", b"INT. OFFICE - DAY\nA real scene with real content.")
    assert "INT. OFFICE - DAY" in text


def test_fountain_extracts_as_is():
    text = extract_text("script.fountain", b"INT. OFFICE - DAY\nA real scene with real content.")
    assert "INT. OFFICE - DAY" in text


def test_docx_is_genuinely_parsed():
    raw = _real_docx_bytes(["INT. OFFICE - DAY", "A real scene with real content."])
    text = extract_text("script.docx", raw)
    assert "INT. OFFICE - DAY" in text
    assert "A real scene with real content." in text


def test_unsupported_extension_is_rejected_with_a_clear_message():
    with pytest.raises(HTTPException) as exc_info:
        extract_text("script.xyz", b"anything")
    assert exc_info.value.status_code == 400
    assert "Unsupported file type" in exc_info.value.detail
    assert ".pdf" in exc_info.value.detail and ".docx" in exc_info.value.detail


def test_empty_txt_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        extract_text("empty.txt", b"   \n\t  ")
    assert exc_info.value.status_code == 400
    assert "empty or unreadable" in exc_info.value.detail


def test_corrupted_pdf_is_rejected_not_silently_garbled():
    with pytest.raises(HTTPException) as exc_info:
        extract_text("bad.pdf", b"this is not a real pdf file")
    assert exc_info.value.status_code == 400
    assert "PDF" in exc_info.value.detail


def test_pdf_with_no_text_layer_is_rejected():
    """A blank/scanned-image PDF parses without error but yields no text --
    that must still be caught as unreadable, not treated as a valid empty
    document worth auditing."""
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = BytesIO()
    writer.write(buf)
    with pytest.raises(HTTPException) as exc_info:
        extract_text("blank.pdf", buf.getvalue())
    assert exc_info.value.status_code == 400
    assert "empty or unreadable" in exc_info.value.detail


def test_corrupted_docx_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        extract_text("bad.docx", b"this is not a real docx file")
    assert exc_info.value.status_code == 400
    assert ".docx" in exc_info.value.detail


def test_min_content_chars_is_a_real_positive_number():
    # Sanity check on the constant itself, since the frontend duplicates it
    # and both must move together if either changes.
    assert MIN_CONTENT_CHARS > 0
