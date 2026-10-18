/** Round a THB (or USD) amount to whole satang / cents. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
