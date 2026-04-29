import { CACHE, LIMITS } from "./constants.js";

const memoryCache = new Map();

/**
 * Manager for Quran API data fetching and caching
 */
export class QuranAPI {
  /**
   * @param {import("@upstash/redis").Redis} redis
   */
  constructor(redis) {
    this.baseUrl = "https://mp3quran.net/api/v3";
    this.redis = redis;
  }

  /**
   * Universal fetch with timeout protection
   */
  async fetchWithTimeout(url, options = {}, timeout = LIMITS.FETCH_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  /**
   * Get Quran page image URL
   * @param {number|string} pageNumber 
   */
  async getPage(pageNumber) {
    const formattedPage = pageNumber.toString().padStart(3, "0");
    return `https://www.mp3quran.net/api/quran_pages_arabic/1080/${formattedPage}.png`;
  }

  /**
   * Get reciters list with caching and filtering
   * @param {string} lang 
   * @param {string|number} reciterId 
   */
  async getReciters(lang = "ar", reciterId = null) {
    const memKey = `reciters:${lang}`;
    let reciters = memoryCache.get(memKey);

    if (!reciters) {
      const cacheKey = CACHE.RECITER_FULL(lang);
      reciters = await this.redis.get(cacheKey);
      if (reciters) {
        memoryCache.set(memKey, reciters);
      }
    }

    if (!reciters) {
      try {
        const response = await this.fetchWithTimeout(`${this.baseUrl}/reciters?language=${lang}`);
        const data = await response.json();
        if (data && data.reciters) {
          // Slim down reciters to save memory
          reciters = data.reciters.map(r => ({
            id: r.id,
            name: r.name,
            moshaf: r.moshaf.map(m => ({
              id: m.id,
              name: m.name,
              server: m.server,
              surah_list: m.surah_list
            }))
          }));
          reciters.sort((a, b) => a.name.localeCompare(b.name, lang));
          await this.redis.set(CACHE.RECITER_FULL(lang), reciters, { ex: CACHE.TTL });
          memoryCache.set(memKey, reciters);
        }
      } catch (e) {
        console.error("API Error (getReciters):", e);
      }
    }

    if (reciters) {
      if (reciterId) {
        return reciters.filter((r) => r.id == reciterId);
      }
      return reciters;
    }
    return [];
  }

  /**
   * Get surah names and metadata
   * @param {string} lang 
   */
  async getSuwar(lang = "ar") {
    const memKey = `suwar:${lang}`;
    if (memoryCache.has(memKey)) return memoryCache.get(memKey);

    const cacheKey = CACHE.SUWAR(lang);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      memoryCache.set(memKey, cached);
      return cached;
    }

    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/suwar?language=${lang}`);
      const data = await response.json();

      if (data && data.suwar) {
        await this.redis.set(cacheKey, data.suwar, { ex: CACHE.TTL });
        memoryCache.set(memKey, data.suwar);
        return data.suwar;
      }
    } catch (e) {
      console.error("API Error (getSuwar):", e);
    }
    return [];
  }

  /**
   * Get radio stations list
   * @param {string} lang 
   */
  async getRadios(lang = "ar") {
    const memKey = `radios:${lang}`;
    if (memoryCache.has(memKey)) return memoryCache.get(memKey);

    const cacheKey = CACHE.RADIOS(lang);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      memoryCache.set(memKey, cached);
      return cached;
    }

    try {
      const response = await this.fetchWithTimeout(
        `https://mp3quran.net/api/radio-v2/radio_${lang}.json`
      );
      const data = await response.json();

      if (data && data.radios) {
        await this.redis.set(cacheKey, data.radios, { ex: CACHE.TTL });
        memoryCache.set(memKey, data.radios);
        return data.radios;
      }
    } catch (e) {
      console.error("API Error (getRadios):", e);
    }
    return [];
  }

  /**
   * Get today's hadith
   */
  async getTodayHadith() {
    const memKey = "today_hadith";
    if (memoryCache.has(memKey)) return memoryCache.get(memKey);

    const cacheKey = CACHE.HADITH;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      memoryCache.set(memKey, cached);
      return cached;
    }

    try {
      const response = await this.fetchWithTimeout(
        "https://www.mp3quran.net/api/today-hadith.php"
      );
      const data = await response.json();

      if (data && data.language) {
        await this.redis.set(cacheKey, data.language, { ex: CACHE.TTL });
        memoryCache.set(memKey, data.language);
        return data.language;
      }
    } catch (e) {
      console.error("API Error (getTodayHadith):", e);
    }
    return [];
  }
}
