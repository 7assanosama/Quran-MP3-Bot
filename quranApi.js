export class QuranAPI {
  constructor(redis) {
    this.baseUrl = "https://mp3quran.net/api/v3";
    this.redis = redis;
    this.cacheTTL = 3600 * 24; // 24 hours
  }

  async getReciters(lang = "ar") {
    const cacheKey = `cache:reciters:${lang}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/reciters?language=${lang}`);
      const data = await response.json();

      if (data && data.reciters) {
        await this.redis.set(cacheKey, data.reciters, { ex: this.cacheTTL });
        return data.reciters;
      }
    } catch (e) {
      console.error("API Error (getReciters):", e);
    }
    return [];
  }

  async getSuwar(lang = "ar") {
    const cacheKey = `cache:suwar:${lang}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/suwar?language=${lang}`);
      const data = await response.json();

      if (data && data.suwar) {
        await this.redis.set(cacheKey, data.suwar, { ex: this.cacheTTL });
        return data.suwar;
      }
    } catch (e) {
      console.error("API Error (getSuwar):", e);
    }
    return [];
  }

  async getRadios(lang = "ar") {
    const cacheKey = `cache:radios:${lang}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    try {
      // Radios V2 is still widely used and works with V3
      const response = await fetch(`https://mp3quran.net/api/radio-v2/radio_${lang}.json`);
      const data = await response.json();

      if (data && data.radios) {
        await this.redis.set(cacheKey, data.radios, { ex: this.cacheTTL });
        return data.radios;
      }
    } catch (e) {
      console.error("API Error (getRadios):", e);
    }
    return [];
  }
}

