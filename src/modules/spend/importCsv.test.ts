import { describe, expect, it } from 'vitest'
import { guessColumns, looksLikeHeader, parseAmount, parseCsv, parseDate, toImportRows } from './importCsv'
import { toCsv } from './exportCsv'

describe('parseCsv', () => {
  it('handles quotes, commas inside fields and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })
  it('detects semicolons and tabs', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseDate', () => {
  it('reads common formats and Buddhist years', () => {
    expect(parseDate('2026-10-05')).toBe('2026-10-05')
    expect(parseDate('05/10/2026')).toBe('2026-10-05')
    expect(parseDate('05/10/2569')).toBe('2026-10-05')
    expect(parseDate('5-10-69')).toBe('2026-10-05')
    expect(parseDate('05.10.26 14:32')).toBe('2026-10-05')
    expect(parseDate('31/02/2026')).toBeUndefined()
    expect(parseDate('Coffee')).toBeUndefined()
  })
})

describe('parseAmount', () => {
  it('reads signs, commas and parentheses', () => {
    expect(parseAmount('1,234.50')).toBe(1234.5)
    expect(parseAmount('(500)')).toBe(-500)
    expect(parseAmount('-65')).toBe(-65)
    expect(parseAmount('฿ 99')).toBe(99)
    expect(parseAmount('')).toBeUndefined()
    expect(parseAmount('n/a')).toBeUndefined()
  })
})

describe('columns and rows', () => {
  it('maps Thai bank headers with withdrawal / deposit columns', () => {
    const [header, ...rows] = parseCsv('วันที่,รายการ,ถอนเงิน,ฝากเงิน,ยอดคงเหลือ\n05/10/2569,ค่ากาแฟ,65.00,,1000\n06/10/2569,เงินเดือน,,50000,51000\nTotal,,,,')
    expect(looksLikeHeader(header)).toBe(true)
    const map = guessColumns(header)!
    expect(map).toMatchObject({ date: 0, description: 1, out: 2, in: 3 })
    expect(toImportRows(rows, map)).toEqual({
      rows: [
        { date: '2026-10-05', type: 'expense', amount: 65, description: 'ค่ากาแฟ' },
        { date: '2026-10-06', type: 'income', amount: 50000, description: 'เงินเดือน' },
      ],
      skipped: 1,
    })
  })
  it('maps a single signed amount column', () => {
    const map = guessColumns(['Date', 'Description', 'Amount'])!
    expect(map).toMatchObject({ date: 0, description: 1, amount: 2 })
    expect(toImportRows([['2026-10-01', 'Grab', '-120']], map).rows[0]).toMatchObject({ type: 'expense', amount: 120 })
  })
})

describe('BOM', () => {
  it('drops a leading byte-order mark', () => {
    expect(parseCsv(String.fromCharCode(0xfeff) + 'Date,Amount\n2026-10-01,5')[0][0]).toBe('Date')
  })
})

describe('export round trip', () => {
  it('writes CSV the importer reads back', () => {
    const base = { createdAt: '2026-10-01T00:00:00Z' }
    const csv = toCsv(
      [
        { ...base, id: '2', type: 'income', amount: 50000, date: '2026-10-02', note: 'เงินเดือน', categoryId: 'salary', accountId: 'w' },
        { ...base, id: '1', type: 'expense', amount: 65.5, date: '2026-10-01', note: 'Tea, "large" #nosetea', tags: ['nosetea'], categoryId: 'drinks', accountId: 'w' },
      ],
      { category: (id) => id ?? '', account: (id) => (id === 'w' ? 'SCB Easy' : '') },
    )
    const [header, ...rows] = parseCsv(csv)
    expect(header[0]).toBe('Date')
    const map = guessColumns(header)!
    expect(toImportRows(rows, map).rows).toEqual([
      { date: '2026-10-01', type: 'expense', amount: 65.5, description: 'Tea, "large" #nosetea' },
      { date: '2026-10-02', type: 'income', amount: 50000, description: 'เงินเดือน' },
    ])
  })
})
