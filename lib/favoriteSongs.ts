import { CacheService } from "./cacheService";
import { supabase } from "./supabase";

export interface FavoriteSong {
  id: string;
  user_id: string;
  position: number; // 1, 2, or 3
  song_id: string;
  song_title: string;
  song_artist: string;
  song_album?: string;
  song_artwork?: string;
  service: "spotify" | "apple";
  created_at: string;
  updated_at: string;
}

export interface FavoriteSongInput {
  song_id: string;
  song_title: string;
  song_artist: string;
  song_album?: string;
  song_artwork?: string;
  service: "spotify" | "apple";
}

export class FavoriteSongsService {
  // Get all favorite songs for a user with caching
  static async getUserFavoriteSongs(
    userId: string,
    forceRefresh: boolean = false
  ): Promise<{
    success: boolean;
    songs?: FavoriteSong[];
    error?: string;
  }> {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cachedSongs = CacheService.getCachedFavoriteSongs(userId);
        if (cachedSongs) {
          return {
            success: true,
            songs: cachedSongs,
          };
        }
      }

      const { data, error } = await supabase
        .from("favorite_songs")
        .select(`
          id,
          user_id,
          position,
          song_id,
          song_title,
          song_artist,
          song_album,
          song_artwork,
          service,
          created_at,
          updated_at
        `)
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (error) {
        console.error("Error fetching favorite songs:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      const songs = data || [];

      // Cache the result
      if (songs.length > 0) {
        CacheService.cacheFavoriteSongs(userId, songs);
      }

      return {
        success: true,
        songs,
      };
    } catch (error) {
      console.error("Error fetching favorite songs:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch favorite songs",
      };
    }
  }

  // Save or update a favorite song at a specific position
  static async saveFavoriteSong(
    userId: string,
    position: number,
    song: FavoriteSongInput
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await supabase.from("favorite_songs").upsert(
        {
          user_id: userId,
          position: position,
          song_id: song.song_id,
          song_title: song.song_title,
          song_artist: song.song_artist,
          song_album: song.song_album,
          song_artwork: song.song_artwork,
          service: song.service,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,position",
        }
      );

      if (error) {
        console.error("Error saving favorite song:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      // Invalidate cache after successful update
      CacheService.invalidateFavoriteSongs(userId);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Error saving favorite song:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save favorite song",
      };
    }
  }

  // Remove a favorite song from a specific position
  static async removeFavoriteSong(
    userId: string,
    position: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await supabase
        .from("favorite_songs")
        .delete()
        .eq("user_id", userId)
        .eq("position", position);

      if (error) {
        console.error("Error removing favorite song:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      // Invalidate cache after successful removal
      CacheService.invalidateFavoriteSongs(userId);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Error removing favorite song:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove favorite song",
      };
    }
  }

  // Get favorite song at a specific position
  static async getFavoriteSongAtPosition(
    userId: string,
    position: number
  ): Promise<{
    success: boolean;
    song?: FavoriteSong;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from("favorite_songs")
        .select("*")
        .eq("user_id", userId)
        .eq("position", position)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found"
        console.error("Error fetching favorite song:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        song: data || undefined,
      };
    } catch (error) {
      console.error("Error fetching favorite song:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch favorite song",
      };
    }
  }

  // Helper function to convert song picker song to favorite song input
  static convertToFavoriteSongInput(
    song: {
      id: string;
      title: string;
      artist: string;
      album: string;
      artwork: string;
    },
    service: "spotify" | "apple"
  ): FavoriteSongInput {
    return {
      song_id: song.id,
      song_title: song.title,
      song_artist: song.artist,
      song_album: song.album,
      song_artwork: song.artwork,
      service: service,
    };
  }
}
