import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { CacheService } from "./cacheService";
import { supabase } from "./supabase"; // Import main supabase client

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

// Create a separate client for share extension to avoid conflicts
// Note: For demo/testing in main app, we'll use the main supabase client for database operations
export const shareExtensionSupabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: false, // Disable auto-refresh in extension
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export interface SharedSong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  service: "spotify" | "apple";
  external_url?: string;
}

export interface Friend {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
}

export class ShareExtensionService {
  /**
   * Extract song ID from music URLs (same logic as iOS Share Extension)
   */
  private static extractSongId(spotifyURL?: string, appleMusicURL?: string): string {
    // Extract Spotify track ID
    if (spotifyURL) {
      const trackMatch = spotifyURL.match(/track\/([a-zA-Z0-9]+)/);
      if (trackMatch) {
        return trackMatch[1];
      }
    }
    
    // Extract Apple Music ID
    if (appleMusicURL) {
      const idMatch = appleMusicURL.match(/\/([0-9]+)/);
      if (idMatch) {
        return idMatch[1];
      }
    }
    
    // Fallback to URL itself if we can't extract ID
    return spotifyURL || appleMusicURL || "unknown";
  }

  // Get current user session
  static async getCurrentUser() {
    try {
      // Use main supabase client for better session consistency in demo mode
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session?.user) {
        return null;
      }
      return session.user;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  // Get user's friends list with caching
  static async getUserFriends(userId: string, forceRefresh: boolean = false): Promise<Friend[]> {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cachedFriends = CacheService.getCachedFriendsList(userId);
        if (cachedFriends) {
          return cachedFriends;
        }
      }

      // First, get the friendship relationships with minimal data
      const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("user_id, friend_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (friendshipsError) {
        console.error("Error fetching friendships:", friendshipsError);
        return [];
      }

      if (!friendships || friendships.length === 0) {
        return [];
      }

      // Extract friend IDs (excluding current user)
      const friendIds = friendships
        .map(friendship => 
          friendship.user_id === userId ? friendship.friend_id : friendship.user_id
        )
        .filter(id => id !== userId);

      if (friendIds.length === 0) {
        return [];
      }

      // Fetch friend profiles with only necessary columns
      const { data: friends, error: friendsError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, avatar_url")
        .in("id", friendIds);

      if (friendsError) {
        console.error("Error fetching friend profiles:", friendsError);
        return [];
      }

      const friendsList = friends || [];

      // Cache the result
      if (friendsList.length > 0) {
        CacheService.cacheFriendsList(userId, friendsList);
      }

      return friendsList;
    } catch (error) {
      console.error("Error getting user friends:", error);
      return [];
    }
  }

  // Get Spotify track details using access token
  static async getSpotifyTrackDetails(
    trackId: string,
    accessToken: string
  ): Promise<SharedSong | null> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const track = await response.json();

      return {
        id: track.id,
        title: track.name,
        artist: track.artists.map((a: any) => a.name).join(", "),
        album: track.album.name,
        artwork: track.album.images[0]?.url,
        service: "spotify",
        external_url: track.external_urls.spotify,
      };
    } catch (error) {
      console.error("Error fetching Spotify track details:", error);
      return null;
    }
  }

  // Get user's Spotify access token
  static async getUserSpotifyToken(userId: string): Promise<string | null> {
    try {
      // Use main supabase client for database operations
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("spotify_access_token, spotify_token_expires_at")
        .eq("id", userId)
        .single();

      if (error || !profile?.spotify_access_token) {
        return null;
      }

      // Check if token is expired
      if (profile.spotify_token_expires_at) {
        const expiresAt = new Date(profile.spotify_token_expires_at);
        if (expiresAt <= new Date()) {
          return null; // Token expired
        }
      }

      return profile.spotify_access_token;
    } catch (error) {
      console.error("Error getting Spotify token:", error);
      return null;
    }
  }

  // Share song with selected friends
  static async shareSongWithFriends(
    senderId: string,
    song: SharedSong,
    friendIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Extract proper song ID from URLs (fixes null constraint error)
      const extractedSongId = this.extractSongId(
        song.service === "spotify" ? song.external_url : undefined,
        song.service === "apple" ? song.external_url : undefined
      );

      // Create shared_songs records for each friend
      const sharedSongs = friendIds.map((friendId) => ({
        sender_id: senderId,
        receiver_id: friendId,
        song_id: song.id || extractedSongId, // Use extracted ID if song.id is missing
        song_title: song.title,
        song_artist: song.artist,
        song_album: song.album,
        song_artwork: song.artwork,
        service: song.service,
        external_url: song.external_url,
        is_queued: friendId === senderId, // Mark as queued if sending to self
      }));

      // Use main supabase client for database operations to ensure proper authentication
      const { error: sharedSongsError } = await supabase
        .from("shared_songs")
        .upsert(sharedSongs, {
          onConflict: "sender_id,receiver_id,song_id,service",
        });

      if (sharedSongsError) {
        console.error("Error creating shared songs:", sharedSongsError);
        return { success: false, error: sharedSongsError.message };
      }

      // Create activity records for each friend (excluding self)
      const activities = friendIds
        .filter((friendId) => friendId !== senderId)
        .map((friendId) => ({
          user_id: friendId, // Friend receives the activity
          actor_id: senderId, // Current user is the actor
          type: "song_sent",
          song_title: song.title,
          song_artist: song.artist,
          song_album: song.album,
          song_artwork: song.artwork,
          song_id: song.id,
          song_service: song.service,
          song_external_url: song.external_url,
          is_actionable: true,
          is_completed: false,
        }));

      // Use main supabase client for database operations
      if (activities.length > 0) {
        const { error: activitiesError } = await supabase
          .from("activities")
          .insert(activities);

        if (activitiesError) {
          console.error("Error creating activities:", activitiesError);
          // Don't fail the whole operation if activity creation fails
          console.warn(
            "Song shared but failed to create activity notifications"
          );
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Error sharing song:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to share song",
      };
    }
  }

  // Get display name for a friend
  static getDisplayName(friend: Friend): string {
    if (friend.first_name && friend.last_name) {
      return `${friend.first_name} ${friend.last_name}`;
    }
    if (friend.first_name) {
      return friend.first_name;
    }
    if (friend.username) {
      return friend.username;
    }
    return "User";
  }

  // Get initials for a friend
  static getUserInitials(friend: Friend): string {
    if (friend.first_name) {
      return friend.first_name[0].toUpperCase();
    }
    if (friend.username) {
      return friend.username[0].toUpperCase();
    }
    return "U";
  }
}
