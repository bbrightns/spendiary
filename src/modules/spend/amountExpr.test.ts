import { describe, expect, it } from 'vitest'
import { appendOperator, cleanAmountInput, evalAmount, hasOperator, settleAmount } from './amountExpr'

describe('evalAmount', () => {
  it('reads a plain amount, commas as thousands', () => {
    expect(evalAmount('1,250')).toBe(1250)
    expect(evalAmount('99.5')).toBe(99.5)
    expect(evalAmount('.5')).toBe(0.5)
    expect(evalAmount('12.')).toBe(12)
  })

  it('adds and subtracts left to right', () => {
    expect(evalAmount('120+45+30')).toBe(195)
    expect(evalAmount('450−50')).toBe(400)
    expect(evalAmount('100−20+5')).toBe(85)
  })

  it('multiplies and divides before adding', () => {
    expect(evalAmount('3×120')).toBe(360)
    expect(evalAmount('100+2×50')).toBe(200)
    expect(evalAmount('900÷3−50')).toBe(250)
  })

  it('ignores a trailing operator', () => {
    expect(evalAmount('120+')).toBe(120)
    expect(evalAmount('120+45×')).toBe(165)
  })

  it('rounds to satang without float noise', () => {
    expect(evalAmount('0.1+0.2')).toBe(0.3)
    expect(evalAmount('100÷3')).toBe(33.33)
    expect(evalAmount('1.005×1')).toBe(1.01)
  })

  it('returns null for what is not a number', () => {
    expect(evalAmount('')).toBeNull()
    expect(evalAmount('+')).toBeNull()
    expect(evalAmount('.')).toBeNull()
    expect(evalAmount('1.2.3')).toBeNull()
    expect(evalAmount('5÷0')).toBeNull()
    expect(evalAmount('5+.')).toBeNull()
  })

  it('can go to zero or below; the caller decides that is not valid', () => {
    expect(evalAmount('50−50')).toBe(0)
    expect(evalAmount('50−80')).toBe(-30)
  })
})

describe('cleanAmountInput', () => {
  it('maps keyboard symbols to the field glyphs', () => {
    expect(cleanAmountInput('10-2*3/4')).toBe('10−2×3÷4')
    expect(cleanAmountInput('2x3')).toBe('2×3')
  })

  it('drops other characters and a leading operator', () => {
    expect(cleanAmountInput('฿ 1,2a0')).toBe('1,20')
    expect(cleanAmountInput('-50')).toBe('50')
    expect(cleanAmountInput('+')).toBe('')
  })

  it('replaces an operator typed right after another', () => {
    expect(cleanAmountInput('12+-')).toBe('12−')
    expect(appendOperator('12+', '×')).toBe('12×')
    expect(appendOperator('', '+')).toBe('')
  })
})

describe('settleAmount', () => {
  it('turns a sum into its result and leaves the rest alone', () => {
    expect(settleAmount('120+45')).toBe('165')
    expect(settleAmount('1,250')).toBe('1,250')
    expect(settleAmount('1.2.3+1')).toBe('1.2.3+1')
    expect(settleAmount('50−80')).toBe('50−80')
    expect(hasOperator('1,250')).toBe(false)
  })
})
