// Utility commands: /qr, /shorturl, /ping, /me, /hash, /settings

import type { CommandHandler, CommandContext } from './types';
import { createSuccessMessage, createErrorMessage, createInfoMessage } from './types';
import { isValidUrl, escapeHtml, formatDate } from '../utils/helpers';

// /ping command
export const pingCommand: CommandHandler = {
  command: 'ping',
  description: 'Check if bot is alive',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram } = ctx;
    const startTime = Date.now();

    await telegram.sendMessage({
      chat_id: message.chat.id,
      text: `I'm here. Response time: ${Date.now() - startTime}ms\n\nServer time: ${new Date().toISOString()}`,
      reply_to_message_id: message.message_id,
    });
  },
};

// /qr command - Generate QR code
export const qrCommand: CommandHandler = {
  command: 'qr',
  description: 'Generate a QR code for text or URL',
  usage: '/qr [text or url]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, args } = ctx;
    const chatId = message.chat.id;

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing text',
          'Tell me what to encode in the QR code.\n\n' +
          'Usage: <code>/qr [text or url]</code>\n' +
          'Example: <code>/qr https://google.com</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const text = args.trim();
    const encodedText = encodeURIComponent(text);
    
    // Using QR Server API (free, no auth required)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedText}`;

    const responseText = createSuccessMessage(
      'QR Code generated',
      `<b>Content:</b> ${escapeHtml(text.substring(0, 100))}${text.length > 100 ? '...' : ''}\n\n` +
      `Click the button below to view or download your QR code.`
    );

    const keyboard = {
      inline_keyboard: [
        [
          { text: 'View QR Code', url: qrUrl },
          { text: 'Download PNG', url: `${qrUrl}&format=png` },
        ],
      ],
    };

    await telegram.sendWithKeyboard(chatId, responseText, keyboard, message.message_id);
  },
};

// /shorturl command - Create short URL
export const shortUrlCommand: CommandHandler = {
  command: 'shorturl',
  description: 'Create a shortened URL',
  usage: '/shorturl [url]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, args } = ctx;
    const chatId = message.chat.id;

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing URL',
          'I need a URL to shorten.\n\n' +
          'Usage: <code>/shorturl [url]</code>\n' +
          'Example: <code>/shorturl https://example.com/very/long/path</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const url = args.trim();
    if (!isValidUrl(url)) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid URL', 'That doesn\'t look like a valid URL. Make sure it starts with http:// or https://'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    await telegram.sendTyping(chatId);

    try {
      // Using TinyURL (free, no auth required)
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
      
      if (!response.ok) {
        throw new Error('Failed to create short URL');
      }

      const shortUrl = await response.text();

      const responseText = createSuccessMessage(
        'URL shortened',
        `<b>Original:</b>\n${escapeHtml(url.substring(0, 100))}${url.length > 100 ? '...' : ''}\n\n` +
        `<b>Short URL:</b>\n<code>${shortUrl}</code>\n\n` +
        `Click the button or copy the link above.`
      );

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Open Short URL', url: shortUrl }],
        ],
      };

      await telegram.sendWithKeyboard(chatId, responseText, keyboard, message.message_id);
    } catch {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Failed', 'Couldn\'t create a short URL right now. Try again in a moment.'),
        reply_to_message_id: message.message_id,
      });
    }
  },
};

// /hash command - Generate hashes
export const hashCommand: CommandHandler = {
  command: 'hash',
  description: 'Generate MD5 and SHA-256 hashes',
  usage: '/hash [text]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, args } = ctx;
    const chatId = message.chat.id;

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing text',
          'I need some text to hash.\n\n' +
          'Usage: <code>/hash [text]</code>\n' +
          'Example: <code>/hash mypassword123</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const text = args.trim();
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Generate SHA-256
    const sha256Buffer = await crypto.subtle.digest('SHA-256', data);
    const sha256Hash = Array.from(new Uint8Array(sha256Buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Generate SHA-1 (often used as a substitute display for MD5 concept)
    const sha1Buffer = await crypto.subtle.digest('SHA-1', data);
    const sha1Hash = Array.from(new Uint8Array(sha1Buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const responseText = createSuccessMessage(
      'Hash results',
      `<b>Input:</b> ${escapeHtml(text.substring(0, 50))}${text.length > 50 ? '...' : ''}\n\n` +
      `<b>SHA-256:</b>\n<code>${sha256Hash}</code>\n\n` +
      `<b>SHA-1:</b>\n<code>${sha1Hash}</code>`
    );

    await telegram.sendMessage({
      chat_id: chatId,
      text: responseText,
      reply_to_message_id: message.message_id,
    });
  },
};

// /me command - User profile and stats
export const meCommand: CommandHandler = {
  command: 'me',
  description: 'View your profile and usage statistics',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, storage, isAdmin } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username;
    const firstName = message.from?.first_name || 'User';

    if (!userId) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Error', 'Couldn\'t retrieve your user information.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const session = await storage.getOrCreateUser(userId, username);

    const profileText = `
<b>Your Profile</b>

<b>Name:</b> ${firstName}
<b>User ID:</b> <code>${userId}</code>
${username ? `<b>Username:</b> @${username}` : ''}
${isAdmin ? '<b>Role:</b> Administrator' : ''}

<b>Usage Statistics</b>

<b>Searches today:</b> ${session.dailySearches}
<b>Copies today:</b> ${session.dailyCopies}
<b>Total commands:</b> ${session.commandCount}
<b>Last active:</b> ${formatDate(session.lastActivity)}

<b>Your Preferences</b>
Notifications: ${session.preferences.notifications ? 'On' : 'Off'}
Search results per page: ${session.preferences.searchLimit}
`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Toggle notifications', callback_data: 'settings:notifications' },
        ],
        [{ text: 'Close', callback_data: 'close' }],
      ],
    };

    await telegram.sendWithKeyboard(chatId, profileText, keyboard, message.message_id);
  },
};

// /settings command - User preferences
export const settingsCommand: CommandHandler = {
  command: 'settings',
  description: 'Adjust your preferences',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, storage } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Error', 'Couldn\'t retrieve your user information.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const session = await storage.getOrCreateUser(userId, message.from?.username);

    const settingsText = `
<b>Your Settings</b>

Here you can adjust how the bot works for you.

<b>Notifications:</b> ${session.preferences.notifications ? 'Enabled' : 'Disabled'}
When enabled, you'll receive updates about your copy operations.

<b>Search limit:</b> ${session.preferences.searchLimit} results per page
How many search results to show at once.

<b>Auto preview:</b> ${session.preferences.autoPreview ? 'Enabled' : 'Disabled'}
Automatically show file previews when available.

Use the buttons below to change your settings.
`;

    const keyboard = {
      inline_keyboard: [
        [
          { 
            text: session.preferences.notifications ? 'Disable notifications' : 'Enable notifications', 
            callback_data: 'settings:notifications' 
          },
        ],
        [
          { text: '5 results', callback_data: 'settings:limit:5' },
          { text: '10 results', callback_data: 'settings:limit:10' },
          { text: '20 results', callback_data: 'settings:limit:20' },
        ],
        [
          { 
            text: session.preferences.autoPreview ? 'Disable auto preview' : 'Enable auto preview', 
            callback_data: 'settings:autopreview' 
          },
        ],
        [{ text: 'Close', callback_data: 'close' }],
      ],
    };

    await telegram.sendWithKeyboard(chatId, settingsText, keyboard, message.message_id);
  },
};
