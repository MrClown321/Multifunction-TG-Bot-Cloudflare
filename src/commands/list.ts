// /list command handler - List files in destination folder

import type { CommandHandler, CommandContext } from './types';
import { createInfoMessage, createErrorMessage } from './types';
import { formatFileSize, escapeHtml, truncate } from '../utils/helpers';
import type { DriveFile } from '../types/google-drive';

const FILES_PER_PAGE = 10;

// Type filters for list command
const TYPE_FILTERS: Record<string, string[]> = {
  video: ['video/'],
  audio: ['audio/'],
  image: ['image/'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats', 'text/'],
  archive: ['application/zip', 'application/x-rar', 'application/x-7z'],
  folder: ['application/vnd.google-apps.folder'],
};

export const listCommand: CommandHandler = {
  command: 'list',
  description: 'List files in destination folder',
  usage: '/list [page_number] [type_filter]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, drive, config, argList } = ctx;
    const chatId = message.chat.id;

    await telegram.sendTyping(chatId);

    // Parse arguments
    let pageNum = 1;
    let typeFilter: string | null = null;
    
    for (const arg of argList) {
      const num = parseInt(arg);
      if (!isNaN(num)) {
        pageNum = num;
      } else if (TYPE_FILTERS[arg.toLowerCase()]) {
        typeFilter = arg.toLowerCase();
      }
    }
    
    try {
      const result = await drive.listFiles(config.folderId, undefined, 100);

      if (!result.files || result.files.length === 0) {
        await telegram.sendMessage({
          chat_id: chatId,
          text: createInfoMessage('Folder is empty', 'There are no files in your destination folder yet.'),
          reply_to_message_id: message.message_id,
        });
        return;
      }

      // Apply type filter if specified
      let filteredFiles = result.files;
      if (typeFilter) {
        const mimeTypes = TYPE_FILTERS[typeFilter];
        filteredFiles = result.files.filter(file =>
          mimeTypes.some(mime => file.mimeType.startsWith(mime))
        );
        
        if (filteredFiles.length === 0) {
          await telegram.sendMessage({
            chat_id: chatId,
            text: createInfoMessage(
              'No matching files',
              `No ${typeFilter} files found in your folder.\n\nTry /list without a filter to see all files.`
            ),
            reply_to_message_id: message.message_id,
          });
          return;
        }
      }

      const totalFiles = filteredFiles.length;
      const totalPages = Math.ceil(totalFiles / FILES_PER_PAGE);
      const currentPage = Math.min(Math.max(1, pageNum), totalPages);
      const startIdx = (currentPage - 1) * FILES_PER_PAGE;
      const endIdx = Math.min(startIdx + FILES_PER_PAGE, totalFiles);
      const pageFiles = filteredFiles.slice(startIdx, endIdx);

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

      const keyboard = createListPaginationKeyboard(currentPage, totalPages, typeFilter);

      await telegram.sendWithKeyboard(chatId, text, keyboard, message.message_id);
    } catch {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Error', 'Failed to list files. Please try again.'),
        reply_to_message_id: message.message_id,
      });
    }
  },
};

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('audio')) return 'Audio';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'Archive';
  if (mimeType.includes('folder')) return 'Folder';
  if (mimeType.includes('document') || mimeType.includes('text')) return 'Document';
  return 'File';
}

function createListPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  typeFilter: string | null
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  
  // Filter buttons
  const filterRow: Array<{ text: string; callback_data: string }> = [
    { text: typeFilter === 'video' ? '[Video]' : 'Video', callback_data: `list:1:video` },
    { text: typeFilter === 'audio' ? '[Audio]' : 'Audio', callback_data: `list:1:audio` },
    { text: typeFilter === 'folder' ? '[Folders]' : 'Folders', callback_data: `list:1:folder` },
  ];
  keyboard.push(filterRow);
  
  if (typeFilter) {
    keyboard.push([{ text: 'Clear filter', callback_data: `list:1:` }]);
  }

  // Navigation row
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

  return { inline_keyboard: keyboard };
}

export { FILES_PER_PAGE };
