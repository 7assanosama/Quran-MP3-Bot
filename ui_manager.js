import { STRINGS, BUTTONS } from "./strings.js";

export class UIManager {
  constructor(bot) {
    this.bot = bot;
  }

  async showReciters(chatId, lang, messageId = null, intent = "listen", page = 0) {
    const reciters = await this.bot.quran.getReciters(lang);
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
      return this.bot.editMessage(chatId, messageId, text, extra);
    }
    return this.bot.sendMessage(chatId, text, extra);
  }

  async showSuwar(chatId, lang, reciterId, messageId, intent = "listen", page = 0) {
    const suwar = await this.bot.quran.getSuwar(lang);
    const reciters = await this.bot.quran.getReciters(lang, reciterId);
    const reciter = reciters[0];

    if (!reciter) {
      return this.bot.sendMessage(chatId, `❌ Error: Reciter ID ${reciterId} not found.`);
    }
    if (!reciter.moshaf) {
      return this.bot.sendMessage(chatId, `❌ Error: No moshaf data found for reciter ${reciter.name}.`);
    }

    const icon = intent === "download" ? "📥" : "🎧";

    // Build a map of surahId -> moshafIndex to handle reciters with multiple collections
    const surahToMoshaf = new Map();
    reciter.moshaf.forEach((m, mIndex) => {
      m.surah_list.split(/[,\s]+/).forEach((sId) => {
        const id = sId.trim();
        if (id && !surahToMoshaf.has(id)) {
          surahToMoshaf.set(id, mIndex);
        }
      });
    });

    const availableSuwar = suwar.filter((s) => surahToMoshaf.has(s.id.toString()));

    // Pagination for suwar
    const pageSize = 60; // 20 rows of 3
    const start = page * pageSize;
    const end = start + pageSize;
    const pagedSuwar = availableSuwar.slice(start, end);

    // Create a compact keyboard for suwar (3 per row)
    const keyboard = [];
    for (let i = 0; i < pagedSuwar.length; i += 3) {
      keyboard.push(
        pagedSuwar.slice(i, i + 3).map((s) => {
          const mIndex = surahToMoshaf.get(s.id.toString());
          return {
            text: s.name,
            callback_data: `surah:${intent}:${reciterId}:${s.id}:${mIndex}`,
          };
        }),
      );
    }

    // Pagination buttons
    const navButtons = [];
    if (page > 0) {
      navButtons.push({ text: BUTTONS.prev_list[lang], callback_data: `reciter:${intent}:${reciterId}:${page - 1}` });
    }
    if (end < availableSuwar.length) {
      navButtons.push({ text: BUTTONS.next_list[lang], callback_data: `reciter:${intent}:${reciterId}:${page + 1}` });
    }
    if (navButtons.length > 0) {
      keyboard.push(navButtons);
    }

    // Add Back button
    keyboard.push([
      { text: BUTTONS.back[lang], callback_data: `show_reciters:${intent}` },
    ]);

    const text = `${icon} <b>${reciter?.name}</b>\n\n${STRINGS[lang].choose_surah}`;
    return this.bot.editMessage(chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async showReadSuwar(chatId, lang, messageId = null, page = 0) {
    const suwar = await this.bot.quran.getSuwar(lang);
    const pageSize = 60;
    const start = page * pageSize;
    const end = start + pageSize;
    const pagedSuwar = suwar.slice(start, end);

    const keyboard = [];
    for (let i = 0; i < pagedSuwar.length; i += 3) {
      keyboard.push(
        pagedSuwar.slice(i, i + 3).map((s) => ({
          text: s.name,
          callback_data: `read_surah:${s.id}`,
        })),
      );
    }

    // Pagination buttons
    const navButtons = [];
    if (page > 0) {
      navButtons.push({ text: BUTTONS.prev_list[lang], callback_data: `show_read_suwar:${page - 1}` });
    }
    if (end < suwar.length) {
      navButtons.push({ text: BUTTONS.next_list[lang], callback_data: `show_read_suwar:${page + 1}` });
    }
    if (navButtons.length > 0) {
      keyboard.push(navButtons);
    }

    const text = STRINGS[lang].choose_surah;
    const extra = { reply_markup: { inline_keyboard: keyboard } };

    if (messageId) {
      return this.bot.editMessage(chatId, messageId, text, extra);
    }
    return this.bot.sendMessage(chatId, text, extra);
  }

  async showQuranPage(chatId, lang, pageNum, messageId = null) {
    if (pageNum < 1) pageNum = 1;
    if (pageNum > 604) pageNum = 604;

    const imageUrl = await this.bot.quran.getPage(pageNum);
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
      return this.bot.callTelegram("editMessageMedia", {
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

    return this.bot.callTelegram("sendPhoto", {
      chat_id: chatId,
      photo: imageUrl,
      caption: caption,
      ...extra,
    });
  }

  async showRadios(chatId, lang, messageId = null, page = 0) {
    const radios = await this.bot.quran.getRadios(lang);
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
      return this.bot.editMessage(chatId, messageId, STRINGS[lang].choose_radio, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    return this.bot.sendMessage(chatId, STRINGS[lang].choose_radio, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async showTodayHadith(chatId, lang) {
    const hadiths = await this.bot.quran.getTodayHadith();
    if (!hadiths || hadiths.length === 0) {
      return this.bot.sendMessage(chatId, "❌ Error loading hadith.");
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
    return this.bot.sendMessage(chatId, text);
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
}
