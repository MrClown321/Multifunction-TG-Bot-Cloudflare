/**
 * Advanced Telegram Bot for Google Drive Management
 * Running on Cloudflare Workers
 * 
 * Features:
 * - Google Drive file search and cloning
 * - Rate limiting and user session management
 * - Admin commands for moderation
 * - QR code generation and URL shortening
 * - Inline keyboard pagination
 * - Comprehensive error handling
 * - Structured logging
 */

import type { Env } from './types/env';
import type { TelegramUpdate } from './types/telegram';
import { TelegramClient, GoogleDriveClient, StorageService } from './services';
import { handleCommand, handleCallback } from './commands';
import type { CommandContext, CallbackContext } from './commands';
import {
  verifyTelegramWebhook,
  parseUpdate,
  checkBanned,
  isAdmin,
  isAuthorizedChat,
  buildConfig,
} from './middleware';
import { parseCommand, logger } from './utils';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Webhook setup endpoint (GET request with token param)
    if (url.pathname === '/setWebhook' && request.method === 'GET') {
      const token = url.searchParams.get('token');
      if (token !== env.BOT_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }

      const webhookUrl = `${url.origin}/webhook`;
      const telegram = new TelegramClient(env.BOT_TOKEN);

      try {
        await telegram.setWebhook(webhookUrl, env.WEBHOOK_SECRET);
        return new Response(
          JSON.stringify({ success: true, webhookUrl }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: (error as Error).message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Main webhook endpoint
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env, ctx);
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const startTime = Date.now();
  const config = buildConfig(env);

  // Verify webhook secret
  if (!verifyTelegramWebhook(request, config.webhookSecret)) {
    logger.warn('Invalid webhook secret');
    return new Response('Unauthorized', { status: 401 });
  }

  // Parse the update
  const update = await parseUpdate(request);
  if (!update) {
    return new Response('OK', { status: 200 });
  }

  // Initialize services
  const telegram = new TelegramClient(config.botToken);
  const drive = new GoogleDriveClient(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRefreshToken
  );
  const storage = new StorageService(env.BOT_KV);

  try {
    // Handle callback queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update, telegram, drive, storage, config, env);
      return new Response('OK', { status: 200 });
    }

    // Handle regular messages
    if (update.message) {
      await handleMessage(update, telegram, drive, storage, config, env, startTime);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    logger.error('Error handling update', error as Error, { 
      userId: update.message?.from?.id || update.callback_query?.from?.id 
    });
    return new Response('OK', { status: 200 }); // Always return 200 to Telegram
  }
}

async function handleMessage(
  update: TelegramUpdate,
  telegram: TelegramClient,
  drive: GoogleDriveClient,
  storage: StorageService,
  config: ReturnType<typeof buildConfig>,
  env: Env,
  startTime: number
): Promise<void> {
  const message = update.message!;
  const userId = message.from?.id;
  const chatId = message.chat.id;
  const messageText = message.text;

  // Skip if no text
  if (!messageText) return;

  // Check authorization (group chat or authorized DM user)
  let isAllowed = isAuthorizedChat(chatId, userId, config);
  
  // If not allowed by config, also check KV-stored authorized users for DMs
  if (!isAllowed && userId && chatId === userId) {
    isAllowed = await storage.isUserAuthorized(userId);
  }
  
  if (!isAllowed) {
    // Send a friendly message for unauthorized DM attempts
    if (userId && chatId === userId) {
      await telegram.sendMessage({
        chat_id: chatId,
        text: 'Sorry, you\'re not authorized to use this bot in DMs. Please contact an admin if you need access.',
        reply_to_message_id: message.message_id,
      });
    }
    logger.info('Unauthorized access attempt', { chatId, userId });
    return;
  }

  // Check if user is banned
  if (userId && await checkBanned(storage, userId)) {
    await telegram.sendMessage({
      chat_id: chatId,
      text: 'Sorry, but you\'ve been banned from using this bot. If you think this is a mistake, please contact an administrator.',
      reply_to_message_id: message.message_id,
    });
    return;
  }

  // Update user session
  if (userId) {
    await storage.getOrCreateUser(userId, message.from?.username);
    await storage.incrementUserCommand(userId);
  }

  // Check if it's a command
  if (!messageText.startsWith('/')) {
    return; // Not a command, ignore
  }

  // Parse the command
  const { command, args, argList } = parseCommand(messageText);

  // Build command context
  const ctx: CommandContext = {
    message,
    args,
    argList,
    telegram,
    drive,
    storage,
    config,
    env,
    isAdmin: userId ? isAdmin(userId, config) : false,
  };

  // Execute the command
  await handleCommand(command, ctx);

  // Log the command execution
  const duration = Date.now() - startTime;
  logger.command(command, userId || 0, chatId, duration);
}

async function handleCallbackQuery(
  update: TelegramUpdate,
  telegram: TelegramClient,
  drive: GoogleDriveClient,
  storage: StorageService,
  config: ReturnType<typeof buildConfig>,
  env: Env
): Promise<void> {
  const query = update.callback_query!;
  const userId = query.from.id;
  const data = query.data || '';

  // Check if user is banned
  if (await checkBanned(storage, userId)) {
    await telegram.answerCallbackQuery({
      callback_query_id: query.id,
      text: 'You are banned from using this bot.',
      show_alert: true,
    });
    return;
  }

  // Build callback context
  const ctx: CallbackContext = {
    query,
    data,
    telegram,
    drive,
    storage,
    config,
    env,
    isAdmin: isAdmin(userId, config),
  };

  // Handle the callback
  await handleCallback(ctx);
}
