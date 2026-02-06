// Telegram Bot API Client

import type {
  SendMessageOptions,
  EditMessageOptions,
  AnswerCallbackQueryOptions,
  InlineKeyboardMarkup,
} from '../types/telegram';
import { logger } from '../utils/logger';

export class TelegramClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(botToken: string) {
    this.token = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  private async request<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await response.json() as { ok: boolean; result: T; description?: string };

    if (!result.ok) {
      logger.error(`Telegram API error: ${method}`, new Error(result.description || 'Unknown error'));
      throw new Error(result.description || 'Telegram API error');
    }

    return result.result;
  }

  async sendMessage(options: SendMessageOptions): Promise<unknown> {
    const body: Record<string, unknown> = {
      chat_id: options.chat_id,
      text: options.text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview ?? true,
    };

    if (options.reply_to_message_id) {
      body.reply_to_message_id = options.reply_to_message_id;
    }

    if (options.reply_markup) {
      body.reply_markup =
        typeof options.reply_markup === 'string'
          ? options.reply_markup
          : JSON.stringify(options.reply_markup);
    }

    return this.request('sendMessage', body);
  }

  async editMessage(options: EditMessageOptions): Promise<unknown> {
    const body: Record<string, unknown> = {
      chat_id: options.chat_id,
      message_id: options.message_id,
      text: options.text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview ?? true,
    };

    if (options.reply_markup) {
      body.reply_markup =
        typeof options.reply_markup === 'string'
          ? options.reply_markup
          : JSON.stringify(options.reply_markup);
    }

    return this.request('editMessageText', body);
  }

  async answerCallbackQuery(options: AnswerCallbackQueryOptions): Promise<boolean> {
    return this.request<boolean>('answerCallbackQuery', {
      callback_query_id: options.callback_query_id,
      text: options.text,
      show_alert: options.show_alert,
      cache_time: options.cache_time,
    });
  }

  async sendChatAction(chatId: number | string, action: string): Promise<boolean> {
    return this.request<boolean>('sendChatAction', {
      chat_id: chatId,
      action,
    });
  }

  async deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
    return this.request<boolean>('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  async getMe(): Promise<unknown> {
    return this.request('getMe');
  }

  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    const body: Record<string, unknown> = { url };
    if (secretToken) {
      body.secret_token = secretToken;
    }
    return this.request<boolean>('setWebhook', body);
  }

  async deleteWebhook(): Promise<boolean> {
    return this.request<boolean>('deleteWebhook');
  }

  // Helper to send a message with inline keyboard
  async sendWithKeyboard(
    chatId: number | string,
    text: string,
    keyboard: InlineKeyboardMarkup,
    replyToMessageId?: number
  ): Promise<unknown> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      reply_markup: keyboard,
      reply_to_message_id: replyToMessageId,
    });
  }

  // Helper to send typing indicator
  async sendTyping(chatId: number | string): Promise<boolean> {
    return this.sendChatAction(chatId, 'typing');
  }

  // Send a photo from a URL
  async sendPhoto(options: {
    chat_id: number | string;
    photo: string;
    caption?: string;
    parse_mode?: string;
    reply_to_message_id?: number;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      chat_id: options.chat_id,
      photo: options.photo,
    };

    if (options.caption) {
      body.caption = options.caption;
      body.parse_mode = options.parse_mode || 'HTML';
    }

    if (options.reply_to_message_id) {
      body.reply_to_message_id = options.reply_to_message_id;
    }

    return this.request('sendPhoto', body);
  }

  // Send upload photo action
  async sendUploadPhotoAction(chatId: number | string): Promise<boolean> {
    return this.sendChatAction(chatId, 'upload_photo');
  }

  // Send a document from a URL
  async sendDocument(options: {
    chat_id: number | string;
    document: string;
    caption?: string;
    parse_mode?: string;
    reply_to_message_id?: number;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      chat_id: options.chat_id,
      document: options.document,
    };

    if (options.caption) {
      body.caption = options.caption;
      body.parse_mode = options.parse_mode || 'HTML';
    }

    if (options.reply_to_message_id) {
      body.reply_to_message_id = options.reply_to_message_id;
    }

    return this.request('sendDocument', body);
  }

  // Send upload document action
  async sendUploadDocumentAction(chatId: number | string): Promise<boolean> {
    return this.sendChatAction(chatId, 'upload_document');
  }
}
