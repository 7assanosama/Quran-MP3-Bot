import { QuranBot } from "./bot.js";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Bot is running 🚀");
    }

    try {
      const update = await request.json();
      if (!update.message) return new Response("ok");

      const bot = new QuranBot(env);
      await bot.handleUpdate(update.message);

      return new Response("ok");
    } catch (error) {
      console.error("Error handling update:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
