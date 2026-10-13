import { describe, expect, it } from 'vitest'
import { guessColumns, looksLikeHeader, parseAmount, parseCsv, parseDate, parseTime, toImportRows } from './importCsv'
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

describe('parseTime', () => {
  it('reads 24-hour and AM/PM times', () => {
    expect(parseTime('4:48')).toBe('04:48')
    expect(parseTime('16:43:10')).toBe('16:43')
    expect(parseTime('4.48 PM')).toBe('16:48')
    expect(parseTime('12:05 am')).toBe('00:05')
    expect(parseTime('25:00')).toBeUndefined()
    expect(parseTime('Food')).toBeUndefined()
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

describe('category columns', () => {
  it('reads time, category and subcategory from a tab-separated paste with multi-line notes', () => {
    const text = [
      'Date\tTime\tType\tCategory\tSubcategory\tAccount\tTo account\tDescription\tTags\tAmount',
      '31-05-26\t4:48\texpense\tTransport\tAirplane\t\t\t"flight kkc-bkk-kkc\nfu eye"\t\t-2621',
      '06-06-26\t16:21\texpense\tGift\t\t\t\tชุดหว่าหวา 85\t\t-300',
    ].join('\n')
    const [header, ...rows] = parseCsv(text)
    const map = guessColumns(header)!
    expect(map).toMatchObject({ date: 0, time: 1, category: 3, subcategory: 4, description: 7, amount: 9 })
    expect(toImportRows(rows, map).rows).toEqual([
      { date: '2026-05-31', time: '04:48', type: 'expense', amount: 2621, description: 'flight kkc-bkk-kkc fu eye', category: 'Transport', subcategory: 'Airplane' },
      { date: '2026-06-06', time: '16:21', type: 'expense', amount: 300, description: 'ชุดหว่าหวา 85', category: 'Gift' },
    ])
  })
  it('takes the time from the date cell when there is no time column', () => {
    const map = guessColumns(['Date', 'Amount'])!
    expect(toImportRows([['2026-10-01 19:28', '-5']], map).rows[0]).toMatchObject({ date: '2026-10-01', time: '19:28' })
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
        { ...base, id: '1', type: 'expense', amount: 65.5, date: '2026-10-01', time: '08:15', subcategory: 'Milk tea', note: 'Tea, "large" #nosetea', tags: ['nosetea'], categoryId: 'drinks', accountId: 'w' },
      ],
      { category: (id) => id ?? '', account: (id) => (id === 'w' ? 'SCB Easy' : '') },
    )
    const [header, ...rows] = parseCsv(csv)
    expect(header[0]).toBe('Date')
    const map = guessColumns(header)!
    expect(toImportRows(rows, map).rows).toEqual([
      { date: '2026-10-01', time: '08:15', type: 'expense', amount: 65.5, description: 'Tea, "large" #nosetea', category: 'drinks', subcategory: 'Milk tea' },
      { date: '2026-10-02', type: 'income', amount: 50000, description: 'เงินเดือน', category: 'salary' },
    ])
  })
})
