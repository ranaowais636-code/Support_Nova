"""PDF/DOCX extraction and traceable chunking without requiring a browser upload service."""
import base64
import io
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from typing import Dict, List, Tuple
from xml.etree import ElementTree as ET


def _decode(data: str) -> bytes:
    if not data:
        return b""
    if "," in data and data.split(",", 1)[0].startswith("data:"):
        data = data.split(",", 1)[1]
    return base64.b64decode(data)


def _extract_docx(raw: bytes) -> Tuple[str, List[Tuple[str, str, str]]]:
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    chunks: List[Tuple[str, str, str]] = []
    paragraphs: List[str] = []
    for p in root.findall(".//w:p", ns):
        text = "".join(t.text or "" for t in p.findall(".//w:t", ns)).strip()
        if not text:
            continue
        paragraphs.append(text)
        style = p.find("./w:pPr/w:pStyle", ns)
        heading = style.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val", "") if style is not None else ""
        chunks.append((heading or "paragraph", text, "DOCX"))
    return "\n\n".join(paragraphs), chunks


def _extract_pdf(raw: bytes) -> Tuple[str, List[Tuple[str, str, str]]]:
    # Prefer pypdf when installed; otherwise use the OS pdftotext utility.
    text = ""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        pages = [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
        text = "\n\n".join(t for _, t in pages)
        chunks = [(f"page-{page_no}", t.strip(), f"p. {page_no}") for page_no, t in pages if t.strip()]
        return text, chunks
    except Exception:
        pass

    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        raise RuntimeError("PDF extraction requires pypdf or the pdftotext utility.")
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = os.path.join(tmp, "document.pdf")
        txt_path = os.path.join(tmp, "document.txt")
        with open(pdf_path, "wb") as f:
            f.write(raw)
        proc = subprocess.run([pdftotext, "-layout", pdf_path, txt_path], capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or "Unable to extract PDF text.")
        with open(txt_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    pages = [p.strip() for p in re.split(r"\f", text) if p.strip()]
    chunks = [(f"page-{i}", page, f"p. {i}") for i, page in enumerate(pages, 1)]
    return text, chunks


def extract_document(filename: str, encoded_data: str) -> Dict[str, object]:
    raw = _decode(encoded_data)
    if not raw:
        raise ValueError("Uploaded file is empty.")
    ext = os.path.splitext(filename.lower())[1]
    if ext == ".pdf":
        text, source_chunks = _extract_pdf(raw)
    elif ext == ".docx":
        text, source_chunks = _extract_docx(raw)
    else:
        raise ValueError("Only PDF and DOCX files are supported. You can also paste plain text manually.")
    if not text.strip():
        raise ValueError("No readable text was extracted from the document.")
    return {"text": text.strip(), "source_chunks": source_chunks, "filename": filename, "bytes": len(raw)}


def chunk_text(text: str, section: str, version: str, source_chunks=None, max_chars: int = 1800) -> List[Dict[str, str]]:
    chunks: List[Dict[str, str]] = []
    if source_chunks:
        for i, (heading, body, page_ref) in enumerate(source_chunks, 1):
            body = re.sub(r"\s+", " ", body).strip()
            if not body:
                continue
            for offset in range(0, len(body), max_chars):
                part = body[offset:offset + max_chars].strip()
                if part:
                    chunks.append({"section": f"{section}.{i}", "heading": heading, "page_ref": page_ref, "version": version, "chunk_text": part})
    else:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        buffer = ""
        idx = 0
        for paragraph in paragraphs:
            if len(buffer) + len(paragraph) + 2 <= max_chars:
                buffer = (buffer + "\n\n" + paragraph).strip()
            else:
                idx += 1
                chunks.append({"section": f"{section}.{idx}", "heading": f"Section {section}.{idx}", "page_ref": f"chunk {idx}", "version": version, "chunk_text": buffer})
                buffer = paragraph
        if buffer:
            idx += 1
            chunks.append({"section": f"{section}.{idx}", "heading": f"Section {section}.{idx}", "page_ref": f"chunk {idx}", "version": version, "chunk_text": buffer})
    return chunks
