// /copy command handler

import type { CommandHandler, CommandContext } from './types';
import { createSuccessMessage, createErrorMessage, createInfoMessage } from './types';
import { extractFileId, formatFileSize, escapeHtml } from '../utils/helpers';

export const copyCommand: CommandHandler = {
  command: 'copy',
  description: 'Clone a file to your Google Drive folder',
  usage: '/copy [url or file_id]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, drive, storage, args, config } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing file ID',
          'I need a Google Drive file URL or ID to copy.\n\n' +
          'Usage: <code>/copy [url or file_id]</code>\n\n' +
          'Examples:\n' +
          '  <code>/copy https://drive.google.com/file/d/xxx/view</code>\n' +
          '  <code>/copy 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const fileId = extractFileId(args.trim());
    if (!fileId) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Invalid file ID',
          'I couldn\'t extract a valid file ID from what you gave me.\n\n' +
          'Make sure you\'re using a valid Google Drive URL or file ID.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // Check rate limit for copies (stricter)
    if (userId) {
      const rateLimit = await storage.checkRateLimit(userId, 5, 60000);
      if (!rateLimit.allowed) {
        await telegram.sendMessage({
          chat_id: chatId,
          text: createErrorMessage(
            'Rate limited',
            `You can only make 5 copy requests per minute.\n` +
            `Please wait ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`
          ),
          reply_to_message_id: message.message_id,
        });
        return;
      }
    }

    // Send processing message
    await telegram.sendTyping(chatId);

    const processingMsg = await telegram.sendMessage({
      chat_id: chatId,
      text: createInfoMessage('Working on it', `Cloning file <code>${fileId}</code>...\n\nThis should only take a moment.`),
      reply_to_message_id: message.message_id,
    });

    try {
      const result = await drive.copyFile(fileId, config.folderId);

      if (result.error) {
        // Edit processing message with error
        const msgData = processingMsg as { message_id: number };
        await telegram.editMessage({
          chat_id: chatId,
          message_id: msgData.message_id,
          text: createErrorMessage(
            'Clone failed',
            `Error: ${escapeHtml(result.error.message)}\n\n` +
            'This usually happens when:\n' +
            '- The file doesn\'t exist or was deleted\n' +
            '- You don\'t have permission to access it\n' +
            '- The file is in someone\'s trash\n' +
            '- A resource key is required for shared files'
          ),
        });
        return;
      }

      if (!result.name) {
        const msgData = processingMsg as { message_id: number };
        await telegram.editMessage({
          chat_id: chatId,
          message_id: msgData.message_id,
          text: createErrorMessage('Clone failed', 'Something unexpected happened. The file might not have been copied correctly.'),
        });
        return;
      }

      // Update stats
      if (userId) {
        await storage.incrementDailyCopy(userId);
        await storage.incrementStat('totalCopies');
      }

      // Build index link
      const encodedName = encodeURIComponent(result.name);
      const indexLink = `${config.indexUrl}/0:/${encodedName}`;
      const driveLink = `https://drive.google.com/open?id=${result.id}`;

      const successText = createSuccessMessage(
        'Done! File cloned successfully.',
        `<b>File Name:</b>\n${escapeHtml(result.name)}\n\n` +
        `<b>Size:</b> ${formatFileSize(result.size)}\n` +
        `<b>Type:</b> ${result.mimeType}\n\n` +
        `The file is now in your destination folder.`
      );

      const keyboard = {
        inline_keyboard: [
          [
            { text: 'Open in Drive', url: driveLink },
            { text: 'Index Link', url: indexLink },
          ],
          [{ text: 'Copy another file', callback_data: 'prompt:copy' }],
        ],
      };

      const msgData = processingMsg as { message_id: number };
      await telegram.editMessage({
        chat_id: chatId,
        message_id: msgData.message_id,
        text: successText,
        reply_markup: keyboard,
      });

    } catch {
      const msgData = processingMsg as { message_id: number };
      await telegram.editMessage({
        chat_id: chatId,
        message_id: msgData.message_id,
        text: createErrorMessage(
          'Clone failed',
          'Something went wrong on my end. Please try again in a moment.'
        ),
      });
    }
  },
};
