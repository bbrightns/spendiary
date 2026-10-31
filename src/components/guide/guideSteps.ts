export interface TourStep {
  targetId: string
  title: string
  description: string
  badge?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

export type PageGuideKey =
  | 'dashboard'
  | 'portfolio'
  | 'dca'
  | 'rebalance'
  | 'retirement'
  | 'logs'
  | 'summary'
  | 'settings'

export const PAGE_GUIDES: Record<PageGuideKey, { title: string; steps: TourStep[] }> = {
  dashboard: {
    title: 'Dashboard tour',
    steps: [
      {
        targetId: 'guide-dashboard-networth',
        badge: 'Portfolio overview',
        title: 'Net worth',
        description:
          'Shows your cash in every account plus the value of all your investments, converted to Thai baht (THB) automatically.',
        position: 'bottom',
      },
      {
        targetId: 'guide-dashboard-dca',
        badge: 'Time to invest',
        title: 'Today',
        description:
          'When DCA buys or dividends need logging, this line takes you to them. Card bills and loans are paid on Spend Home.',
        position: 'bottom',
      },
      {
        targetId: 'guide-dashboard-alloc',
        badge: 'Spread your risk',
        title: 'Asset allocation',
        description:
          'A chart of how your money is split across stocks, funds, crypto and gold, so you can see if it is balanced.',
        position: 'top',
      },
      {
        targetId: 'guide-dashboard-cash',
        badge: 'Cash reserve',
        title: 'Cash accounts & savings',
        description:
          'Manage your savings and high-interest accounts. Edit a balance or add a new account right away.',
        position: 'bottom',
      },
      {
        targetId: 'guide-dashboard-chart',
        badge: 'Growth over time',
        title: 'Net worth trend',
        description:
          'Tracks how your net worth has changed over time so you can see where you are heading.',
        position: 'top',
      },
    ],
  },

  portfolio: {
    title: 'Portfolio tour',
    steps: [
      {
        targetId: 'guide-portfolio-summary',
        badge: 'Your returns',
        title: 'Portfolio profit & loss',
        description:
          'See what your portfolio is worth now, how much you put in, and your profit or loss so far, in baht and %.',
        position: 'bottom',
      },
      {
        targetId: 'guide-portfolio-actions',
        badge: 'Tools',
        title: 'Export & actions',
        description:
          'Export your holdings as a CSV file, or copy your whole portfolio as Markdown to use elsewhere.',
        position: 'bottom',
      },
      {
        targetId: 'guide-portfolio-alloc',
        badge: 'How it is split',
        title: 'Asset allocation',
        description:
          'A donut chart showing how your value is split across each holding or group, with a shortcut to the Rebalance page.',
        position: 'bottom',
      },
      {
        targetId: 'guide-portfolio-holdings',
        badge: 'Each holding',
        title: 'Your holdings',
        description:
          'Every asset with its average cost and market price. Tap one to buy more, move it, or see its history. For Bitcoin and gold, tap the arrow on the right to manage each location (buy, sell, edit, remove).',
        position: 'top',
      },
      {
        targetId: 'guide-portfolio-tabs',
        badge: 'Categories',
        title: 'Filter & sort',
        description:
          'Pick an asset group, like US stocks, funds, crypto or gold, to see just those holdings, and sort by value, profit or type.',
        position: 'bottom',
      },
    ],
  },

  dca: {
    title: 'DCA planner tour',
    steps: [
      {
        targetId: 'guide-dca-summary',
        badge: 'Monthly flow',
        title: 'Where your salary goes',
        description:
          'Salary, then fixed bills, living costs from Spend and your DCA plans. If they add up to more than your salary, it shows what cash covers each month and how long your cash lasts.',
        position: 'bottom',
      },
      {
        targetId: 'guide-dca-transfers',
        badge: 'Fixed costs',
        title: 'Regular expenses',
        description:
          'Add monthly costs like rent and bills, or money you set aside, to see what is left over to invest.',
        position: 'top',
      },
      {
        targetId: 'guide-dca-plans',
        badge: 'Monthly plan',
        title: 'Your DCA plans',
        description:
          'Choose what to keep buying, the day of the month, the amount, and which cash account the money comes from.',
        position: 'bottom',
      },
      {
        targetId: 'guide-dca-confirm',
        badge: 'Saved for you',
        title: 'Log a buy',
        description:
          "When a plan comes due, it is highlighted. Spendiary doesn't buy for you: after you buy at your broker, log it here and your units and cash are updated.",
        position: 'top',
      },
    ],
  },

  rebalance: {
    title: 'Rebalance tour',
    steps: [
      {
        targetId: 'guide-rebalance-mode',
        badge: 'Pick a style',
        title: 'Rebalancing mode',
        description:
          'Rebalance by asset group (for example 50% stocks, 30% funds) or by each individual holding, whichever you prefer.',
        position: 'bottom',
      },
      {
        targetId: 'guide-rebalance-cash',
        badge: 'New money',
        title: 'Add cash',
        description:
          'Enter how much cash you want to add. The app plans which assets to buy so you do not have to sell anything.',
        position: 'top',
      },
      {
        targetId: 'guide-rebalance-weights',
        badge: 'Set targets',
        title: 'Target allocation',
        description:
          'Set the percentages you want, adding up to 100%, to compare against your current portfolio.',
        position: 'bottom',
      },
      {
        targetId: 'guide-rebalance-suggestions',
        badge: 'What to buy or sell',
        title: 'Suggested actions',
        description:
          'Shows exactly how much to buy or sell for each item to bring your portfolio back to your targets.',
        position: 'top',
      },
    ],
  },

  retirement: {
    title: 'Retirement planner tour',
    steps: [
      {
        targetId: 'guide-retirement-settings',
        badge: 'Set your goal',
        title: 'Your retirement details',
        description:
          'Enter your age, the age you want to retire, the return you expect, and how much you will spend each month in retirement.',
        position: 'bottom',
      },
      {
        targetId: 'guide-retirement-chart',
        badge: 'The road ahead',
        title: 'Savings projection',
        description:
          'A chart showing how your savings could grow with regular investing, compared with your retirement goal.',
        position: 'bottom',
      },
      {
        targetId: 'guide-retirement-freedom',
        badge: 'Financial freedom',
        title: 'Safety net & milestones',
        description:
          'See how long your savings could last and how close you are to each milestone, based on what you own today.',
        position: 'top',
      },
    ],
  },

  logs: {
    title: 'Activity logs tour',
    steps: [
      {
        targetId: 'guide-logs-header',
        badge: 'Filters',
        title: 'Filter transactions',
        description:
          'Show only one asset group or one kind of activity, like buys, price updates or edits.',
        position: 'bottom',
      },
      {
        targetId: 'guide-logs-list',
        badge: 'Details',
        title: 'Activity timeline',
        description:
          'Check dates, cost, units and every change, with an Undo button to reverse an entry any time.',
        position: 'top',
      },
    ],
  },

  summary: {
    title: 'Profit & loss summary tour',
    steps: [
      {
        targetId: 'guide-summary-period',
        badge: 'Pick a period',
        title: 'Period filter',
        description:
          'Use the shortcuts (this month, this year, all time) or pick a year and month to see how much you made or lost.',
        position: 'bottom',
      },
      {
        targetId: 'guide-summary-hero',
        badge: 'Net profit',
        title: 'Profit you have actually made',
        description:
          'Net profit = profit from things you sold + dividends received after tax, plus how much you put in and sold for in that period.',
        position: 'bottom',
      },
      {
        targetId: 'guide-summary-assets',
        badge: 'By asset',
        title: 'Where the profit came from',
        description:
          'See for each asset how much you put in, sold for, made from sales, and received in dividends.',
        position: 'top',
      },
    ],
  },

  settings: {
    title: 'Settings tour',
    steps: [
      {
        targetId: 'guide-settings-sync',
        badge: 'Cloud sync',
        title: 'Sync your data (Supabase)',
        description:
          'Sign in with Google to back up your data in the cloud and use it safely on any device.',
        position: 'bottom',
      },
      {
        targetId: 'guide-settings-profile',
        badge: 'Sections',
        title: 'Everything in sections',
        description:
          'Each row opens one part of Settings. Start with General for the theme and your name for the greeting on Home.',
        position: 'bottom',
      },
      {
        targetId: 'guide-settings-backup',
        badge: 'Keep it safe',
        title: 'Backup & restore',
        description:
          'Open Data and backup to download a JSON backup, or import an old one to move to a new device or restore your data at any time.',
        position: 'bottom',
      },
    ],
  },
}

