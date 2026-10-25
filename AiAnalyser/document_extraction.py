from pathlib import Path
from docling.document_converter import DocumentConverter


def document_extraction():
    
    # Input and output paths
    input_pdf = Path("data/resume_mukul_dahiya.pdf")
    output_dir = Path("output")

    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_pdf.exists():
        raise FileNotFoundError(f"PDF not found: {input_pdf}")
    
    # Initialize the converter
    converter = DocumentConverter()

    # Parse the PDF
    result = converter.convert(input_pdf)

    # Export the parsed document to Markdown
    markdown = result.document.export_to_markdown()

    # Save Markdown
    markdown_path = output_dir / f"{input_pdf.stem}.md"
    markdown_path.write_text(markdown, encoding="utf-8")

    # Export structured document data to JSON
    json_path = output_dir / f"{input_pdf.stem}.json"
    result.document.save_as_json(json_path)

    print(f"Markdown saved to: {markdown_path}")
    print(f"JSON saved to: {json_path}")
    print(f"Extracted characters: {len(markdown)}")




