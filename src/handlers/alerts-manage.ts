import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../store.js";
import type { ThresholdAlert, PercentMoveAlert } from "../store.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

// Handle "Manage Alerts" button tap
composer.callbackQuery("alerts:manage", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showAlertManagement(ctx);
});

// Handle adding an alert for a specific ticker
composer.callbackQuery(/^alerts:add:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];
  await showAddAlertMenu(ctx, ticker);
});

// Handle threshold alert setup
composer.callbackQuery(/^alerts:threshold:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];
  ctx.session.step = "awaiting_threshold";
  ctx.session.managingAlertTicker = ticker;
  await ctx.reply(`Set a price alert for ${ticker}.\n\nType the price level (e.g. 50000 for above $50,000):`, {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 50000" },
  });
});

// Handle percent move alert setup
composer.callbackQuery(/^alerts:percent:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];
  ctx.session.step = "awaiting_percent";
  ctx.session.managingAlertTicker = ticker;
  await ctx.reply(`Set a percent move alert for ${ticker}.\n\nType the percent change threshold (e.g. 5 for 5% move):`, {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 5" },
  });
});

// Handle threshold input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_threshold") return next();

  const ticker = ctx.session.managingAlertTicker;
  if (!ticker) {
    ctx.session.step = "idle";
    return next();
  }

  const input = ctx.message.text.trim();
  const price = parseFloat(input);

  if (isNaN(price) || price <= 0) {
    await ctx.reply("Please enter a valid positive number.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", `alerts:add:${ticker}`)]]),
    });
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    ctx.session.step = "idle";
    return next();
  }

  const user = store.getOrCreateUser(chatId);
  const watchlistItem = user.watchlist.find((w) => w.ticker === ticker);

  if (!watchlistItem) {
    await ctx.reply(`${ticker} is not in your watchlist. Add it first.`, {
      reply_markup: inlineKeyboard([[inlineButton("➕ Add to watchlist", "watchlist:add")]]),
    });
    ctx.session.step = "idle";
    return;
  }

  // Create threshold alert (notify when price goes above)
  const alert: ThresholdAlert = {
    id: `thresh_${Date.now()}`,
    above: price,
    enabled: true,
  };

  watchlistItem.thresholdAlerts.push(alert);
  ctx.session.step = "idle";
  ctx.session.managingAlertTicker = undefined;

  await ctx.reply(`✅ Alert set! You'll be notified when ${ticker} goes above ${price}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("🔔 Add another alert", `alerts:add:${ticker}`)],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

// Handle percent input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_percent") return next();

  const ticker = ctx.session.managingAlertTicker;
  if (!ticker) {
    ctx.session.step = "idle";
    return next();
  }

  const input = ctx.message.text.trim();
  const percent = parseFloat(input);

  if (isNaN(percent) || percent <= 0 || percent > 100) {
    await ctx.reply("Please enter a valid percent between 0 and 100.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", `alerts:add:${ticker}`)]]),
    });
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    ctx.session.step = "idle";
    return next();
  }

  const user = store.getOrCreateUser(chatId);
  const watchlistItem = user.watchlist.find((w) => w.ticker === ticker);

  if (!watchlistItem) {
    await ctx.reply(`${ticker} is not in your watchlist. Add it first.`, {
      reply_markup: inlineKeyboard([[inlineButton("➕ Add to watchlist", "watchlist:add")]]),
    });
    ctx.session.step = "idle";
    return;
  }

  // Create percent move alert
  const alert: PercentMoveAlert = {
    id: `pct_${Date.now()}`,
    percentThreshold: percent,
    windowHours: 1, // Default 1-hour window
    enabled: true,
  };

  watchlistItem.percentMoveAlerts.push(alert);
  ctx.session.step = "idle";
  ctx.session.managingAlertTicker = undefined;

  await ctx.reply(`✅ Alert set! You'll be notified when ${ticker} moves ${percent}% in 1 hour.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("🔔 Add another alert", `alerts:add:${ticker}`)],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

// Show alert management menu
async function showAlertManagement(ctx: Ctx): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const user = store.getOrCreateUser(chatId);

  if (user.watchlist.length === 0) {
    await ctx.reply("Your watchlist is empty — add coins first to set alerts.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add Coin", "watchlist:add")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  let message = "🔔 <b>Manage Alerts</b>\n\n";
  message += "Select a coin to manage its alerts:";

  const buttons = user.watchlist.map((w) => [
    inlineButton(`${w.ticker} (${w.thresholdAlerts.length + w.percentMoveAlerts.length})`, `alerts:add:${w.ticker}`),
  ]);

  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard(buttons),
  });
}

// Show add alert menu for a specific ticker
async function showAddAlertMenu(ctx: Ctx, ticker: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const user = store.getOrCreateUser(chatId);
  const watchlistItem = user.watchlist.find((w) => w.ticker === ticker);

  if (!watchlistItem) {
    await ctx.reply(`${ticker} is not in your watchlist.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add to watchlist", "watchlist:add")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  // Show existing alerts
  let message = `🔔 <b>Alerts for ${ticker}</b>\n\n`;

  if (watchlistItem.thresholdAlerts.length > 0) {
    message += "<b>Price alerts:</b>\n";
    for (const alert of watchlistItem.thresholdAlerts) {
      if (alert.above) message += `• Above ${alert.above}\n`;
      if (alert.below) message += `• Below ${alert.below}\n`;
    }
  }

  if (watchlistItem.percentMoveAlerts.length > 0) {
    message += "<b>Percent move alerts:</b>\n";
    for (const alert of watchlistItem.percentMoveAlerts) {
      message += `• ${alert.percentThreshold}% in ${alert.windowHours}h\n`;
    }
  }

  if (watchlistItem.thresholdAlerts.length === 0 && watchlistItem.percentMoveAlerts.length === 0) {
    message += "No alerts set yet.\n";
  }

  const buttons = [
    [inlineButton("📈 Price alert", `alerts:threshold:${ticker}`)],
    [inlineButton("📊 Percent move", `alerts:percent:${ticker}`)],
    [inlineButton("⬅️ Back", "alerts:manage")],
  ];

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard(buttons),
  });
}

export default composer;
