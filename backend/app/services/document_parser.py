import io
from pathlib import Path
from typing import Tuple
import pymupdf  # PyMuPDF
import docx


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract clean text from PDF bytes using PyMuPDF.
    
    Raises:
        ValueError: If PDF is empty, unreadable, or scanned image with no text layer.
    """
    if not file_bytes:
        raise ValueError("The uploaded PDF file is empty (0 bytes).")

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Failed to open PDF document: {str(e)}")

    if doc.page_count == 0:
        raise ValueError("PDF document contains no pages.")

    text_pages = []
    for page_idx in range(doc.page_count):
        page = doc.load_page(page_idx)
        text = page.get_text("text").strip()
        if text:
            text_pages.append(text)

    full_text = "\n\n".join(text_pages).strip()

    if not full_text:
        raise ValueError(
            "PDF contains no extractable text layer. The document may be scanned or image-only."
        )

    return full_text


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract clean text from DOCX bytes using python-docx.
    
    Raises:
        ValueError: If DOCX is empty or corrupted.
    """
    if not file_bytes:
        raise ValueError("The uploaded DOCX file is empty (0 bytes).")

    try:
        doc = docx.Document(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Failed to open DOCX document: {str(e)}")

    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

    # Also capture table contents
    for table in doc.tables:
        for row in table.rows:
            row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_text:
                paragraphs.append(" | ".join(row_text))

    full_text = "\n\n".join(paragraphs).strip()

    if not full_text:
        raise ValueError("DOCX file contains no extractable text content.")

    return full_text


def extract_text_from_plain(file_bytes: bytes) -> str:
    """Decode plain text or markdown bytes."""
    if not file_bytes:
        raise ValueError("The uploaded text file is empty (0 bytes).")

    try:
        text = file_bytes.decode("utf-8").strip()
    except UnicodeDecodeError:
        try:
            text = file_bytes.decode("latin-1").strip()
        except Exception as e:
            raise ValueError(f"Failed to decode text file: {str(e)}")

    if not text:
        raise ValueError("Text file contains no content.")

    return text


def parse_document(filename: str, file_bytes: bytes) -> Tuple[str, int, int]:
    """Inspects file extension and extracts text.
    
    Returns:
        Tuple of (extracted_text, char_count, line_count)
    Raises:
        ValueError: On unsupported file types, empty files, or parse errors.
    """
    ext = Path(filename).suffix.lower()

    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    if ext == ".pdf":
        text = extract_text_from_pdf(file_bytes)
    elif ext == ".docx":
        text = extract_text_from_docx(file_bytes)
    else:
        text = extract_text_from_plain(file_bytes)

    lines = [line for line in text.splitlines() if line.strip()]
    return text, len(text), len(lines)
