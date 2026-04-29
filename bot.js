import { STRINGS, BUTTONS } from "./strings.js";
import { Redis } from "@upstash/redis";
import { QuranAPI } from "./quranApi.js";
import { UIManager } from "./ui_manager.js";
import { MediaManager } from "./media_manager.js";
import { TelegramAPI } from "./telegram_api.js";
import { CALLBACK_PREFIX, STATE, CACHE } from "./constants.js";

/**
 * Main Quran Bot Controller
 */
export class QuranBot {
  constructor(env) {
    this.env = env;
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    
    this.telegram = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
    this.quran = new QuranAPI(this.redis);
    this.ui = new UIManager(this);
    this.media = new MediaManager(this);
  }

  /**
   * Main entry point for all Telegram updates
   */
  async handleUpdate(update) {
    try {
      if (update.message) {
        return await this.handleMessage(update.message);
      } else if (update.callback_query) {
        return await this.handleCallback(update.callback_query);
      }
    } catch (error) {
      console.error("Global Update Error:", error);
    }
  }

  /**
   * Handle incoming text messages
   */
  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text?.trim();
    if (!text) return;

    const lang = await this.getLang(chatId);

    // Language Toggle
    if (text === BUTTONS.lang[lang]) {
      const newLang = lang === "ar" ? "en" : "ar";
      await this.setLang(chatId, newLang);
      return this.sendResponse(chatId, newLang, "lang_set");
    }

    // Main Commands
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

    // Direct Page Number Navigation
    if (/^\d+$/.test(text)) {
      const pageNum = parseInt(text);
      if (pageNum >= 1 && pageNum <= 604) {
        return this.ui.showQuranPage(chatId, lang, pageNum);
      }
    }

    // State-based handling (e.g., waiting for page number)
    const state = await this.redis.get(CACHE.STATE(chatId));
    if (state === STATE.WAITING_PAGE && /^\d+$/.test(text)) {
      await this.redis.del(CACHE.STATE(chatId));
      const pageNum = parseInt(text);
      if (pageNum >= 1 && pageNum <= 604) {
        return this.ui.showQuranPage(chatId, lang, pageNum);
      }
    }

    return this.sendResponse(chatId, lang, "welcome");
  }

  /**
   * Handle incoming callback queries (button clicks)
   */
  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    try {
      const lang = await this.getLang(chatId);
      
      // Instantly acknowledge the callback to remove the loading state
      this.telegram.answerCallback(query.id).catch(() => {});

      // Language selection
      if (data.startsWith(CALLBACK_PREFIX.LANG)) {
        const newLang = data.split(":")[1];
        await this.setLang(chatId, newLang);
        return this.sendResponse(chatId, newLang, "welcome");
      }

      // Reciter & Moshaf selection
      if (data.startsWith(CALLBACK_PREFIX.RECITER)) {
        const [, intent, reciterId] = data.split(":");
        return this.ui.showMoshafs(chatId, lang, reciterId, messageId, intent);
      }

      if (data.startsWith(CALLBACK_PREFIX.MOSHAF)) {
        const [, intent, reciterId, mIndex] = data.split(":");
        return this.ui.showSuwar(chatId, lang, reciterId, messageId, intent, 0, parseInt(mIndex));
      }

      if (data.startsWith(CALLBACK_PREFIX.MOSHAF_PAGE)) {
        const [, intent, reciterId, mIndex, page] = data.split(":");
        return this.ui.showSuwar(chatId, lang, reciterId, messageId, intent, parseInt(page), parseInt(mIndex));
      }

      // Media delivery
      if (data.startsWith(CALLBACK_PREFIX.SURAH)) {
        const [, intent, reciterId, surahId, mIndex] = data.split(":");
        return this.media.sendMedia(chatId, lang, reciterId, surahId, parseInt(mIndex), intent);
      }

      // UI Lists
      if (data.startsWith(CALLBACK_PREFIX.SHOW_RECITERS)) {
        const [, intent, page] = data.split(":");
        return this.ui.showReciters(chatId, lang, messageId, intent, parseInt(page || "0"));
      }

      if (data.startsWith(CALLBACK_PREFIX.SHOW_RADIOS)) {
        const page = data.split(":")[1];
        return this.ui.showRadios(chatId, lang, messageId, parseInt(page || "0"));
      }

      if (data.startsWith(CALLBACK_PREFIX.SHOW_READ_SUWAR)) {
        const page = data.split(":")[1];
        return this.ui.showReadSuwar(chatId, lang, messageId, parseInt(page || "0"));
      }

      // Page Navigation
      if (data.startsWith(CALLBACK_PREFIX.PAGE)) {
        const pageNum = parseInt(data.split(":")[1]);
        return this.ui.showQuranPage(chatId, lang, pageNum, messageId);
      }

      if (data.startsWith(CALLBACK_PREFIX.READ_SURAH)) {
        const surahId = data.split(":")[1];
        const suwar = await this.quran.getSuwar(lang);
        const surah = suwar.find((s) => s.id == surahId);
        if (surah) return this.ui.showQuranPage(chatId, lang, surah.start_page);
      }

      // Other actions
      if (data === CALLBACK_PREFIX.GOTO_PAGE) {
        await this.redis.set(CACHE.STATE(chatId), STATE.WAITING_PAGE);
        return this.telegram.sendMessage(chatId, STRINGS[lang].enter_page);
      }

      if (data === CALLBACK_PREFIX.MAIN_MENU) {
        return this.sendResponse(chatId, lang, "welcome");
      }

    } catch (e) {
      console.error("Callback Processing Error:", e);
      try {
        await this.telegram.sendMessage(chatId, `❌ Bot Error: ${e.message}`);
      } catch (err) {
        /* Silent fail if even error reporting fails */
      }
    }
  }

  // --- Helpers ---

  async sendResponse(chatId, lang, stringKey) {
    const text = STRINGS[lang][stringKey] || STRINGS[lang].welcome;
    const keyboard = this.ui.getMainMenu(lang);
    return this.telegram.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  async getLang(chatId) {
    try {
      return (await this.redis.get(CACHE.LANG(chatId))) || "ar";
    } catch (e) {
      return "ar";
    }
  }

  async setLang(chatId, lang) {
    return this.redis.set(CACHE.LANG(chatId), lang);
  }
}
