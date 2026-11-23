/**
 * Human-friendly access codes: `RAG-XXXX-XXXX-XXXX-XXXX-XXXX`.
 *
 * 20 Crockford base32 symbols × 5 bits = 100 bits of entropy from
 * crypto.getRandomValues (each byte & 31 is uniform because 256 % 32 === 0).
 * Only HMAC-SHA256(CODE_PEPPER, normalized) is stored.
 */
import { hmacSha256Hex, randomBytes } from './crypto'

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_PREFIX = 'RAG'
export const CODE_SYMBOLS = 20
export const CODE_GROUP = 4

export function generateCode(): string {
  const bytes = randomBytes(CODE_SYMBOLS)
  let body = ''
  for (const b of bytes) body += CROCKFORD[b & 31]
  const groups = body.match(new RegExp(`.{${CODE_GROUP}}`, 'g'))!
  return [CODE_PREFIX, ...groups].join('-')
}

/**
 * Normalises user input: trim, uppercase, drop spaces / dashes / underscores / dots,
 * map O→0 and I/L→1, strip the optional RAG prefix.
 * Returns the 20-symbol body or null when the input cannot be a valid code.
 */
export function normalizeCode(input: string): string | null {
  let s = input.trim().toUpperCase().replace(/[\s\-_.‐-―]/g, '')
  if (s.length === CODE_PREFIX.length + CODE_SYMBOLS && s.startsWith(CODE_PREFIX)) s = s.slice(CODE_PREFIX.length)
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== CODE_SYMBOLS) return null
  for (const ch of s) if (!CROCKFORD.includes(ch)) return null
  return s
}

export function hashCode(pepper: string, normalized: string): Promise<string> {
  return hmacSha256Hex(pepper, `rag-lab-code:v1:${normalized}`)
}
