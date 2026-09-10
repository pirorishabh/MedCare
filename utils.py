"""
utils.py — Shared Utility Functions
=====================================
Helper functions for file handling, text processing, and validation.
"""

import os
import re
import logging
import hashlib
import time
from werkzeug.utils import secure_filename
from config import config

logger = logging.getLogger(__name__)


# ── File Handling ─────────────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    """Check if the uploaded file extension is allowed."""
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in config.ALLOWED_EXTENSIONS
    )


def save_upload(file) -> tuple[str, str]:
    """
    Save an uploaded file securely and return (filename, filepath).
    Raises ValueError if the file type is not allowed.
    """
    if not file or file.filename == "":
        raise ValueError("No file selected.")
    if not allowed_file(file.filename):
        raise ValueError(
            f"File type not allowed. Supported: {', '.join(config.ALLOWED_EXTENSIONS)}"
        )

    os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)
    filename = secure_filename(file.filename)
    # Prefix with timestamp to avoid collisions
    unique_name = f"{int(time.time())}_{filename}"
    filepath = os.path.join(config.UPLOAD_FOLDER, unique_name)
    file.save(filepath)
    logger.info("Saved upload: %s", filepath)
    return unique_name, filepath


def extract_text_from_file(filepath: str) -> str:
    """
    Extract plain text from PDF, DOCX, or TXT files.
    Returns extracted text or raises an exception on failure.
    """
    ext = filepath.rsplit(".", 1)[-1].lower()

    if ext == "txt":
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    elif ext == "pdf":
        try:
            import PyPDF2
            text_parts = []
            with open(filepath, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text_parts.append(page.extract_text() or "")
            return "\n".join(text_parts)
        except Exception as e:
            logger.error("PDF extraction error: %s", e)
            raise

    elif ext == "docx":
        try:
            from docx import Document
            doc = Document(filepath)
            return "\n".join(para.text for para in doc.paragraphs)
        except Exception as e:
            logger.error("DOCX extraction error: %s", e)
            raise

    else:
        raise ValueError(f"Unsupported file type: {ext}")


# ── Text Processing ───────────────────────────────────────────────────────────

def sanitize_input(text: str, max_length: int = 2000) -> str:
    """Strip dangerous characters and enforce a max length on user input."""
    # Remove null bytes and control characters
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text.strip()[:max_length]


def truncate_text(text: str, max_chars: int = 500, suffix: str = "…") -> str:
    """Truncate text to a maximum character count."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + suffix


def markdown_to_html_safe(text: str) -> str:
    """Convert markdown text to sanitized HTML."""
    try:
        import markdown
        import bleach
        raw_html = markdown.markdown(
            text,
            extensions=["nl2br", "tables", "fenced_code"],
        )
        allowed_tags = [
            "p", "br", "strong", "em", "h1", "h2", "h3", "h4", "h5", "h6",
            "ul", "ol", "li", "blockquote", "code", "pre", "hr", "table",
            "thead", "tbody", "tr", "th", "td", "a",
        ]
        allowed_attrs = {"a": ["href", "title"]}
        return bleach.clean(raw_html, tags=allowed_tags, attributes=allowed_attrs)
    except Exception:
        return text


# ── Validation ────────────────────────────────────────────────────────────────

def validate_json_body(data: dict, required_fields: list) -> tuple[bool, str]:
    """
    Validate that all required fields exist in a JSON payload.
    Returns (is_valid: bool, error_message: str).
    """
    for field in required_fields:
        if field not in data or not str(data[field]).strip():
            return False, f"Missing required field: '{field}'"
    return True, ""


# ── Response Helpers ──────────────────────────────────────────────────────────

def success_response(data: dict, status: int = 200) -> tuple:
    """Build a standardized JSON success response."""
    from flask import jsonify
    return jsonify({"status": "success", **data}), status


def error_response(message: str, status: int = 400) -> tuple:
    """Build a standardized JSON error response."""
    from flask import jsonify
    logger.warning("API error %d: %s", status, message)
    return jsonify({"status": "error", "message": message}), status
