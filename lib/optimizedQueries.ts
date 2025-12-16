import { CacheService, CachedSharedSong } from "./cacheService";
import { supabase } from "./supabase";

export interface GroupedSharedSong {
  groupKey: string;
  song_title: string;
  song_artist: string;
  song_album?: string;
  song_artwork?: string;
  external_url?: string;
  service: "spotify" | "apple";
  senders: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
  }>;
  latest_created_at: string;
  shared_song_ids: string[];
}

export interface GroupedReactedSong {
  groupKey: string;
  song_title: string;
  song_artist: string;
  song_album?: string;
  song_artwork?: string;
  external_url?: string;
  service: "spotify" | "apple";
  reaction?: "liked" | "disliked";
  senders: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
  }>;
  latest_created_at: string;
  reacted_song_ids: string[];
}

export interface PaginatedSongs<T> {
  songs: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export class OptimizedQueriesService {
  private static readonly PAGE_SIZE = 10;
  // Optimized query for inbox songs (unreacted) with pagination
  static async getInboxSongs(
    userId: string,
    cursor?: string,
    forceRefresh: boolean = false
  ): Promise<PaginatedSongs<GroupedSharedSong>> {
    try {
      // Check cache first unless force refresh is requested (only for first page)
      if (!forceRefresh && !cursor) {
        const cached = CacheService.getCachedSharedSongs(userId, 'inbox');
        if (cached) {
          const grouped = this.groupSharedSongs(cached);
          return {
            songs: grouped,
            hasMore: false // Cached results are complete
          };
        }
      }

      let query = supabase
        .from("shared_songs")
        .select(`
          id,
          song_id,
          song_title,
          song_artist,
          song_album,
          song_artwork,
          external_url,
          service,
          created_at,
          liked,
          sender:sender_id(
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .eq("receiver_id", userId)
        .is("liked", null)
        .eq("is_queued", false)
        .order("created_at", { ascending: false })
        .limit(this.PAGE_SIZE + 1); // Fetch one extra to check if there are more

      // Apply cursor if provided
      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching inbox songs:", error);
        return { songs: [], hasMore: false };
      }

      // Check if there are more results
      const hasMore = data && data.length > this.PAGE_SIZE;
      const songs = data ? data.slice(0, this.PAGE_SIZE) : [];

      const transformedData = this.transformSharedSongData(songs);
      const groupedSongs = this.groupSharedSongs(transformedData);

      // Get the cursor for the next page
      const nextCursor = hasMore && songs.length > 0 
        ? songs[songs.length - 1].created_at 
        : undefined;

      // Only cache the first page
      if (!cursor) {
        CacheService.cacheSharedSongs(userId, 'inbox', transformedData);
      }

      return {
        songs: groupedSongs,
        nextCursor,
        hasMore
      };
    } catch (error) {
      console.error("Error fetching inbox songs:", error);
      return { songs: [], hasMore: false };
    }
  }

  // Optimized query for queued songs with pagination
  static async getQueuedSongs(
    userId: string,
    cursor?: string,
    forceRefresh: boolean = false
  ): Promise<PaginatedSongs<GroupedReactedSong>> {
    try {
      // Check cache first unless force refresh is requested (only for first page)
      if (!forceRefresh && !cursor) {
        const cached = CacheService.getCachedSharedSongs(userId, 'queue');
        if (cached) {
          const grouped = this.groupReactedSongs(cached);
          return {
            songs: grouped,
            hasMore: false // Cached results are complete
          };
        }
      }

      let query = supabase
        .from("shared_songs")
        .select(`
          id,
          song_id,
          song_title,
          song_artist,
          song_album,
          song_artwork,
          external_url,
          service,
          created_at,
          liked,
          sender:sender_id(
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .eq("receiver_id", userId)
        .eq("is_queued", true)
        .is("liked", null)
        .order("created_at", { ascending: false })
        .limit(this.PAGE_SIZE + 1);

      // Apply cursor if provided
      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching queued songs:", error);
        return { songs: [], hasMore: false };
      }

      // Check if there are more results
      const hasMore = data && data.length > this.PAGE_SIZE;
      const songs = data ? data.slice(0, this.PAGE_SIZE) : [];

      const transformedData = this.transformSharedSongData(songs);
      const groupedSongs = this.groupReactedSongs(transformedData);

      // Get the cursor for the next page
      const nextCursor = hasMore && songs.length > 0 
        ? songs[songs.length - 1].created_at 
        : undefined;

      // Only cache the first page
      if (!cursor) {
        CacheService.cacheSharedSongs(userId, 'queue', transformedData);
      }

      return {
        songs: groupedSongs,
        nextCursor,
        hasMore
      };
    } catch (error) {
      console.error("Error fetching queued songs:", error);
      return { songs: [], hasMore: false };
    }
  }

  // Optimized query for archive (reacted songs) with pagination
  static async getArchiveSongs(
    userId: string,
    cursor?: string,
    forceRefresh: boolean = false
  ): Promise<PaginatedSongs<GroupedReactedSong>> {
    try {
      // Check cache first unless force refresh is requested (only for first page)
      if (!forceRefresh && !cursor) {
        const cached = CacheService.getCachedSharedSongs(userId, 'archive');
        if (cached) {
          const grouped = this.groupReactedSongs(cached);
          return {
            songs: grouped,
            hasMore: false // Cached results are complete
          };
        }
      }

      let query = supabase
        .from("shared_songs")
        .select(`
          id,
          song_id,
          song_title,
          song_artist,
          song_album,
          song_artwork,
          external_url,
          service,
          created_at,
          liked,
          sender:sender_id(
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .eq("receiver_id", userId)
        .not("liked", "is", null)
        .order("created_at", { ascending: false })
        .limit(this.PAGE_SIZE + 1);

      // Apply cursor if provided
      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching archive songs:", error);
        return { songs: [], hasMore: false };
      }

      // Check if there are more results
      const hasMore = data && data.length > this.PAGE_SIZE;
      const songs = data ? data.slice(0, this.PAGE_SIZE) : [];

      const transformedData = this.transformSharedSongData(songs);
      const groupedSongs = this.groupReactedSongs(transformedData);

      // Get the cursor for the next page
      const nextCursor = hasMore && songs.length > 0 
        ? songs[songs.length - 1].created_at 
        : undefined;

      // Only cache the first page
      if (!cursor) {
        CacheService.cacheSharedSongs(userId, 'archive', transformedData);
      }

      return {
        songs: groupedSongs,
        nextCursor,
        hasMore
      };
    } catch (error) {
      console.error("Error fetching archive songs:", error);
      return { songs: [], hasMore: false };
    }
  }

  // React to a song (like/dislike) with cache update
  static async reactToSong(
    userId: string,
    songIds: string[],
    reaction: boolean | null // true = like, false = dislike, null = unreacted
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from("shared_songs")
        .update({ liked: reaction })
        .in("id", songIds);

      if (error) {
        console.error("Error reacting to song:", error);
        return { success: false, error };
      }

      // Update cache for all affected songs
      songIds.forEach(songId => {
        CacheService.updateSharedSongReaction(userId, songId, reaction);
      });

      // If reacting to a song (liked/disliked), move it to archive
      if (reaction !== null) {
        songIds.forEach(songId => {
          // Try to move from queue first
          CacheService.moveSharedSongBetweenCaches(
            userId,
            songId,
            'queue',
            'archive',
            { liked: reaction, is_queued: false }
          );
          
          // Also try to move from inbox (only one will succeed based on where the song is)
          CacheService.moveSharedSongBetweenCaches(
            userId,
            songId,
            'inbox',
            'archive',
            { liked: reaction }
          );
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error reacting to song:", error);
      return { success: false, error };
    }
  }

  // Queue a song with cache update
  static async queueSong(
    userId: string,
    songIds: string[]
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from("shared_songs")
        .update({ is_queued: true })
        .in("id", songIds);

      if (error) {
        console.error("Error queuing song:", error);
        return { success: false, error };
      }

      // Move songs from inbox to queue cache
      songIds.forEach(songId => {
        CacheService.moveSharedSongBetweenCaches(
          userId,
          songId,
          'inbox',
          'queue',
          { is_queued: true }
        );
      });

      return { success: true };
    } catch (error) {
      console.error("Error queuing song:", error);
      return { success: false, error };
    }
  }

  // Helper function to transform raw data
  private static transformSharedSongData(data: any[]): CachedSharedSong[] {
    return data.map((song: any) => ({
      ...song,
      sender: Array.isArray(song.sender) ? song.sender[0] : song.sender,
    }));
  }

  // Helper function to group shared songs (for inbox)
  private static groupSharedSongs(songs: CachedSharedSong[]): GroupedSharedSong[] {
    const songGroups = new Map<string, GroupedSharedSong>();
    
    songs.forEach((song) => {
      const groupKey = `${song.service}-${song.song_id}`;
      if (songGroups.has(groupKey)) {
        const group = songGroups.get(groupKey)!;
        group.senders.push(song.sender);
        group.shared_song_ids.push(song.id);
      } else {
        songGroups.set(groupKey, {
          groupKey,
          song_title: song.song_title,
          song_artist: song.song_artist,
          song_album: song.song_album,
          song_artwork: song.song_artwork,
          external_url: song.external_url,
          service: song.service,
          senders: [song.sender],
          latest_created_at: song.created_at,
          shared_song_ids: [song.id],
        });
      }
    });

    return Array.from(songGroups.values());
  }

  // Helper function to group reacted songs (for queue/archive)
  private static groupReactedSongs(songs: CachedSharedSong[]): GroupedReactedSong[] {
    const songGroups = new Map<string, GroupedReactedSong>();
    
    songs.forEach((song) => {
      const groupKey = `${song.service}-${song.song_id}`;
      const reaction = song.liked === true ? "liked" : song.liked === false ? "disliked" : undefined;
      
      if (songGroups.has(groupKey)) {
        const group = songGroups.get(groupKey)!;
        group.senders.push(song.sender);
        group.reacted_song_ids.push(song.id);
      } else {
        songGroups.set(groupKey, {
          groupKey,
          song_title: song.song_title,
          song_artist: song.song_artist,
          song_album: song.song_album,
          song_artwork: song.song_artwork,
          external_url: song.external_url,
          service: song.service,
          reaction,
          senders: [song.sender],
          latest_created_at: song.created_at,
          reacted_song_ids: [song.id],
        });
      }
    });

    return Array.from(songGroups.values());
  }

  // Invalidate all shared songs cache for a user (use when major updates happen)
  static invalidateAllSharedSongsCache(userId: string): void {
    CacheService.invalidateSharedSongs(userId);
  }

  // Invalidate specific shared songs cache type
  static invalidateSharedSongsCache(userId: string, type: 'inbox' | 'queue' | 'archive'): void {
    CacheService.invalidateSharedSongs(userId, type);
  }
}