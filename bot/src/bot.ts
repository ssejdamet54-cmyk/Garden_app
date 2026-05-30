import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import http from "node:http";
type Plant = {
  id: number;
  name: string;
  type: string;
  place: string;
  room: string;
  image: string;
  wateringEveryDays: number;
  lastWateredAt: string;
  wateringHistory?: string[];
  notes: string;
};

type BotSettings = {
  remindersEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
};

const botToken = process.env.BOT_TOKEN;
const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
const miniAppUrl =
  process.env.MINI_APP_URL || "https://garden-mini-app.vercel.app/";
const ownerChatId = process.env.OWNER_CHAT_ID;
function getOwnerId(chatId?: number | string): string {
  if (chatId !== undefined && chatId !== null) {
    return String(chatId);
  }

  return ownerChatId || "default";
}

function getBackendHeaders(chatId?: number | string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-owner-id": getOwnerId(chatId),
  };
}

if (!botToken) {
  throw new Error("BOT_TOKEN не указан в .env");
}

const bot = new Telegraf(botToken);
const settingsFilePath = path.join(process.cwd(), "data", "settings.json");

async function readBotSettings(): Promise<BotSettings> {
  try {
    const fileContent = await fs.readFile(settingsFilePath, "utf-8");
    const settings = JSON.parse(fileContent) as BotSettings;

    return {
      remindersEnabled: Boolean(settings.remindersEnabled),
      reminderHour: Number(settings.reminderHour ?? 9),
      reminderMinute: Number(settings.reminderMinute ?? 0),
    };
  } catch {
    const defaultSettings: BotSettings = {
      remindersEnabled: true,
      reminderHour: 9,
      reminderMinute: 0,
    };

    await writeBotSettings(defaultSettings);

    return defaultSettings;
  }
}

async function writeBotSettings(settings: BotSettings) {
  await fs.mkdir(path.dirname(settingsFilePath), { recursive: true });

  await fs.writeFile(
    settingsFilePath,
    JSON.stringify(settings, null, 2),
    "utf-8"
  );
}

async function updateReminderTime(hour: number, minute: number) {
  const settings = await readBotSettings();

  const updatedSettings: BotSettings = {
    ...settings,
    remindersEnabled: true,
    reminderHour: hour,
    reminderMinute: minute,
  };

  await writeBotSettings(updatedSettings);

  return updatedSettings;
}

async function setRemindersEnabled(enabled: boolean) {
  const settings = await readBotSettings();

  const updatedSettings: BotSettings = {
    ...settings,
    remindersEnabled: enabled,
  };

  await writeBotSettings(updatedSettings);

  return updatedSettings;
}

function getReminderTimeText(settings: BotSettings) {
  return `${String(settings.reminderHour).padStart(2, "0")}:${String(
    settings.reminderMinute
  ).padStart(2, "0")}`;
}

async function checkBackendHealth() {
  try {
    const response = await fetch(`${backendUrl}/health`);

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    return Boolean(data.ok);
  } catch {
    return false;
  }
}
async function getPlants(chatId?: number | string): Promise<Plant[]> {
  const response = await fetch(`${backendUrl}/plants`, {
    headers: getBackendHeaders(chatId),
  });

  if (!response.ok) {
    throw new Error("Failed to load plants");
  }

  const plants = await response.json();

  if (!Array.isArray(plants)) {
    return [];
  }

  return plants;
}

function getDaysUntilWatering(plant: Plant) {
  const today = new Date();
  const lastWateredAt = new Date(plant.lastWateredAt);

  today.setHours(0, 0, 0, 0);
  lastWateredAt.setHours(0, 0, 0, 0);

  const nextWatering = new Date(lastWateredAt);
  nextWatering.setDate(
    nextWatering.getDate() + Number(plant.wateringEveryDays || 7)
  );

  const differenceMs = nextWatering.getTime() - today.getTime();

  return Math.ceil(differenceMs / (1000 * 60 * 60 * 24));
}

function formatPlantList(plants: Plant[]) {
  if (plants.length === 0) {
    return "Пока растений нет. Добавь первое растение в приложении.";
  }

  return plants
    .map((plant) => {
      return `${plant.image} ${plant.name}\nМесто: ${plant.place}, ${plant.room}\nПолив: каждые ${plant.wateringEveryDays} дн.`;
    })
    .join("\n\n");
}

function formatWateringList(plants: Plant[]) {
  if (plants.length === 0) {
    return "Пока нет растений для полива.";
  }

  return plants
    .map((plant) => {
      const days = getDaysUntilWatering(plant);

      if (days < 0) {
        return `🔴 ${plant.name}: просрочено на ${Math.abs(days)} дн.`;
      }

      if (days === 0) {
        return `🟡 ${plant.name}: полить сегодня`;
      }

      return `🟢 ${plant.name}: через ${days} дн.`;
    })
    .join("\n");
}

function getWateringButtons(plants: Plant[]) {
  const plantsToWater = plants.filter(
    (plant) => getDaysUntilWatering(plant) <= 0
  );

  return plantsToWater.map((plant) => [
    Markup.button.callback(`✅ Полил: ${plant.name}`, `WATER_PLANT_${plant.id}`),
  ]);
}

function getAllWateringButtons(plants: Plant[]) {
  return plants.map((plant) => [
    Markup.button.callback(`✅ Полил: ${plant.name}`, `WATER_PLANT_${plant.id}`),
  ]);
}

async function sendWateringListMessage(ctx: any, onlyDue: boolean) {
  const plants = await getPlants(ctx.chat?.id);
  const filteredPlants = onlyDue
    ? plants.filter((plant) => getDaysUntilWatering(plant) <= 0)
    : plants;

  if (onlyDue && filteredPlants.length === 0) {
    await ctx.reply("✅ Сейчас ничего поливать не нужно.");
    return;
  }

  const text = onlyDue
    ? `💧 Нужно полить:\n\n${formatWateringList(filteredPlants)}`
    : `💧 График полива:\n\n${formatWateringList(plants)}`;

  const buttons = onlyDue ? getWateringButtons(plants) : getWateringButtons(plants);

  if (buttons.length > 0) {
    await ctx.reply(text, Markup.inlineKeyboard(buttons));
    return;
  }

  await ctx.reply(text);
}

async function sendDailyWateringReminder() {
  if (!ownerChatId) {
    console.warn("OWNER_CHAT_ID не указан в .env");
    return;
  }

  const settings = await readBotSettings();

  if (!settings.remindersEnabled) {
    console.log("Напоминания выключены.");
    return;
  }

  try {
const plants = await getPlants();
    const importantPlants = plants.filter(
      (plant) => getDaysUntilWatering(plant) <= 0
    );

    if (importantPlants.length === 0) {
      console.log("Нет растений для напоминания о поливе.");
      return;
    }

    const text = importantPlants
      .map((plant) => {
        const days = getDaysUntilWatering(plant);

        if (days < 0) {
          return `🔴 ${plant.name}: просрочено на ${Math.abs(days)} дн.`;
        }

        return `🟡 ${plant.name}: полить сегодня`;
      })
      .join("\n");

    await bot.telegram.sendMessage(
      ownerChatId,
      `💧 Напоминание о поливе:\n\n${text}`
    );

    console.log("Напоминание о поливе отправлено.");
  } catch (error) {
    console.error("Не удалось отправить напоминание:", error);
  }
}

bot.start(async (ctx) => {
  console.log("User chat id:", ctx.chat.id);

  await ctx.reply(
    "🌱 Привет! Я твой садовый помощник.\n\nЯ помогу следить за растениями, поливом, уходом и напоминаниями.",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🌿 Мои растения", "MY_PLANTS"),
        Markup.button.callback("💧 Полив", "WATERING"),
      ],
      [
        Markup.button.callback("⚠️ Что полить", "DUE_PLANTS"),
        Markup.button.callback("✅ Полил", "WATER_ALL"),
      ],
      [
  Markup.button.callback("⚙️ Настройки", "SETTINGS"),
  Markup.button.webApp("📱 Открыть приложение", miniAppUrl),
],
      [
        Markup.button.callback("⏰ 09:00", "REMINDER_9"),
        Markup.button.callback("🌙 20:00", "REMINDER_20"),
        Markup.button.callback("🔕 Выкл", "REMINDER_OFF"),
      ],
    ])
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "📚 Команды садового помощника:",
      "",
      "/start — главное меню",
      "/plants — список растений",
      "/watering — график полива",
      "/today — что полить сегодня",
      "/overdue — просроченный полив",
      "/due — всё, что нужно полить сейчас",
      "/water_all — кнопки “Полил” для всех растений",
      "/settings — настройки напоминаний",
      "/status — статус backend",
      "/reminder_9 — напоминать в 09:00",
      "/reminder_20 — напоминать в 20:00",
      "/reminder_on — включить напоминания",
      "/reminder_off — выключить напоминания",
      "/reminder_test — тест напоминания",
    ].join("\n")
  );
});

bot.command("plants", async (ctx) => {
  try {
 const plants = await getPlants(ctx.chat?.id);
    await ctx.reply(`🌿 Твои растения:\n\n${formatPlantList(plants)}`);
  } catch {
    await ctx.reply("Не удалось получить растения. Проверь, запущен ли backend.");
  }
});

bot.command("watering", async (ctx) => {
  try {
    await sendWateringListMessage(ctx, false);
  } catch {
    await ctx.reply("Не удалось получить график полива. Проверь backend.");
  }
});

bot.command("today", async (ctx) => {
  try {
   const plants = await getPlants(ctx.chat?.id);
    const todayPlants = plants.filter(
      (plant) => getDaysUntilWatering(plant) === 0
    );

    if (todayPlants.length === 0) {
      await ctx.reply("✅ Сегодня по графику поливать ничего не нужно.");
      return;
    }

    const text = todayPlants
      .map((plant) => `🟡 ${plant.name} — ${plant.place}, ${plant.room}`)
      .join("\n");

    await ctx.reply(`💧 Сегодня нужно полить:\n\n${text}`);
  } catch {
    await ctx.reply("Не удалось получить задачи на сегодня. Проверь backend.");
  }
});

bot.command("overdue", async (ctx) => {
  try {
const plants = await getPlants(ctx.chat?.id);
    const overduePlants = plants.filter(
      (plant) => getDaysUntilWatering(plant) < 0
    );

    if (overduePlants.length === 0) {
      await ctx.reply("✅ Просроченного полива нет.");
      return;
    }

    const text = overduePlants
      .map((plant) => {
        const days = Math.abs(getDaysUntilWatering(plant));
        return `🔴 ${plant.name}: просрочено на ${days} дн.`;
      })
      .join("\n");

    await ctx.reply(`⚠️ Просроченный полив:\n\n${text}`);
  } catch {
    await ctx.reply("Не удалось получить просроченный полив. Проверь backend.");
  }
});

bot.command("due", async (ctx) => {
  try {
    await sendWateringListMessage(ctx, true);
  } catch {
    await ctx.reply("Не удалось получить список полива. Проверь backend.");
  }
});

bot.command("water_all", async (ctx) => {
  try {
   const plants = await getPlants(ctx.chat?.id);

    if (plants.length === 0) {
      await ctx.reply("Пока растений нет.");
      return;
    }

    await ctx.reply(
      "Выбери растение, которое ты полил:",
      Markup.inlineKeyboard(getAllWateringButtons(plants))
    );
  } catch {
    await ctx.reply("Не удалось получить растения. Проверь backend.");
  }
});

bot.command("settings", async (ctx) => {
  const settings = await readBotSettings();

  await ctx.reply(
    [
      "⚙️ Настройки:",
      "",
      `⏰ Напоминание: ${getReminderTimeText(settings)}`,
      `🔔 Статус: ${settings.remindersEnabled ? "включено" : "выключено"}`,
      ownerChatId ? "👤 Chat ID: подключен" : "👤 Chat ID: не указан",
      `🔗 Backend: ${backendUrl}`,
      "",
      "Команды:",
      "/reminder_9 — напоминать в 09:00",
      "/reminder_20 — напоминать в 20:00",
      "/reminder_on — включить напоминания",
      "/reminder_off — выключить напоминания",
      "/reminder_test — тест напоминания",
    ].join("\n")
  );
});

bot.command("status", async (ctx) => {
  const isBackendOk = await checkBackendHealth();
  const settings = await readBotSettings();

  if (!isBackendOk) {
    await ctx.reply(
      [
        "🔴 Статус:",
        "",
        "Backend недоступен.",
        `Адрес: ${backendUrl}`,
        "",
        "Проверь, запущен ли backend:",
        "cd C:\\Users\\Сервер\\garden-app\\backend",
        "npm run dev",
      ].join("\n")
    );
    return;
  }

  try {
const plants = await getPlants(ctx.chat?.id);

    const overdueCount = plants.filter(
      (plant) => getDaysUntilWatering(plant) < 0
    ).length;

    const todayCount = plants.filter(
      (plant) => getDaysUntilWatering(plant) === 0
    ).length;

    await ctx.reply(
      [
        "🟢 Статус:",
        "",
        "Backend работает.",
        `🌿 Растений: ${plants.length}`,
        `🔴 Просрочено: ${overdueCount}`,
        `🟡 Полить сегодня: ${todayCount}`,
        `⏰ Напоминание: ${getReminderTimeText(settings)}`,
        `🔔 Напоминания: ${
          settings.remindersEnabled ? "включены" : "выключены"
        }`,
      ].join("\n")
    );
  } catch {
    await ctx.reply("Backend отвечает, но не удалось получить растения.");
  }
});

bot.command("reminder_9", async (ctx) => {
  const settings = await updateReminderTime(9, 0);

  await ctx.reply(
    [
      "✅ Время напоминаний обновлено.",
      `⏰ Теперь: ${getReminderTimeText(settings)}`,
      "🔔 Напоминания включены.",
    ].join("\n")
  );
});

bot.command("reminder_20", async (ctx) => {
  const settings = await updateReminderTime(20, 0);

  await ctx.reply(
    [
      "✅ Время напоминаний обновлено.",
      `⏰ Теперь: ${getReminderTimeText(settings)}`,
      "🔔 Напоминания включены.",
    ].join("\n")
  );
});

bot.command("reminder_on", async (ctx) => {
  const settings = await setRemindersEnabled(true);

  await ctx.reply(
    ["🔔 Напоминания включены.", `⏰ Время: ${getReminderTimeText(settings)}`].join(
      "\n"
    )
  );
});

bot.command("reminder_off", async (ctx) => {
  const settings = await setRemindersEnabled(false);

  await ctx.reply(
    [
      "🔕 Напоминания выключены.",
      `⏰ Сохранённое время: ${getReminderTimeText(settings)}`,
      "Включить снова можно командой /reminder_9 или /reminder_20.",
    ].join("\n")
  );
});

bot.command("reminder_test", async (ctx) => {
  await sendDailyWateringReminder();
  await ctx.reply("Тест напоминания запущен. Проверь, пришло ли сообщение.");
});

bot.action("MY_PLANTS", async (ctx) => {
  await ctx.answerCbQuery();

  try {
   const plants = await getPlants(ctx.chat?.id);
    await ctx.reply(`🌿 Твои растения:\n\n${formatPlantList(plants)}`);
  } catch {
    await ctx.reply("Не удалось получить растения. Проверь, запущен ли backend.");
  }
});

bot.action("WATERING", async (ctx) => {
  await ctx.answerCbQuery();

  try {
    await sendWateringListMessage(ctx, false);
  } catch {
    await ctx.reply("Не удалось получить график полива. Проверь backend.");
  }
});

bot.action("APP_INFO", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "📱 Mini App пока работает локально на компьютере.\n\nTelegram разрешает Mini App только по HTTPS-ссылке. Когда выложим приложение в интернет, здесь появится кнопка открытия приложения."
  );
});

bot.action("SETTINGS", async (ctx) => {
  await ctx.answerCbQuery();

  const settings = await readBotSettings();

  await ctx.reply(
    [
      "⚙️ Настройки:",
      "",
      `⏰ Напоминание: ${getReminderTimeText(settings)}`,
      `🔔 Статус: ${settings.remindersEnabled ? "включено" : "выключено"}`,
      ownerChatId ? "👤 Chat ID: подключен" : "👤 Chat ID: не указан",
      `🔗 Backend: ${backendUrl}`,
      "",
      "Быстрые команды:",
      "/reminder_9",
      "/reminder_20",
      "/reminder_off",
    ].join("\n")
  );
});

bot.action("DUE_PLANTS", async (ctx) => {
  await ctx.answerCbQuery();

  try {
    await sendWateringListMessage(ctx, true);
  } catch {
    await ctx.reply("Не удалось получить список полива. Проверь backend.");
  }
});

bot.action("WATER_ALL", async (ctx) => {
  await ctx.answerCbQuery();

  try {
  const plants = await getPlants(ctx.chat?.id);

    if (plants.length === 0) {
      await ctx.reply("Пока растений нет.");
      return;
    }

    await ctx.reply(
      "Выбери растение, которое ты полил:",
      Markup.inlineKeyboard(getAllWateringButtons(plants))
    );
  } catch {
    await ctx.reply("Не удалось получить растения. Проверь backend.");
  }
});

bot.action("REMINDER_9", async (ctx) => {
  await ctx.answerCbQuery();

  const settings = await updateReminderTime(9, 0);

  await ctx.reply(`✅ Напоминания включены на ${getReminderTimeText(settings)}.`);
});

bot.action("REMINDER_20", async (ctx) => {
  await ctx.answerCbQuery();

  const settings = await updateReminderTime(20, 0);

  await ctx.reply(`✅ Напоминания включены на ${getReminderTimeText(settings)}.`);
});

bot.action("REMINDER_OFF", async (ctx) => {
  await ctx.answerCbQuery();

  await setRemindersEnabled(false);

  await ctx.reply("🔕 Напоминания выключены.");
});

bot.action(/^WATER_PLANT_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const plantId = Number(ctx.match[1]);

  try {
    const response = await fetch(`${backendUrl}/plants/${plantId}/water`, {
      method: "POST",
headers: getBackendHeaders(ctx.chat?.id),
    });

    if (!response.ok) {
      throw new Error("Failed to water plant");
    }

    const updatedPlant = await response.json();

    await ctx.reply(`✅ Полив отмечен: ${updatedPlant.name}`);
  } catch {
    await ctx.reply("Не удалось отметить полив. Проверь backend.");
  }
});

let lastReminderDate = "";

cron.schedule("* * * * *", async () => {
  const settings = await readBotSettings();

  if (!settings.remindersEnabled) {
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const todayKey = now.toISOString().slice(0, 10);

  const isReminderTime =
    currentHour === settings.reminderHour &&
    currentMinute === settings.reminderMinute;

  if (!isReminderTime) {
    return;
  }

  if (lastReminderDate === todayKey) {
    return;
  }

  lastReminderDate = todayKey;
  await sendDailyWateringReminder();
});

bot.telegram.setMyCommands([
  {
    command: "start",
    description: "Главное меню",
  },
  {
    command: "plants",
    description: "Мои растения",
  },
  {
    command: "watering",
    description: "График полива",
  },
  {
    command: "today",
    description: "Полить сегодня",
  },
  {
    command: "overdue",
    description: "Просроченный полив",
  },
  {
    command: "due",
    description: "Что нужно полить сейчас",
  },
  {
    command: "water_all",
    description: "Отметить полив",
  },
  {
    command: "settings",
    description: "Настройки",
  },
  {
    command: "status",
    description: "Статус backend",
  },
  {
    command: "help",
    description: "Помощь",
  },
  {
    command: "reminder_9",
    description: "Напоминать в 09:00",
  },
  {
    command: "reminder_20",
    description: "Напоминать в 20:00",
  },
  {
    command: "reminder_on",
    description: "Включить напоминания",
  },
  {
    command: "reminder_off",
    description: "Выключить напоминания",
  },
  {
    command: "reminder_test",
    description: "Тест напоминания",
  },
]);

bot.catch((error) => {
  console.error("Bot error:", error);
});

readBotSettings().then((settings) => {
  console.log(`Watering reminder configured at ${getReminderTimeText(settings)}`);
});
const port = Number(process.env.PORT || 3000);

const healthServer = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, {
      "Content-Type": "application/json",
    });

    response.end(
      JSON.stringify({
        ok: true,
        service: "garden-telegram-bot",
      })
    );

    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
  });

  response.end("Garden Telegram bot is running.");
});

healthServer.listen(port, () => {
  console.log(`Bot health server is running on port ${port}`);
});

bot
  .launch()
  .then(() => {
    console.log("Garden Telegram bot is running.");
  })
  .catch((error) => {
    console.error("Failed to launch bot:", error);
  });

process.once("SIGINT", () => {
  bot.stop("SIGINT");
  healthServer.close();
});

process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  healthServer.close();
});