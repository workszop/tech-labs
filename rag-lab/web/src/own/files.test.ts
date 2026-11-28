import { describe, expect, it } from 'vitest'
import { OWN_LIMITS, addFiles, checkParsed, checkPreParse, kindOf, type OwnDoc } from './files'

const file = (name: string, text: string, type = 'text/plain') => new File([text], name, { type })

describe('kindOf', () => {
  it('recognises pdf, docx, txt and md by extension', () => {
    expect(kindOf('a.PDF', '')).toBe('pdf')
    expect(kindOf('b.docx', '')).toBe('docx')
    expect(kindOf('c.txt', '')).toBe('txt')
    expect(kindOf('d.md', '')).toBe('txt')
    expect(kindOf('e.pptx', '')).toBeNull()
    expect(kindOf('f', 'application/pdf')).toBe('pdf')
  })
})

describe('checkPreParse', () => {
  it('rejects the 11th file, a file over 10 MB and an unknown type', () => {
    expect(checkPreParse({ name: 'a.txt', size: 10, type: '' }, 10)).toBe('tooMany')
    expect(checkPreParse({ name: 'a.txt', size: 10, type: '' }, 9)).toBeNull()
    expect(checkPreParse({ name: 'a.pdf', size: 11 * 1024 * 1024, type: '' }, 0)).toBe('tooBig')
    expect(checkPreParse({ name: 'a.pptx', size: 10, type: '' }, 0)).toBe('badType')
  })
})

describe('checkParsed', () => {
  it('limits PDF pages and text length, and rejects empty text', () => {
    expect(checkParsed('pdf', 21, 'x'.repeat(100))).toBe('tooManyPages')
    expect(checkParsed('pdf', 20, 'x'.repeat(1000))).toBeNull()
    expect(checkParsed('txt', 1, 'x'.repeat(OWN_LIMITS.maxChars + 1))).toBe('tooLong')
    expect(checkParsed('docx', 1, 'x'.repeat(OWN_LIMITS.maxChars))).toBeNull()
    expect(checkParsed('pdf', 2, '   \n ')).toBe('noText')
  })
})

describe('addFiles', () => {
  it('parses text files and counts pages of 3000 characters', async () => {
    const r = await addFiles([file('a.txt', 'Urlop wynosi 26 dni.'), file('b.md', 'y'.repeat(6001))], [])
    expect(r.rejected).toEqual([])
    expect(r.accepted.map((d) => [d.name, d.kind, d.pages])).toEqual([['a.txt', 'txt', 1], ['b.md', 'txt', 3]])
    expect(r.accepted[0].text).toBe('Urlop wynosi 26 dni.')
    expect(r.accepted[0].chars).toBe(20)
  })

  it('keeps accepted files and says why the others were rejected', async () => {
    const existing = Array.from({ length: 9 }, (_, i) => ({ id: `d${i}`, name: `${i}.txt`, kind: 'txt', pages: 1, chars: 30, text: 'x'.repeat(30) }) as OwnDoc)
    const r = await addFiles([file('ok.txt', 'Treść dokumentu numer dziesięć.'), file('late.txt', 'Za późno, limit plików.'), file('x.pptx', 'a', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), file('empty.txt', '  ')], existing)
    expect(r.accepted.map((d) => d.name)).toEqual(['ok.txt'])
    expect(r.rejected).toEqual([
      { name: 'late.txt', reason: 'tooMany' },
      { name: 'x.pptx', reason: 'badType' },
      { name: 'empty.txt', reason: 'tooMany' },
    ])
  })

  it('rejects an empty text file with noText', async () => {
    const r = await addFiles([file('empty.txt', '   ')], [])
    expect(r.rejected).toEqual([{ name: 'empty.txt', reason: 'noText' }])
  })
})

describe('polish from review', () => {
  it('rejects the same file twice', async () => {
    const first = await addFiles([file('a.txt', 'Treść pierwszego dokumentu, wystarczająco długa.')], [])
    const again = await addFiles([file('a.txt', 'Treść pierwszego dokumentu, wystarczająco długa.')], first.accepted)
    expect(again.rejected).toEqual([{ name: 'a.txt', reason: 'duplicate' }])
  })

  it('treats a PDF with almost no text per page as a scan', () => {
    expect(checkParsed('pdf', 3, '- 1 -\n- 2 -\n- 3 - plus a few more chars')).toBe('noText')
    expect(checkParsed('pdf', 2, 'x'.repeat(257))).toBeNull()
  })

  it('reads a Windows-1250 text file without mojibake', async () => {
    // "Zażółć gęślą jaźń" in windows-1250
    const bytes = new Uint8Array([0x5a, 0x61, 0xbf, 0xf3, 0xb3, 0xe6, 0x20, 0x67, 0xea, 0x9c, 0x6c, 0xb9, 0x20, 0x6a, 0x61, 0x9f, 0xf1, 0x2e, 0x20, 0x44, 0x6f, 0x6b, 0x75, 0x6d, 0x65, 0x6e, 0x74, 0x20, 0x74, 0x65, 0x73, 0x74, 0x6f, 0x77, 0x79, 0x2e])
    const r = await addFiles([new File([bytes], 'cp.txt', { type: 'text/plain' })], [])
    expect(r.accepted[0]?.text).toBe('Zażółć gęślą jaźń. Dokument testowy.')
  })

  it('shortens very long file names for the prompt, keeping the extension', async () => {
    const { shortDocName } = await import('./files')
    const s = shortDocName('a'.repeat(400) + '.pdf')
    expect(s.length).toBeLessThanOrEqual(200)
    expect(s.endsWith('.pdf')).toBe(true)
    expect(shortDocName('krótka.pdf')).toBe('krótka.pdf')
  })
})
