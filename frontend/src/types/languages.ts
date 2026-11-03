export interface LanguageInfo {
  code: string
  name: string
  native_name: string
  rtl: boolean
  is_common: boolean
}

export interface CorpusLanguageStats {
  language_pairs: string[]
  primary_languages: string[]
  secondary_languages: string[]
  modes: string[]
}

export const FALLBACK_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', native_name: 'English', rtl: false, is_common: true },
  { code: 'id', name: 'Indonesian', native_name: 'Bahasa Indonesia', rtl: false, is_common: true },
  { code: 'ja', name: 'Japanese', native_name: '日本語', rtl: false, is_common: true },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', rtl: true, is_common: true },
  { code: 'es', name: 'Spanish', native_name: 'Español', rtl: false, is_common: true },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', native_name: '简体中文', rtl: false, is_common: true },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', native_name: '繁體中文', rtl: false, is_common: true },
  { code: 'fr', name: 'French', native_name: 'Français', rtl: false, is_common: true },
  { code: 'de', name: 'German', native_name: 'Deutsch', rtl: false, is_common: true },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native_name: 'Português (Brasil)', rtl: false, is_common: true },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', native_name: 'Português (Portugal)', rtl: false, is_common: false },
  { code: 'ru', name: 'Russian', native_name: 'Русский', rtl: false, is_common: true },
  { code: 'ko', name: 'Korean', native_name: '한국어', rtl: false, is_common: true },
  { code: 'it', name: 'Italian', native_name: 'Italiano', rtl: false, is_common: true },
  { code: 'nl', name: 'Dutch', native_name: 'Nederlands', rtl: false, is_common: false },
  { code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', rtl: false, is_common: true },
  { code: 'th', name: 'Thai', native_name: 'ไทย', rtl: false, is_common: true },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', rtl: false, is_common: true },
  { code: 'ur', name: 'Urdu', native_name: 'اردو', rtl: true, is_common: false },
  { code: 'he', name: 'Hebrew', native_name: 'עברית', rtl: true, is_common: false },
  { code: 'fa', name: 'Persian', native_name: 'فارسی', rtl: true, is_common: false },
  { code: 'tr', name: 'Turkish', native_name: 'Türkçe', rtl: false, is_common: true },
  { code: 'pl', name: 'Polish', native_name: 'Polski', rtl: false, is_common: false },
  { code: 'uk', name: 'Ukrainian', native_name: 'Українська', rtl: false, is_common: false },
  { code: 'ms', name: 'Malay', native_name: 'Bahasa Melayu', rtl: false, is_common: false },
  { code: 'tl', name: 'Tagalog (Filipino)', native_name: 'Tagalog', rtl: false, is_common: false },
  { code: 'sv', name: 'Swedish', native_name: 'Svenska', rtl: false, is_common: false },
  { code: 'el', name: 'Greek', native_name: 'Ελληνικά', rtl: false, is_common: false },
  { code: 'cs', name: 'Czech', native_name: 'Čeština', rtl: false, is_common: false },
  { code: 'hu', name: 'Hungarian', native_name: 'Magyar', rtl: false, is_common: false },
  { code: 'ro', name: 'Romanian', native_name: 'Română', rtl: false, is_common: false },
  { code: 'da', name: 'Danish', native_name: 'Dansk', rtl: false, is_common: false },
  { code: 'fi', name: 'Finnish', native_name: 'Suomi', rtl: false, is_common: false },
  { code: 'no', name: 'Norwegian', native_name: 'Norsk', rtl: false, is_common: false },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা', rtl: false, is_common: false },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', rtl: false, is_common: false },
  { code: 'te', name: 'Telugu', native_name: 'తెలుగు', rtl: false, is_common: false },
  { code: 'mr', name: 'Marathi', native_name: 'मराठी', rtl: false, is_common: false },
  { code: 'sw', name: 'Swahili', native_name: 'Kiswahili', rtl: false, is_common: false },
  { code: 'jv', name: 'Javanese', native_name: 'Basa Jawa', rtl: false, is_common: false },
  { code: 'su', name: 'Sundanese', native_name: 'Basa Sunda', rtl: false, is_common: false }
]

const RTL_CODES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'ug'])

export function isRTL(code?: string): boolean {
  if (!code) return false
  const primary = code.split('-')[0].toLowerCase()
  return RTL_CODES.has(primary)
}

export function lookupLanguage(code?: string, customCatalog?: LanguageInfo[]): LanguageInfo {
  if (!code) {
    return { code: 'und', name: 'Undetermined', native_name: 'Undetermined', rtl: false, is_common: false }
  }
  const clean = code.trim()
  const lower = clean.toLowerCase()
  const list = customCatalog && customCatalog.length > 0 ? customCatalog : FALLBACK_LANGUAGES

  // Direct match
  const direct = list.find(l => l.code.toLowerCase() === lower)
  if (direct) return direct

  // Prefix match (e.g. en-US -> en)
  const prefix = lower.split('-')[0]
  const prefixMatch = list.find(l => l.code.toLowerCase() === prefix)
  if (prefixMatch) {
    return {
      ...prefixMatch,
      code: clean
    }
  }

  // Fallback dynamic object
  return {
    code: clean,
    name: clean.toUpperCase(),
    native_name: clean.toUpperCase(),
    rtl: isRTL(clean),
    is_common: false
  }
}

export function formatLanguagePair(primary?: string, secondary?: string): string {
  const p = (primary || 'und').toUpperCase()
  const s = (secondary || '').toUpperCase()
  return s ? `${p} → ${s}` : p
}
