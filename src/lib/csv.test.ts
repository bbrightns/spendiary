import { describe, expect, it } from 'vitest'
import { buildCsv, csvCell } from './csv'

describe('csvCell', () => {
  it('quotes only when needed', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell(12.5)).toBe('12.5')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
})

describe('buildCsv', () => {
  it('writes a BOM, CRLF line ends and a final line end', () => {
    expect(buildCsv(['A', 'B'], [['x', 1], ['y,z', null]])).toBe('﻿A,B\r\nx,1\r\n"y,z",\r\n')
  })
})
