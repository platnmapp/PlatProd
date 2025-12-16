import { FavoriteSong } from "./favoriteSongs";
import { UserProfile, UserStats } from "./userProfile";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface Friend {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
}

export interface CachedSharedSong {
  id: string;
  song_id: string;
  song_title: string;
  song_artist: string;
  song_album?: string;
  song_artwork?: string;
  external_url?: string;
  service: "spotify" | "apple";
  created_at: string;
  liked?: boolean | null;
  is_queued: boolean;
  sender: {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

export class CacheService {
  private static cache = new Map<string, CacheEntry<any>>();
  
  // Cache expiry times (in minutes)
  private static readonly CACHE_EXPIRY = {
    PROFILE: 30,           // User profiles
    FRIENDS: 15,           // Friends list
    FAVORITE_SONGS: 60,    // Favorite songs (longer since they change less)
    SHARED_SONGS: 5,       // Shared songs (shorter since they update frequently)
    USER_STATS: 10,        // User statistics
    AVATARS: 120,          // Avatar URLs (very stable)
  };

  private static generateKey(type: string, identifier: string): string {
    return `${type}:${identifier}`;
  }

  private static isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private static setCache<T>(key: string, data: T, expiryMinutes: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (expiryMinutes * 60 * 1000),
    });
  }

  private static getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(key);
      }
      return null;
    }
    return entry.data;
  }

  // Profile caching
  static cacheUserProfile(userId: string, profile: UserProfile): void {
    this.setCache(
      this.generateKey('profile', userId),
      profile,
      this.CACHE_EXPIRY.PROFILE
    );
  }

  static getCachedUserProfile(userId: string): UserProfile | null {
    return this.getCache<UserProfile>(this.generateKey('profile', userId));
  }

  static invalidateUserProfile(userId: string): void {
    this.cache.delete(this.generateKey('profile', userId));
  }

  // User stats caching
  static cacheUserStats(userId: string, stats: UserStats): void {
    this.setCache(
      this.generateKey('stats', userId),
      stats,
      this.CACHE_EXPIRY.USER_STATS
    );
  }

  static getCachedUserStats(userId: string): UserStats | null {
    return this.getCache<UserStats>(this.generateKey('stats', userId));
  }

  static invalidateUserStats(userId: string): void {
    this.cache.delete(this.generateKey('stats', userId));
  }

  // Friends caching
  static cacheFriendsList(userId: string, friends: Friend[]): void {
    this.setCache(
      this.generateKey('friends', userId),
      friends,
      this.CACHE_EXPIRY.FRIENDS
    );
  }

  static getCachedFriendsList(userId: string): Friend[] | null {
    return this.getCache<Friend[]>(this.generateKey('friends', userId));
  }

  static invalidateFriendsList(userId: string): void {
    this.cache.delete(this.generateKey('friends', userId));
  }

  // Favorite songs caching
  static cacheFavoriteSongs(userId: string, songs: FavoriteSong[]): void {
    this.setCache(
      this.generateKey('favorites', userId),
      songs,
      this.CACHE_EXPIRY.FAVORITE_SONGS
    );
  }

  static getCachedFavoriteSongs(userId: string): FavoriteSong[] | null {
    return this.getCache<FavoriteSong[]>(this.generateKey('favorites', userId));
  }

  static invalidateFavoriteSongs(userId: string): void {
    this.cache.delete(this.generateKey('favorites', userId));
  }

  // Shared songs caching (with subcategories)
  static cacheSharedSongs(userId: string, type: 'inbox' | 'queue' | 'archive', songs: CachedSharedSong[]): void {
    this.setCache(
      this.generateKey('shared_songs', `${userId}:${type}`),
      songs,
      this.CACHE_EXPIRY.SHARED_SONGS
    );
  }

  static getCachedSharedSongs(userId: string, type: 'inbox' | 'queue' | 'archive'): CachedSharedSong[] | null {
    return this.getCache<CachedSharedSong[]>(this.generateKey('shared_songs', `${userId}:${type}`));
  }

  static invalidateSharedSongs(userId: string, type?: 'inbox' | 'queue' | 'archive'): void {
    if (type) {
      this.cache.delete(this.generateKey('shared_songs', `${userId}:${type}`));
    } else {
      // Invalidate all shared songs for user
      ['inbox', 'queue', 'archive'].forEach(songType => {
        this.cache.delete(this.generateKey('shared_songs', `${userId}:${songType}`));
      });
    }
  }

  // Avatar URL caching
  static cacheAvatarUrl(userId: string, avatarUrl: string): void {
    this.setCache(
      this.generateKey('avatar', userId),
      avatarUrl,
      this.CACHE_EXPIRY.AVATARS
    );
  }

  static getCachedAvatarUrl(userId: string): string | null {
    return this.getCache<string>(this.generateKey('avatar', userId));
  }

  static invalidateAvatarUrl(userId: string): void {
    this.cache.delete(this.generateKey('avatar', userId));
  }

  // Utility methods
  static clearAllCache(): void {
    this.cache.clear();
  }

  static clearUserCache(userId: string): void {
    // Clear all cache entries for a specific user
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  static getCacheStats(): { totalEntries: number; cacheSize: string } {
    return {
      totalEntries: this.cache.size,
      cacheSize: `${Math.round(JSON.stringify([...this.cache.entries()]).length / 1024)}KB`
    };
  }

  // Method to update cache when user reacts to songs
  static updateSharedSongReaction(userId: string, songId: string, reaction: boolean | null): void {
    // Update all relevant shared song caches
    ['inbox', 'queue', 'archive'].forEach(type => {
      const cached = this.getCachedSharedSongs(userId, type as any);
      if (cached) {
        const updated = cached.map(song => 
          song.id === songId ? { ...song, liked: reaction } : song
        );
        this.cacheSharedSongs(userId, type as any, updated);
      }
    });
  }

  // Method to move song between cache categories (e.g., inbox to queue)
  static moveSharedSongBetweenCaches(
    userId: string, 
    songId: string, 
    fromType: 'inbox' | 'queue' | 'archive',
    toType: 'inbox' | 'queue' | 'archive',
    updateFields?: Partial<CachedSharedSong>
  ): void {
    const fromCache = this.getCachedSharedSongs(userId, fromType);
    let toCache = this.getCachedSharedSongs(userId, toType) || [];
    
    if (fromCache) {
      const songIndex = fromCache.findIndex(song => song.id === songId);
      if (songIndex !== -1) {
        const song = fromCache[songIndex];
        const updatedSong = updateFields ? { ...song, ...updateFields } : song;
        
        // Remove from source cache
        fromCache.splice(songIndex, 1);
        this.cacheSharedSongs(userId, fromType, fromCache);
        
        // Add to destination cache
        toCache.unshift(updatedSong);
        this.cacheSharedSongs(userId, toType, toCache);
      }
    }
  }
}