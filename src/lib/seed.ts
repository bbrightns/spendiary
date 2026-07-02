import type { SpendiaryData } from './types'

/** Build an ISO date N days from today, so demo data always looks fresh. */
function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const today = new Date().toISOString().slice(0, 10)

export const seedData: SpendiaryData = {
  cashAccounts: [
    { id: 'c1', name: 'KBank', balance: 145_000 },
    { id: 'c2', name: 'SCB', balance: 92_000 },
    { id: 'c3', name: 'Bangkok Bank', balance: 48_000 },
  ],
  monthlyIncome: 80_000,
  holdings: [
    {
      id: 'h1',
      name: 'SCB US Index Fund',
      ticker: 'SCBS&P500',
      assetClass: 'fund',
      units: 4200,
      avgCost: 18.4,
      price: 22.15,
      updatedAt: today,
    },
    {
      id: 'h2',
      name: 'K-Global Tech Fund',
      ticker: 'K-USA-A',
      assetClass: 'fund',
      units: 3100,
      avgCost: 24.1,
      price: 23.05,
      updatedAt: today,
    },
    {
      id: 'h3',
      name: 'Apple Inc.',
      ticker: 'AAPL',
      assetClass: 'stock',
      units: 32,
      avgCost: 6450,
      price: 7820,
      updatedAt: today,
    },
    {
      id: 'h4',
      name: 'NVIDIA Corp.',
      ticker: 'NVDA',
      assetClass: 'stock',
      units: 45,
      avgCost: 3100,
      price: 4690,
      updatedAt: today,
    },
    {
      id: 'h5',
      name: 'Microsoft Corp.',
      ticker: 'MSFT',
      assetClass: 'stock',
      units: 18,
      avgCost: 13800,
      price: 15240,
      updatedAt: today,
    },
    {
      id: 'h6',
      name: 'Bitcoin',
      ticker: 'BTC',
      assetClass: 'crypto',
      units: 0.42,
      avgCost: 2_180_000,
      price: 2_540_000,
      updatedAt: today,
    },
  ],
  dcaPlans: [
    { id: 'd1', name: 'S&P 500 Index', assetClass: 'fund', monthlyAmount: 20_000, dayOfMonth: 1 },
    { id: 'd2', name: 'Global Tech Fund', assetClass: 'fund', monthlyAmount: 12_000, dayOfMonth: 1 },
    { id: 'd3', name: 'US Stocks Basket', assetClass: 'stock', monthlyAmount: 15_000, dayOfMonth: 15 },
    { id: 'd4', name: 'Bitcoin', assetClass: 'crypto', monthlyAmount: 8_000, dayOfMonth: 25 },
  ],
  transfers: [
    {
      id: 't1',
      recipient: 'Mom (Monthly Support)',
      note: 'Standing allowance',
      amount: 15_000,
      frequency: 'monthly',
      completed: 9,
      total: 12,
      expiryDate: inDays(82),
    },
    {
      id: 't2',
      recipient: 'Condo Down-payment Fund',
      note: 'Auto-save to savings',
      amount: 25_000,
      frequency: 'monthly',
      completed: 22,
      total: 24,
      expiryDate: inDays(58),
    },
    {
      id: 't3',
      recipient: 'Emergency Fund Top-up',
      amount: 5_000,
      frequency: 'weekly',
      completed: 46,
      total: 52,
      expiryDate: inDays(11),
    },
    {
      id: 't4',
      recipient: 'Term Insurance Premium',
      note: 'Muang Thai Life',
      amount: 4_200,
      frequency: 'monthly',
      completed: 5,
      total: 6,
      expiryDate: inDays(19),
    },
  ],
}
