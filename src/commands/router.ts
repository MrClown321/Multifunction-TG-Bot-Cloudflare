// Command router - register and dispatch commands

import type { CommandHandler, CommandContext, CallbackContext } from './types';
import { startCommand } from './start';
import { helpCommand } from './help';
import { searchCommand, RESULTS_PER_PAGE, formatSearchResults, createPaginationKeyboard } from './search';
import { copyCommand } from './copy';
import { infoCommand } from './info';
import { listCommand, FILES_PER_PAGE } from './list';
import { pingCommand, qrCommand, shortUrlCommand, hashCommand, meCommand, settingsCommand } from './utilities';
import { statsCommand, banCommand, unbanCommand, mkdirCommand, deleteCommand, renameCommand, broadcastCommand, authorizeCommand, deauthorizeCommand, listauthCommand } from './admin';
import { batchCommand, favoritesCommand, addFavCommand, removeFavCommand, recentCommand, shareCommand, quotaCommand, clearCommand } from './advanced';
import { mediainfoCommandHandler } from './mediainfo-handler';
import { createErrorMessage, createSuccessMessage, createInfoMessage } from './types';
import type { DriveFile } from '../types/google-drive';

// Register all command handlers
const commandHandlers: Map<string, CommandHandler> = new Map();

const commands: CommandHandler[] = [
  startCommand,
  helpCommand,
  searchCommand,
  copyCommand,
  infoCommand,
  listCommand,
  pingCommand,
  qrCommand,
  shortUrlCommand,
  hashCommand,
  meCommand,
  settingsCommand,
  // Advanced commands
  batchCommand,
  favoritesCommand,
  addFavCommand,
  removeFavCommand,
  recentCommand,
  shareCommand,
  quotaCommand,
  clearCommand,
  // MediaInfo command
  mediainfoCommandHandler,
  // Admin commands
  statsCommand,
  banCommand,
  unbanCommand,
  mkdirCommand,
  deleteCommand,
  renameCommand,
  broadcastCommand,
  authorizeCommand,
  deauthorizeCommand,
  listauthCommand,
];


commands.forEach((handler) => {
  commandHandlers.set(handler.command, handler);
});

export async function handleCommand(
  commandName: string,
  ctx: CommandContext
): Promise<void> {
  const handler = commandHandlers.get(commandName);

  if (!handler) {
    // Unknown command
    await ctx.telegram.sendMessage({
      chat_id: ctx.message.chat.id,
      text: createErrorMessage(
        'Unknown command',
        `I don't recognize <code>/${commandName}</code>.\n\nType /help to see what I can do.`
      ),
      reply_to_message_id: ctx.message.message_id,
    });
    return;
  }

  // Check admin-only commands
  if (handler.adminOnly && !ctx.isAdmin) {
    await ctx.telegram.sendMessage({
      chat_id: ctx.message.chat.id,
      text: createErrorMessage('Access denied', 'This command is only available to administrators.'),
      reply_to_message_id: ctx.message.message_id,
    });
    return;
  }

  // Execute the command
  await handler.handle(ctx);
}

// Callback query handlers
export async function handleCallback(ctx: CallbackContext): Promise<void> {
  const { query, data, telegram, drive, storage, config } = ctx;
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;

  if (!chatId || !messageId) {
    await telegram.answerCallbackQuery({ callback_query_id: query.id, text: 'Invalid callback' });
    return;
  }

  const [action, ...params] = data.split(':');

  try {
    switch (action) {
      case 'close':
        await telegram.deleteMessage(chatId, messageId);
        await telegram.answerCallbackQuery({ callback_query_id: query.id });
        break;

      case 'noop':
        await telegram.answerCallbackQuery({ callback_query_id: query.id });
        break;

      case 'copy':
        const fileId = params[0];
        if (!fileId) {
          await telegram.answerCallbackQuery({ callback_query_id: query.id, text: 'Invalid file ID', show_alert: true });
          return;
        }

        await telegram.answerCallbackQuery({ callback_query_id: query.id, text: 'Cloning file...' });

        const result = await drive.copyFile(fileId, config.folderId);

        if (result.error) {
          await telegram.sendMessage({
            chat_id: chatId,
            text: createErrorMessage('Clone failed', result.error.message),
          });
        } else if (result.name) {
          const encodedName = encodeURIComponent(result.name);
          const indexLink = `${config.indexUrl}/0:/${encodedName}`;

          await telegram.sendMessage({
            chat_id: chatId,
            text: createSuccessMessage(
              'File cloned successfully',
              `<b>File:</b> ${result.name}\n\n` +
              `<b>Index Link:</b>\n${indexLink}`
            ),
          });

          // Update stats
          if (query.from.id) {
            await storage.incrementDailyCopy(query.from.id);
            await storage.incrementStat('totalCopies');
          }
        }
        break;

      case 'search':
        const searchQuery = params[0];
        const page = parseInt(params[1]) || 1;

        await telegram.answerCallbackQuery({ callback_query_id: query.id, text: `Loading page ${page}...` });

        // Get cached results
        const paginationState = await storage.getPaginationState(chatId, messageId);
        
        if (paginationState && paginationState.results) {
          const files = paginationState.results as DriveFile[];
          const totalResults = files.length;
          const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);
          const startIdx = (page - 1) * RESULTS_PER_PAGE;
          const endIdx = Math.min(startIdx + RESULTS_PER_PAGE, totalResults);
          const pageFiles = files.slice(startIdx, endIdx);

          const messageText = formatSearchResults(searchQuery, pageFiles, page, totalPages, totalResults, null);
          const keyboard = createPaginationKeyboard(searchQuery, page, totalPages, pageFiles);

          await telegram.editMessage({
            chat_id: chatId,
            message_id: messageId,
            text: messageText,
            reply_markup: keyboard,
          });

          // Update pagination state
          await storage.savePaginationState(chatId, messageId, {
            ...paginationState,
            page,
          });
        }
        break;

      case 'list':
        const listPage = parseInt(params[0]) || 1;
        const typeFilter = params[1] || null;
        
        await telegram.answerCallbackQuery({ callback_query_id: query.id, text: `Loading...` });
        
        const listResult = await drive.listFiles(config.folderId, undefined, 100);
        if (listResult.files && listResult.files.length > 0) {
          // Apply type filter
          let filteredFiles = listResult.files;
          const TYPE_FILTERS: Record<string, string[]> = {
            video: ['video/'],
            audio: ['audio/'],
            folder: ['application/vnd.google-apps.folder'],
          };
          
          if (typeFilter && TYPE_FILTERS[typeFilter]) {
            const mimeTypes = TYPE_FILTERS[typeFilter];
            filteredFiles = listResult.files.filter(file =>
              mimeTypes.some(mime => file.mimeType.startsWith(mime))
            );
          }
          
          if (filteredFiles.length === 0) {
            await telegram.editMessage({
              chat_id: chatId,
              message_id: messageId,
              text: createInfoMessage('No matching files', `No ${typeFilter} files found.`),
              reply_markup: {
                inline_keyboard: [[{ text: 'Clear filter', callback_data: 'list:1:' }], [{ text: 'Close', callback_data: 'close' }]],
              },
            });
            return;
          }
          
          const totalFiles = filteredFiles.length;
          const totalPages = Math.ceil(totalFiles / FILES_PER_PAGE);
          const currentPage = Math.min(Math.max(1, listPage), totalPages);
          const startIdx = (currentPage - 1) * FILES_PER_PAGE;
          const endIdx = Math.min(startIdx + FILES_PER_PAGE, totalFiles);
          const pageFiles = filteredFiles.slice(startIdx, endIdx);

          const { formatFileSize, truncate, escapeHtml } = await import('../utils/helpers');
          
          let text = `<b>Your Destination Folder</b>`;
          if (typeFilter) {
            text += ` (${typeFilter} files only)`;
          }
          text += `\n${totalFiles} items total - page ${currentPage} of ${totalPages}\n\n`;

          pageFiles.forEach((file, idx) => {
            const fileType = getFileTypeLabel(file.mimeType);
            const name = truncate(escapeHtml(file.name), 40);
            const size = formatFileSize(file.size);
            const num = startIdx + idx + 1;

            text += `<b>${num}.</b> ${name}\n`;
            text += `     ${fileType} | ${size}\n`;
            text += `     ID: <code>${file.id}</code>\n\n`;
          });

          // Build keyboard
          const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
          
          const filterRow = [
            { text: typeFilter === 'video' ? '[Video]' : 'Video', callback_data: `list:1:video` },
            { text: typeFilter === 'audio' ? '[Audio]' : 'Audio', callback_data: `list:1:audio` },
            { text: typeFilter === 'folder' ? '[Folders]' : 'Folders', callback_data: `list:1:folder` },
          ];
          keyboard.push(filterRow);
          
          if (typeFilter) {
            keyboard.push([{ text: 'Clear filter', callback_data: `list:1:` }]);
          }

          const navRow: Array<{ text: string; callback_data: string }> = [];
          if (currentPage > 1) {
            navRow.push({ text: 'Previous', callback_data: `list:${currentPage - 1}:${typeFilter || ''}` });
          }
          navRow.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });
          if (currentPage < totalPages) {
            navRow.push({ text: 'Next', callback_data: `list:${currentPage + 1}:${typeFilter || ''}` });
          }
          keyboard.push(navRow);
          keyboard.push([{ text: 'Refresh', callback_data: `list:${currentPage}:${typeFilter || ''}` }]);
          keyboard.push([{ text: 'Close', callback_data: 'close' }]);

          await telegram.editMessage({
            chat_id: chatId,
            message_id: messageId,
            text,
            reply_markup: { inline_keyboard: keyboard },
          });
        }
        break;

      case 'confirm_delete':
        if (!ctx.isAdmin) {
          await telegram.answerCallbackQuery({ callback_query_id: query.id, text: 'Access denied', show_alert: true });
          return;
        }

        const deleteFileId = params[0];
        const deleted = await drive.deleteFile(deleteFileId);

        if (deleted) {
          await telegram.editMessage({
            chat_id: chatId,
            message_id: messageId,
            text: createSuccessMessage('File deleted', `File <code>${deleteFileId}</code> has been permanently deleted.`),
          });
        } else {
          await telegram.editMessage({
            chat_id: chatId,
            message_id: messageId,
            text: createErrorMessage('Delete failed', 'Couldn\'t delete the file. It might not exist or you might not have permission.'),
          });
        }

        await telegram.answerCallbackQuery({ callback_query_id: query.id });
        break;

      case 'help':
        await telegram.answerCallbackQuery({ callback_query_id: query.id });
        break;

      case 'settings':
        const settingType = params[0];
        const userId = query.from.id;
        const session = await storage.getOrCreateUser(userId, query.from.username);
        
        if (settingType === 'notifications') {
          session.preferences.notifications = !session.preferences.notifications;
          await storage.saveUser(session);
          await telegram.answerCallbackQuery({
            callback_query_id: query.id,
            text: `Notifications ${session.preferences.notifications ? 'enabled' : 'disabled'}`,
            show_alert: true,
          });
        } else if (settingType === 'limit') {
          const limit = parseInt(params[1]) || 10;
          session.preferences.searchLimit = limit;
          await storage.saveUser(session);
          await telegram.answerCallbackQuery({
            callback_query_id: query.id,
            text: `Search results set to ${limit} per page`,
            show_alert: true,
          });
        } else if (settingType === 'autopreview') {
          session.preferences.autoPreview = !session.preferences.autoPreview;
          await storage.saveUser(session);
          await telegram.answerCallbackQuery({
            callback_query_id: query.id,
            text: `Auto preview ${session.preferences.autoPreview ? 'enabled' : 'disabled'}`,
            show_alert: true,
          });
        }
        break;

      case 'admin':
        if (!ctx.isAdmin) {
          await telegram.answerCallbackQuery({ callback_query_id: query.id, text: 'Access denied', show_alert: true });
          return;
        }
        
        if (params[0] === 'stats') {
          const stats = await storage.getStats();
          const { formatDate } = await import('../utils/helpers');
          
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

          await telegram.editMessage({
            chat_id: chatId,
            message_id: messageId,
            text: statsText,
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Refresh', callback_data: 'admin:stats' }],
                [{ text: 'Close', callback_data: 'close' }],
              ],
            },
          });
          await telegram.answerCallbackQuery({ callback_query_id: query.id, text: 'Stats refreshed' });
        }
        break;

      default:
        await telegram.answerCallbackQuery({
          callback_query_id: query.id,
          text: 'Unknown action',
          show_alert: true,
        });
    }
  } catch (error) {
    console.error('Callback error:', error);
    await telegram.answerCallbackQuery({
      callback_query_id: query.id,
      text: 'An error occurred',
      show_alert: true,
    });
  }
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('audio')) return 'Audio';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'Archive';
  if (mimeType.includes('folder')) return 'Folder';
  if (mimeType.includes('document') || mimeType.includes('text')) return 'Document';
  return 'File';
}

export { commandHandlers, commands };
