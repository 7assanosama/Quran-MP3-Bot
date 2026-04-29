/**
 * Centralized constants for Quran-MP3-Bot
 */

export const CALLBACK_PREFIX = {
  RECITER: "reciter:",
  MOSHAF: "moshaf:",
  MOSHAF_PAGE: "moshaf_page:",
  SURAH: "surah:",
  READ_SURAH: "read_surah:",
  SHOW_RECITERS: "show_reciters:",
  SHOW_READ_SUWAR: "show_read_suwar:",
  SHOW_RADIOS: "show_radios:",
  PAGE: "page:",
  LANG: "lang:",
  DL_FILE: "dl_file:",
  GOTO_PAGE: "goto_page",
  MAIN_MENU: "main_menu",
};

export const STATE = {
  WAITING_PAGE: "waiting_page",
};

export const CACHE = {
  LANG: (chatId) => `lang:${chatId}`,
  STATE: (chatId) => `state:${chatId}`,
  RECITER_FULL: (lang) => `cache:reciters:${lang}`,
  SUWAR: (lang) => `cache:suwar:${lang}`,
  RADIOS: (lang) => `cache:radios:${lang}`,
  HADITH: "cache:today_hadith",
  TTL: 3600 * 24, // 24 hours
};

export const LIMITS = {
  TELEGRAM_URL_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  UI_PAGE_SIZE_RECITERS: 50,
  UI_PAGE_SIZE_SUWAR: 60,
  FETCH_TIMEOUT: 7000, // 7 seconds
};
