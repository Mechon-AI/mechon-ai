use serde_json::Value;

pub fn clean_translation_output(raw_content: &str) -> String {
    let trimmed = raw_content.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // 1. Check if the output is JSON or wrapped in code fences
    let json_candidate = if let Some(start) = trimmed.find("```json") {
        let content_after = &trimmed[start + 7..];
        if let Some(end) = content_after.rfind("```") {
            content_after[..end].trim()
        } else {
            content_after.trim()
        }
    } else if let Some(start) = trimmed.find("```") {
        let content_after = &trimmed[start + 3..];
        if let Some(end) = content_after.rfind("```") {
            content_after[..end].trim()
        } else {
            content_after.trim()
        }
    } else if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            &trimmed[start..=end]
        } else {
            trimmed
        }
    } else {
        trimmed
    };

    // If it successfully parses as JSON, extract the text field
    if let Ok(val) = serde_json::from_str::<Value>(json_candidate) {
        if let Some(text) = val.get("translation").and_then(|t| t.as_str()) {
            return text.trim().to_string();
        }
        if let Some(text) = val.get("translated_text").and_then(|t| t.as_str()) {
            return text.trim().to_string();
        }
        if let Some(text) = val.get("text").and_then(|t| t.as_str()) {
            return text.trim().to_string();
        }
        if let Some(obj) = val.get("translations").and_then(|t| t.as_object()) {
            if let Some((_, v)) = obj.iter().next() {
                if let Some(s) = v.as_str() {
                    return s.trim().to_string();
                }
            }
        }
        if let Some(obj) = val.as_object() {
            if let Some((_, v)) = obj.iter().next() {
                if let Some(s) = v.as_str() {
                    return s.trim().to_string();
                }
            }
        }
    }

    // 2. Not JSON or extracted cleanly: clean code blocks or quotes
    let mut text = trimmed.to_string();

    // Strip markdown code fences if wrapped
    if text.starts_with("```") {
        let lines: Vec<&str> = text.lines().collect();
        if lines.len() >= 2 && lines.last().unwrap_or(&"").trim() == "```" {
            let inner = lines[1..lines.len() - 1].join("\n");
            text = inner.trim().to_string();
        }
    }

    // Strip leading conversational phrases common in LLMs (e.g., "Here is the translation:", "Translation:")
    let prefixes = [
        "here is the translation:",
        "here is the translation",
        "translation:",
        "translated turn:",
        "terjemahan:",
        "hasil terjemahan:",
    ];

    let lower = text.to_lowercase();
    for p in &prefixes {
        if lower.starts_with(p) {
            text = text[p.len()..].trim().to_string();
            break;
        }
    }

    // Strip wrapping quotation marks if present
    if (text.starts_with('"') && text.ends_with('"') && text.len() >= 2)
        || (text.starts_with('“') && text.ends_with('”') && text.len() >= 2)
    {
        text = text[1..text.len() - 1].trim().to_string();
    }

    text
}
