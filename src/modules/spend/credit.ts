import type { Liability, SpendCard } from '../../lib/types'
import { installmentHold } from './loans'

type Card = Pick<SpendCard, 'id' | 'name' | 'creditLimit' | 'balance' | 'sharedLimitWith'>

/**
 * The card whose limit this one uses: its main card when it shares one, else itself.
 * Only one level: a main card can't share someone else's limit, and a missing main means its own.
 */
export function limitOwner<C extends Card>(card: C, cards: C[]): C {
  const main = card.sharedLimitWith ? cards.find((c) => c.id === card.sharedLimitWith && !c.sharedLimitWith) : undefined
  return main ?? card
}

/** Every card drawing on the same limit as this one, the main card first. */
export function limitGroup<C extends Card>(card: C, cards: C[]): C[] {
  const owner = limitOwner(card, cards)
  return [owner, ...cards.filter((c) => c.id !== owner.id && limitOwner(c, cards).id === owner.id)]
}

export interface Credit {
  /** The limit this card draws on (shared or its own) */
  limit: number
  /** Owed plus installment holds across everyone on that limit */
  used: number
  left: number
  /** Installment plans holding part of it */
  held: number
  /** The other cards on the same limit */
  sharedWith: string[]
}

/** What's left to spend on a card, counting every card that shares its limit and their installment holds. */
export function availableCredit<C extends Card>(card: C, cards: C[], loans: Liability[]): Credit {
  const group = limitGroup(card, cards)
  const limit = group[0].creditLimit
  const held = group.reduce((s, c) => s + installmentHold(loans, c.id), 0)
  const used = group.reduce((s, c) => s + c.balance, 0) + held
  return { limit, used, left: Math.max(0, limit - used), held, sharedWith: group.filter((c) => c.id !== card.id).map((c) => c.name) }
}

/** All credit still available, counting each shared limit once. */
export function totalAvailable<C extends Card>(cards: C[], loans: Liability[]): { limit: number; left: number } {
  const owners = cards.filter((c) => limitOwner(c, cards).id === c.id)
  return owners.reduce(
    (t, c) => {
      const credit = availableCredit(c, cards, loans)
      return { limit: t.limit + credit.limit, left: t.left + credit.left }
    },
    { limit: 0, left: 0 },
  )
}
