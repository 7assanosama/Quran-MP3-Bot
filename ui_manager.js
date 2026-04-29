import { STRINGS, BUTTONS } from "./strings.js";
import { CALLBACK_PREFIX, LIMITS } from "./constants.js";

/**
 * Manager for generating and displaying bot user interfaces
 */
export class UIManager {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Show reciters list with pagination
   */
  async showReciters(chatId, lang, messageId = null, intent = "listen", page = 0) {
    const reciters = await this.bot.quran.getReciters(lang);
    const pageSize = LIMITS.UI_PAGE_SIZE_RECITERS;
    const start = page * pageSize;
    const end = start + pageSize;
    const pagedReciters = reciters.slice(start, end);

    const icon = intent === "download" ? "📥" : "🎧";
    const keyboard = pagedReciters.map((r) => [
      { text: `${icon} ${r.name}`, callback_data: `${CALLBACK_PREFIX.RECITER}${intent}:${r.id}` },
    ]);

    // Pagination buttons
    const navButtons = [];
    if (page > 0) {
      navButtons.push({ 
        text: BUTTONS.prev_list[lang], 
        callback_data: `${CALLBACK_PREFIX.SHOW_RECITERS}${intent}:${page - 1}` 
      });
    }
    if (end < reciters.length) {
      navButtons.push({ 
        text: BUTTONS.next_list[lang], 
        callback_data: `${CALLBACK_PREFIX.SHOW_RECITERS}${intent}:${page + 1}` 
      });
    }
    if (navButtons.length > 0) keyboard.push(navButtons);

    const text = STRINGS[lang].choose_reciter;
    const extra = { reply_markup: { inline_keyboard: keyboard } };

    if (messageId) {
      return this.bot.telegram.editMessage(chatId, messageId, text, extra);
    }
    return this.bot.telegram.sendMessage(chatId, text, extra);
  }

  /**
   * Show available moshafs/collections for a reciter
   */
  async showMoshafs(chatId, lang, reciterId, messageId, intent = "listen") {
    const reciters = await this.bot.quran.getReciters(lang, reciterId);
    const reciter = reciters[0];

    if (!reciter) {
      return this.bot.telegram.sendMessage(chatId, `❌ Error: Reciter ID ${reciterId} not found.`);
    }

    // If only 1 moshaf, skip and show suwar directly
    if (reciter.moshaf && reciter.moshaf.length === 1) {
      return this.showSuwar(chatId, lang, reciterId, messageId, intent, 0, 0);
    }

    const icon = intent === "download" ? "📥" : "🎧";
    const keyboard = reciter.moshaf.map((m, index) => [
      {
        text: `${icon} ${m.name}`,
        callback_data: `${CALLBACK_PREFIX.MOSHAF}${intent}:${reciterId}:${index}`,
      },
    ]);

    // Back button
    keyboard.push([{ 
      text: BUTTONS.back[lang], 
      callback_data: `${CALLBACK_PREFIX.SHOW_RECITERS}${intent}` 
    }]);

    const text = `👤 <b>${reciter.name}</b>\n\n${STRINGS[lang].choose_moshaf}`;
    return this.bot.telegram.editMessage(chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  /**
   * Show surah list for a specific reciter and collection
   */
  async showSuwar(chatId, lang, reciterId, messageId, intent = "listen", page = 0, mIndex = -1) {
    const [suwar, reciters] = await Promise.all([
      this.bot.quran.getSuwar(lang),
      this.bot.quran.getReciters(lang, reciterId)
    ]);
    const reciter = reciters[0];

    if (!reciter || !reciter.moshaf) {
      return this.bot.telegram.sendMessage(chatId, "❌ Error: Reciter or collection not found.");
    }

    const icon = intent === "download" ? "📥" : "🎧";
    let availableSuwar = [];
    let currentMoshafName = "";
    const surahToMoshaf = new Map();

    if (mIndex === -1) {
      // Logic for multi-collection reciters where we merge surah availability
      reciter.moshaf.forEach((m, idx) => {
        m.surah_list.split(/[,\s]+/).forEach((sId) => {
          const id = sId.trim();
          if (id && !surahToMoshaf.has(id)) {
            surahToMoshaf.set(id, idx);
          }
        });
      });
      availableSuwar = suwar.filter((s) => surahToMoshaf.has(s.id.toString()));
    } else {
      // Specific moshaf selected
      const selectedMoshaf = reciter.moshaf[mIndex];
      if (!selectedMoshaf) return this.bot.telegram.sendMessage(chatId, "❌ Error: Collection not found.");
      
      currentMoshafName = selectedMoshaf.name;
      const surahIds = selectedMoshaf.surah_list.split(/[,\s]+/).map(id => id.trim());
      availableSuwar = suwar.filter((s) => surahIds.includes(s.id.toString()));
    }

    // Pagination
    const pageSize = LIMITS.UI_PAGE_SIZE_SUWAR;
    const start = page * pageSize;
    const end = start + pageSize;
    const pagedSuwar = availableSuwar.slice(start, end);

    // Build keyboard
    const keyboard = [];
    for (let i = 0; i < pagedSuwar.length; i += 3) {
      keyboard.push(
        pagedSuwar.slice(i, i + 3).map((s) => {
          const actualMIndex = mIndex === -1 ? surahToMoshaf.get(s.id.toString()) : mIndex;
          return {
            text: s.name,
            callback_data: `${CALLBACK_PREFIX.SURAH}${intent}:${reciterId}:${s.id}:${actualMIndex}`,
          };
        }),
      );
    }

    // Navigation buttons
    const navButtons = [];
    if (page > 0) {
      navButtons.push({ 
        text: BUTTONS.prev_list[lang], 
        callback_data: `${CALLBACK_PREFIX.MOSHAF_PAGE}${intent}:${reciterId}:${mIndex}:${page - 1}` 
      });
    }
    if (end < availableSuwar.length) {
      navButtons.push({ 
        text: BUTTONS.next_list[lang], 
        callback_data: `${CALLBACK_PREFIX.MOSHAF_PAGE}${intent}:${reciterId}:${mIndex}:${page + 1}` 
      });
    }
    if (navButtons.length > 0) keyboard.push(navButtons);

    // Back button logic
    const backCallback = mIndex === -1 
      ? `${CALLBACK_PREFIX.SHOW_RECITERS}${intent}` 
      : `${CALLBACK_PREFIX.RECITER}${intent}:${reciterId}`;
    keyboard.push([{ text: BUTTONS.back[lang], callback_data: backCallback }]);

    const title = currentMoshafName ? `${reciter.name}\n📖 ${currentMoshafName}` : reciter.name;
    const text = `${icon} <b>${title}</b>\n\n${STRINGS[lang].choose_surah}`;
    
    return this.bot.telegram.editMessage(chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  /**
   * Show surahs for reading (mushaf pages)
   */
  async showReadSuwar(chatId, lang, messageId = null, page = 0) {
    const suwar = await this.bot.quran.getSuwar(lang);
    const pageSize = LIMITS.UI_PAGE_SIZE_SUWAR;
    const start = page * pageSize;
    const end = start + pageSize;
    const pagedSuwar = suwar.slice(start, end);

    const keyboard = [];
    for (let i = 0; i < pagedSuwar.length; i += 3) {
      keyboard.push(
        pagedSuwar.slice(i, i + 3).map((s) => ({
          text: s.name,
          callback_data: `${CALLBACK_PREFIX.READ_SURAH}${s.id}`,
        })),
      );
    }

    // Pagination
    const navButtons = [];
    if (page > 0) {
      navButtons.push({ 
        text: BUTTONS.prev_list[lang], 
        callback_data: `${CALLBACK_PREFIX.SHOW_READ_SUWAR}${page - 1}` 
      });
    }
    if (end < suwar.length) {
      navButtons.push({ 
        text: BUTTONS.next_list[lang], 
        callback_data: `${CALLBACK_PREFIX.SHOW_READ_SUWAR}${page + 1}` 
      });
    }
    if (navButtons.length > 0) keyboard.push(navButtons);

    const text = STRINGS[lang].choose_surah;
    const extra = { reply_markup: { inline_keyboard: keyboard } };

    if (messageId) {
      return this.bot.telegram.editMessage(chatId, messageId, text, extra);
    }
    return this.bot.telegram.sendMessage(chatId, text, extra);
  }

  /**
   * Display a specific Quran page image
   */
  async showQuranPage(chatId, lang, pageNum, messageId = null) {
    pageNum = Math.max(1, Math.min(604, pageNum));

    const imageUrl = await this.bot.quran.getPage(pageNum);
    const keyboard = [[]];

    if (pageNum > 1) {
      keyboard[0].push({
        text: BUTTONS.prev_page[lang],
        callback_data: `${CALLBACK_PREFIX.PAGE}${pageNum - 1}`,
      });
    }
    if (pageNum < 604) {
      keyboard[0].push({
        text: BUTTONS.next_page[lang],
        callback_data: `${CALLBACK_PREFIX.PAGE}${pageNum + 1}`,
      });
    }

    keyboard.push([{ text: BUTTONS.goto_page[lang], callback_data: CALLBACK_PREFIX.GOTO_PAGE }]);

    const caption = `📖 <b>${STRINGS[lang].page} ${pageNum}</b>`;
    const extra = {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: "HTML",
    };

    if (messageId) {
      return this.bot.telegram.editMessageMedia(chatId, messageId, {
        type: "photo",
        media: imageUrl,
        caption: caption,
        parse_mode: "HTML",
      }, extra);
    }

    return this.bot.telegram.sendPhoto(chatId, imageUrl, caption, extra);
  }

  /**
   * Show radio stations list
   */
  async showRadios(chatId, lang, messageId = null, page = 0) {
    const radios = await this.bot.quran.getRadios(lang);
    const pageSize = LIMITS.UI_PAGE_SIZE_RECITERS;
    const start = page * pageSize;
    const end = start + pageSize;
    const pagedRadios = radios.slice(start, end);

    const keyboard = pagedRadios.map((r) => [{ text: r.name, url: r.url }]);

    const navButtons = [];
    if (page > 0) {
      navButtons.push({ 
        text: BUTTONS.prev_list[lang], 
        callback_data: `${CALLBACK_PREFIX.SHOW_RADIOS}${page - 1}` 
      });
    }
    if (end < radios.length) {
      navButtons.push({ 
        text: BUTTONS.next_list[lang], 
        callback_data: `${CALLBACK_PREFIX.SHOW_RADIOS}${page + 1}` 
      });
    }
    if (navButtons.length > 0) keyboard.push(navButtons);

    const text = STRINGS[lang].choose_radio;
    const extra = { reply_markup: { inline_keyboard: keyboard } };

    if (messageId) {
      return this.bot.telegram.editMessage(chatId, messageId, text, extra);
    }
    return this.bot.telegram.sendMessage(chatId, text, extra);
  }

  /**
   * Show daily hadith
   */
  async showTodayHadith(chatId, lang) {
    const hadiths = await this.bot.quran.getTodayHadith();
    if (!hadiths) return this.bot.telegram.sendMessage(chatId, "❌ Error loading hadith.");

    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const index = dayOfYear % hadiths.length;
    const hadith = hadiths[index].hadith;

    const text = `${STRINGS[lang].today_hadith_title}\n\n${hadith}`;
    return this.bot.telegram.sendMessage(chatId, text);
  }

  /**
   * Get the main menu keyboard
   */
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
