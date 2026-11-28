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
    expect(checkParsed('pdf', 20, 'x'.repeat(100))).toBeNull()
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
