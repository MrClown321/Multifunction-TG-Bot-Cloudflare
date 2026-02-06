// /info command handler - Get file information

import type { CommandHandler, CommandContext } from './types';
import { createErrorMessage, createInfoMessage } from './types';
import { extractFileId, formatFileSize, formatDate, escapeHtml } from '../utils/helpers';

export const infoCommand: CommandHandler = {
  command: 'info',
  description: 'Get detailed information about a file',
  usage: '/info [url or file_id]',

  async handle(ctx: CommandContext): Promise<void> {
    const { message, telegram, drive, args } = ctx;
    const chatId = message.chat.id;

    if (!args.trim()) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage(
          'Missing file ID',
          'I need a Google Drive file URL or ID to look up.\n\n' +
          'Usage: <code>/info [url or file_id]</code>'
        ),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    const fileId = extractFileId(args.trim());
    if (!fileId) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Invalid file ID', 'I couldn\'t extract a valid file ID from that.'),
        reply_to_message_id: message.message_id,
      });
      return;
    }

    await telegram.sendTyping(chatId);

    try {
      const metadata = await drive.getFileMetadata(fileId);

      if (!metadata) {
        await telegram.sendMessage({
          chat_id: chatId,
          text: createErrorMessage(
            'File not found',
            'I couldn\'t get information about this file. It might not exist, or you might not have permission to view it.'
          ),
          reply_to_message_id: message.message_id,
        });
        return;
      }

      const fileType = getReadableType(metadata.mimeType);
      const owner = metadata.owners?.[0];

      const infoText = `
<b>File Information</b>

<b>Name:</b> ${escapeHtml(metadata.name)}
<b>ID:</b> <code>${metadata.id}</code>

<b>Size:</b> ${formatFileSize(metadata.size)}
<b>Type:</b> ${fileType}
<b>MIME:</b> ${metadata.mimeType}

<b>Created:</b> ${metadata.createdTime ? formatDate(metadata.createdTime) : 'Unknown'}
<b>Modified:</b> ${metadata.modifiedTime ? formatDate(metadata.modifiedTime) : 'Unknown'}

${owner ? `<b>Owner:</b> ${escapeHtml(owner.displayName || owner.emailAddress)}` : ''}
<b>Shared:</b> ${metadata.shared ? 'Yes' : 'No'}
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: 'Open in Drive', url: metadata.webViewLink || `https://drive.google.com/open?id=${metadata.id}` },
          ],
          [
            { text: 'Copy this file', callback_data: `copy:${metadata.id}` },
          ],
        ],
      };

      await telegram.sendWithKeyboard(chatId, infoText, keyboard, message.message_id);
    } catch {
      await telegram.sendMessage({
        chat_id: chatId,
        text: createErrorMessage('Error', 'Failed to get file information. Please try again.'),
        reply_to_message_id: message.message_id,
      });
    }
  },
};

function getReadableType(mimeType: string): string {
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('audio')) return 'Audio';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('pdf')) return 'PDF Document';
  if (mimeType.includes('zip')) return 'ZIP Archive';
  if (mimeType.includes('rar')) return 'RAR Archive';
  if (mimeType.includes('folder')) return 'Folder';
  if (mimeType.includes('document')) return 'Document';
  if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
  if (mimeType.includes('presentation')) return 'Presentation';
  if (mimeType.includes('text')) return 'Text File';
  return 'File';
}
