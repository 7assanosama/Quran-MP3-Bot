import { STRINGS } from "./strings.js";
import { Redis } from "@upstash/redis";

export class QuranBot {
  constructor(env) {
    this.env = env;
    this.token = env.TELEGRAM_BOT_TOKEN;
    this.api = `https://api.telegram.org/bot${this.token}`;

    // Initialize Upstash Redis client
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  async handleUpdate(message) {
    const chatId = message.chat.id;
    const text = message.text?.trim();
    const lang = await this.getLang(chatId);

    // Handle language switching
    if (text === "English 🌐" || text === "en") {
      await this.setLang(chatId, "en");
      return this.sendResponse(chatId, "en", "lang_set");
    }

    if (text === "العربية 🌐" || text === "ar") {
      await this.setLang(chatId, "ar");
      return this.sendResponse(chatId, "ar", "lang_set");
    }

    // Default response for known commands or main menu
    if (text === "/start") {
      return this.sendResponse(chatId, lang, "welcome");
    }

    // Handle unknown text
    if (text) {
      return this.sendResponse(chatId, lang, "unknown");
    }

    return this.sendResponse(chatId, lang, "welcome");
  }

  async sendResponse(chatId, lang, stringKey) {
    const text = STRINGS[lang][stringKey] || STRINGS[lang].welcome;
    const keyboard = this.getMainMenu(lang);

    return this.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  getMainMenu(lang) {
    return {
      keyboard: [[{ text: STRINGS[lang].buttons.lang }]],
      resize_keyboard: true,
    };
  }

  async sendMessage(chatId, text, extra = {}) {
    const url = `${this.api}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...extra,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Telegram API Error:", errorData);
    }

    return response.json();
  }

  async getLang(chatId) {
    try {
      return (await this.redis.get(`user:${chatId}:lang`)) || "ar";
    } catch (e) {
      console.error("Redis Error (getLang):", e);
      return "ar";
    }
  }

  async setLang(chatId, lang) {
    try {
      await this.redis.set(`user:${chatId}:lang`, lang);
    } catch (e) {
      console.error("Redis Error (setLang):", e);
    }
  }
}
