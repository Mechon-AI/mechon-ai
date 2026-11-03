use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LanguageInfo {
    pub code: String,        // BCP-47 language tag (e.g., "id", "en", "ja", "ar", "zh-Hans", "pt-BR")
    pub name: String,        // English / display name (e.g., "Japanese")
    pub native_name: String, // Native name in script (e.g., "日本語")
    pub rtl: bool,           // Right-to-left script indicator
    pub is_common: bool,     // Prioritized in UI language selectors
}

/// A comprehensive built-in registry of BCP-47 languages.
pub static BUILTIN_LANGUAGES: &[(&str, &str, &str, bool, bool)] = &[
    // code, name, native_name, rtl, is_common
    ("en", "English", "English", false, true),
    ("id", "Indonesian", "Bahasa Indonesia", false, true),
    ("ja", "Japanese", "日本語", false, true),
    ("ar", "Arabic", "العربية", true, true),
    ("zh-Hans", "Chinese (Simplified)", "简体中文", false, true),
    ("zh-Hant", "Chinese (Traditional)", "繁體中文", false, true),
    ("es", "Spanish", "Español", false, true),
    ("fr", "French", "Français", false, true),
    ("de", "German", "Deutsch", false, true),
    ("ko", "Korean", "한국어", false, true),
    ("pt", "Portuguese", "Português", false, true),
    ("pt-BR", "Portuguese (Brazil)", "Português (Brasil)", false, true),
    ("ru", "Russian", "Русский", false, true),
    ("it", "Italian", "Italiano", false, true),
    ("hi", "Hindi", "हिन्दी", false, true),
    ("tr", "Turkish", "Türkçe", false, true),
    ("vi", "Vietnamese", "Tiếng Việt", false, true),
    ("th", "Thai", "ไทย", false, true),
    ("he", "Hebrew", "עבריت", true, true),
    ("fa", "Persian", "فارسی", true, true),
    ("ur", "Urdu", "اردو", true, true),
    ("nl", "Dutch", "Nederlands", false, false),
    ("pl", "Polish", "Polski", false, false),
    ("sv", "Swedish", "Svenska", false, false),
    ("uk", "Ukrainian", "Українська", false, false),
    ("cs", "Czech", "Čeština", false, false),
    ("el", "Greek", "Ελληνικά", false, false),
    ("da", "Danish", "Dansk", false, false),
    ("fi", "Finnish", "Suomi", false, false),
    ("no", "Norwegian", "Norsk", false, false),
    ("hu", "Hungarian", "Magyar", false, false),
    ("ro", "Romanian", "Română", false, false),
    ("bn", "Bengali", "বাংলা", false, false),
    ("ms", "Malay", "Bahasa Melayu", false, false),
    ("tl", "Tagalog / Filipino", "Filipino", false, false),
    ("sw", "Swahili", "Kiswahili", false, false),
    ("ta", "Tamil", "தமிழ்", false, false),
    ("te", "Telugu", "తెలుగు", false, false),
    ("mr", "Marathi", "मराठी", false, false),
    ("ca", "Catalan", "Català", false, false),
];

pub struct LanguageRegistry;

impl LanguageRegistry {
    /// Return all built-in languages, sorted with common languages first.
    pub fn all_languages() -> Vec<LanguageInfo> {
        let mut list: Vec<LanguageInfo> = BUILTIN_LANGUAGES
            .iter()
            .map(|&(code, name, native_name, rtl, is_common)| LanguageInfo {
                code: code.to_string(),
                name: name.to_string(),
                native_name: native_name.to_string(),
                rtl,
                is_common,
            })
            .collect();

        // Sort: is_common first, then alphabetical by English name
        list.sort_by(|a, b| {
            b.is_common
                .cmp(&a.is_common)
                .then_with(|| a.name.cmp(&b.name))
        });
        list
    }

    /// Check if a BCP-47 language code is Right-to-Left.
    pub fn is_rtl(code: &str) -> bool {
        let lower = code.to_lowercase();
        let base = lower.split('-').next().unwrap_or(&lower);
        matches!(base, "ar" | "he" | "fa" | "ur" | "ps" | "sd" | "ug" | "yi")
    }

    /// Validate whether a string is a well-formed BCP-47 tag (simple check).
    pub fn validate_bcp47(code: &str) -> bool {
        let trimmed = code.trim();
        if trimmed.is_empty() || trimmed.len() > 35 {
            return false;
        }
        // Must start with 2-3 letter primary subtag, followed by optional subtags
        let parts: Vec<&str> = trimmed.split('-').collect();
        if parts.is_empty() {
            return false;
        }
        let primary = parts[0];
        if primary.len() < 2 || primary.len() > 3 || !primary.chars().all(|c| c.is_ascii_alphabetic()) {
            return false;
        }
        for subtag in &parts[1..] {
            if subtag.is_empty() || subtag.len() > 8 || !subtag.chars().all(|c| c.is_ascii_alphanumeric()) {
                return false;
            }
        }
        true
    }

    /// Look up or construct a LanguageInfo for any given BCP-47 code.
    /// If not in built-in list, gracefully synthesizes metadata.
    pub fn lookup(code: &str) -> LanguageInfo {
        let trimmed = code.trim();
        let lower = trimmed.to_lowercase();

        // Check exact match in built-ins
        for &(b_code, name, native_name, rtl, is_common) in BUILTIN_LANGUAGES {
            if b_code.eq_ignore_ascii_case(trimmed) {
                return LanguageInfo {
                    code: b_code.to_string(),
                    name: name.to_string(),
                    native_name: native_name.to_string(),
                    rtl,
                    is_common,
                };
            }
        }

        // Check base language match (e.g., "en-US" -> "en")
        let base = lower.split('-').next().unwrap_or(&lower);
        for &(b_code, name, native_name, rtl, is_common) in BUILTIN_LANGUAGES {
            if b_code.eq_ignore_ascii_case(base) {
                return LanguageInfo {
                    code: trimmed.to_string(),
                    name: format!("{} ({})", name, trimmed),
                    native_name: format!("{} ({})", native_name, trimmed),
                    rtl,
                    is_common,
                };
            }
        }

        // Arbitrary fallback
        let rtl = Self::is_rtl(trimmed);
        LanguageInfo {
            code: trimmed.to_string(),
            name: trimmed.to_uppercase(),
            native_name: trimmed.to_uppercase(),
            rtl,
            is_common: false,
        }
    }

    /// Generate the Canonical Schema v2.0 "language" block.
    pub fn build_canonical_language_object(
        mode: &str,
        primary_code: &str,
        secondary_code: Option<&str>,
    ) -> Value {
        let primary = Self::lookup(primary_code);
        let mut obj = json!({
            "mode": mode,
            "primary": {
                "code": primary.code,
                "name": primary.name,
                "native_name": primary.native_name,
                "rtl": primary.rtl
            }
        });

        if let Some(sec_code) = secondary_code {
            if !sec_code.is_empty() {
                let secondary = Self::lookup(sec_code);
                if let Some(map) = obj.as_object_mut() {
                    map.insert(
                        "secondary".to_string(),
                        json!({
                            "code": secondary.code,
                            "name": secondary.name,
                            "native_name": secondary.native_name,
                            "rtl": secondary.rtl
                        }),
                    );
                }
            }
        }

        obj
    }
}
