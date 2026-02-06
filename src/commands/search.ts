// /search command handler with pagination and filters

import type { CommandHandler, CommandContext } from './types';
import { createErrorMessage, createInfoMessage } from './types';
import { formatFileSize, escapeHtml, truncate } from '../utils/helpers';
import type { DriveFile } from '../types/google-drive';

const RESULTS_PER_PAGE = 5;

// File type filters
const TYPE_FILTERS: Record<string, string[]> = {
  video: ['video/'],
  audio: ['audio/'],
  image: ['image/'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats', 'text/'],
  archive: ['application/zip', 'application/x-rar', 'application/x-7z', 'application/gzip'],
  folder: ['application/vnd.google-apps.folder'],
};

export const searchCommand: CommandHandler = {
  command: 'search',
  description: 'Search for files in Google Drive',
  usage: '/search [query] or /search type:[filter] [query]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, drive, storage, args } = ctx;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing search query',
          'You need to tell me what to search for.\n\n' +
          'Usage: <code>/search [query]</code>\n' +
          'Example: <code>/search Avatar 2022</code>\n\n' +
          'You can also filter by type:\n' +
          '<code>/search type:video avatar</code>\n' +
          'Available filters: video, audio, image, document, archive, folder'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // Check rate limit
    if (userId) {
      const rateLimit = await storage.checkRateLimit(userId, 10, 60000);
      if (!rateLimit.allowed) {
        await telegram.sendMessage({
          chat_id: chatId,
          text: createErrorMessage(
            'Slow down',
            `You're searching too fast. Give me ${Math.ceil(rateLimit.resetIn / 1000)} seconds and try again.`
          ),
          reply_to_message_id: message.message_id,
        });
        return;
      }
    }

    // Parse type filter if present
    let searchQuery = args;
    let typeFilter: string | null = null;
    
    const typeMatch = args.match(/^type:(\w+)\s+(.+)$/i);
    if (typeMatch) {
      const filterName = typeMatch[1].toLowerCase();
      if (TYPE_FILTERS[filterName]) {
        typeFilter = filterName;
        searchQuery = typeMatch[2];
      }
    }

    // Send typing indicator
    await telegram.sendTyping(chatId);

    // Check cache first
    const cacheKey = typeFilter ? `${typeFilter}:${searchQuery}` : searchQuery;
    const cached = await storage.getCachedSearch(cacheKey);
    let searchResult;

    if (cached) {
      searchResult = cached as { files: DriveFile[]; nextPageToken?: string };
    } else {
      try {
        searchResult = await drive.search(searchQuery, undefined, 50);
        
        // Apply type filter if specified
        if (typeFilter && searchResult.files) {
          const mimeTypes = TYPE_FILTERS[typeFilter];
          searchResult.files = searchResult.files.filter(file =>
            mimeTypes.some(mime => file.mimeType.startsWith(mime))
          );
        }
        
        // Cache the results
        await storage.cacheSearchResults(cacheKey, searchResult, 300);
      } catch {
        await telegram.sendMessage({
          chat_id: chatId,
          text: createErrorMessage(
            'Search failed',
            'Something went wrong while searching. This might be a temporary issue - try again in a moment.'
          ),
          reply_to_message_id: message.message_id,
        });
        return;
      }
    }

    if (!searchResult.files || searchResult.files.length === 0) {
      const noResultsText = typeFilter
        ? `I couldn't find any ${typeFilter} files matching "${escapeHtml(searchQuery)}".`
        : `I couldn't find anything matching "${escapeHtml(searchQuery)}".`;
      
      await telegram.sendMessage({
        chat_id: chatId,
        text: createInfoMessage(
          'No results',
          noResultsText + '\n\nTry using different keywords or check your spelling.'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    // Update stats
    if (userId) {
      await storage.incrementDailySearch(userId);
      await storage.incrementStat('totalSearches');
    }

    // Paginate results
    const totalResults = searchResult.files.length;
    const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);
    const currentPage = 1;
    const startIdx = 0;
    const endIdx = Math.min(RESULTS_PER_PAGE, totalResults);
    const pageFiles = searchResult.files.slice(startIdx, endIdx);

    const messageText = formatSearchResults(searchQuery, pageFiles, currentPage, totalPages, totalResults, typeFilter);
    const keyboard = createPaginationKeyboard(cacheKey, currentPage, totalPages, pageFiles);

    const sentMessage = await telegram.sendWithKeyboard(chatId, messageText, keyboard, message.message_id);

    // Store pagination state
    if (userId && sentMessage) {
      const msgData = sentMessage as { message_id: number };
      await storage.savePaginationState(chatId, msgData.message_id, {
        query: cacheKey,
        page: currentPage,
        results: searchResult.files,
        pageToken: searchResult.nextPageToken,
      });
    }
  },
};

function formatSearchResults(
  query: string,
  files: DriveFile[],
  currentPage: number,
  totalPages: number,
  totalResults: number,
  typeFilter: string | null = null
): string {
  let text = `<b>Search results for:</b> "${escapeHtml(query)}"`;
  if (typeFilter) {
    text += ` (${typeFilter} only)`;
  }
  text += `\nFound ${totalResults} files - showing page ${currentPage} of ${totalPages}\n\n`;

  files.forEach((file, idx) => {
    const fileType = getFileTypeLabel(file.mimeType);
    const name = truncate(escapeHtml(file.name), 50);
    const size = formatFileSize(file.size);
    const num = (currentPage - 1) * RESULTS_PER_PAGE + idx + 1;

    text += `<b>${num}.</b> <a href="https://drive.google.com/open?id=${file.id}">${name}</a>\n`;
    text += `     ${fileType} | ${size}\n\n`;
  });

  text += `\nClick on a file name to open it, or use the buttons below to copy.`;

  return text;
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('audio')) return 'Audio';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'Archive';
  if (mimeType.includes('folder')) return 'Folder';
  if (mimeType.includes('document') || mimeType.includes('text')) return 'Document';
  if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
  if (mimeType.includes('presentation')) return 'Presentation';
  return 'File';
}

function createPaginationKeyboard(
  query: string,
  currentPage: number,
  totalPages: number,
  files: DriveFile[]
): { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> } {
  const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  // Copy buttons for current page files (2 per row)
  for (let i = 0; i < files.length; i += 2) {
    const row: Array<{ text: string; callback_data: string }> = [];
    row.push({ text: `Copy #${(currentPage - 1) * RESULTS_PER_PAGE + i + 1}`, callback_data: `copy:${files[i].id}` });
    if (files[i + 1]) {
      row.push({ text: `Copy #${(currentPage - 1) * RESULTS_PER_PAGE + i + 2}`, callback_data: `copy:${files[i + 1].id}` });
    }
    keyboard.push(row);
  }

  // Pagination row
  const navRow: Array<{ text: string; callback_data: string }> = [];
  
  if (currentPage > 1) {
    navRow.push({ text: 'Previous', callback_data: `search:${query}:${currentPage - 1}` });
  }
  
  navRow.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });
  
  if (currentPage < totalPages) {
    navRow.push({ text: 'Next', callback_data: `search:${query}:${currentPage + 1}` });
  }
  
  keyboard.push(navRow);

  // Close button
  keyboard.push([{ text: 'Close', callback_data: 'close' }]);

  return { inline_keyboard: keyboard };
}

export { formatSearchResults, createPaginationKeyboard, RESULTS_PER_PAGE, getFileTypeLabel };
