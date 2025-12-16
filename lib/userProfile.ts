import { CacheService } from "./cacheService";
import { supabase } from "./supabase";

export interface UserProfile {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
  onboarding_completed: boolean;

  // Spotify data
  spotify_user_id?: string;
  spotify_display_name?: string;
  spotify_email?: string;
  spotify_access_token?: string;
  spotify_refresh_token?: string;
  spotify_token_expires_at?: string;
  spotify_connected_at?: string;

  // Apple Music data
  apple_music_user_id?: string;
  apple_music_user_name?: string;
  apple_music_user_token?: string;
  apple_music_developer_token?: string;
  apple_music_token_expires_at?: string;
  apple_music_connected?: boolean;
  apple_music_connected_at?: string;

  created_at: string;
  updated_at: string;
}

export interface UserStats {
  friends_count: number;
  songs_sent_count: number;
  likes_received_count: number;
  streak_days: number;
}

export class UserProfileService {
  // Fetch complete user profile with caching
  static async getUserProfile(
    userId: string,
    forceRefresh: boolean = false
  ): Promise<{ profile: UserProfile | null; error: any }> {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cachedProfile = CacheService.getCachedUserProfile(userId);
        if (cachedProfile) {
          return { profile: cachedProfile, error: null };
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          first_name,
          last_name,
          username,
          avatar_url,
          onboarding_completed,
          spotify_user_id,
          spotify_display_name,
          spotify_email,
          spotify_access_token,
          spotify_refresh_token,
          spotify_token_expires_at,
          spotify_connected_at,
          apple_music_user_id,
          apple_music_user_name,
          apple_music_user_token,
          apple_music_developer_token,
          apple_music_token_expires_at,
          apple_music_connected,
          apple_music_connected_at,
          created_at,
          updated_at
        `)
        .eq("id", userId)
        .single();

      if (!error && data) {
        // Cache the result
        CacheService.cacheUserProfile(userId, data);
      }

      return { profile: data, error };
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return { profile: null, error };
    }
  }

  // Fetch basic user profile (for lists and minimal displays)
  static async getBasicUserProfile(
    userId: string,
    forceRefresh: boolean = false
  ): Promise<{ profile: Pick<UserProfile, 'id' | 'first_name' | 'last_name' | 'username' | 'avatar_url'> | null; error: any }> {
    try {
      // Check if we have a full profile cached first
      if (!forceRefresh) {
        const cachedProfile = CacheService.getCachedUserProfile(userId);
        if (cachedProfile) {
          const { id, first_name, last_name, username, avatar_url } = cachedProfile;
          return { profile: { id, first_name, last_name, username, avatar_url }, error: null };
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, avatar_url")
        .eq("id", userId)
        .single();

      return { profile: data, error };
    } catch (error) {
      console.error("Error fetching basic user profile:", error);
      return { profile: null, error };
    }
  }

  // Get user display name (first + last name or username as fallback)
  static getDisplayName(profile: UserProfile): string {
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile.first_name) {
      return profile.first_name;
    }
    if (profile.username) {
      return profile.username;
    }
    return "User";
  }

  // Get user's full name
  static getFullName(profile: UserProfile): string {
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile.first_name || profile.username || "User";
  }

  // Check if Spotify is connected and token is valid
  static isSpotifyConnected(profile: UserProfile): boolean {
    if (!profile.spotify_access_token || !profile.spotify_token_expires_at) {
      return false;
    }

    const expiresAt = new Date(profile.spotify_token_expires_at);
    const now = new Date();

    return expiresAt > now;
  }

  // Check if Apple Music is connected and token is valid
  static isAppleMusicConnected(profile: UserProfile): boolean {
    if (!profile.apple_music_user_token || !profile.apple_music_connected) {
      return false;
    }

    // Check if token is expired (if expiration date is available)
    if (profile.apple_music_token_expires_at) {
      const expiresAt = new Date(profile.apple_music_token_expires_at);
      const now = new Date();

      if (expiresAt <= now) {
        return false;
      }
    }

    return true;
  }

  // Check if any music service is connected
  static hasConnectedMusicService(profile: UserProfile): boolean {
    return (
      this.isSpotifyConnected(profile) || this.isAppleMusicConnected(profile)
    );
  }

  // Get connected music services
  static getConnectedMusicServices(profile: UserProfile): string[] {
    const services: string[] = [];
    if (this.isSpotifyConnected(profile)) {
      services.push("spotify");
    }
    if (this.isAppleMusicConnected(profile)) {
      services.push("apple");
    }
    return services;
  }

  // Get user stats from database with caching
  static async getUserStats(userId: string, forceRefresh: boolean = false): Promise<UserStats> {
    // Check cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedStats = CacheService.getCachedUserStats(userId);
      if (cachedStats) {
        return cachedStats;
      }
    }
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
        .neq("receiver_id", userId); // Exclude songs sent to self

      if (sentSongsError) {
        console.error("Error fetching sent songs:", sentSongsError);
      }

      const songs_sent_count = sentSongs?.length || 0;

      // Count likes received on songs sent by this user to others (excluding self-sent songs and self-likes)
      const { data: likedSongs, error: likedSongsError } = await supabase
        .from("shared_songs")
        .select("id")
        .eq("sender_id", userId)
        .neq("receiver_id", userId) // Exclude songs sent to self
        .eq("liked", true);

      if (likedSongsError) {
        console.error("Error fetching liked songs:", likedSongsError);
      }

      const likes_received_count = likedSongs?.length || 0;

      // Calculate activity streak (consecutive days with any activity)
      let streak_days = 0;
      try {
        // Get all activities for the user (songs sent, received, liked) ordered by date
        const { data: activities, error: activitiesError } = await supabase
          .from("shared_songs")
          .select("created_at")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order("created_at", { ascending: false });

        if (!activitiesError && activities && activities.length > 0) {
          // Group activities by date and calculate consecutive days
          const activityDates = new Set();
          activities.forEach((activity) => {
            const date = new Date(activity.created_at).toDateString();
            activityDates.add(date);
          });

          const sortedDates = Array.from(activityDates).sort(
            (a, b) =>
              new Date(b as string).getTime() - new Date(a as string).getTime()
          );

          // Calculate consecutive days from today
          const today = new Date().toDateString();
          let currentDate = new Date();

          for (const activityDate of sortedDates) {
            const checkDate = currentDate.toDateString();
            if (activityDate === checkDate) {
              streak_days++;
              currentDate.setDate(currentDate.getDate() - 1);
            } else {
              break;
            }
          }
        }
      } catch (streakError) {
        console.error("Error calculating streak:", streakError);
        streak_days = 0;
      }

      const stats = {
        friends_count,
        songs_sent_count,
        likes_received_count,
        streak_days,
      };

      // Cache the result
      CacheService.cacheUserStats(userId, stats);

      return stats;
    } catch (error) {
      console.error("Error fetching user stats:", error);
      const defaultStats = {
        friends_count: 0,
        songs_sent_count: 0,
        likes_received_count: 0,
        streak_days: 0,
      };
      return defaultStats;
    }
  }

  // Update user profile
  static async updateUserProfile(
    userId: string,
    updates: Partial<Omit<UserProfile, "id" | "created_at">>
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        // Invalidate cache when profile is updated
        CacheService.invalidateUserProfile(userId);
        
        // If avatar was updated, also invalidate avatar cache
        if (updates.avatar_url !== undefined) {
          CacheService.invalidateAvatarUrl(userId);
        }
      }

      return { success: !error, error };
    } catch (error) {
      console.error("Error updating user profile:", error);
      return { success: false, error };
    }
  }

  // Get user avatar URL with fallback
  static getAvatarUrl(profile: UserProfile): string {
    if (profile.avatar_url) {
      return profile.avatar_url;
    }

    // Use Spotify avatar if available
    if (profile.spotify_user_id) {
      // For now, return placeholder - could fetch from Spotify API
      return "";
    }

    // Return placeholder
    return "";
  }

  static async updateFavoriteSongs(userId: string, songs: any[]) {
    try {
      // First, delete existing favorite songs for this user
      const { error: deleteError } = await supabase
        .from("favorite_songs")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Then insert the new favorite songs
      if (songs.length > 0) {
        const favoriteSongsData = songs.map((song, index) => ({
          user_id: userId,
          position: index + 1, // positions are 1-based
          song_id: song.id,
          song_title: song.title,
          song_artist: song.artist,
          song_album: song.album || null,
          song_artwork: song.artwork || null,
          service: song.service,
        }));

        const { error: insertError } = await supabase
          .from("favorite_songs")
          .insert(favoriteSongsData);

        if (insertError) throw insertError;
      }

      // Invalidate favorite songs cache after successful update
      CacheService.invalidateFavoriteSongs(userId);
    } catch (error) {
      console.error("Error updating favorite songs:", error);
      throw new Error("Could not update favorite songs in the database.");
    }
  }
}
