import { STRINGS, BUTTONS } from "./strings.js";
import { Redis } from "@upstash/redis";
import { QuranAPI } from "./quranApi.js";

export class QuranBot {
  constructor(env) {
    this.env = env;
    this.token = env.TELEGRAM_BOT_TOKEN;
    this.api = `https://api.telegram.org/bot${this.token}`;
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    this.quran = new QuranAPI(this.redis);
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

    await this.sendAction(chatId, "typing");
    const lang = await this.getLang(chatId);

    // Language handling
    if (text === BUTTONS.lang[lang] || text === "en" || text === "ar") {
      const newLang = lang === "ar" ? "en" : "ar";
      await this.setLang(chatId, newLang);
      return this.sendResponse(chatId, newLang, "lang_set");
    }

    // Commands
    if (text === "/start") {
      return this.sendResponse(chatId, lang, "welcome");
    }

    if (text === BUTTONS.listen_quran[lang]) {
      return this.showReciters(chatId, lang, null, "listen");
    }

    if (text === BUTTONS.read_quran[lang]) {
      return this.showQuranPage(chatId, lang, 1);
    }

    if (text === BUTTONS.radios[lang]) {
      return this.showRadios(chatId, lang);
    }

    if (text === BUTTONS.today_hadith[lang]) {
      return this.showTodayHadith(chatId, lang);
    }

    // Quick page navigation (detect numbers 1-604)
    if (/^\d+$/.test(text)) {
      const pageNum = parseInt(text);
      if (pageNum >= 1 && pageNum <= 604) {
        return this.showQuranPage(chatId, lang, pageNum);
      }
    }

    return this.sendResponse(chatId, lang, "unknown");
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;
    const lang = await this.getLang(chatId);

    // Answer callback to remove loading state
    await this.answerCallback(query.id);

    if (data.startsWith("reciter:")) {
      const [, intent, reciterId] = data.split(":");
      return this.showSuwar(chatId, lang, reciterId, messageId, intent);
    }

    if (data.startsWith("surah:")) {
      const [, intent, reciterId, surahId, mIndex] = data.split(":");
      return this.sendAudio(chatId, lang, reciterId, surahId, mIndex || 0);
    }

    if (data.startsWith("show_reciters:")) {
      const parts = data.split(":");
      const intent = parts[1];
      const page = parseInt(parts[2] || "0");
      return this.showReciters(chatId, lang, messageId, intent, page);
    }

    if (data.startsWith("show_radios:")) {
      const page = parseInt(data.split(":")[1] || "0");
      return this.showRadios(chatId, lang, messageId, page);
    }

    if (data.startsWith("page:")) {
      const pageNum = parseInt(data.split(":")[1]);
      return this.showQuranPage(chatId, lang, pageNum, messageId);
    }

    if (data.startsWith("dl_file:")) {
      const [, reciterId, surahId] = data.split(":");
      return this.sendAudio(chatId, lang, reciterId, surahId);
    }

    if (data === "goto_page") {
      return this.sendMessage(chatId, STRINGS[lang].enter_page);
    }

    if (data === "main_menu") {
      const text = STRINGS[lang].welcome;
      return this.editMessage(chatId, messageId, text, {
        reply_markup: { inline_keyboard: [] }, // Or hide it
      });
    }
  }

  async showReciters(chatId, lang, messageId = null, intent = "listen", page = 0) {
    const reciters = await this.quran.getReciters(lang);
    const pageSize = 50;
    const start = page * pageSize;
    const end = start + pageSize;
    const pagedReciters = reciters.slice(start, end);

    const icon = intent === "download" ? "📥" : "🎧";
    const keyboard = pagedReciters.map((r) => [
      { text: `${icon} ${r.name}`, callback_data: `reciter:${intent}:${r.id}` },
    ]);

    // Pagination buttons
    const navButtons = [];
    if (page > 0) {
      navButtons.push({ text: BUTTONS.prev_list[lang], callback_data: `show_reciters:${intent}:${page - 1}` });
    }
    if (end < reciters.length) {
      navButtons.push({ text: BUTTONS.next_list[lang], callback_data: `show_reciters:${intent}:${page + 1}` });
    }
    if (navButtons.length > 0) {
      keyboard.push(navButtons);
    }

    const text = STRINGS[lang].choose_reciter;
    const extra = { reply_markup: { inline_keyboard: keyboard } };

    if (messageId) {
      return this.editMessage(chatId, messageId, text, extra);
    }
    return this.sendMessage(chatId, text, extra);
  }

  async showSuwar(chatId, lang, reciterId, messageId, intent = "listen") {
    const suwar = await this.quran.getSuwar(lang);
    const reciters = await this.quran.getReciters(lang, reciterId);
    const reciter = reciters[0];

    const icon = intent === "download" ? "📥" : "🎧";

    // Build a map of surahId -> moshafIndex to handle reciters with multiple collections
    const surahToMoshaf = new Map();
    reciter.moshaf.forEach((m, mIndex) => {
      m.surah_list.split(",").forEach((sId) => {
        const id = sId.trim();
        if (id && !surahToMoshaf.has(id)) {
          surahToMoshaf.set(id, mIndex);
        }
      });
    });

    const availableSuwar = suwar.filter((s) => surahToMoshaf.has(s.id.toString()));

    // Create a compact keyboard for suwar (3 per row)
    const keyboard = [];
    for (let i = 0; i < availableSuwar.length; i += 3) {
      keyboard.push(
        availableSuwar.slice(i, i + 3).map((s) => {
          const mIndex = surahToMoshaf.get(s.id.toString());
          return {
            text: s.name,
            callback_data: `surah:${intent}:${reciterId}:${s.id}:${mIndex}`,
          };
        }),
      );
    }

    // Add Back button
    keyboard.push([
      { text: BUTTONS.back[lang], callback_data: `show_reciters:${intent}` },
    ]);

    const text = `${icon} <b>${reciter?.name}</b>\n\n${STRINGS[lang].choose_surah}`;
    return this.editMessage(chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async showQuranPage(chatId, lang, pageNum, messageId = null) {
    if (pageNum < 1) pageNum = 1;
    if (pageNum > 604) pageNum = 604;

    const imageUrl = await this.quran.getPage(pageNum);
    const keyboard = [[]];

    if (pageNum > 1) {
      keyboard[0].push({
        text: BUTTONS.prev_page[lang],
        callback_data: `page:${pageNum - 1}`,
      });
    }
    if (pageNum < 604) {
      keyboard[0].push({
        text: BUTTONS.next_page[lang],
        callback_data: `page:${pageNum + 1}`,
      });
    }

    // Add Go to Page button in a new row
    keyboard.push([
      { text: BUTTONS.goto_page[lang], callback_data: "goto_page" },
    ]);

    const caption = `📖 <b>${STRINGS[lang].page} ${pageNum}</b>`;
    const extra = {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: "HTML",
    };

    if (messageId) {
      // Telegram editMessageText doesn't support changing media,
      // but we can use editMessageMedia or just send a new one.
      // editMessageMedia is better for UX.
      return this.callTelegram("editMessageMedia", {
        chat_id: chatId,
        message_id: messageId,
        media: {
          type: "photo",
          media: imageUrl,
          caption: caption,
          parse_mode: "HTML",
        },
        ...extra,
      });
    }

    return this.callTelegram("sendPhoto", {
      chat_id: chatId,
      photo: imageUrl,
      caption: caption,
      ...extra,
    });
  }

  async showRadios(chatId, lang, messageId = null, page = 0) {
    const radios = await this.quran.getRadios(lang);
    const pageSize = 50;
    const start = page * pageSize;
    const end = start + pageSize;
    const pagedRadios = radios.slice(start, end);

    const keyboard = pagedRadios.map((r) => [{ text: r.name, url: r.url }]);

    // Pagination buttons
    const navButtons = [];
    if (page > 0) {
      navButtons.push({ text: BUTTONS.prev_list[lang], callback_data: `show_radios:${page - 1}` });
    }
    if (end < radios.length) {
      navButtons.push({ text: BUTTONS.next_list[lang], callback_data: `show_radios:${page + 1}` });
    }
    if (navButtons.length > 0) {
      keyboard.push(navButtons);
    }

    if (messageId) {
      return this.editMessage(chatId, messageId, STRINGS[lang].choose_radio, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    return this.sendMessage(chatId, STRINGS[lang].choose_radio, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async showTodayHadith(chatId, lang) {
    const hadiths = await this.quran.getTodayHadith();
    if (!hadiths || hadiths.length === 0) {
      return this.sendResponse(chatId, lang, "error");
    }

    // Pick a hadith based on today's date
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    const index = dayOfYear % hadiths.length;
    const hadith = hadiths[index].hadith;

    const text = `${STRINGS[lang].today_hadith_title}\n\n${hadith}`;
    return this.sendMessage(chatId, text);
  }

  async sendAudio(chatId, lang, reciterId, surahId, mIndex = 0) {
    const reciters = await this.quran.getReciters(lang, reciterId);
    const suwar = await this.quran.getSuwar(lang);
    const reciter = reciters[0]; // Since we filtered by ID
    const surah = suwar.find((s) => s.id == surahId);

    if (!reciter || !surah || !reciter.moshaf[mIndex]) return;

    const server = reciter.moshaf[mIndex].server;
    const formattedSurah = surahId.toString().padStart(3, "0");
    const audioUrl = `${server}${formattedSurah}.mp3`;

    const text = STRINGS[lang].playing
      .replace("{name}", surah.name)
      .replace("{reciter}", reciter.name);

    return this.callTelegram("sendAudio", {
      chat_id: chatId,
      audio: audioUrl,
      caption: text,
      parse_mode: "HTML",
      title: surah.name,
      performer: reciter.name,
    });
  }

  // Helper Methods
  async sendAction(chatId, action = "typing") {
    return this.callTelegram("sendChatAction", { chat_id: chatId, action });
  }

  async answerCallback(callbackQueryId) {
    return this.callTelegram("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
    });
  }

  async sendResponse(chatId, lang, stringKey) {
    const text = STRINGS[lang][stringKey] || STRINGS[lang].welcome;
    const keyboard = this.getMainMenu(lang);
    return this.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  getMainMenu(lang) {
    return {
      keyboard: [
        [{ text: BUTTONS.today_hadith[lang] }],
        [
          { text: BUTTONS.read_quran[lang] },
          { text: BUTTONS.listen_quran[lang] },
        ],
        [{ text: BUTTONS.radios[lang] }, { text: BUTTONS.lang[lang] }],
      ],
      resize_keyboard: true,
    };
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

  async callTelegram(method, body) {
    const url = `${this.api}/${method}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async getLang(chatId) {
    try {
      return (await this.redis.get(`user:${chatId}:lang`)) || "ar";
    } catch (e) {
      return "ar";
    }
  }

  async setLang(chatId, lang) {
    try {
      await this.redis.set(`user:${chatId}:lang`, lang);
    } catch (e) {}
  }
}
