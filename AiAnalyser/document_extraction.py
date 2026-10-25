"""Standalone Docling extraction helper (CLI / debugging).

The production pipeline lives in ``app/nodes/extract.py``. This module keeps the
original behaviour available for quick local checks:

    uv run python -c "from document_extraction import document_extraction; document_extraction()"
"""

from __future__ import annotations

from pathlib import Path

from app.nodes.extract import convert_document


def document_extraction(
    input_pdf: str | Path = "data/resume_mukul_dahiya.pdf",
    output_dir: str | Path = "output",
) -> dict[str, Path]:
    input_pdf = Path(input_pdf)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_pdf.exists():
        raise FileNotFoundError(f"PDF not found: {input_pdf}")

    result = convert_document(input_pdf)

    markdown = result.document.export_to_markdown()
    markdown_path = output_dir / f"{input_pdf.stem}.md"
    markdown_path.write_text(markdown, encoding="utf-8")

    json_path = output_dir / f"{input_pdf.stem}.json"
    result.document.save_as_json(json_path)

    print(f"Markdown saved to: {markdown_path}")
    print(f"JSON saved to: {json_path}")
    print(f"Extracted characters: {len(markdown)}")

    return {"markdown": markdown_path, "json": json_path}
