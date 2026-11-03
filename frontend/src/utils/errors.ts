/**
 * Unified Error Normalization Utility for Mechon AI
 * 
 * Handles:
 * - JavaScript Error instances
 * - Tauri IPC command string rejections
 * - Structured Rust AppError JSON objects { message, code, status }
 * - HTTP response error structures
 * - Scrubs sensitive tokens/headers from UI output
 */

export interface StructuredErrorPayload {
  message?: string
  code?: string
  status?: number
  error?: string | { message?: string; code?: string }
  details?: string
}

/**
 * Scrubs potential secrets (API keys, authorization headers) from client-facing errors
 */
export function sanitizeClientErrorMessage(msg: string): string {
  if (!msg) return ''
  let scrubbed = msg
  const sensitivePatterns = [
    /Bearer\s+[A-Za-z0-9_\-\.]{8,}/gi,
    /sk-[A-Za-z0-9_\-\.]{10,}/gi,
    /x-api-key:\s*[A-Za-z0-9_\-\.]{8,}/gi,
    /key=[A-Za-z0-9_\-\.]{10,}/gi
  ]

  for (const pattern of sensitivePatterns) {
    scrubbed = scrubbed.replace(pattern, (match) => {
      const parts = match.split(/[\s=:]+/)
      const secret = parts[parts.length - 1]
      if (secret && secret.length > 6) {
        const masked = `••••••••${secret.slice(-4)}`
        return match.replace(secret, masked)
      }
      return '••••••••'
    })
  }

  return scrubbed
}

/**
 * Normalizes any caught exception or Tauri rejection into a reliable, readable error string.
 * Never returns 'undefined', '[object Object]', or an empty string.
 */
export function formatErrorMessage(err: unknown, fallbackPrefix = 'Operation failed'): string {
  if (err === null || err === undefined) {
    return `${fallbackPrefix}: Unknown server error occurred.`
  }

  // 1. Direct string rejection from Tauri or throw "string"
  if (typeof err === 'string') {
    const trimmed = err.trim()
    if (!trimmed || trimmed === 'undefined' || trimmed === '[object Object]') {
      return `${fallbackPrefix}: Unexpected empty error response.`
    }
    // Attempt parsing as JSON in case it's a serialized error payload
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        return formatErrorMessage(parsed, fallbackPrefix)
      } catch {
        // Not valid JSON, continue with raw string
      }
    }
    return sanitizeClientErrorMessage(cleanPrefix(trimmed))
  }

  // 2. Standard JavaScript Error instance
  if (err instanceof Error) {
    const msg = err.message ? err.message.trim() : ''
    if (msg && msg !== 'undefined' && msg !== '[object Object]') {
      return sanitizeClientErrorMessage(cleanPrefix(msg))
    }
  }

  // 3. Structured error payload (Rust AppError serialization or HTTP error)
  if (typeof err === 'object') {
    const payload = err as StructuredErrorPayload

    if (typeof payload.message === 'string' && payload.message.trim()) {
      const msg = payload.message.trim()
      if (msg !== 'undefined' && msg !== '[object Object]') {
        const statusText = payload.status ? ` (HTTP ${payload.status})` : ''
        return sanitizeClientErrorMessage(`${cleanPrefix(msg)}${statusText}`)
      }
    }

    if (payload.error) {
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return sanitizeClientErrorMessage(cleanPrefix(payload.error.trim()))
      }
      if (typeof payload.error === 'object' && payload.error.message) {
        return sanitizeClientErrorMessage(cleanPrefix(payload.error.message))
      }
    }

    if (typeof payload.details === 'string' && payload.details.trim()) {
      return sanitizeClientErrorMessage(cleanPrefix(payload.details.trim()))
    }

    try {
      const str = JSON.stringify(err)
      if (str && str !== '{}') {
        return sanitizeClientErrorMessage(`${fallbackPrefix}: ${str}`)
      }
    } catch {
      // Ignore stringify failures
    }
  }

  // 4. Fallback string representation
  const stringified = String(err).trim()
  if (stringified && stringified !== 'undefined' && stringified !== '[object Object]') {
    return sanitizeClientErrorMessage(cleanPrefix(stringified))
  }

  return `${fallbackPrefix}: An unexpected error occurred.`
}

function cleanPrefix(msg: string): string {
  // Strip redundant nested prefixes like "Provider error: Provider error: "
  return msg
    .replace(/^Provider error:\s*Provider error:\s*/i, 'Provider error: ')
    .replace(/^Database error:\s*Database error:\s*/i, 'Database error: ')
}
