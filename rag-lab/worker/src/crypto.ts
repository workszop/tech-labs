const enc = new TextEncoder()

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const x of b) s += x.toString(16).padStart(2, '0')
  return s
}

export function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('invalid base64url')
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(input)))
}

const hmacKeyCache = new Map<string, Promise<CryptoKey>>()

function hmacKey(secret: string): Promise<CryptoKey> {
  let k = hmacKeyCache.get(secret)
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    if (hmacKeyCache.size > 8) hmacKeyCache.clear()
    hmacKeyCache.set(secret, k)
  }
  return k
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await hmacKey(secret)
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

/**
 * Constant-time string comparison. Both sides are hashed first so that the
 * comparison is fixed-length and does not leak the secret's length.
 */
export async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean }
  if (typeof subtle.timingSafeEqual === 'function') return subtle.timingSafeEqual(da, db)
  const x = new Uint8Array(da)
  const y = new Uint8Array(db)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

/** Session bearer token: 32 random bytes, base64url (43 chars). */
export function newSessionToken(): string {
  return base64url(randomBytes(32))
}

export const SESSION_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export function randomId(prefix: string, bytes = 9): string {
  return `${prefix}_${base64url(randomBytes(bytes))}`
}
