/**
 * Every localStorage key the app uses, in one place. Only per-device settings and caches live
 * here; the user's data is in Supabase. The values are what older builds saved under, so
 * never change one without migrating the old key.
 */
export const STORAGE_KEYS = {
  // Preferences (also carried in backups)
  theme: 'spendiary.theme',
  pnlDisplay: 'spendiary_pnl_display',
  logsViewMode: 'spendiary_logs_view_mode',
  goldSellUnit: 'spendiary_gold_sell_unit',
  rebalanceExcludeSafeHaven: 'spendiary_rebalance_exclude_safe_haven',

  // Navigation and search history
  lastSide: 'spendiary.last_side',
  lastSpendPath: 'spendiary.last_spend_path',
  lastInvestPath: 'spendiary.last_invest_path',
  paletteUsage: 'spendiary.palette_usage',
  paletteRecent: 'spendiary.palette_recent',
  spendRecentSearches: 'spendiary.spend_recent_searches',

  // Price caches
  usdThb: 'spendiary.cached_usd_thb',
  usdThbAt: 'spendiary.cached_usd_thb_at',
  pricesUpdatedAt: 'spendiary.cached_prices_last_updated',
  goldThbPerGram: 'spendiary.cached_gold_thb_gram',

  // Sign-in and sync
  lastUserId: 'spendiary.last_user_id',
  lastSyncedTime: 'spendiary.last_synced_time',
  testData: 'spendiary.test_data',
} as const
