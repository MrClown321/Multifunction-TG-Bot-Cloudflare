// Advanced features - batch operations, favorites, recent activity, share links, quota

import type { CommandHandler, CommandContext } from './types';
import { createErrorMessage, createSuccessMessage, createInfoMessage, createLoadingMessage } from './types';
import { extractFileId, formatFileSize, truncate, escapeHtml, formatDate } from '../utils/helpers';

// Type for Telegram API response
interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number };
  };
}

// Batch copy command - copy multiple files at once
export const batchCommand: CommandHandler = {
  command: 'batch',
  description: 'Copy multiple files at once (space-separated IDs or links)',
  usage: '/batch <file1> <file2> <file3>...',
  async handle(ctx: CommandContext) {
    const { message, argList, telegram, drive, storage, config } = ctx;
    const chatId = message.chat.id;

    if (argList.length === 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'Batch Copy',
          'This command lets you clone multiple files at once.\n\n' +
          '<b>Usage:</b>\n' +
          '/batch [id1] [id2] [id3]\n\n' +
          'You can use file IDs or Google Drive links, separated by spaces. ' +
          'I\'ll process them one by one and give you a summary when done.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // Check daily limit
    const userId = message.from?.id;
    if (userId) {
      const canCopy = await storage.checkDailyLimit(userId, config.dailyLimit);
      if (!canCopy) {
        await telegram.sendMessage({
          chat_id: chatId,
          text: createErrorMessage(
            'Daily limit reached',
            `You've hit your daily copy limit of ${config.dailyLimit} files. ` +
            'This resets at midnight UTC. Try again tomorrow.'
          ),
          reply_to_message_id: message.message_id,
        });
        return;
      }
    }

    // Extract file IDs
    const fileIds: string[] = [];
    const invalid: string[] = [];

    for (const arg of argList) {
      const id = extractFileId(arg);
      if (id) {
        fileIds.push(id);
      } else {
        invalid.push(arg);
      }
    }

    if (fileIds.length === 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'No valid files',
          'I couldn\'t extract any valid file IDs from what you provided. ' +
          'Make sure you\'re using valid Google Drive file IDs or share links.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // Send initial status
    const statusMsgResponse = await telegram.sendMessage({
      chat_id: chatId,
      text: createLoadingMessage(`Processing batch of ${fileIds.length} files...`),
      reply_to_message_id: message.message_id,
    }) as TelegramResponse;

    const statusMsgId = statusMsgResponse?.result?.message_id;

    const results: { id: string; success: boolean; name?: string; error?: string }[] = [];

    // Process each file
    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i];
      
      // Update progress every few files
      if (i > 0 && i % 3 === 0 && statusMsgId) {
        await telegram.editMessage({
          chat_id: chatId,
          message_id: statusMsgId,
          text: createLoadingMessage(`Processing file ${i + 1} of ${fileIds.length}...`),
        });
      }

      try {
        const result = await drive.copyFile(fileId, config.folderId);
        
        if (result.error) {
          results.push({ id: fileId, success: false, error: result.error.message });
        } else {
          results.push({ id: fileId, success: true, name: result.name });
          if (userId) {
            await storage.incrementDailyCopy(userId);
          }
        }
      } catch (error) {
        results.push({ id: fileId, success: false, error: 'Unknown error occurred' });
      }
    }

    // Build summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    let summary = `<b>Batch Copy Complete</b>\n\n`;
    summary += `Processed ${fileIds.length} files\n`;
    summary += `Successful: ${successful.length}\n`;
    summary += `Failed: ${failed.length}\n\n`;

    if (successful.length > 0) {
      summary += '<b>Copied files:</b>\n';
      successful.forEach((r, i) => {
        summary += `${i + 1}. ${escapeHtml(r.name || r.id)}\n`;
      });
      summary += '\n';
    }

    if (failed.length > 0) {
      summary += '<b>Failed:</b>\n';
      failed.forEach((r, i) => {
        summary += `${i + 1}. ${r.id}: ${r.error}\n`;
      });
    }

    if (invalid.length > 0) {
      summary += `\n<b>Skipped (invalid IDs):</b> ${invalid.length}`;
    }

    // Update stats
    for (let i = 0; i < successful.length; i++) {
      await storage.incrementStat('totalCopies');
    }

    if (statusMsgId) {
      await telegram.editMessage({
        chat_id: chatId,
        message_id: statusMsgId,
        text: summary,
      });
    }
  },
};

// Favorites command - save and list favorite files
export const favoritesCommand: CommandHandler = {
  command: 'favorites',
  description: 'View your saved favorite files',
  usage: '/favorites',
  async handle(ctx: CommandContext) {
    const { message, telegram, storage } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) return;

    const session = await storage.getOrCreateUser(userId, message.from?.username);
    const favorites = session.favorites || [];

    if (favorites.length === 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'Favorites',
          'You don\'t have any favorites saved yet.\n\n' +
          'Use /addfav [file-id] to save a file to your favorites list.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    let text = '<b>Your Favorites</b>\n\n';
    favorites.forEach((fav, i) => {
      text += `${i + 1}. ${escapeHtml(fav.name)}\n`;
      text += `   ID: <code>${fav.id}</code>\n`;
      text += `   Added: ${formatDate(fav.addedAt)}\n\n`;
    });

    text += 'Use /removefav [number] to remove an item.';

    const keyboard = {
      inline_keyboard: favorites.slice(0, 5).map((fav) => [
        { text: `Clone: ${truncate(fav.name, 20)}`, callback_data: `copy:${fav.id}` },
      ]).concat([[{ text: 'Close', callback_data: 'close' }]]),
    };

    await telegram.sendMessage({
      chat_id: chatId,
      text,
      reply_to_message_id: message.message_id,
      reply_markup: keyboard,
    });
  },
};

// Add to favorites
export const addFavCommand: CommandHandler = {
  command: 'addfav',
  description: 'Add a file to your favorites',
  usage: '/addfav <file-id> [name]',
  async handle(ctx: CommandContext) {
    const { message, argList, telegram, drive, storage } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) return;

    if (argList.length === 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'Add Favorite',
          'Save a file to your favorites for quick access later.\n\n' +
          '<b>Usage:</b> /addfav [file-id]\n\n' +
          'I\'ll fetch the file details and save it to your list.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const fileId = extractFileId(argList[0]);
    if (!fileId) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid file ID', 'That doesn\'t look like a valid file ID or Google Drive link.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // Fetch file info
    const info = await drive.getFileMetadata(fileId);
    if (!info) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('File not found', 'I couldn\'t find that file. Make sure the ID is correct and the file is publicly accessible.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const session = await storage.getOrCreateUser(userId, message.from?.username);
    session.favorites = session.favorites || [];

    // Check if already in favorites
    if (session.favorites.some(f => f.id === fileId)) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage('Already saved', 'This file is already in your favorites.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // Add to favorites (max 20)
    if (session.favorites.length >= 20) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Limit reached', 'You can only save up to 20 favorites. Remove some to add new ones.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    session.favorites.push({
      id: fileId,
      name: info.name || 'Unknown',
      addedAt: Date.now(),
    });

    await storage.saveUser(session);

    await telegram.sendMessage({
      chat_id: chatId,
      text: createSuccessMessage(
        'Added to favorites',
        `<b>${escapeHtml(info.name || 'File')}</b> has been saved to your favorites.\n\n` +
        'Use /favorites to see your saved files.'
      ),
      reply_to_message_id: message.message_id,
    });
  },
};

// Remove from favorites
export const removeFavCommand: CommandHandler = {
  command: 'removefav',
  description: 'Remove a file from your favorites',
  usage: '/removefav <number>',
  async handle(ctx: CommandContext) {
    const { message, argList, telegram, storage } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) return;

    if (argList.length === 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'Remove Favorite',
          'Remove a file from your favorites list.\n\n' +
          '<b>Usage:</b> /removefav [number]\n\n' +
          'Use /favorites first to see the list with numbers.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const index = parseInt(argList[0]) - 1;
    const session = await storage.getOrCreateUser(userId, message.from?.username);
    session.favorites = session.favorites || [];

    if (index < 0 || index >= session.favorites.length) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid number', `Please enter a number between 1 and ${session.favorites.length}.`),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const removed = session.favorites.splice(index, 1)[0];
    await storage.saveUser(session);

    await telegram.sendMessage({
      chat_id: chatId,
      text: createSuccessMessage(
        'Removed from favorites',
        `<b>${escapeHtml(removed.name)}</b> has been removed from your favorites.`
      ),
      reply_to_message_id: message.message_id,
    });
  },
};

// Recent activity command
export const recentCommand: CommandHandler = {
  command: 'recent',
  description: 'Show your recent activity',
  usage: '/recent',
  async handle(ctx: CommandContext) {
    const { message, telegram, storage } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) return;

    const session = await storage.getOrCreateUser(userId, message.from?.username);
    const recent = session.recentActivity || [];

    if (recent.length === 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'Recent Activity',
          'No recent activity to show. Start searching and copying files to build your history.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    let text = '<b>Your Recent Activity</b>\n\n';
    recent.slice(0, 10).forEach((item, i) => {
      const action = item.action === 'copy' ? 'Cloned' : 
                     item.action === 'search' ? 'Searched' : 
                     item.action === 'info' ? 'Viewed' : 'Action';
      const target = item.name || item.query || item.fileId || 'Unknown';
      text += `${i + 1}. ${action}: ${escapeHtml(target)}\n`;
      text += `   ${formatDate(item.timestamp)}\n\n`;
    });

    await telegram.sendMessage({
      chat_id: chatId,
      text,
      reply_to_message_id: message.message_id,
    });
  },
};

// Share command - generate share links
export const shareCommand: CommandHandler = {
  command: 'share',
  description: 'Get shareable links for a file',
  usage: '/share <file-id>',
  async handle(ctx: CommandContext) {
    const { message, argList, telegram, drive, config } = ctx;
    const chatId = message.chat.id;

    if (argList.length === 0) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'Share File',
          'Generate shareable links for a file in your destination folder.\n\n' +
          '<b>Usage:</b> /share [file-id]\n\n' +
          'I\'ll give you the Google Drive link and the index link.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const fileId = extractFileId(argList[0]);
    if (!fileId) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid file ID', 'That doesn\'t look like a valid file ID.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const info = await drive.getFileMetadata(fileId);
    if (!info) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('File not found', 'I couldn\'t find that file.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const driveLink = `https://drive.google.com/file/d/${fileId}/view`;
    const encodedName = encodeURIComponent(info.name || 'file');
    const indexLink = config.indexUrl ? `${config.indexUrl}/0:/${encodedName}` : 'Index URL not configured';

    let text = `<b>Share Links</b>\n\n`;
    text += `<b>File:</b> ${escapeHtml(info.name || 'Unknown')}\n`;
    text += `<b>Size:</b> ${formatFileSize(info.size)}\n\n`;
    text += `<b>Google Drive:</b>\n${driveLink}\n\n`;
    text += `<b>Index Link:</b>\n${indexLink}`;

    await telegram.sendMessage({
      chat_id: chatId,
      text,
      reply_to_message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Open in Drive', url: driveLink }],
          ...(config.indexUrl ? [[{ text: 'Open Index', url: indexLink }]] : []),
          [{ text: 'Close', callback_data: 'close' }],
        ],
      },
    });
  },
};

// Quota command - check usage stats
export const quotaCommand: CommandHandler = {
  command: 'quota',
  description: 'Check your daily usage and limits',
  usage: '/quota',
  async handle(ctx: CommandContext) {
    const { message, telegram, storage, config } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) return;

    // Get user session for their daily usage
    const session = await storage.getOrCreateUser(userId, message.from?.username);
    const dailyCopies = session.dailyCopies || 0;
    const dailyLimit = config.dailyLimit;

    let text = '<b>Your Usage</b>\n\n';
    text += `<b>Today's copies:</b> ${dailyCopies} / ${dailyLimit}\n`;
    text += `<b>Total commands:</b> ${session.totalCommands || session.commandCount}\n`;
    text += `<b>Favorites saved:</b> ${(session.favorites || []).length} / 20\n\n`;
    text += 'Your daily copy limit resets at midnight UTC.';

    await telegram.sendMessage({
      chat_id: chatId,
      text,
      reply_to_message_id: message.message_id,
    });
  },
};

// Clear history command
export const clearCommand: CommandHandler = {
  command: 'clear',
  description: 'Clear your recent activity history',
  usage: '/clear',
  async handle(ctx: CommandContext) {
    const { message, telegram, storage } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) return;

    const session = await storage.getOrCreateUser(userId, message.from?.username);
    session.recentActivity = [];
    await storage.saveUser(session);

    await telegram.sendMessage({
      chat_id: chatId,
      text: createSuccessMessage('History cleared', 'Your recent activity has been cleared.'),
      reply_to_message_id: message.message_id,
    });
  },
};
