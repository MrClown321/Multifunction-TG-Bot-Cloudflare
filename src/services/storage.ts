// KV Storage Service for state management

import type { UserSession, RateLimitEntry, BotStats, CacheEntry } from '../types/env';
import { getTodayDate } from '../utils/helpers';
import { logger } from '../utils/logger';

export class StorageService {
  private readonly kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  // ==================== User Session Management ====================

  private getUserKey(userId: number): string {
    return `user:${userId}`;
  }

  async getUser(userId: number): Promise<UserSession | null> {
    try {
      const data = await this.kv.get(this.getUserKey(userId), 'json');
      return data as UserSession | null;
    } catch {
      return null;
    }
  }

  async saveUser(session: UserSession): Promise<void> {
    await this.kv.put(this.getUserKey(session.userId), JSON.stringify(session), {
      expirationTtl: 86400 * 30, // 30 days
    });
  }

  async getOrCreateUser(userId: number, username?: string): Promise<UserSession> {
    let session = await this.getUser(userId);
    const today = getTodayDate();

    if (!session) {
      session = {
        userId,
        username,
        language: 'en',
        lastActivity: Date.now(),
        commandCount: 0,
        totalCommands: 0,
        dailySearches: 0,
        dailyCopies: 0,
        lastSearchDate: today,
        preferences: {
          notifications: true,
          searchLimit: 10,
          autoPreview: false,
        },
        favorites: [],
        recentActivity: [],
      };
    } else {
      // Reset daily counters if new day
      if (session.lastSearchDate !== today) {
        session.dailySearches = 0;
        session.dailyCopies = 0;
        session.lastSearchDate = today;
      }
      session.lastActivity = Date.now();
      if (username) session.username = username;
      // Ensure new fields exist
      session.favorites = session.favorites || [];
      session.recentActivity = session.recentActivity || [];
      session.totalCommands = session.totalCommands || session.commandCount;
    }

    await this.saveUser(session);
    return session;
  }

  async incrementUserCommand(userId: number): Promise<void> {
    const session = await this.getUser(userId);
    if (session) {
      session.commandCount++;
      session.totalCommands = (session.totalCommands || 0) + 1;
      await this.saveUser(session);
    }
  }

  async incrementDailySearch(userId: number): Promise<number> {
    const session = await this.getUser(userId);
    if (session) {
      session.dailySearches++;
      await this.saveUser(session);
      return session.dailySearches;
    }
    return 0;
  }

  async incrementDailyCopy(userId: number): Promise<number> {
    const session = await this.getUser(userId);
    if (session) {
      session.dailyCopies++;
      await this.saveUser(session);
      return session.dailyCopies;
    }
    return 0;
  }

  async checkDailyLimit(userId: number, limit: number): Promise<boolean> {
    const session = await this.getUser(userId);
    if (!session) return true;
    return (session.dailyCopies || 0) < limit;
  }

  async addRecentActivity(
    userId: number,
    activity: { action: 'copy' | 'search' | 'info' | 'list'; fileId?: string; name?: string; query?: string }
  ): Promise<void> {
    const session = await this.getUser(userId);
    if (session) {
      session.recentActivity = session.recentActivity || [];
      session.recentActivity.unshift({
        ...activity,
        timestamp: Date.now(),
      });
      // Keep only last 20 activities
      session.recentActivity = session.recentActivity.slice(0, 20);
      await this.saveUser(session);
    }
  }

  // ==================== Rate Limiting ====================

  private getRateLimitKey(userId: number): string {
    return `ratelimit:${userId}`;
  }

  async checkRateLimit(
    userId: number,
    maxRequests: number = 30,
    windowMs: number = 60000
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const key = this.getRateLimitKey(userId);
    const now = Date.now();

    let entry = await this.kv.get<RateLimitEntry>(key, 'json');

    if (!entry || now - entry.firstRequest > windowMs) {
      // Start new window
      entry = { count: 1, firstRequest: now, lastRequest: now };
      await this.kv.put(key, JSON.stringify(entry), { expirationTtl: Math.ceil(windowMs / 1000) + 10 });
      return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    if (entry.count >= maxRequests) {
      const resetIn = windowMs - (now - entry.firstRequest);
      return { allowed: false, remaining: 0, resetIn };
    }

    entry.count++;
    entry.lastRequest = now;
    await this.kv.put(key, JSON.stringify(entry), { expirationTtl: Math.ceil(windowMs / 1000) + 10 });

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetIn: windowMs - (now - entry.firstRequest),
    };
  }

  // ==================== User Blacklist/Whitelist ====================

  async isUserBanned(userId: number): Promise<boolean> {
    const result = await this.kv.get(`banned:${userId}`);
    return result !== null;
  }

  async banUser(userId: number, reason: string): Promise<void> {
    await this.kv.put(`banned:${userId}`, JSON.stringify({ reason, timestamp: Date.now() }));
  }

  async unbanUser(userId: number): Promise<void> {
    await this.kv.delete(`banned:${userId}`);
  }

  // ==================== Authorized Users (for DM access) ====================

  async isUserAuthorized(userId: number): Promise<boolean> {
    const result = await this.kv.get(`authorized:${userId}`);
    return result !== null;
  }

  async authorizeUser(userId: number, authorizedBy: number): Promise<void> {
    await this.kv.put(`authorized:${userId}`, JSON.stringify({ authorizedBy, timestamp: Date.now() }));
  }

  async deauthorizeUser(userId: number): Promise<void> {
    await this.kv.delete(`authorized:${userId}`);
  }

  async getAuthorizedUsers(): Promise<number[]> {
    // List all authorized users from KV
    const list = await this.kv.list({ prefix: 'authorized:' });
    return list.keys.map(key => parseInt(key.name.replace('authorized:', ''))).filter(id => !isNaN(id));
  }

  // ==================== Bot Statistics ====================

  async getStats(): Promise<BotStats> {
    const stats = await this.kv.get<BotStats>('bot:stats', 'json');
    return (
      stats || {
        totalUsers: 0,
        totalSearches: 0,
        totalCopies: 0,
        activeToday: 0,
        lastUpdated: Date.now(),
      }
    );
  }

  async updateStats(update: Partial<BotStats>): Promise<void> {
    const stats = await this.getStats();
    const updated = { ...stats, ...update, lastUpdated: Date.now() };
    await this.kv.put('bot:stats', JSON.stringify(updated));
  }

  async incrementStat(key: 'totalSearches' | 'totalCopies' | 'totalUsers'): Promise<void> {
    const stats = await this.getStats();
    stats[key]++;
    await this.updateStats(stats);
  }

  // ==================== Search Cache ====================

  async cacheSearchResults(query: string, results: unknown, ttlSeconds: number = 300): Promise<void> {
    const key = `cache:search:${query.toLowerCase().trim()}`;
    const entry: CacheEntry<unknown> = {
      data: results,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    };
    await this.kv.put(key, JSON.stringify(entry), { expirationTtl: ttlSeconds });
  }

  async getCachedSearch(query: string): Promise<unknown | null> {
    const key = `cache:search:${query.toLowerCase().trim()}`;
    const entry = await this.kv.get<CacheEntry<unknown>>(key, 'json');

    if (!entry) return null;

    // Check if still valid
    if (Date.now() - entry.timestamp > entry.ttl) {
      return null;
    }

    return entry.data;
  }

  // ==================== Pagination State ====================

  async savePaginationState(
    chatId: number,
    messageId: number,
    state: {
      query: string;
      pageToken?: string;
      page: number;
      results: unknown[];
    }
  ): Promise<void> {
    const key = `pagination:${chatId}:${messageId}`;
    await this.kv.put(key, JSON.stringify(state), { expirationTtl: 3600 }); // 1 hour
  }

  async getPaginationState(
    chatId: number,
    messageId: number
  ): Promise<{ query: string; pageToken?: string; page: number; results: unknown[] } | null> {
    const key = `pagination:${chatId}:${messageId}`;
    return this.kv.get(key, 'json');
  }
}
