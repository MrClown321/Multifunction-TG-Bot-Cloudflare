// Middleware for request processing

import type { TelegramUpdate } from '../types/telegram';
import type { Env, BotConfig } from '../types/env';
import { StorageService } from '../services/storage';
import { logger } from '../utils/logger';

/**
 * Verify the request is from Telegram using the secret token
 */
export function verifyTelegramWebhook(request: Request, secretToken?: string): boolean {
  if (!secretToken) return true; // No secret configured, skip verification

  const headerToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return headerToken === secretToken;
}

/**
 * Parse and validate the incoming Telegram update
 */
export async function parseUpdate(request: Request): Promise<TelegramUpdate | null> {
  try {
    const data = await request.json() as Record<string, unknown>;
    
    // Basic validation - must have update_id
    if (!data || typeof data.update_id !== 'number') {
      return null;
    }

    return data as unknown as TelegramUpdate;
  } catch (error) {
    logger.error('Failed to parse update', error as Error);
    return null;
  }
}

/**
 * Check if user is banned
 */
export async function checkBanned(
  storage: StorageService,
  userId: number
): Promise<boolean> {
  return storage.isUserBanned(userId);
}

/**
 * Check if user is admin
 */
export function isAdmin(userId: number, config: BotConfig): boolean {
  return config.adminUserIds.includes(userId);
}

/**
 * Check if user is authorized (admin or whitelisted)
 */
export function isAuthorizedUser(userId: number, config: BotConfig): boolean {
  return config.adminUserIds.includes(userId) || config.authorizedUserIds.includes(userId);
}

/**
 * Check if the message source is authorized
 * Allows:
 * - Messages from the authorized group chat
 * - DMs from admins
 * - DMs from authorized users
 */
export function isAuthorizedChat(chatId: number, userId: number | undefined, config: BotConfig): boolean {
  // If no specific chat is configured, allow all
  if (!config.authorizedChatId) return true;
  
  // Check if it's the authorized group
  if (chatId.toString() === config.authorizedChatId) return true;
  
  // Check if it's a private chat (DM) - chatId equals userId for private chats
  if (userId && chatId === userId) {
    // Allow admins in DMs
    if (config.adminUserIds.includes(userId)) return true;
    // Allow authorized users in DMs
    if (config.authorizedUserIds.includes(userId)) return true;
  }
  
  return false;
}

/**
 * Build bot configuration from environment
 */
export function buildConfig(env: Env): BotConfig {
  const adminIds = env.ADMIN_USER_IDS 
    ? env.ADMIN_USER_IDS.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id))
    : [];

  const authorizedUserIds = env.AUTHORIZED_USER_IDS
    ? env.AUTHORIZED_USER_IDS.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id))
    : [];

  return {
    botToken: env.BOT_TOKEN,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRefreshToken: env.GOOGLE_REFRESH_TOKEN,
    webhookSecret: env.WEBHOOK_SECRET,
    folderId: env.FOLDER_ID,
    indexUrl: env.INDEX_URL,
    ownerGithub: env.OWNER_GITHUB,
    ownerTelegram: env.OWNER_TELEGRAM,
    authorizedChatId: env.AUTHORIZED_CHAT_ID,
    adminUserIds: adminIds,
    authorizedUserIds: authorizedUserIds,
    dailyLimit: 50, // Default 50 copies per day
  };
}

/**
 * Rate limiting check
 */
export async function checkRateLimit(
  storage: StorageService,
  userId: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  return storage.checkRateLimit(userId, 30, 60000); // 30 requests per minute
}
