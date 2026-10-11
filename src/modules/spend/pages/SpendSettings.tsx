import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { useToast } from '../../../store/ToastContext'
import { localDateStr, thb } from '../../../lib/format'
import type { PayCycle, WeekendShift } from '../../../lib/types'
import { DEFAULT_BILL_REMINDER_DAYS, isCalendar, periodFor, periodLabel, upcomingPaydays } from '../logic'
import { useSpend } from '../useSpend'
import { categoriesFor } from '../categories'
import { TONES } from '../tones'
import { CategoryManager } from '../CategorySheet'

const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const inputClass =
  'h-11 w-20 rounded-xl border border-line-strong bg-surface px-3 text-center text-base font-bold text-ink outline-none tnum focus:border-brand focus:ring-2 focus:ring-brand/15'

function Section({ id, title, description, children }: { id?: string; title: string; description: string; children: ReactNode }) {
  return (
    <Card id={id} className="space-y-4 scroll-mt-24">
      <div>
        <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
      </div>
      {children}
    </Card>
  )
}

type Draft = { mode: PayCycle['mode']; ruleKind: 'day' | 'fromEnd'; day: string; daysBefore: string; weekend: WeekendShift }

function toDraft(c?: PayCycle): Draft {
  return {
    mode: c?.mode ?? 'calendar',
    ruleKind: c?.rule?.kind ?? 'day',
    day: c?.rule?.kind === 'day' ? String(c.rule.day) : '25',
    daysBefore: c?.rule?.kind === 'fromEnd' ? String(c.rule.daysBefore) : '1',
    weekend: c?.weekend ?? 'before',
  }
}

function fromDraft(d: Draft): PayCycle | null {
  if (d.mode === 'calendar') return { mode: 'calendar' }
  if (d.ruleKind === 'day') {
    const day = Number(d.day)
    if (!Number.isInteger(day) || day < 1 || day > 31) return null
    return { mode: 'payday', rule: { kind: 'day', day }, weekend: d.weekend }
  }
  const n = Number(d.daysBefore)
  if (!Number.isInteger(n) || n < 0 || n > 27) return null
  return { mode: 'payday', rule: { kind: 'fromEnd', daysBefore: n }, weekend: d.weekend }
}

export function SpendSettings() {
  const { settings, methods, updateSettings } = useSpend()
  const { showToast } = useToast()
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings.cycle))
  const [budget, setBudget] = useState(settings.monthlyBudget ? String(settings.monthlyBudget) : '')

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const cycle = fromDraft(draft)
  const today = localDateStr()
  const current = cycle ? periodFor(today, cycle) : null
  const savedCycle = JSON.stringify(settings.cycle ?? { mode: 'calendar' })
  const cycleChanged = cycle !== null && JSON.stringify(cycle) !== savedCycle

  const [catDraft, setCatDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(settings.categoryBudgets ?? {}).map(([k, v]) => [k, String(v)])),
  )
  const catParsed = Object.fromEntries(
    Object.entries(catDraft)
      .map(([k, v]) => [k, Number(v.replace(/,/g, ''))] as const)
      .filter(([, n]) => Number.isFinite(n) && n > 0),
  )
  const catTotal = Object.values(catParsed).reduce((s, n) => s + n, 0)
  const catOverMonthly = !!settings.monthlyBudget && catTotal > settings.monthlyBudget
  const catChanged = JSON.stringify(catParsed) !== JSON.stringify(Object.fromEntries(Object.entries(settings.categoryBudgets ?? {}).filter(([, n]) => n > 0)))

  // Arriving from "Set budgets" on Overview: jump to that section
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const budgetNum = Number(budget.replace(/,/g, ''))
  const budgetValid = budget === '' || (Number.isFinite(budgetNum) && budgetNum >= 0)
  const budgetChanged = budgetValid && (budget === '' ? undefined : budgetNum) !== settings.monthlyBudget

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Spend" title="Settings" subtitle="How your spending month is counted, your budget, and how Quick add fills in." />

      <Section id="spending-month" title="Spending month" description="Count from the 1st, or from payday to the day before the next payday.">
        <SegmentedControl
          ariaLabel="Month mode"
          value={draft.mode}
          onChange={(v) => set('mode', v)}
          options={[
            { value: 'calendar', label: 'Calendar month' },
            { value: 'payday', label: 'From payday' },
          ]}
        />

        {draft.mode === 'payday' && (
          <div className="space-y-4">
            <div className="space-y-2" role="radiogroup" aria-label="Payday rule">
              <p className="text-sm font-semibold text-ink-soft">Payday is</p>
              {(
                [
                  {
                    kind: 'day' as const,
                    body: (
                      <>
                        On day
                        <input
                          aria-label="Day of month"
                          inputMode="numeric"
                          maxLength={2}
                          className={inputClass}
                          value={draft.day}
                          onFocus={() => set('ruleKind', 'day')}
                          onChange={(e) => set('day', e.target.value.replace(/\D/g, ''))}
                        />
                        of every month
                      </>
                    ),
                  },
                  {
                    kind: 'fromEnd' as const,
                    body: (
                      <>
                        <input
                          aria-label="Days before the last day"
                          inputMode="numeric"
                          maxLength={2}
                          className={inputClass}
                          value={draft.daysBefore}
                          onFocus={() => set('ruleKind', 'fromEnd')}
                          onChange={(e) => set('daysBefore', e.target.value.replace(/\D/g, ''))}
                        />
                        {draft.daysBefore === '1' ? 'day' : 'days'} before the last day of the month
                      </>
                    ),
                  },
                ]
              ).map((opt) => {
                const on = draft.ruleKind === opt.kind
                return (
                  <div
                    key={opt.kind}
                    role="radio"
                    aria-checked={on}
                    tabIndex={0}
                    onClick={() => set('ruleKind', opt.kind)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && set('ruleKind', opt.kind)}
                    className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      on ? 'border-brand/50 bg-brand-soft/60 text-ink' : 'border-line text-ink-soft hover:bg-surface-muted/50'
                    }`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand' : 'border-line-strong'}`}>
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                    </span>
                    {opt.body}
                  </div>
                )
              })}
              {draft.ruleKind === 'fromEnd' && <p className="px-1 text-xs text-ink-muted">0 means the last day itself.</p>}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-soft">If it falls on a Saturday or Sunday</p>
              <SegmentedControl
                ariaLabel="Weekend rule"
                value={draft.weekend}
                onChange={(v) => set('weekend', v)}
                options={[
                  { value: 'before', label: 'Fri before', title: 'Move to the Friday before' },
                  { value: 'after', label: 'Mon after', title: 'Move to the Monday after' },
                  { value: 'keep', label: 'Keep date', title: 'Keep the date even on a weekend' },
                ]}
              />
            </div>
          </div>
        )}

        {/* Live preview */}
        {cycle && current ? (
          <div className="rounded-2xl bg-surface-muted/70 p-4 text-sm">
            <p className="text-ink-muted">
              This month runs <b className="font-bold text-ink">{periodLabel(current, cycle)}</b>
            </p>
            {!isCalendar(cycle) && (
              <ul className="mt-2 space-y-1">
                {upcomingPaydays(cycle, 3).map((d) => (
                  <li key={d} className="flex justify-between gap-3 tnum">
                    <span className="text-ink-muted">Next payday</span>
                    <span className="font-semibold text-ink">{fmtDay(d)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm font-semibold text-loss">
            {draft.ruleKind === 'day' ? 'Pick a day from 1 to 31.' : 'Use a number from 0 to 27.'}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!cycleChanged}
            onClick={() => {
              updateSettings({ cycle: cycle! })
              showToast('Spending month updated')
            }}
          >
            Save
          </Button>
        </div>
      </Section>

      <Section id="monthly-budget" title="Monthly budget" description="What you plan to spend each month, excluding investing and transfers.">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 flex-1 items-center rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
            <span className="mr-2 text-ink-muted">฿</span>
            <input
              aria-label="Monthly budget"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="No budget"
              className="w-full bg-transparent text-base text-ink outline-none tnum placeholder:text-ink-faint"
            />
          </div>
          <Button
            size="sm"
            disabled={!budgetChanged}
            onClick={() => {
              updateSettings({ monthlyBudget: budget === '' || budgetNum === 0 ? undefined : budgetNum })
              showToast(budget === '' ? 'Budget turned off' : `Budget set to ${thb(budgetNum)}`)
            }}
          >
            Save
          </Button>
        </div>
      </Section>

      <div id="categories" className="scroll-mt-24">
        <Section title="Categories" description="Add your own, or change a name, icon or color. Hidden ones stay on past transactions.">
          <CategoryManager />
        </Section>
      </div>

      <div id="category-budgets" className="scroll-mt-24">
        <Section title="Budget per category" description="Optional limits per spending month. Leave a category empty for no limit.">
          <ul className="divide-y divide-line">
            {categoriesFor('expense').map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONES[c.tone].chip}`}>
                  <c.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold text-ink">{c.label}</span>
                <div className="flex h-10 w-36 items-center rounded-xl border border-line-strong bg-surface px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
                  <span className="mr-1.5 text-sm text-ink-muted">฿</span>
                  <input
                    aria-label={`${c.label} budget`}
                    inputMode="decimal"
                    value={catDraft[c.id] ?? ''}
                    onChange={(e) => setCatDraft((d) => ({ ...d, [c.id]: e.target.value.replace(/[^\d.,]/g, '') }))}
                    placeholder="—"
                    className="w-full bg-transparent text-right text-sm font-semibold text-ink outline-none tnum placeholder:text-ink-faint"
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs tnum ${catOverMonthly ? 'font-semibold text-warn' : 'text-ink-muted'}`}>
              Total {thb(catTotal)}
              {settings.monthlyBudget ? ` of ${thb(settings.monthlyBudget)} monthly budget` : ''}
              {catOverMonthly ? ' — more than the monthly budget' : ''}
            </p>
            <Button
              size="sm"
              disabled={!catChanged}
              onClick={() => {
                updateSettings({ categoryBudgets: catParsed })
                showToast('Category budgets saved')
              }}
            >
              Save
            </Button>
          </div>
        </Section>
      </div>

      <Section id="bill-reminders" title="Card bill reminders" description="When to start reminding you on Overview and the Accounts tab, before a card bill is due.">
        <select
          aria-label="Remind before due date"
          value={settings.billReminderDays ?? DEFAULT_BILL_REMINDER_DAYS}
          onChange={(e) => {
            updateSettings({ billReminderDays: Number(e.target.value) })
            showToast('Reminder updated')
          }}
          className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        >
          {[1, 3, 5, 7, 10, 14].map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? 'day' : 'days'} before it's due
            </option>
          ))}
        </select>
      </Section>

      <Section id="quick-add" title="Quick add" description="The payment method picked for you when you add an expense. Star more on the Accounts page.">
        <select
          aria-label="Default payment method"
          value={settings.defaultAccountId ?? ''}
          onChange={(e) => {
            updateSettings({ defaultAccountId: e.target.value || undefined })
            showToast('Default updated')
          }}
          className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        >
          <option value="">Whatever I used last</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.kind === 'card' ? `Card · ${m.name}` : m.name}
            </option>
          ))}
        </select>
      </Section>
    </div>
  )
}
