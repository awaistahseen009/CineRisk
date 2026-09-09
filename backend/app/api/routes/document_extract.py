"""
Real text extraction for uploaded documents, keyed strictly by file
extension. Every supported format is genuinely parsed here -- there is no
"decode raw bytes as UTF-8 and hope" fallback, because that silently turns a
binary PDF or DOCX into unreadable noise that is technically non-empty and
would sail straight past an empty-content check while producing a garbage
audit. An unsupported extension is a clear, immediate error instead.
"""
from io import BytesIO

from docx import Document
from fastapi import HTTPException
from pypdf import PdfReader

# A script needs to actually say something to be worth auditing. This also
# catches the "decoded to a handful of stray bytes" failure mode for a
# format we do support but couldn't cleanly parse.
MIN_CONTENT_CHARS = 20

SUPPORTED_EXTENSIONS = (".txt", ".fountain", ".pdf", ".docx")


def extract_text(filename: str, raw_bytes: bytes) -> str:
    """Return the real extracted text, or raise HTTPException(400) with a
    message the frontend can show directly -- unsupported format, or a
    supported format that yielded no usable content."""
    lowered = filename.lower()
    ext = next((e for e in SUPPORTED_EXTENSIONS if lowered.endswith(e)), None)

    if ext is None:
        supported = ", ".join(SUPPORTED_EXTENSIONS)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type for \"{filename}\". Please upload one of: {supported}.",
        )

    if ext == ".pdf":
        text = _extract_pdf(raw_bytes, filename)
    elif ext == ".docx":
        text = _extract_docx(raw_bytes, filename)
    else:
        # .txt / .fountain are already plain text.
        text = raw_bytes.decode("utf-8", errors="ignore")

    if len(text.strip()) < MIN_CONTENT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"\"{filename}\" appears to be empty or unreadable. Please upload a script with actual content.",
        )

    return text


def _extract_pdf(raw_bytes: bytes, filename: str) -> str:
    try:
        reader = PdfReader(BytesIO(raw_bytes))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read \"{filename}\" as a PDF. The file may be corrupted, password-protected, or scanned images without embedded text.",
        ) from exc


def _extract_docx(raw_bytes: bytes, filename: str) -> str:
    try:
        document = Document(BytesIO(raw_bytes))
        return "\n".join(p.text for p in document.paragraphs)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read \"{filename}\" as a .docx file. It may be corrupted or an older .doc format, which isn't supported.",
        ) from exc
