import { STRINGS, BUTTONS } from "./strings.js";

export class MediaManager {
  constructor(bot) {
    this.bot = bot;
  }

  async sendMedia(chatId, lang, reciterId, surahId, mIndex = 0, intent = "listen") {
    const reciters = await this.bot.quran.getReciters(lang, reciterId);
    const suwar = await this.bot.quran.getSuwar(lang);
    const reciter = reciters[0];
    const surah = suwar.find((s) => s.id == surahId);

    if (!reciter) {
      return this.bot.sendMessage(chatId, `❌ Error: Reciter ID ${reciterId} not found.`);
    }
    if (!suwar || suwar.length === 0) {
      return this.bot.sendMessage(chatId, `❌ Error: Could not load surah list.`);
    }
    if (!surah) {
      return this.bot.sendMessage(chatId, `❌ Error: Surah ID ${surahId} not found.`);
    }
    if (!reciter.moshaf || !reciter.moshaf[mIndex]) {
      return this.bot.sendMessage(chatId, `❌ Error: Collection index ${mIndex} not found for ${reciter.name}.`);
    }

    const server = reciter.moshaf[mIndex].server;
    const formattedSurah = surahId.toString().padStart(3, "0");
    const audioUrl = `${server}${formattedSurah}.mp3`;

    // Check file size proactively (Telegram limit is 20MB for URL-based files)
    let isLarge = false;
    try {
      const headResponse = await fetch(audioUrl, { method: "HEAD" });
      const size = parseInt(headResponse.headers.get("content-length") || "0");
      if (size > 20 * 1024 * 1024) isLarge = true;
    } catch (e) {
      console.error("Size check error:", e);
    }

    const text = STRINGS[lang].playing
      .replace("{name}", surah.name)
      .replace("{reciter}", reciter.name);

    const keyboard = [
      [{ text: BUTTONS.read_surah[lang], callback_data: `page:${surah.start_page}` }],
    ];

    if (isLarge) {
      const fallbackText = `⚠️ <b>${surah.name} - ${reciter.name}</b>\n\n${STRINGS[lang].file_too_large}\n\n🔗 <a href="${audioUrl}">${STRINGS[lang].direct_link}</a>`;
      return this.bot.sendMessage(chatId, fallbackText, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    const method = intent === "download" ? "sendDocument" : "sendAudio";
    const mediaParam = intent === "download" ? "document" : "audio";

    const params = {
      chat_id: chatId,
      [mediaParam]: audioUrl,
      caption: text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    };

    if (intent !== "download") {
      params.title = surah.name;
      params.performer = reciter.name;
    }

    try {
      return await this.bot.callTelegram(method, params);
    } catch (e) {
      // Final fallback if size check missed it or other URL issues
      const fallbackText = `⚠️ <b>${surah.name} - ${reciter.name}</b>\n\n${STRINGS[lang].file_too_large}\n\n🔗 <a href="${audioUrl}">${STRINGS[lang].direct_link}</a>`;
      return this.bot.sendMessage(chatId, fallbackText, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  }
}
