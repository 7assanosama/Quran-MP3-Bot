import { STRINGS, BUTTONS } from "./strings.js";
import { Redis } from "@upstash/redis";
import { QuranAPI } from "./quranApi.js";

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

    // Initialize Quran API controller
    this.quran = new QuranAPI(this.redis);
  }

  async handleUpdate(message) {
    const chatId = message.chat.id;
    const text = message.text?.trim();

    // Show "typing..." status
    await this.sendAction(chatId, "typing");

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

  async sendAction(chatId, action = "typing") {
    const url = `${this.api}/sendChatAction`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        action: action,
      }),
    }).catch((e) => console.error("Error sending action:", e));
  }

  async sendResponse(chatId, lang, stringKey) {
    const text = STRINGS[lang][stringKey] || STRINGS[lang].welcome;
    const keyboard = this.getMainMenu(lang);

    return this.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  getMainMenu(lang) {
    return {
      keyboard: [
        [
          { text: BUTTONS.listen_quran[lang] },
          { text: BUTTONS.read_quran[lang] },
        ],
        [{ text: BUTTONS.lang[lang] }, { text: BUTTONS.radios[lang] }],
      ],
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
