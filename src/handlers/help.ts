import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

// /help — plain-language explanation for non-technical users. This bot is
// button-driven: tell the user to tap /start to open the menu rather than listing
// slash commands. The same text is shown when the user taps the Help button on the
// main menu (`menu:help`). Enhance the copy for your specific bot; keep it short.
const composer = new Composer<Ctx>();

const HELP =
  "ℹ️ <b>How to use CryptoWatch</b>\n\n" +
  "Everything is controlled by tapping buttons — no commands to remember.\n\n" +
  "• <b>➕ Add Coin</b> — Track a cryptocurrency\n" +
  "• <b>📊 Price</b> — Check current prices\n" +
  "• <b>🔔 Manage Alerts</b> — Set price or percent alerts\n" +
  "• <b>⚙️ Settings</b> — Timezone, quiet hours, daily summary\n\n" +
  "Tap /start to open the menu.";

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("help", async (ctx) => {
  await ctx.reply(HELP, { parse_mode: "HTML" });
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(HELP, { parse_mode: "HTML", reply_markup: backToMenu });
});

export default composer;
