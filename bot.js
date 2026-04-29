import { STRINGS, BUTTONS } from "./strings.js";
import { Redis } from "@upstash/redis";
import { QuranAPI } from "./quranApi.js";
import { UIManager } from "./ui_manager.js";
import { MediaManager } from "./media_manager.js";

export class QuranBot {
  constructor(env) {
    this.env = env;
    this.token = env.TELEGRAM_BOT_TOKEN;
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    this.quran = new QuranAPI(this.redis);
    this.ui = new UIManager(this);
    this.media = new MediaManager(this);
  }

  async handleUpdate(update) {
    if (update.message) {
      return this.handleMessage(update.message);
    } else if (update.callback_query) {
      return this.handleCallback(update.callback_query);
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text?.trim();
    if (!text) return;

    const lang = await this.getLang(chatId);

    // Language handling
    if (text === BUTTONS.lang[lang]) {
      const newLang = lang === "ar" ? "en" : "ar";
      await this.setLang(chatId, newLang);
      return this.sendResponse(chatId, newLang, "lang_set");
    }

    // Commands
    if (text === "/start" || text === BUTTONS.back?.ar || text === BUTTONS.back?.en) {
      return this.sendResponse(chatId, lang, "welcome");
    }

    if (text === BUTTONS.today_hadith[lang]) {
      return this.ui.showTodayHadith(chatId, lang);
    }

    if (text === BUTTONS.read_quran[lang]) {
      return this.ui.showReadSuwar(chatId, lang);
    }

    if (text === BUTTONS.listen_quran[lang]) {
      return this.ui.showReciters(chatId, lang, null, "listen");
    }

    if (text === BUTTONS.radios[lang]) {
      return this.ui.showRadios(chatId, lang);
    }

    // Quick Page Navigation
    if (/^\d+$/.test(text)) {
      const pageNum = parseInt(text);
      if (pageNum >= 1 && pageNum <= 604) {
        return this.ui.showQuranPage(chatId, lang, pageNum);
      }
    }

    // State handling
    const state = await this.redis.get(`state:${chatId}`);
    if (state === "waiting_page" && /^\d+$/.test(text)) {
      await this.redis.del(`state:${chatId}`);
      const pageNum = parseInt(text);
      if (pageNum >= 1 && pageNum <= 604) {
        return this.ui.showQuranPage(chatId, lang, pageNum);
      }
    }

    return this.sendResponse(chatId, lang, "welcome");
  }

  async handleCallback(query) {
    try {
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;
      const data = query.data;
      const lang = await this.getLang(chatId);

      // Answer callback to remove loading state (non-blocking)
      this.answerCallback(query.id).catch(() => {});

      if (data.startsWith("lang:")) {
        const newLang = data.split(":")[1];
        await this.setLang(chatId, newLang);
        return this.sendResponse(chatId, newLang, "welcome");
      }

      if (data.startsWith("reciter:")) {
        const parts = data.split(":");
        if (parts.length >= 3) {
          const [, intent, reciterId] = parts;
          return this.ui.showMoshafs(chatId, lang, reciterId, messageId, intent);
        }
      }

      if (data.startsWith("moshaf:")) {
        const parts = data.split(":");
        if (parts.length === 4) {
          const [, intent, reciterId, mIndex] = parts;
          return this.ui.showSuwar(chatId, lang, reciterId, messageId, intent, 0, parseInt(mIndex));
        }
      }

      if (data.startsWith("moshaf_page:")) {
        const parts = data.split(":");
        if (parts.length === 5) {
          const [, intent, reciterId, mIndex, page] = parts;
          return this.ui.showSuwar(chatId, lang, reciterId, messageId, intent, parseInt(page), parseInt(mIndex));
        }
      }

      if (data.startsWith("surah:")) {
        const parts = data.split(":");
        if (parts.length === 5) {
          return this.media.sendMedia(chatId, lang, parts[2], parts[3], parts[4] || 0, parts[1]);
        }
      }

      if (data.startsWith("show_reciters:")) {
        const parts = data.split(":");
        return this.ui.showReciters(chatId, lang, messageId, parts[1], parseInt(parts[2] || "0"));
      }

      if (data.startsWith("show_radios:")) {
        const parts = data.split(":");
        return this.ui.showRadios(chatId, lang, messageId, parseInt(parts[1] || "0"));
      }

      if (data.startsWith("page:")) {
        const pageNum = parseInt(data.split(":")[1]);
        return this.ui.showQuranPage(chatId, lang, pageNum, messageId);
      }

      if (data.startsWith("read_surah:")) {
        const surahId = data.split(":")[1];
        const suwar = await this.quran.getSuwar(lang);
        const surah = suwar.find((s) => s.id == surahId);
        if (surah) {
          return this.ui.showQuranPage(chatId, lang, surah.start_page);
        }
      }

      if (data.startsWith("show_read_suwar:")) {
        const page = parseInt(data.split(":")[1] || "0");
        return this.ui.showReadSuwar(chatId, lang, messageId, page);
      }

      if (data.startsWith("dl_file:")) {
        const [, reciterId, surahId] = data.split(":");
        return this.media.sendMedia(chatId, lang, reciterId, surahId, 0, "download");
      }

      if (data === "goto_page") {
        await this.redis.set(`state:${chatId}`, "waiting_page");
        return this.sendMessage(chatId, STRINGS[lang].enter_page);
      }

      if (data === "main_menu") {
        return this.sendResponse(chatId, lang, "welcome");
      }
    } catch (e) {
      console.error("Callback Error:", e);
      return this.sendMessage(query.message.chat.id, `❌ Bot Error: ${e.message}`);
    }
  }

  // Communication Helpers
  async callTelegram(method, params) {
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const result = await response.json();
    if (!result.ok) {
      console.error(`Telegram API Error (${method}):`, result);
      throw new Error(`Telegram API Error: ${result.description}`);
    }
    return result;
  }

  async sendMessage(chatId, text, extra = {}) {
    return this.callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...extra,
    });
  }

  async editMessage(chatId, messageId, text, extra = {}) {
    return this.callTelegram("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      ...extra,
    });
  }

  async answerCallback(callbackQueryId) {
    return this.callTelegram("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
    });
  }

  async sendResponse(chatId, lang, stringKey) {
    const text = STRINGS[lang][stringKey] || STRINGS[lang].welcome;
    const keyboard = this.ui.getMainMenu(lang);
    return this.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  async getLang(chatId) {
    try {
      return (await this.redis.get(`lang:${chatId}`)) || "ar";
    } catch (e) {
      return "ar";
    }
  }

  async setLang(chatId, lang) {
    return this.redis.set(`lang:${chatId}`, lang);
  }
}
