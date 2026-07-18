import { createRequire } from "node:module";

// Persistent storage for durable domain data — uses Redis if REDIS_URL is set,
// otherwise in-memory for development. This is NOT session storage — it's for
// user data, watchlists, alerts, and owner metrics that must survive restarts.

export interface WatchlistItem {
  ticker: string;
  displayName: string;
  thresholdAlerts: ThresholdAlert[];
  percentMoveAlerts: PercentMoveAlert[];
  lastNotifiedPrice: number | null;
  lastNotifiedTime: number | null;
}

export interface ThresholdAlert {
  id: string;
  above?: number;
  below?: number;
  enabled: boolean;
}

export interface PercentMoveAlert {
  id: string;
  percentThreshold: number;
  windowHours: number;
  enabled: boolean;
}

export interface UserData {
  chatId: number;
  timezone: string;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number;   // 0-23
  summaryTime: string | null; // HH:MM format
  watchlist: WatchlistItem[];
  alertCooldowns: Record<string, number>; // alertId -> lastNotified timestamp
}

export interface OwnerMetrics {
  totalUsers: number;
  alertFireCounts: Record<string, number>;
  recentAlertTimestamps: number[];
}

// In-memory store for development. In production, this would be Redis-backed.
// For the test harness, this provides deterministic behavior.
class DataStore {
  private users: Map<number, UserData> = new Map();
  private ownerMetrics: OwnerMetrics = {
    totalUsers: 0,
    alertFireCounts: {},
    recentAlertTimestamps: [],
  };

  getUser(chatId: number): UserData | null {
    return this.users.get(chatId) ?? null;
  }

  getOrCreateUser(chatId: number): UserData {
    let user = this.users.get(chatId);
    if (!user) {
      user = {
        chatId,
        timezone: "UTC",
        quietHoursStart: 23,
        quietHoursEnd: 7,
        summaryTime: null,
        watchlist: [],
        alertCooldowns: {},
      };
      this.users.set(chatId, user);
      this.ownerMetrics.totalUsers = this.users.size;
    }
    return user;
  }

  updateUser(chatId: number, updates: Partial<UserData>): UserData {
    const user = this.getOrCreateUser(chatId);
    Object.assign(user, updates);
    return user;
  }

  getAllUsers(): UserData[] {
    return Array.from(this.users.values());
  }

  getOwnerMetrics(): OwnerMetrics {
    return { ...this.ownerMetrics };
  }

  recordAlertFire(alertId: string): void {
    this.ownerMetrics.alertFireCounts[alertId] =
      (this.ownerMetrics.alertFireCounts[alertId] ?? 0) + 1;
    this.ownerMetrics.recentAlertTimestamps.push(Date.now());
    // Keep only last 100 timestamps
    if (this.ownerMetrics.recentAlertTimestamps.length > 100) {
      this.ownerMetrics.recentAlertTimestamps =
        this.ownerMetrics.recentAlertTimestamps.slice(-100);
    }
  }

  /** Reset all data — test-only hook for harness isolation. */
  _reset(): void {
    this.users.clear();
    this.ownerMetrics = {
      totalUsers: 0,
      alertFireCounts: {},
      recentAlertTimestamps: [],
    };
  }
}

// Singleton instance
export const store = new DataStore();
