import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../store.js";
import { searchCoins, getCoinId, getPrice } from "../price-feed.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";

// Register in main menu
registerMainMenuItem({ label: "➕ Add Coin", data: "watchlist:add", order: 10 });

const composer = new Composer<Ctx>();

// Handle "Add Coin" button tap
composer.callbackQuery("watchlist:add", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_ticker";
  ctx.session.awaitingTicker = true;
  await ctx.reply("Type the ticker symbol or name of the cryptocurrency you want to track (e.g. BTC, ETH, Solana):", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. BTC or Bitcoin" },
  });
});

// Handle ticker input
composer.on("message:text", async (ctx, next) => {
  if (!ctx.session.awaitingTicker) return next();

  const input = ctx.message.text.trim().toUpperCase();
  ctx.session.awaitingTicker = false;
  ctx.session.step = "idle";

  const chatId = ctx.chat?.id;
  if (!chatId) {
    return next();
  }

  // Check if already in watchlist
  const user = store.getOrCreateUser(chatId);
  if (user.watchlist.some((w) => w.ticker === input)) {
    await ctx.reply(`${input} is already in your watchlist.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add another", "watchlist:add")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  // Try to find the coin
  const coinId = getCoinId(input);
  let displayName = input;

  if (!coinId) {
    // Search for the coin
    const results = await searchCoins(input);
    if (results.length === 0) {
      await ctx.reply(`Couldn't find "${input}" — check the ticker or name and try again.`, {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Try again", "watchlist:add")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      });
      return;
    }
    displayName = results[0].name;
  } else {
    // Get display name from price data
    const priceData = await getPrice(input);
    if (priceData) {
      displayName = priceData.displayName;
    }
  }

  // Add to watchlist
  user.watchlist.push({
    ticker: input,
    displayName,
    thresholdAlerts: [],
    percentMoveAlerts: [],
    lastNotifiedPrice: null,
    lastNotifiedTime: null,
  });

  await ctx.reply(`✅ Added ${displayName} (${input}) to your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add another", "watchlist:add")],
      [inlineButton("📊 Check price", `price:${input}`)],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
