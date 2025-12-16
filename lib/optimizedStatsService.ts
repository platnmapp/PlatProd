// ===================================================================
// OPTIMIZED STATS SERVICE
// ===================================================================
// This service replaces expensive COUNT queries with optimized snapshot-based queries
// Uses daily_stats table for historical data + real-time calculations for today

import { supabase } from './supabase';

export interface OptimizedUserStats {
  friends_count: number;
  songs_sent_count: number;
  likes_received_count: number;
  hit_rate_percentage: number;
  streak_days: number;
  
  // Additional detailed stats
  songs_received_count?: number;
  likes_given_count?: number;
  activities_count?: number;
  
  // Debug info
  last_snapshot_date?: string;
  data_source: 'optimized' | 'fallback';
}

export interface DailyStatSnapshot {
  id: string;
  user_id: string;
  stat_date: string;
  songs_sent_count: number;
  songs_received_count: number;
  likes_given_count: number;
  likes_received_count: number;
  hit_rate_percentage: number;
  activities_count: number;
  friend_requests_sent: number;
  friend_requests_received: number;
  had_activity: boolean;
  created_at: string;
  updated_at: string;
}

export class OptimizedStatsService {
  
  /**
   * Get user stats using optimized approach:
   * 1. Try to use database function with snapshots
   * 2. Fall back to direct calculation if needed
   */
  static async getUserStats(
    userId: string, 
    forceRealTime: boolean = false
  ): Promise<OptimizedUserStats> {
    
    if (!forceRealTime) {
      try {
        // Try optimized approach first
        const optimizedStats = await this.getOptimizedStats(userId);
        if (optimizedStats) {
          return optimizedStats;
        }
      } catch (error) {
        console.warn('Optimized stats failed, falling back to real-time calculation:', error);
      }
    }
    
    // Fall back to real-time calculation
    return await this.getRealTimeStats(userId);
  }

  /**
   * Get stats using database function (snapshots + today's real-time)
   */
  private static async getOptimizedStats(userId: string): Promise<OptimizedUserStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_optimized_user_stats', {
        target_user_id: userId
      });

      if (error) {
        console.error('Error calling get_optimized_user_stats:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        friends_count: data.friends_count || 0,
        songs_sent_count: data.songs_sent_count || 0,
        likes_received_count: data.likes_received_count || 0,
        hit_rate_percentage: data.hit_rate_percentage || 0,
        streak_days: data.streak_days || 0,
        last_snapshot_date: data.last_snapshot_date,
        data_source: 'optimized'
      };

    } catch (error) {
      console.error('Error in getOptimizedStats:', error);
      return null;
    }
  }

  /**
   * Fall back to real-time calculation (original expensive method)
   * This is the same logic as the original UserProfileService.getUserStats
   */
  private static async getRealTimeStats(userId: string): Promise<OptimizedUserStats> {
    try {
      // Count accepted friendships (both directions)
      const { data: friendships, error: friendsError } = await supabase
        .from("friendships")
        .select("id")
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (friendsError) {
        console.error("Error fetching friendships:", friendsError);
      }

      const friends_count = friendships?.length || 0;

      // Count songs sent by this user (excluding songs sent to themselves)
      const { data: sentSongs, error: sentSongsError } = await supabase
        .from("shared_songs")
        .select("id")
        .eq("sender_id", userId)
        .neq("receiver_id", userId);

      if (sentSongsError) {
        console.error("Error fetching sent songs:", sentSongsError);
      }

      const songs_sent_count = sentSongs?.length || 0;

      // Count likes received on songs sent by this user to others
      const { data: likedSongs, error: likedSongsError } = await supabase
        .from("shared_songs")
        .select("id")
        .eq("sender_id", userId)
        .neq("receiver_id", userId)
        .eq("liked", true);

      if (likedSongsError) {
        console.error("Error fetching liked songs:", likedSongsError);
      }

      const likes_received_count = likedSongs?.length || 0;

      // Calculate hit rate
      const hit_rate_percentage = songs_sent_count > 0 
        ? (likes_received_count / songs_sent_count) * 100 
        : 0;

      // Calculate activity streak (simplified version)
      const streak_days = await this.calculateActivityStreak(userId);

      return {
        friends_count,
        songs_sent_count,
        likes_received_count,
        hit_rate_percentage: Math.round(hit_rate_percentage * 100) / 100, // Round to 2 decimal places
        streak_days,
        data_source: 'fallback'
      };

    } catch (error) {
      console.error("Error calculating real-time stats:", error);
      
      // Return default stats on error
      return {
        friends_count: 0,
        songs_sent_count: 0,
        likes_received_count: 0,
        hit_rate_percentage: 0,
        streak_days: 0,
        data_source: 'fallback'
      };
    }
  }

  /**
   * Calculate activity streak using daily_stats table if available
   */
  private static async calculateActivityStreak(userId: string): Promise<number> {
    try {
      // Try to use the database function first
      const { data, error } = await supabase.rpc('calculate_activity_streak', {
        target_user_id: userId
      });

      if (!error && typeof data === 'number') {
        return data;
      }

      // Fall back to simplified calculation
      return await this.calculateStreakFallback(userId);

    } catch (error) {
      console.error('Error calculating activity streak:', error);
      return 0;
    }
  }

  /**
   * Simplified streak calculation fallback
   */
  private static async calculateStreakFallback(userId: string): Promise<number> {
    let streak = 0;
    const today = new Date();
    
    // Check last 30 days for activity (performance limit)
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      // Check if user had any activity on this date
      const { data: activities, error } = await supabase
        .from('shared_songs')
        .select('id')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lt('created_at', `${dateStr}T23:59:59Z`)
        .limit(1);

      if (error || !activities || activities.length === 0) {
        break; // No activity found, streak ends
      }

      streak++;
    }

    return streak;
  }

  /**
   * Get detailed daily stats for a user (last 30 days)
   */
  static async getUserDailyStats(
    userId: string,
    days: number = 30
  ): Promise<DailyStatSnapshot[]> {
    try {
      const { data, error } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('user_id', userId)
        .order('stat_date', { ascending: false })
        .limit(days);

      if (error) {
        console.error('Error fetching daily stats:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('Error in getUserDailyStats:', error);
      return [];
    }
  }

  /**
   * Get aggregated stats for date range
   */
  static async getStatsForDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    total_songs_sent: number;
    total_songs_received: number;
    total_likes_given: number;
    total_likes_received: number;
    average_hit_rate: number;
    active_days: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('user_id', userId)
        .gte('stat_date', startDate)
        .lte('stat_date', endDate);

      if (error) {
        console.error('Error fetching date range stats:', error);
        return {
          total_songs_sent: 0,
          total_songs_received: 0,
          total_likes_given: 0,
          total_likes_received: 0,
          average_hit_rate: 0,
          active_days: 0
        };
      }

      const stats = data || [];
      
      const totals = stats.reduce((acc, day) => ({
        total_songs_sent: acc.total_songs_sent + day.songs_sent_count,
        total_songs_received: acc.total_songs_received + day.songs_received_count,
        total_likes_given: acc.total_likes_given + day.likes_given_count,
        total_likes_received: acc.total_likes_received + day.likes_received_count,
        active_days: acc.active_days + (day.had_activity ? 1 : 0)
      }), {
        total_songs_sent: 0,
        total_songs_received: 0,
        total_likes_given: 0,
        total_likes_received: 0,
        active_days: 0
      });

      const average_hit_rate = totals.total_songs_sent > 0 
        ? (totals.total_likes_received / totals.total_songs_sent) * 100 
        : 0;

      return {
        ...totals,
        average_hit_rate: Math.round(average_hit_rate * 100) / 100
      };

    } catch (error) {
      console.error('Error in getStatsForDateRange:', error);
      return {
        total_songs_sent: 0,
        total_songs_received: 0,
        total_likes_given: 0,
        total_likes_received: 0,
        average_hit_rate: 0,
        active_days: 0
      };
    }
  }

  /**
   * Force update today's stats for a user
   */
  static async updateTodayStats(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('calculate_daily_stats_for_user', {
        target_user_id: userId,
        target_date: new Date().toISOString().split('T')[0]
      });

      if (error) {
        console.error('Error updating today stats:', error);
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error in updateTodayStats:', error);
      return false;
    }
  }
}