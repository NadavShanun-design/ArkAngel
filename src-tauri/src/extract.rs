use anyhow::{Context, Result};
use std::{fs, io::Read, path::Path};
use mime_guess::MimeGuess;
use quick_xml::events::Event;
use quick_xml::Reader as XmlReader;
use zip::ZipArchive;

/// Public entrypoint used by your Tauri command: give it a path and it yields display-ready text.
pub fn extract_text_for_context(path: &Path) -> Result<String> {
    let name = path.file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());

    let file_type = detect_file_type(path);

    // Dispatch by rough type/extension
    let text = match file_type.as_str() {
        "pdf" => extract_pdf_text(path)
            .unwrap_or_else(|e| format!("[PDF: {} — text extraction failed: {}]", name, e)),

        "docx" => extract_docx_text(path)
            .unwrap_or_else(|e| format!("[DOCX: {} — text extraction failed: {}]", name, e)),

        // Plain text and code-like files: read verbatim
        "txt" | "md" | "json" | "csv" | "xml" | "yaml" | "yml" | "log"
        | "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "java" | "cpp" | "c" | "go" | "php"
        | "html" | "css" | "sql" => {
            fs::read_to_string(path)
                .unwrap_or_else(|e| format!("[{} — could not read file as text: {}]", name, e))
        }

        // Everything else: acknowledge but don't block the pipeline
        other => format!("[{} — no text extractor implemented for *.{} yet]", name, other),
    };

    // Wrap in the format your sidecar is already expecting
    Ok(format!("File: {name}\nContent:\n{text}"))
}

/// Light heuristic: prefer extension, fall back to MIME.
fn detect_file_type(path: &Path) -> String {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase());

    if let Some(ext) = ext {
        return ext;
    }

    let guess = MimeGuess::from_path(path).first_or_octet_stream();
    match (guess.type_().as_str(), guess.subtype().as_str()) {
        ("application", "pdf") => "pdf".into(),
        ("application", "vnd.openxmlformats-officedocument.wordprocessingml.document") => "docx".into(),
        ("text", _) => "txt".into(),
        _ => "bin".into(),
    }
}

fn extract_pdf_text(path: &Path) -> Result<String> {
    println!("[EXTRACT] Attempting to extract PDF: {:?}", path);
    
    // Check if file exists and get size
    if !path.exists() {
        return Ok(format!("[PDF file not found: {}]", path.display()));
    }
    
    let metadata = fs::metadata(path)?;
    println!("[EXTRACT] File size: {} bytes", metadata.len());
    
    // Try memory-based first (works well across platforms)
    let bytes = fs::read(path).with_context(|| format!("reading {}", path.display()))?;
    println!("[EXTRACT] Read {} bytes from file", bytes.len());
    
    match pdf_extract::extract_text_from_mem(&bytes) {
        Ok(t) if !t.trim().is_empty() => {
            println!("[EXTRACT] Successfully extracted {} chars from PDF", t.len());
            Ok(t)
        },
        Ok(_) => {
            println!("[EXTRACT] PDF appears to have no selectable text");
            Ok(format!(
                "[PDF appears to contain no selectable text — likely scanned images: {}]",
                path.file_name().unwrap_or_default().to_string_lossy()
            ))
        },
        Err(e) => {
            println!("[EXTRACT] Memory extraction failed: {}, trying path-based", e);
            // Fallback to path-based extractor if available in your crate version
            let p = path.to_string_lossy().to_string();
            match pdf_extract::extract_text(&p) {
                Ok(t) if !t.trim().is_empty() => {
                    println!("[EXTRACT] Path-based extraction succeeded: {} chars", t.len());
                    Ok(t)
                },
                Ok(_) => {
                    println!("[EXTRACT] Path-based extraction returned empty text");
                    Ok(format!(
                        "[PDF appears to contain no selectable text — likely scanned images: {}]",
                        path.file_name().unwrap_or_default().to_string_lossy()
                    ))
                },
                Err(e2) => {
                    println!("[EXTRACT] Both extraction methods failed: {}", e2);
                    Ok(format!(
                        "[PDF extraction failed: {} for file: {}]",
                        e2, path.file_name().unwrap_or_default().to_string_lossy()
                    ))
                }
            }
        }
    }
}

fn extract_docx_text(path: &Path) -> Result<String> {
    let file = fs::File::open(path)?;
    let mut zip = ZipArchive::new(file)?;

    // Wordprocessing content lives here
    let mut doc_xml = zip.by_name("word/document.xml")
        .context("DOCX missing word/document.xml")?;

    let mut xml = String::new();
    doc_xml.read_to_string(&mut xml)?;

    let mut reader = XmlReader::from_str(&xml);
    reader.trim_text(true);

    let mut buf = Vec::new();
    let mut in_text_node = false;
    let mut out = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name_bytes = e.name().as_ref().to_vec();
                // <w:t> holds text runs; <w:p> is a paragraph
                if name_bytes.ends_with(b"t") { in_text_node = true; }
                if name_bytes.ends_with(b"p") { out.push('\n'); }
            }
            Ok(Event::End(ref e)) => {
                let name_bytes = e.name().as_ref().to_vec();
                if name_bytes.ends_with(b"t") { in_text_node = false; }
            }
            Ok(Event::Text(e)) => {
                if in_text_node {
                    out.push_str(&e.unescape().unwrap_or_default());
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(anyhow::anyhow!("XML parse error: {}", e)),
            _ => {}
        }
        buf.clear();
    }

    // Collapse excessive whitespace while keeping paragraphs readable
    let cleaned = out
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(cleaned)
}