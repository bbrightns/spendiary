import type { ReactNode } from 'react'

/** Keeps a Thai phrase on one line. The browser's Thai dictionary breaks loanwords mid-word (คริ|ปโต)
 *  and splits short phrases that read badly apart (ยัง|ไง). */
export function Keep({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>
}
