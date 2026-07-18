import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../store.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

// Owner ID - in production this would come from env var
const OWNER_ID = parseInt(process.env.OWNER_ID ?? "0", 10);

const composer = new Composer<Ctx>();

// Handle /owner command
composer.command("owner", async (ctx) => {
  // Check if user is owner
  if (OWNER_ID && ctx.from?.id !== OWNER_ID) {
    await ctx.reply("This command is for the bot owner only.");
    return;
  }

  await showOwnerDashboard(ctx);
});

// Handle "Owner" button tap (if added to menu)
composer.callbackQuery("owner:dashboard", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (OWNER_ID && ctx.from?.id !== OWNER_ID) {
    await ctx.reply("This is for the bot owner only.");
    return;
  }
  await showOwnerDashboard(ctx);
});

async function showOwnerDashboard(ctx: Ctx): Promise<void> {
  const metrics = store.getOwnerMetrics();
  const users = store.getAllUsers();

  let message = "📊 <b>Owner Dashboard</b>\n\n";
  message += `<b>Users:</b> ${metrics.totalUsers}\n`;
  message += `<b>Total alerts fired:</b> ${Object.values(metrics.alertFireCounts).reduce((a, b) => a + b, 0)}\n`;

  // Recent alerts (last 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentAlerts = metrics.recentAlertTimestamps.filter((t) => t > oneDayAgo);
  message += `<b>Alerts last 24h:</b> ${recentAlerts.length}\n`;

  // Top alerted coins
  const topCoins = Object.entries(metrics.alertFireCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (topCoins.length > 0) {
    message += "\n<b>Most alerted coins:</b>\n";
    for (const [coin, count] of topCoins) {
      message += `• ${coin}: ${count} alerts\n`;
    }
  }

  // User activity summary
  if (users.length > 0) {
    const totalWatchlistItems = users.reduce((sum, u) => sum + u.watchlist.length, 0);
    message += `\n<b>Watchlist items:</b> ${totalWatchlistItems}\n`;
  }

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard([
      [inlineButton("🔄 Refresh", "owner:dashboard")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
}

export default composer;
