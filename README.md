# 📖 Quran-MP3-Bot

A professional, high-performance Telegram bot built on **Cloudflare Workers** that allows users to listen to, download, and read the Holy Quran. It supports multiple reciters, various Riwayat (collections), and provides additional features like daily Hadith and Islamic radio stations.

---

## 🚀 Features

-   **🎧 Listen & Download**: Access recitations from hundreds of famous reciters.
-   **📖 Read Quran**: View high-quality images of Mushaf pages with easy navigation.
-   **📜 Daily Hadith**: Get a fresh Hadith every day based on the current date.
-   **📻 Islamic Radios**: Stream various Islamic radio stations directly.
-   **🎙️ Multi-Riwayah Support**: Choose between different collections (Murattal, Mujawwad, etc.) for supported reciters.
-   **🌐 Bilingual**: Full support for both **Arabic** and **English** interfaces.
-   **⚡ High Performance**: Dual-layer caching (In-memory + Redis) for near-instant responses.
-   **📥 Large File Support**: Automatic fallback to direct links for files exceeding Telegram's 20MB limit.

---

## 🛠️ Tech Stack

-   **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) (Serverless)
-   **Database/Cache**: [Upstash Redis](https://upstash.com/)
-   **Language**: Modern JavaScript (ES6+)
-   **APIs**: 
    -   [Telegram Bot API](https://core.telegram.org/bots/api)
    -   [MP3Quran API v3](https://mp3quran.net/api/)

---

## 📁 Project Structure

The codebase follows a modular architecture for better maintainability:

-   `bot.js`: The main controller and orchestrator.
-   `ui_manager.js`: Handles all menu generation and UI logic.
-   `media_manager.js`: Manages audio and document delivery.
-   `quranApi.js`: Specialized data fetcher for the MP3Quran API.
-   `telegram_api.js`: Centralized communication layer with Telegram.
-   `constants.js`: Standardized magic strings and configuration.
-   `strings.js`: Multi-language localization strings.

---

## ⚙️ Configuration

To deploy the bot, you need the following environment variables in your `wrangler.toml` or Cloudflare dashboard:

| Variable | Description |
| :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot API token from [@BotFather](https://t.me/BotFather). |
| `UPSTASH_REDIS_REST_URL` | Your Upstash Redis REST URL. |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash Redis REST token. |

---

## 🚀 Deployment

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/Quran-MP3-Bot.git
    cd Quran-MP3-Bot
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure `wrangler.toml`**:
    Add your environment variables as secrets or in the config file.

4.  **Deploy**:
    ```bash
    npx wrangler deploy
    ```

5.  **Set Webhook**:
    Point your Telegram bot to your worker URL:
    `https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>`

---

## 🤝 Contribution

Contributions are welcome! If you'd like to improve the bot or fix a bug, please feel free to open a Pull Request.

## 📄 License

This project is licensed under the MIT License.

---

**Developed with ❤️ by [7assanosama]**
*(Assisted by Antigravity AI)*
