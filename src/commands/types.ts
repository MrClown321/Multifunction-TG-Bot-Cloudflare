// Command handler types and base class

import type { TelegramMessage, CallbackQuery } from '../types/telegram';
import type { Env, BotConfig } from '../types/env';
import { TelegramClient, GoogleDriveClient, StorageService } from '../services';

export interface CommandContext {
  message: TelegramMessage;
  args: string;
  argList: string[];
  telegram: TelegramClient;
  drive: GoogleDriveClient;
  storage: StorageService;
  config: BotConfig;
  env: Env;
  isAdmin: boolean;
}

export interface CallbackContext {
  query: CallbackQuery;
  data: string;
  telegram: TelegramClient;
  drive: GoogleDriveClient;
  storage: StorageService;
  config: BotConfig;
  env: Env;
  isAdmin: boolean;
}

export interface CommandHandler {
  command: string;
  description: string;
  usage?: string;
  adminOnly?: boolean;
  handle(ctx: CommandContext): Promise<void>;
}

export interface CallbackHandler {
  prefix: string;
  handle(ctx: CallbackContext): Promise<void>;
}

// Response helpers - human-friendly messages without emojis
export function createSuccessMessage(title: string, content: string): string {
  return `<b>${title}</b>\n\n${content}`;
}

export function createErrorMessage(title: string, content: string): string {
  return `<b>${title}</b>\n\n${content}`;
}

export function createInfoMessage(title: string, content: string): string {
  return `<b>${title}</b>\n\n${content}`;
}

export function createWarningMessage(title: string, content: string): string {
  return `<b>${title}</b>\n\n${content}`;
}

export function createLoadingMessage(content: string): string {
  return `<b>Processing...</b>\n\n${content}`;
}
