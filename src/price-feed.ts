// Price feed integration using CoinGecko API (free tier, no API key needed)
// CoinGecko provides real market data for cryptocurrencies

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export interface PriceData {
  ticker: string;
  displayName: string;
  currentPrice: number;
  percentChange24h: number;
  marketCap: number;
  lastUpdated: number;
}

// Map common tickers to CoinGecko IDs
const TICKER_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  LTC: "litecoin",
  ATOM: "cosmos",
  FTM: "fantom",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  PEPE: "pepe",
  SHIB: "shiba-inu",
  TRX: "tron",
  TON: "the-open-network",
  HBAR: "hedera-hashgraph",
};

// Retry with exponential backoff
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limited — wait and retry
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}

// Get CoinGecko ID from ticker
export function getCoinId(ticker: string): string | null {
  return TICKER_TO_ID[ticker.toUpperCase()] ?? null;
}

// Search for coins by query (for adding to watchlist)
export async function searchCoins(query: string): Promise<Array<{ id: string; symbol: string; name: string }>> {
  try {
    const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`;
    const response = await fetchWithRetry(url);
    const data = await response.json();
    return (data.coins ?? []).slice(0, 5).map((c: any) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
    }));
  } catch {
    return [];
  }
}

// Get price for a single coin
export async function getPrice(ticker: string): Promise<PriceData | null> {
  const coinId = getCoinId(ticker);
  if (!coinId) {
    // Try searching
    const results = await searchCoins(ticker);
    if (results.length === 0) return null;
    return getPriceById(results[0].id, ticker.toUpperCase());
  }
  return getPriceById(coinId, ticker.toUpperCase());
}

// Get price by CoinGecko ID
async function getPriceById(coinId: string, ticker: string): Promise<PriceData | null> {
  try {
    const url = `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    const response = await fetchWithRetry(url);
    const data = await response.json();

    return {
      ticker,
      displayName: data.name ?? ticker,
      currentPrice: data.market_data?.current_price?.usd ?? 0,
      percentChange24h: data.market_data?.price_change_percentage_24h ?? 0,
      marketCap: data.market_data?.market_cap?.usd ?? 0,
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

// Get prices for multiple coins (batched for efficiency)
export async function getPrices(tickers: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>();

  // Map tickers to CoinGecko IDs
  const coinIds: Array<{ ticker: string; id: string }> = [];
  for (const ticker of tickers) {
    const id = getCoinId(ticker);
    if (id) {
      coinIds.push({ ticker, id });
    }
  }

  if (coinIds.length === 0) return results;

  try {
    // Use simple/price endpoint for batch fetching
    const ids = coinIds.map((c) => c.id).join(",");
    const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
    const response = await fetchWithRetry(url);
    const data = await response.json();

    for (const { ticker, id } of coinIds) {
      const coinData = data[id];
      if (coinData) {
        results.set(ticker, {
          ticker,
          displayName: ticker, // Will be enriched later if needed
          currentPrice: coinData.usd ?? 0,
          percentChange24h: coinData.usd_24h_change ?? 0,
          marketCap: coinData.usd_market_cap ?? 0,
          lastUpdated: Date.now(),
        });
      }
    }
  } catch {
    // If batch fails, try individual fetches
    for (const ticker of tickers) {
      const price = await getPrice(ticker);
      if (price) results.set(ticker, price);
    }
  }

  return results;
}

// Format price for display
export function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }
  return `$${price.toFixed(8)}`;
}

// Format percent change
export function formatPercentChange(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}
