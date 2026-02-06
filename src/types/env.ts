// Environment and Configuration Types

export interface Env {
  // Cloudflare KV Namespace for state management
  BOT_KV: KVNamespace;

  // Secrets (set via wrangler secret put)
  BOT_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  WEBHOOK_SECRET?: string;

  // Image generation API (htmlcsstoimage.com) - optional
  HCTI_USER_ID?: string;
  HCTI_API_KEY?: string;

  // Environment Variables
  FOLDER_ID: string;
  INDEX_URL: string;
  OWNER_GITHUB: string;
  OWNER_TELEGRAM: string;
  AUTHORIZED_CHAT_ID: string;
  ADMIN_USER_IDS: string; // Comma-separated list of admin user IDs
  AUTHORIZED_USER_IDS?: string; // Comma-separated list of authorized user IDs for DM access
}

export interface BotConfig {
  botToken: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  webhookSecret?: string;
  folderId: string;
  indexUrl: string;
  ownerGithub: string;
  ownerTelegram: string;
  authorizedChatId: string;
  adminUserIds: number[];
  authorizedUserIds: number[];
  dailyLimit: number;
}

export interface UserSession {
  userId: number;
  username?: string;
  language: string;
  lastActivity: number;
  commandCount: number;
  totalCommands: number;
  dailySearches: number;
  dailyCopies: number;
  lastSearchDate: string;
  preferences: UserPreferences;
  favorites: FavoriteItem[];
  recentActivity: RecentActivityItem[];
}

export interface FavoriteItem {
  id: string;
  name: string;
  addedAt: number;
}

export interface RecentActivityItem {
  action: 'copy' | 'search' | 'info' | 'list';
  fileId?: string;
  name?: string;
  query?: string;
  timestamp: number;
}

export interface UserPreferences {
  notifications: boolean;
  searchLimit: number;
  autoPreview: boolean;
}

export interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

export interface BotStats {
  totalUsers: number;
  totalSearches: number;
  totalCopies: number;
  activeToday: number;
  lastUpdated: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
