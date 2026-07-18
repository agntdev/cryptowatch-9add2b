import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../store.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

// Register in main menu
import { registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "📋 Watchlist", data: "watchlist:view", order: 15 });

const composer = new Composer<Ctx>();

// Handle "Watchlist" button tap
composer.callbackQuery("watchlist:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showWatchlist(ctx);
});

// Handle remove coin
composer.callbackQuery(/^watchlist:remove:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];
  await confirmRemove(ctx, ticker);
});

// Handle confirm remove
composer.callbackQuery(/^watchlist:confirm:(.+):yes$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1];

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const user = store.getOrCreateUser(chatId);
  user.watchlist = user.watchlist.filter((w) => w.ticker !== ticker);

  await ctx.editMessageText(`✅ Removed ${ticker} from your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("📋 View watchlist", "watchlist:view")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery(/^watchlist:confirm:(.+):no$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showWatchlist(ctx);
});

// Show watchlist
async function showWatchlist(ctx: Ctx): Promise<void> {
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

  let message = "📋 <b>Your Watchlist</b>\n\n";

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const item of user.watchlist) {
    const alertCount = item.thresholdAlerts.length + item.percentMoveAlerts.length;
    message += `• <b>${item.ticker}</b> — ${item.displayName}`;
    if (alertCount > 0) {
      message += ` (${alertCount} alerts)`;
    }
    message += "\n";
    buttons.push([
      inlineButton(`${item.ticker}`, `price:${item.ticker}`),
      inlineButton("🗑", `watchlist:remove:${item.ticker}`),
    ]);
  }

  buttons.push([inlineButton("➕ Add Coin", "watchlist:add")]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard(buttons),
  });
}

// Confirm remove
async function confirmRemove(ctx: Ctx, ticker: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const user = store.getOrCreateUser(chatId);
  const item = user.watchlist.find((w) => w.ticker === ticker);

  if (!item) {
    await ctx.reply(`${ticker} is not in your watchlist.`);
    return;
  }

  await ctx.reply(`Remove ${item.displayName} (${ticker}) from your watchlist?`, {
    reply_markup: inlineKeyboard([
      [
        inlineButton("✅ Yes", `watchlist:confirm:${ticker}:yes`),
        inlineButton("❌ No", `watchlist:confirm:${ticker}:no`),
      ],
    ]),
  });
}

export default composer;
