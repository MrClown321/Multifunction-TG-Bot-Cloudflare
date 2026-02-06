// /start command handler

import type { CommandHandler, CommandContext } from './types';

export const startCommand: CommandHandler = {
  command: 'start',
  description: 'Start the bot and see welcome message',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, config } = ctx;
    const chatId = message.chat.id;
    const firstName = message.from?.first_name || 'there';

    const welcomeText = `
Hey ${firstName}, good to see you.

I'm here to help you manage your Google Drive files. Think of me as your personal file assistant - I can search through your drives, clone files, generate QR codes, and handle a bunch of other useful stuff.

<b>Here's what I can do:</b>

<b>File Operations</b>
  /search [query] - Find files across your drives
  /copy [url or id] - Clone a file to your folder
  /info [url or id] - Get details about a file
  /list - See what's in your destination folder
  /mkdir [name] - Create a new folder
  /rename [id] [name] - Rename a file
  /delete [id] - Remove a file (admin only)

<b>Utilities</b>
  /qr [text] - Generate a QR code
  /shorturl [url] - Shorten a long URL
  /hash [text] - Generate MD5/SHA hashes
  /ping - Check if I'm alive

<b>Your Account</b>
  /me - Your stats and preferences
  /settings - Adjust your preferences
  /help - Detailed command help

If you need help with anything specific, just type /help followed by the command name.
`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: 'GitHub', url: config.ownerGithub },
          { text: 'Contact Owner', url: `https://t.me/${config.ownerTelegram}` },
        ],
        [{ text: 'Show Help', callback_data: 'help:main' }],
      ],
    };

    await telegram.sendWithKeyboard(chatId, welcomeText, keyboard, message.message_id);
  },
};
