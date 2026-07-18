import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../store.js";
import { getPrice, getPrices, formatPrice, formatPercentChange } from "../price-feed.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";

// Register in main menu
registerMainMenuItem({ label: "📊 Price", data: "price:menu", order: 20 });

const composer = new Composer<Ctx>();

// Handle /price command (with optional ticker)
composer.command("price", async (ctx) => {
  const args = ctx.match?.toString().trim();
  if (args) {
    await showPrice(ctx, args.toUpperCase());
  } else {
    await showWatchlistPrices(ctx);
  }
});

// Handle "Price" button tap
composer.callbackQuery("price:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showWatchlistPrices(ctx);
});

// Handle individual coin price button
composer.callbackQuery(/^price:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];
  await showPrice(ctx, ticker);
});

// Show price for a specific coin
async function showPrice(ctx: Ctx, ticker: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const user = store.getOrCreateUser(chatId);
  const watchlistItem = user.watchlist.find((w) => w.ticker === ticker);

  const priceData = await getPrice(ticker);
  if (!priceData) {
    await ctx.reply(`Couldn't fetch price for ${ticker}. The coin may not exist or the service is temporarily unavailable.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const changeEmoji = priceData.percentChange24h >= 0 ? "📈" : "📉";
  const changeText = formatPercentChange(priceData.percentChange24h);

  let message = `${changeEmoji} <b>${priceData.displayName}</b> (${priceData.ticker})\n\n`;
  message += `Price: ${formatPrice(priceData.currentPrice)}\n`;
  message += `24h change: ${changeText}\n`;
  message += `Market cap: $${(priceData.marketCap / 1e9).toFixed(2)}B`;

  // Add alert info if in watchlist
  if (watchlistItem) {
    const alerts = [
      ...watchlistItem.thresholdAlerts.filter((a) => a.enabled),
      ...watchlistItem.percentMoveAlerts.filter((a) => a.enabled),
    ];
    if (alerts.length > 0) {
      message += `\n\n📋 Active alerts: ${alerts.length}`;
    }
  }

  const buttons = [];
  if (watchlistItem) {
    buttons.push([inlineButton("🔔 Set alert", `alerts:add:${ticker}`)]);
  } else {
    buttons.push([inlineButton("➕ Add to watchlist", `watchlist:add:${ticker}`)]);
  }
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard(buttons),
  });
}

// Show all watchlist prices
async function showWatchlistPrices(ctx: Ctx): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const user = store.getOrCreateUser(chatId);

  if (user.watchlist.length === 0) {
    await ctx.reply("Your watchlist is empty — tap ➕ Add Coin to start tracking.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add Coin", "watchlist:add")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  // Fetch prices for all watchlist coins
  const tickers = user.watchlist.map((w) => w.ticker);
  const prices = await getPrices(tickers);

  let message = "📊 <b>Your Watchlist</b>\n\n";
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const item of user.watchlist) {
    const price = prices.get(item.ticker);
    if (price) {
      const changeEmoji = price.percentChange24h >= 0 ? "🟢" : "🔴";
      const changeText = formatPercentChange(price.percentChange24h);
      message += `${changeEmoji} <b>${item.ticker}</b>: ${formatPrice(price.currentPrice)} (${changeText})\n`;
      buttons.push([inlineButton(`${item.ticker}`, `price:${item.ticker}`)]);
    } else {
      message += `⚪ <b>${item.ticker}</b>: unavailable\n`;
      buttons.push([inlineButton(`${item.ticker}`, `price:${item.ticker}`)]);
    }
  }

  buttons.push([inlineButton("➕ Add Coin", "watchlist:add")]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard(buttons),
  });
}

export default composer;
