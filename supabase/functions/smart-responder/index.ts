// Supabase Edge Function: smart-responder (v3 — Yahoo Finance v8 chart endpoint)
// Request:  POST { symbols: "AAPL,BUG" }  — price lookup
//           POST { query: "bug" }          — symbol/name search (US-listed stocks & ETFs)
// Response: { prices: { AAPL: 190.1 }, quotes: { AAPL: { price, currency, name } } }
//   - `prices` only contains USD-quoted symbols (the web app converts them with the USD/THB rate)
//   - `quotes` contains every symbol Yahoo recognised, with its currency and name
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Quote {
  price: number
  currency: string
  name?: string
}

async function fetchSymbolQuote(symbol: string): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (typeof meta?.regularMarketPrice !== 'number') return null
    return {
      price: meta.regularMarketPrice,
      currency: String(meta.currency ?? ''),
      name: meta.longName ?? meta.shortName ?? undefined,
    }
  } catch {
    return null
  }
}

const US_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'NYSE American', 'NYSE Arca', 'BATS', 'NYSEArca', 'NasdaqGS', 'NasdaqCM', 'NasdaqGM'])

async function searchSymbols(query: string) {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.quotes ?? []) as Array<Record<string, string>>)
      .filter((q) => (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') && US_EXCHANGES.has(q.exchDisp ?? q.exchange))
      .map((q) => ({ symbol: String(q.symbol).toUpperCase(), name: q.longname ?? q.shortname ?? q.symbol }))
  } catch {
    return []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    if (typeof body.query === 'string' && body.query.trim()) {
      return new Response(
        JSON.stringify({ results: await searchSymbols(body.query.trim()) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { symbols } = body

    if (!symbols || typeof symbols !== 'string') {
      return new Response(
        JSON.stringify({ error: 'symbols (string) required in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tickerList = symbols.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean)

    const results = await Promise.allSettled(
      tickerList.map(async (ticker: string) => ({
        ticker,
        quote: await fetchSymbolQuote(ticker),
      }))
    )

    const prices: Record<string, number> = {}
    const quotes: Record<string, Quote> = {}
    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value.quote) continue
      const { ticker, quote } = r.value
      quotes[ticker] = quote
      // Only USD quotes are safe to treat as USD prices (e.g. PTT.BK is quoted in THB)
      if (quote.currency === 'USD') prices[ticker] = quote.price
    }

    console.log('Fetched prices successfully:', JSON.stringify(prices))

    return new Response(
      JSON.stringify({ prices, quotes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge Function error:', (error as Error).message)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
