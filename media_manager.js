import { STRINGS, BUTTONS } from "./strings.js";
import { CALLBACK_PREFIX, LIMITS } from "./constants.js";

/**
 * Manager for handling audio and document delivery
 */
export class MediaManager {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Send audio or document for a specific surah and reciter
   */
  async sendMedia(chatId, lang, reciterId, surahId, mIndex = 0, intent = "listen") {
    const [suwar, reciters] = await Promise.all([
      this.bot.quran.getSuwar(lang),
      this.bot.quran.getReciters(lang, reciterId)
    ]);
    
    const reciter = reciters[0];
    const surah = suwar.find((s) => s.id == surahId);

    if (!reciter || !surah || !reciter.moshaf?.[mIndex]) {
      return this.bot.telegram.sendMessage(chatId, `❌ Error: Data not found for the requested surah.`);
    }

    const server = reciter.moshaf[mIndex].server;
    const formattedSurah = surahId.toString().padStart(3, "0");
    const audioUrl = `${server}${formattedSurah}.mp3`;

    // Check file size proactively
    let isLarge = false;
    try {
      const headResponse = await fetch(audioUrl, { method: "HEAD" });
      const size = parseInt(headResponse.headers.get("content-length") || "0");
      if (size > LIMITS.TELEGRAM_URL_FILE_SIZE) isLarge = true;
    } catch (e) {
      console.error("Size check error:", e);
    }

    const text = STRINGS[lang].playing
      .replace("{name}", surah.name)
      .replace("{reciter}", reciter.name);

    const keyboard = [
      [{ text: BUTTONS.read_surah[lang], callback_data: `${CALLBACK_PREFIX.PAGE}${surah.start_page}` }],
    ];

    if (isLarge) {
      const fallbackText = `⚠️ <b>${surah.name} - ${reciter.name}</b>\n\n${STRINGS[lang].file_too_large}\n\n🔗 <a href="${audioUrl}">${STRINGS[lang].direct_link}</a>`;
      return this.bot.telegram.sendMessage(chatId, fallbackText, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    const method = intent === "download" ? "sendDocument" : "sendAudio";
    const extra = {
      reply_markup: { inline_keyboard: keyboard }
    };

    if (intent !== "download") {
      extra.title = surah.name;
      extra.performer = reciter.name;
    }

    try {
      if (intent === "download") {
        return await this.bot.telegram.sendDocument(chatId, audioUrl, text, extra);
      } else {
        return await this.bot.telegram.sendAudio(chatId, audioUrl, text, extra);
      }
    } catch (e) {
      // Final fallback for URL issues
      const fallbackText = `⚠️ <b>${surah.name} - ${reciter.name}</b>\n\n${STRINGS[lang].file_too_large}\n\n🔗 <a href="${audioUrl}">${STRINGS[lang].direct_link}</a>`;
      return this.bot.telegram.sendMessage(chatId, fallbackText, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  }
}
