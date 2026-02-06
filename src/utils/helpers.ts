// Utility functions

/**
 * Format bytes to human readable file size
 */
export function formatFileSize(bytes: number | string | undefined): string {
  if (!bytes) return 'Unknown';
  const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (numBytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));

  return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Extract Google Drive file ID from various URL formats
 */
export function extractFileId(link: string): string | null {
  // Handle direct file ID
  if (/^[a-zA-Z0-9_-]{25,}$/.test(link.trim())) {
    return link.trim();
  }

  // Handle various Google Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
    /\/uc\?id=([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Parse command arguments from message text
 */
export function parseCommand(text: string): { command: string; args: string; argList: string[] } {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase().replace(/^\//, '').split('@')[0];
  const argList = parts.slice(1);
  const args = argList.join(' ');
  return { command, args, argList };
}

/**
 * Generate a random string for unique identifiers
 */
export function generateId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format timestamp to readable date string
 */
export function formatDate(timestamp: number | string): string {
  const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Get readable file type label based on mime type
 */
export function getFileTypeLabel(mimeType: string): string {
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

/**
 * Get file type short code for display
 */
export function getFileTypeEmoji(mimeType: string): string {
  // Kept for backwards compatibility, returns text labels now
  return getFileTypeLabel(mimeType);
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
