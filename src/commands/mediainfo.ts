// MediaInfo Command Handler

import type { TelegramMessage } from '../types/telegram';
import type { Env, BotConfig } from '../types/env';
import { TelegramClient } from '../services/telegram';
import { GoogleDriveClient } from '../services/google-drive';
import { logger } from '../utils/logger';
import { extractFileId } from '../utils/helpers';
import { analyzeMediaBuffer, formatMediaInfoForTelegram } from '../services/mediainfo';
import { uploadToPastebin } from '../services/pastebin';
import { 
  parseMediaInfo, 
  generateMediaInfoHtml, 
  generateMediaInfoImage,
  formatMediaInfoStyledText 
} from '../services/mediainfo-image';

const MAX_DOWNLOAD_SIZE = 10 * 1024 * 1024; // 10MB - enough for most media headers

interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id: number;
    [key: string]: unknown;
  };
}

interface DownloadResult {
  buffer: Uint8Array;
  fileSize: number;
  filename: string;
}

/**
 * Check if a string is a direct HTTP/HTTPS URL (not Google Drive)
 */
function isDirectUrl(input: string): boolean {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    // Exclude Google Drive URLs
    if (url.hostname.includes('drive.google.com') || 
        url.hostname.includes('docs.google.com') ||
        url.hostname === 'drive.usercontent.google.com') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract filename from URL or Content-Disposition header
 */
function extractFilenameFromUrl(url: string, headers?: Headers): string {
  // Try Content-Disposition header first
  if (headers) {
    const disposition = headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
      if (match && match[1]) {
        return match[1].replace(/['"]/g, '');
      }
    }
  }
  
  // Fall back to URL path
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.length > 0) {
      return decodeURIComponent(lastPart);
    }
  } catch {
    // Ignore URL parsing errors
  }
  
  return 'unknown';
}

/**
 * Download content from a direct HTTP/HTTPS URL
 */
async function downloadFromUrl(url: string, maxBytes: number): Promise<DownloadResult | null> {
  try {
    // First, do a HEAD request to get file size
    let fileSize = 0;
    try {
      const headResponse = await fetch(url, { method: 'HEAD' });
      if (headResponse.ok) {
        const contentLength = headResponse.headers.get('content-length');
        if (contentLength) {
          fileSize = parseInt(contentLength, 10);
        }
      }
    } catch {
      // HEAD request failed, will try GET anyway
    }

    // Download with Range header if file is large
    const headers: Record<string, string> = {};
    if (fileSize > maxBytes) {
      headers['Range'] = `bytes=0-${maxBytes - 1}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Update file size from response if not known
    if (fileSize === 0) {
      const contentLength = response.headers.get('content-length');
      const contentRange = response.headers.get('content-range');
      
      if (contentRange) {
        // Parse "bytes 0-999/5000" format
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          fileSize = parseInt(match[1], 10);
        }
      } else if (contentLength) {
        fileSize = parseInt(contentLength, 10);
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const filename = extractFilenameFromUrl(url, response.headers);

    return {
      buffer,
      fileSize: fileSize || buffer.byteLength,
      filename,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Direct URL download error:', error);
    return null;
  }
}

/**
 * /mediainfo - Analyze media file using MediaInfo WASM
 * Usage: /mediainfo <file_id_or_url>
 * Supports both Google Drive links and direct HTTP/HTTPS URLs
 */
export async function mediainfoCommand(
  message: TelegramMessage,
  telegram: TelegramClient,
  drive: GoogleDriveClient,
  env: Env,
  config: BotConfig
): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text || '';
  const args = text.split(/\s+/).slice(1).join(' ').trim();

  if (!args) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: 'Usage: /mediainfo &lt;file_id_or_url&gt;\n\n' +
        'Analyzes a media file and returns detailed technical information including:\n' +
        '- Video codec, resolution, framerate, bitrate\n' +
        '- Audio codec, channels, sample rate\n' +
        '- Subtitle tracks\n' +
        '- Container format details\n\n' +
        'Supports:\n' +
        '• Google Drive links/IDs\n' +
        '• Direct HTTP/HTTPS URLs\n\n' +
        'Examples:\n' +
        '/mediainfo 1ABC123def456\n' +
        '/mediainfo https://drive.google.com/file/d/1ABC123def456/view\n' +
        '/mediainfo https://example.com/video.mp4',
      reply_to_message_id: message.message_id,
    });
    return;
  }

  // Send loading message
  const loadingResult = await telegram.sendMessage({
    chat_id: chatId,
    text: '⏳ Analyzing...',
    reply_to_message_id: message.message_id,
  }) as TelegramResponse;

  const messageId = loadingResult?.result?.message_id;

  const updateStatus = async (status: string) => {
    if (messageId) {
      await telegram.editMessage({
        chat_id: chatId,
        message_id: messageId,
        text: status,
      });
    }
  };

  try {
    let downloadResult: DownloadResult | null = null;
    let filename = 'unknown';

    // Check if it's a direct URL or Google Drive
    if (isDirectUrl(args)) {
      // Direct HTTP/HTTPS URL
      await updateStatus('⏳ Downloading from URL...');
      
      downloadResult = await downloadFromUrl(args, MAX_DOWNLOAD_SIZE);
      if (!downloadResult) {
        const errorMessage = '❌ Failed to download from URL. The server may be unreachable, ' +
          'the file may not exist, or access may be restricted.';
        if (messageId) {
          await telegram.editMessage({ chat_id: chatId, message_id: messageId, text: errorMessage });
        } else {
          await telegram.sendMessage({ chat_id: chatId, text: errorMessage });
        }
        return;
      }
      filename = downloadResult.filename;
      
    } else {
      // Google Drive link or file ID
      const fileId = extractFileId(args);
      if (!fileId) {
        await telegram.editMessage({
          chat_id: chatId,
          message_id: messageId!,
          text: '❌ Could not extract a valid file ID from the provided input. ' +
            'Please provide a Google Drive file ID, Drive URL, or direct HTTP URL.',
        });
        return;
      }

      // Get file metadata first
      const metadata = await drive.getFileMetadata(fileId);
      if (!metadata) {
        const errorMessage = '❌ Could not access this file. It may not exist, ' +
          'or the bot may not have permission to access it.';
        if (messageId) {
          await telegram.editMessage({ chat_id: chatId, message_id: messageId, text: errorMessage });
        } else {
          await telegram.sendMessage({ chat_id: chatId, text: errorMessage });
        }
        return;
      }

      // Check if it's a folder
      if (metadata.mimeType === 'application/vnd.google-apps.folder') {
        const errorMessage = '❌ This is a folder, not a media file. ' +
          'Please provide a file ID for a video or audio file.';
        if (messageId) {
          await telegram.editMessage({ chat_id: chatId, message_id: messageId, text: errorMessage });
        } else {
          await telegram.sendMessage({ chat_id: chatId, text: errorMessage });
        }
        return;
      }

      // Check if file size is reasonable
      const fileSize = parseInt(metadata.size || '0', 10);
      if (fileSize === 0) {
        const errorMessage = '❌ This file appears to be empty or is a Google Docs file ' +
          'which cannot be analyzed with MediaInfo.';
        if (messageId) {
          await telegram.editMessage({ chat_id: chatId, message_id: messageId, text: errorMessage });
        } else {
          await telegram.sendMessage({ chat_id: chatId, text: errorMessage });
        }
        return;
      }

      await updateStatus(`⏳ Downloading ${metadata.name}...`);
      filename = metadata.name || 'unknown';

      // Download file content (first chunk for large files)
      const driveDownload = await drive.downloadFileContent(fileId, MAX_DOWNLOAD_SIZE);
      if (!driveDownload) {
        const errorMessage = '❌ Failed to download the file content. ' +
          'The file may be too large, protected, or unavailable.';
        if (messageId) {
          await telegram.editMessage({ chat_id: chatId, message_id: messageId, text: errorMessage });
        } else {
          await telegram.sendMessage({ chat_id: chatId, text: errorMessage });
        }
        return;
      }
      
      downloadResult = {
        buffer: driveDownload.buffer,
        fileSize: driveDownload.fileSize,
        filename,
      };
    }

    await updateStatus('⏳ Analyzing with MediaInfo...');

    // Analyze with MediaInfo WASM
    const analysis = await analyzeMediaBuffer(
      downloadResult.buffer,
      downloadResult.fileSize,
      filename
    );

    // Parse the result for visual display
    const parsedInfo = parseMediaInfo(analysis.result, filename);

    // Upload detailed output to pastebin
    await updateStatus('⏳ Uploading detailed report...');
    
    const detailedText = `MediaInfo Report for: ${filename}\n` +
      `Generated: ${new Date().toISOString()}\n` +
      `${'='.repeat(50)}\n\n` +
      analysis.text;
    
    const pasteResult = await uploadToPastebin(
      detailedText,
      `MediaInfo: ${filename}`
    );

    // Try to generate visual image
    await updateStatus('⏳ Generating visual report...');
    
    const html = generateMediaInfoHtml(parsedInfo);
    const imageResult = await generateMediaInfoImage(
      html,
      env.HCTI_USER_ID,
      env.HCTI_API_KEY
    );

    // Build caption with filename, size, type, and pastebin link
    const captionLines: string[] = [];
    captionLines.push(`<b>Filename:</b>`);
    captionLines.push(`<code>${filename}</code>`);
    captionLines.push('');
    captionLines.push(`<b>Size:</b> ${parsedInfo.general.size}`);
    captionLines.push('');
    captionLines.push(`<b>Type:</b> ${parsedInfo.general.container}`);
    
    if (pasteResult.success && pasteResult.url) {
      captionLines.push('');
      captionLines.push(`📋 <b>Full Report:</b> ${pasteResult.url}`);
    }
    
    const caption = captionLines.join('\n');

    // Delete the loading message
    if (messageId) {
      try {
        await telegram.deleteMessage(chatId, messageId);
      } catch {
        // Ignore delete errors
      }
    }

    if (imageResult.success && imageResult.url) {
      // Send the visual image as document
      await telegram.sendDocument({
        chat_id: chatId,
        document: imageResult.url,
        caption,
        reply_to_message_id: message.message_id,
      });
      logger.info(`MediaInfo image sent for ${filename}`);
    } else {
      // Fallback to styled text
      logger.warn(`Image generation failed: ${imageResult.error}, using text fallback`);
      
      const styledText = formatMediaInfoStyledText(parsedInfo);
      let response = `<b>Filename:</b> <code>${filename}</code>\n`;
      response += `<b>Size:</b> ${parsedInfo.general.size}\n`;
      response += `<b>Type:</b> ${parsedInfo.general.container}\n\n`;
      response += styledText;
      
      if (pasteResult.success && pasteResult.url) {
        response += `\n\n📋 <b>Full Report:</b> ${pasteResult.url}`;
      }
      
      // Telegram message limit is 4096 characters
      if (response.length > 4000) {
        const linkPart = pasteResult.success && pasteResult.url 
          ? `\n\n📋 <b>Full Report:</b> ${pasteResult.url}`
          : '';
        response = response.substring(0, 3900 - linkPart.length) + 
          '\n\n<i>[Output truncated]</i>' + linkPart;
      }
      
      await telegram.sendMessage({ 
        chat_id: chatId, 
        text: response,
        parse_mode: 'HTML',
        reply_to_message_id: message.message_id,
      });
    }

    logger.info(`MediaInfo analysis completed for ${filename}`);

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('MediaInfo command error:', error);
    
    const errorMessage = `❌ Analysis failed: ${error.message}`;
    
    if (messageId) {
      await telegram.editMessage({ chat_id: chatId, message_id: messageId, text: errorMessage });
    } else {
      await telegram.sendMessage({ chat_id: chatId, text: errorMessage });
    }
  }
}
