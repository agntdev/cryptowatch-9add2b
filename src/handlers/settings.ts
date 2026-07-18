import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { store } from "../store.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

// Register in main menu
import { registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "⚙️ Settings", data: "settings:menu", order: 50 });

const composer = new Composer<Ctx>();

// Handle "Settings" button tap
composer.callbackQuery("settings:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showSettings(ctx);
});

// Handle timezone setting
composer.callbackQuery("settings:timezone", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_timezone";
  ctx.session.settingTimezone = true;
  await ctx.reply("Type your timezone (e.g. UTC, America/New_York, Europe/London):", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. America/New_York" },
  });
});

// Handle quiet hours setting
composer.callbackQuery("settings:quiet_hours", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showQuietHoursSettings(ctx);
});

// Handle setting quiet hours start
composer.callbackQuery("settings:quiet_start", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_quiet_start";
  ctx.session.settingQuietHours = true;
  ctx.session.quietHoursField = "start";
  await ctx.reply("When should quiet hours START? (hour 0-23, e.g. 22 for 10 PM):", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 22" },
  });
});

// Handle setting quiet hours end
composer.callbackQuery("settings:quiet_end", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_quiet_end";
  ctx.session.settingQuietHours = true;
  ctx.session.quietHoursField = "end";
  await ctx.reply("When should quiet hours END? (hour 0-23, e.g. 7 for 7 AM):", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 7" },
  });
});

// Handle daily summary time setting
composer.callbackQuery("settings:summary_time", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_summary_time";
  ctx.session.settingSummaryTime = true;
  await ctx.reply("What time should you receive the daily summary? (HH:MM in 24h format, e.g. 08:00):", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 08:00" },
  });
});

// Handle timezone input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_timezone") return next();

  const input = ctx.message.text.trim();
  ctx.session.settingTimezone = false;
  ctx.session.step = "idle";

  // Basic timezone validation
  if (input.length < 2 || input.length > 50) {
    await ctx.reply("Please enter a valid timezone (e.g. UTC, America/New_York).", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:menu")]]),
    });
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    return next();
  }

  store.updateUser(chatId, { timezone: input });

  await ctx.reply(`✅ Timezone set to ${input}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:menu")]]),
  });
});

// Handle quiet hours start input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_quiet_start") return next();

  const input = ctx.message.text.trim();
  const hour = parseInt(input, 10);

  ctx.session.settingQuietHours = false;
  ctx.session.step = "idle";

  if (isNaN(hour) || hour < 0 || hour > 23) {
    await ctx.reply("Please enter a valid hour (0-23).", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:menu")]]),
    });
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    return next();
  }

  store.updateUser(chatId, { quietHoursStart: hour });

  await ctx.reply(`✅ Quiet hours will start at ${hour}:00.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:menu")]]),
  });
});

// Handle quiet hours end input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_quiet_end") return next();

  const input = ctx.message.text.trim();
  const hour = parseInt(input, 10);

  ctx.session.settingQuietHours = false;
  ctx.session.step = "idle";

  if (isNaN(hour) || hour < 0 || hour > 23) {
    await ctx.reply("Please enter a valid hour (0-23).", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:menu")]]),
    });
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    return next();
  }

  store.updateUser(chatId, { quietHoursEnd: hour });

  await ctx.reply(`✅ Quiet hours will end at ${hour}:00.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:menu")]]),
  });
});

// Handle summary time input
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_summary_time") return next();

  const input = ctx.message.text.trim();
  ctx.session.settingSummaryTime = false;
  ctx.session.step = "idle";

  // Validate HH:MM format
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(input)) {
    await ctx.reply("Please enter a valid time in HH:MM format (e.g. 08:00).", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:menu")]]),
    });
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    return next();
  }

  store.updateUser(chatId, { summaryTime: input });

  await ctx.reply(`✅ Daily summary set for ${input}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:menu")]]),
  });
});

// Show settings menu
async function showSettings(ctx: Ctx): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const user = store.getOrCreateUser(chatId);

  let message = "⚙️ <b>Settings</b>\n\n";
  message += `<b>Timezone:</b> ${user.timezone}\n`;
  message += `<b>Quiet hours:</b> ${user.quietHoursStart}:00 - ${user.quietHoursEnd}:00\n`;
  message += `<b>Daily summary:</b> ${user.summaryTime ?? "Not set"}\n`;

  const buttons = [
    [inlineButton("🌍 Timezone", "settings:timezone")],
    [inlineButton("🔕 Quiet hours", "settings:quiet_hours")],
    [inlineButton("📅 Daily summary", "settings:summary_time")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ];

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard(buttons),
  });
}

// Show quiet hours settings
async function showQuietHoursSettings(ctx: Ctx): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const user = store.getOrCreateUser(chatId);

  let message = "🔕 <b>Quiet Hours</b>\n\n";
  message += `Current: ${user.quietHoursStart}:00 - ${user.quietHoursEnd}:00\n\n`;
  message += "During quiet hours, you won't receive alerts.";

  const buttons = [
    [inlineButton(`Start: ${user.quietHoursStart}:00`, "settings:quiet_start")],
    [inlineButton(`End: ${user.quietHoursEnd}:00`, "settings:quiet_end")],
    [inlineButton("⬅️ Back", "settings:menu")],
  ];

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: inlineKeyboard(buttons),
  });
}

export default composer;
