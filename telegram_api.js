/**
 * Centralized Telegram API communication class
 */
export class TelegramAPI {
  constructor(token) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  /**
   * Universal call to Telegram API
   */
  async call(method, params = {}) {
    const url = `${this.baseUrl}/${method}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const result = await response.json();
      if (!result.ok) {
        console.error(`Telegram API Error (${method}):`, result);
        throw new Error(result.description || "Unknown Telegram API Error");
      }
      return result.result;
    } catch (error) {
      console.error(`Network/API Error (${method}):`, error);
      throw error;
    }
  }

  async sendMessage(chatId, text, extra = {}) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...extra,
    });
  }

  async editMessage(chatId, messageId, text, extra = {}) {
    return this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      ...extra,
    });
  }

  async editMessageMedia(chatId, messageId, media, extra = {}) {
    return this.call("editMessageMedia", {
      chat_id: chatId,
      message_id: messageId,
      media,
      ...extra,
    });
  }

  async sendAudio(chatId, audioUrl, caption, extra = {}) {
    return this.call("sendAudio", {
      chat_id: chatId,
      audio: audioUrl,
      caption,
      parse_mode: "HTML",
      ...extra,
    });
  }

  async sendDocument(chatId, docUrl, caption, extra = {}) {
    return this.call("sendDocument", {
      chat_id: chatId,
      document: docUrl,
      caption,
      parse_mode: "HTML",
      ...extra,
    });
  }

  async sendPhoto(chatId, photoUrl, caption, extra = {}) {
    return this.call("sendPhoto", {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
      ...extra,
    });
  }

  async answerCallback(callbackQueryId, text = null, showAlert = false) {
    return this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }
}
