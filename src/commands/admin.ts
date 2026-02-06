// Admin commands: /stats, /ban, /unban, /broadcast, /mkdir, /delete, /rename

import type { CommandHandler, CommandContext } from './types';
import { createSuccessMessage, createErrorMessage, createInfoMessage, createWarningMessage } from './types';
import { formatDate, escapeHtml, extractFileId } from '../utils/helpers';

// /stats command - Bot statistics (Admin only)
export const statsCommand: CommandHandler = {
  command: 'stats',
  description: 'View bot statistics',
  adminOnly: true,

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, storage, isAdmin } = ctx;
    const chatId = message.chat.id;

    if (!isAdmin) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const stats = await storage.getStats();

    const statsText = `
<b>Bot Statistics</b>

<b>Users:</b> ${stats.totalUsers}
<b>Total searches:</b> ${stats.totalSearches}
<b>Total copies:</b> ${stats.totalCopies}
<b>Active today:</b> ${stats.activeToday}

<b>Last updated:</b> ${formatDate(stats.lastUpdated)}

<b>System</b>
Runtime: Cloudflare Workers
Region: Edge (Global)
Status: Operational
`;

    const keyboard = {
      inline_keyboard: [
        [{ text: 'Refresh', callback_data: 'admin:stats' }],
        [{ text: 'Close', callback_data: 'close' }],
      ],
    };

    await telegram.sendWithKeyboard(chatId, statsText, keyboard, message.message_id);
  },
};

// /ban command - Ban a user (Admin only)
export const banCommand: CommandHandler = {
  command: 'ban',
  description: 'Ban a user from using the bot',
  usage: '/ban [user_id] [reason]',
  adminOnly: true,

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, storage, isAdmin, argList } = ctx;
    const chatId = message.chat.id;

    if (!isAdmin) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    if (argList.length < 1) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing user ID',
          'Tell me which user to ban.\n\n' +
          'Usage: <code>/ban [user_id] [reason]</code>\n' +
          'Example: <code>/ban 123456789 Spamming</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const userId = parseInt(argList[0]);
    if (isNaN(userId)) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid user ID', 'Please provide a valid numeric user ID.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const reason = argList.slice(1).join(' ') || 'No reason provided';

    await storage.banUser(userId, reason);

    await telegram.sendMessage({
      chat_id: chatId,
      text: createSuccessMessage(
        'User banned',
        `<b>User ID:</b> <code>${userId}</code>\n<b>Reason:</b> ${escapeHtml(reason)}\n\nThis user can no longer use the bot.`
      ),
      reply_to_message_id: message.message_id,
    });
  },
};

// /unban command - Unban a user (Admin only)
export const unbanCommand: CommandHandler = {
  command: 'unban',
  description: 'Unban a previously banned user',
  usage: '/unban [user_id]',
  adminOnly: true,

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, storage, isAdmin, args } = ctx;
    const chatId = message.chat.id;

    if (!isAdmin) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing user ID',
          'Tell me which user to unban.\n\n' +
          'Usage: <code>/unban [user_id]</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const userId = parseInt(args.trim());
    if (isNaN(userId)) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid user ID', 'Please provide a valid numeric user ID.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    await storage.unbanUser(userId);

    await telegram.sendMessage({
      chat_id: chatId,
      text: createSuccessMessage('User unbanned', `<b>User ID:</b> <code>${userId}</code>\n\nThis user can now use the bot again.`),
      reply_to_message_id: message.message_id,
    });
  },
};

// /mkdir command - Create folder in Drive
export const mkdirCommand: CommandHandler = {
  command: 'mkdir',
  description: 'Create a new folder in destination',
  usage: '/mkdir [folder_name]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, drive, config, args } = ctx;
    const chatId = message.chat.id;

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing folder name',
          'Tell me what to name the new folder.\n\n' +
          'Usage: <code>/mkdir [folder_name]</code>\n' +
          'Example: <code>/mkdir Movies 2024</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    await telegram.sendTyping(chatId);

    try {
      const result = await drive.createFolder(args.trim(), config.folderId);

      if (!result) {
        await telegram.sendMessage({
          chat_id: chatId,
          text: createErrorMessage('Failed', 'Couldn\'t create the folder. Please try again.'),
          reply_to_message_id: message.message_id,
        });
        return;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Open folder', url: `https://drive.google.com/drive/folders/${result.id}` }],
        ],
      };

      await telegram.sendWithKeyboard(
        chatId,
        createSuccessMessage('Folder created', `<b>Name:</b> ${escapeHtml(result.name)}\n<b>ID:</b> <code>${result.id}</code>`),
        keyboard,
        message.message_id
      );
    } catch {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Error', 'Failed to create folder.'),
        reply_to_message_id: message.message_id,
      });
    }
  },
};

// /delete command - Delete a file (Admin only)
export const deleteCommand: CommandHandler = {
  command: 'delete',
  description: 'Delete a file from Google Drive',
  usage: '/delete [file_id]',
  adminOnly: true,

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, isAdmin, args } = ctx;
    const chatId = message.chat.id;

    if (!isAdmin) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing file ID',
          'Tell me which file to delete.\n\n' +
          'Usage: <code>/delete [file_id]</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const fileId = extractFileId(args.trim()) || args.trim();

    // Confirmation message
    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Yes, delete it', callback_data: `confirm_delete:${fileId}` },
          { text: 'Cancel', callback_data: 'close' },
        ],
      ],
    };

    await telegram.sendWithKeyboard(
      chatId,
      createWarningMessage(
        'Confirm deletion',
        `Are you sure you want to delete this file?\n\n<b>File ID:</b> <code>${fileId}</code>\n\nThis action cannot be undone.`
      ),
      keyboard,
      message.message_id
    );
  },
};

// /rename command - Rename a file
export const renameCommand: CommandHandler = {
  command: 'rename',
  description: 'Rename a file in Google Drive',
  usage: '/rename [file_id] [new_name]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, drive, argList } = ctx;
    const chatId = message.chat.id;

    if (argList.length < 2) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing parameters',
          'I need a file ID and a new name.\n\n' +
          'Usage: <code>/rename [file_id] [new_name]</code>\n' +
          'Example: <code>/rename 1BxiMVs0XRA My-New-Name.mp4</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const fileId = extractFileId(argList[0]) || argList[0];
    const newName = argList.slice(1).join(' ');

    await telegram.sendTyping(chatId);

    try {
      const result = await drive.renameFile(fileId, newName);

      if (!result) {
        await telegram.sendMessage({
          chat_id: chatId,
          text: createErrorMessage(
            'Rename failed',
            'Couldn\'t rename the file. Make sure you have permission and the file exists.'
          ),
          reply_to_message_id: message.message_id,
        });
        return;
      }

      await telegram.sendMessage({
        chat_id: chatId,
        text: createSuccessMessage(
          'File renamed',
          `<b>New name:</b> ${escapeHtml(result.name)}\n<b>ID:</b> <code>${result.id}</code>`
        ),
        reply_to_message_id: message.message_id,
      });
    } catch {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Error', 'Failed to rename file.'),
        reply_to_message_id: message.message_id,
      });
    }
  },
};

// /broadcast command - Send message to all users (Admin only)
export const broadcastCommand: CommandHandler = {
  command: 'broadcast',
  description: 'Send a message to all users',
  usage: '/broadcast [message]',
  adminOnly: true,

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, isAdmin, args } = ctx;
    const chatId = message.chat.id;

    if (!isAdmin) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing message',
          'What do you want to broadcast?\n\n' +
          'Usage: <code>/broadcast [message]</code>\n' +
          'Example: <code>/broadcast Maintenance tonight at 10 PM</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // For now, just confirm the broadcast would be sent
    // In a real implementation, you'd iterate through all users in KV
    await telegram.sendMessage({
      chat_id: chatId,
      text: createInfoMessage(
        'Broadcast prepared',
        `<b>Message:</b>\n${escapeHtml(args)}\n\n` +
        'Note: Broadcast functionality requires additional setup to store user IDs. ' +
        'Currently, messages are only sent to the authorized chat.'
      ),
      reply_to_message_id: message.message_id,
    });
  },
};

// /authorize command - Grant DM access to a user (Admin only)
export const authorizeCommand: CommandHandler = {
  command: 'authorize',
  description: 'Grant a user access to use the bot in DMs',
  usage: '/authorize [user_id]',
  adminOnly: true,

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, storage, isAdmin, args } = ctx;
    const chatId = message.chat.id;
    const adminId = message.from?.id;

    if (!isAdmin) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'Authorize User',
          'Grant a user permission to use this bot in private messages.\n\n' +
          '<b>Usage:</b> <code>/authorize [user_id]</code>\n\n' +
          'You can get a user\'s ID by having them send /me to the bot in the group, ' +
          'or use bots like @userinfobot.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const userId = parseInt(args.trim());
    if (isNaN(userId)) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid user ID', 'Please provide a valid numeric user ID.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // Check if already authorized
    if (await storage.isUserAuthorized(userId)) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage('Already authorized', `User <code>${userId}</code> already has DM access.`),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    await storage.authorizeUser(userId, adminId || 0);

    await telegram.sendMessage({
      chat_id: chatId,
      text: createSuccessMessage(
        'User authorized',
        `<b>User ID:</b> <code>${userId}</code>\n\n` +
        'This user can now use the bot in private messages. ' +
        'They just need to start a chat with the bot and send /start.'
      ),
      reply_to_message_id: message.message_id,
    });
  },
};

// /deauthorize command - Revoke DM access from a user (Admin only)
export const deauthorizeCommand: CommandHandler = {
  command: 'deauthorize',
  description: 'Revoke a user\'s DM access',
  usage: '/deauthorize [user_id]',
  adminOnly: true,

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, storage, isAdmin, args } = ctx;
    const chatId = message.chat.id;

    if (!isAdmin) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'Deauthorize User',
          'Revoke a user\'s permission to use this bot in private messages.\n\n' +
          '<b>Usage:</b> <code>/deauthorize [user_id]</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const userId = parseInt(args.trim());
    if (isNaN(userId)) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid user ID', 'Please provide a valid numeric user ID.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    await storage.deauthorizeUser(userId);

    await telegram.sendMessage({
      chat_id: chatId,
      text: createSuccessMessage(
        'User deauthorized',
        `<b>User ID:</b> <code>${userId}</code>\n\n` +
        'This user can no longer use the bot in private messages. ' +
        'They can still use it in the authorized group chat.'
      ),
      reply_to_message_id: message.message_id,
    });
  },
};

// /listauth command - List all authorized users (Admin only)
export const listauthCommand: CommandHandler = {
  command: 'listauth',
  description: 'List all users with DM access',
  usage: '/listauth',
  adminOnly: true,

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, storage, config, isAdmin } = ctx;
    const chatId = message.chat.id;

    if (!isAdmin) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const kvAuthorizedUsers = await storage.getAuthorizedUsers();
    const configAdmins = config.adminUserIds;
    const configAuthorized = config.authorizedUserIds;

    let text = '<b>Authorized Users for DM Access</b>\n\n';

    if (configAdmins.length > 0) {
      text += '<b>Admins (from config):</b>\n';
      configAdmins.forEach((id, i) => {
        text += `  ${i + 1}. <code>${id}</code>\n`;
      });
      text += '\n';
    }

    if (configAuthorized.length > 0) {
      text += '<b>Authorized (from config):</b>\n';
      configAuthorized.forEach((id, i) => {
        text += `  ${i + 1}. <code>${id}</code>\n`;
      });
      text += '\n';
    }

    if (kvAuthorizedUsers.length > 0) {
      text += '<b>Authorized (via /authorize):</b>\n';
      kvAuthorizedUsers.forEach((id, i) => {
        text += `  ${i + 1}. <code>${id}</code>\n`;
      });
      text += '\n';
    }

    if (configAdmins.length === 0 && configAuthorized.length === 0 && kvAuthorizedUsers.length === 0) {
      text += 'No users are currently authorized for DM access.\n\n';
    }

    text += 'Use /authorize [user_id] to add a user.\n';
    text += 'Use /deauthorize [user_id] to remove a user.';

    await telegram.sendMessage({
      chat_id: chatId,
      text,
      reply_to_message_id: message.message_id,
    });
  },
};
