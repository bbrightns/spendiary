import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ChevronRightIcon, WalletIcon } from '../../../components/icons'
import { thb } from '../../../lib/format'
import { monthKey } from '../logic'
import { useSpend } from '../useSpend'

export function SpendWallets() {
  const { transactions, wallets } = useSpend()
  const navigate = useNavigate()
  const month = monthKey()

  const flows = useMemo(() => {
    const map = new Map<string, { in: number; out: number; count: number }>()
    const bump = (id: string | undefined, key: 'in' | 'out', v: number) => {
      if (!id) return
      const f = map.get(id) ?? { in: 0, out: 0, count: 0 }
      f[key] += v
      f.count += 1
      map.set(id, f)
    }
    for (const t of transactions) {
      if (!t.date.startsWith(month)) continue
      if (t.type === 'income') bump(t.accountId, 'in', t.amount)
      else if (t.type === 'expense') bump(t.accountId, 'out', t.amount)
      else {
        bump(t.accountId, 'out', t.amount)
        bump(t.toAccountId, 'in', t.amount)
      }
    }
    return map
  }, [transactions, month])

  const total = wallets.reduce((s, w) => s + w.balance, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Spend"
        title="Wallets"
        subtitle="The same cash accounts as Invest. Logging a transaction moves their balance."
        action={
          <Link to="/cash" className="text-sm font-semibold text-brand hover:underline">
            Manage in Cash
          </Link>
        }
      />

      {wallets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<WalletIcon className="h-7 w-7" />}
            title="Add a wallet"
            description="Create a THB cash account in Cash and Liquidity, then log spending against it here."
            action={<Button onClick={() => navigate('/cash?action=new')}>Add cash account</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="animate-rise">
            <p className="text-xs font-medium text-ink-muted">Total in wallets</p>
            <p className="mt-1 font-display text-3xl font-extrabold tracking-tight tnum text-ink">{thb(total)}</p>
          </Card>

          <Card padded={false} className="divide-y divide-line">
            {wallets.map((w) => {
              const f = flows.get(w.id)
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => navigate(`/spend/txns?q=${encodeURIComponent(w.name.toLowerCase())}`)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-muted/50 cursor-pointer sm:px-5"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink-soft"
                    style={w.color ? { color: w.color } : undefined}
                  >
                    <WalletIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{w.name}</span>
                    <span className="block truncate text-xs text-ink-muted tnum">
                      {f ? (
                        <>
                          This month <span className="text-gain">+{thb(f.in)}</span> · −{thb(f.out)}
                        </>
                      ) : (
                        'No activity this month'
                      )}
                      {w.category === 'locked' ? ' · Locked savings' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-ink tnum">{thb(w.balance)}</span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-muted/50" strokeWidth={2} />
                </button>
              )
            })}
          </Card>
          <p className="px-1 text-xs text-ink-muted">USD accounts stay on the Invest side for now.</p>
        </>
      )}
    </div>
  )
}
