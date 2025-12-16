import { AppleMusicAPI, AppleMusicTokens } from "./appleMusic";
import { ParsedMusicLink } from "./musicLinkParser";
import { shareExtensionSupabase } from "./shareExtensionService";
import { SpotifyAPI } from "./spotify";

export interface MusicContent {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  service: "spotify" | "apple";
  contentType: "track" | "album" | "playlist";
  externalUrl?: string;
  duration?: number;
  trackCount?: number;
  description?: string;
}

export interface FetchContentResult {
  success: boolean;
  content?: MusicContent;
  error?: string;
}

export const MusicContentService = {
  /**
   * Fetch music content details based on parsed link
   */
  async fetchContent(
    parsedLink: ParsedMusicLink,
    userId?: string
  ): Promise<FetchContentResult> {
    if (!parsedLink.isSupported) {
      return {
        success: false,
        error: parsedLink.errorMessage || "Unsupported link",
      };
    }

    try {
      switch (parsedLink.service) {
        case "spotify":
          return await this.fetchSpotifyContent(parsedLink, userId);
        case "apple":
          return await this.fetchAppleMusicContent(parsedLink, userId);
        default:
          return {
            success: false,
            error: "Service not supported",
          };
      }
    } catch (error) {
      console.error("Error fetching music content:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch content",
      };
    }
  },

  /**
   * Fetch Spotify content details
   */
  async fetchSpotifyContent(
    parsedLink: ParsedMusicLink,
    userId?: string
  ): Promise<FetchContentResult> {
    // Get user's Spotify access token if userId provided
    let accessToken: string | null = null;
    if (userId) {
      accessToken = await this.getSpotifyAccessToken(userId);
    }

    if (!accessToken) {
      console.log("No Spotify access token available for user, using fallback");
      // Return basic parsed info with better messaging when no token available
      return {
        success: false,
        error:
          "No Spotify access token - connect Spotify in Profile → Link Apps for full song details",
      };
    }

    const spotifyAPI = new SpotifyAPI(accessToken);

    switch (parsedLink.contentType) {
      case "track":
        return await this.fetchSpotifyTrack(spotifyAPI, parsedLink);
      case "album":
        return await this.fetchSpotifyAlbum(spotifyAPI, parsedLink);
      case "playlist":
        return await this.fetchSpotifyPlaylist(spotifyAPI, parsedLink);
      default:
        return {
          success: false,
          error: `Spotify ${parsedLink.contentType} not supported`,
        };
    }
  },

  /**
   * Fetch Spotify track details
   */
  async fetchSpotifyTrack(
    spotifyAPI: SpotifyAPI,
    parsedLink: ParsedMusicLink
  ): Promise<FetchContentResult> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/tracks/${parsedLink.id}`,
        {
          headers: {
            Authorization: `Bearer ${(spotifyAPI as any).accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const track = await response.json();

      return {
        success: true,
        content: {
          id: track.id,
          title: track.name,
          artist: track.artists.map((a: any) => a.name).join(", "),
          album: track.album.name,
          artwork: track.album.images[0]?.url,
          service: "spotify",
          contentType: "track",
          externalUrl: parsedLink.originalUrl,
          duration: track.duration_ms,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch track",
      };
    }
  },

  /**
   * Fetch Spotify album details
   */
  async fetchSpotifyAlbum(
    spotifyAPI: SpotifyAPI,
    parsedLink: ParsedMusicLink
  ): Promise<FetchContentResult> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/albums/${parsedLink.id}`,
        {
          headers: {
            Authorization: `Bearer ${(spotifyAPI as any).accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const album = await response.json();

      return {
        success: true,
        content: {
          id: album.id,
          title: album.name,
          artist: album.artists.map((a: any) => a.name).join(", "),
          artwork: album.images[0]?.url,
          service: "spotify",
          contentType: "album",
          externalUrl: parsedLink.originalUrl,
          trackCount: album.total_tracks,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch album",
      };
    }
  },

  /**
   * Fetch Spotify playlist details
   */
  async fetchSpotifyPlaylist(
    spotifyAPI: SpotifyAPI,
    parsedLink: ParsedMusicLink
  ): Promise<FetchContentResult> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${parsedLink.id}`,
        {
          headers: {
            Authorization: `Bearer ${(spotifyAPI as any).accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const playlist = await response.json();

      return {
        success: true,
        content: {
          id: playlist.id,
          title: playlist.name,
          artist: playlist.owner.display_name,
          artwork: playlist.images[0]?.url,
          service: "spotify",
          contentType: "playlist",
          externalUrl: parsedLink.originalUrl,
          trackCount: playlist.tracks.total,
          description: playlist.description,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch playlist",
      };
    }
  },

  /**
   * Fetch Apple Music content using the new Apple Music API
   */
  async fetchAppleMusicContent(
    parsedLink: ParsedMusicLink,
    userId?: string
  ): Promise<FetchContentResult> {
    // Use the same Supabase Edge Function that iOS Share Extension uses
    // This is much more reliable than managing Apple Music tokens
    try {
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-music-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_KEY || '',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_KEY || ''}`,
        },
        body: JSON.stringify({ link: parsedLink.originalUrl })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const musicContent = await response.json();
      
      return {
        success: true,
        content: {
          type: "track", // Default to track for now
          title: musicContent.title,
          artist: musicContent.artist,
          artwork: musicContent.artworkURL,
          externalUrl: musicContent.appleMusicURL || parsedLink.originalUrl,
          service: "apple",
        }
      };
    } catch (error) {
      console.error("❌ Supabase Edge Function error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch Apple Music content",
      };
    }
  },

  /**
   * Fetch Apple Music track details
   */
  async fetchAppleMusicTrack(
    appleMusicAPI: AppleMusicAPI,
    parsedLink: ParsedMusicLink
  ): Promise<FetchContentResult> {
    try {
      // Search for the track by ID (Apple Music API doesn't have direct track lookup by ID in some cases)
      const searchResult = await appleMusicAPI.searchTracks(parsedLink.id, 1);

      if (
        !searchResult.success ||
        !searchResult.tracks ||
        searchResult.tracks.length === 0
      ) {
        return {
          success: false,
          error: "Track not found",
        };
      }

      const track = searchResult.tracks[0];

      return {
        success: true,
        content: {
          id: track.id,
          title: track.attributes.name,
          artist: track.attributes.artistName,
          album: track.attributes.albumName,
          service: "apple",
          contentType: "track",
          externalUrl: parsedLink.originalUrl,
          artwork: track.attributes.artwork?.url
            .replace("{w}", "300")
            .replace("{h}", "300"),
          duration: track.attributes.durationInMillis,
        },
      };
    } catch (error) {
      console.error("Error fetching Apple Music track:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch track",
      };
    }
  },

  /**
   * Fetch Apple Music album details
   */
  async fetchAppleMusicAlbum(
    appleMusicAPI: AppleMusicAPI,
    parsedLink: ParsedMusicLink
  ): Promise<FetchContentResult> {
    try {
      // For albums, we'll search and try to find the matching album
      const searchResult = await appleMusicAPI.searchTracks(
        `album:${parsedLink.id}`,
        1
      );

      if (
        !searchResult.success ||
        !searchResult.tracks ||
        searchResult.tracks.length === 0
      ) {
        return {
          success: false,
          error: "Album not found",
        };
      }

      const track = searchResult.tracks[0];

      return {
        success: true,
        content: {
          id: parsedLink.id,
          title: track.attributes.albumName,
          artist: track.attributes.artistName,
          service: "apple",
          contentType: "album",
          externalUrl: parsedLink.originalUrl,
          artwork: track.attributes.artwork?.url
            .replace("{w}", "300")
            .replace("{h}", "300"),
        },
      };
    } catch (error) {
      console.error("Error fetching Apple Music album:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch album",
      };
    }
  },

  /**
   * Fetch Apple Music playlist details
   */
  async fetchAppleMusicPlaylist(
    appleMusicAPI: AppleMusicAPI,
    parsedLink: ParsedMusicLink
  ): Promise<FetchContentResult> {
    try {
      const playlistsResult = await appleMusicAPI.getUserPlaylists(50);

      if (!playlistsResult.success || !playlistsResult.playlists) {
        return {
          success: false,
          error: "Failed to fetch playlists",
        };
      }

      // Find the playlist by ID
      const playlist = playlistsResult.playlists.find(
        (p) => p.id === parsedLink.id
      );

      if (!playlist) {
        return {
          success: false,
          error: "Playlist not found",
        };
      }

      return {
        success: true,
        content: {
          id: playlist.id,
          title: playlist.attributes.name,
          artist: "Apple Music Playlist",
          service: "apple",
          contentType: "playlist",
          externalUrl: parsedLink.originalUrl,
          artwork: playlist.attributes.artwork?.url
            .replace("{w}", "300")
            .replace("{h}", "300"),
          trackCount: playlist.attributes.trackCount,
          description: playlist.attributes.description?.standard,
        },
      };
    } catch (error) {
      console.error("Error fetching Apple Music playlist:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch playlist",
      };
    }
  },

  /**
   * Get user's Spotify access token
   */
  async getSpotifyAccessToken(userId: string): Promise<string | null> {
    try {
      const { data: profile, error } = await shareExtensionSupabase
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
  },

  /**
   * Get user's Apple Music tokens
   */
  async getAppleMusicTokens(userId: string): Promise<AppleMusicTokens | null> {
    try {
      const { data: profile, error } = await shareExtensionSupabase
        .from("profiles")
        .select(
          "apple_music_user_token, apple_music_developer_token, apple_music_token_expires_at"
        )
        .eq("id", userId)
        .single();

      if (
        error ||
        !profile?.apple_music_user_token ||
        !profile?.apple_music_developer_token
      ) {
        return null;
      }

      // Check if this is a demo token from Android authentication
      if (profile.apple_music_user_token.includes("android_apple_music_")) {
        return null;
      }

      // Check if token is expired
      if (profile.apple_music_token_expires_at) {
        const expiresAt = new Date(profile.apple_music_token_expires_at);
        if (expiresAt <= new Date()) {
          return null; // Token expired
        }
      }
      return {
        userToken: profile.apple_music_user_token,
        developerToken: profile.apple_music_developer_token,
        expiresAt: profile.apple_music_token_expires_at
          ? new Date(profile.apple_music_token_expires_at).getTime()
          : Date.now() + 24 * 60 * 60 * 1000, // Default to 24 hours if not set
      };
    } catch (error) {
      console.error("Error getting Apple Music tokens:", error);
      return null;
    }
  },

  /**
   * Get display name for content type
   */
  getContentTypeDisplayName(contentType: string): string {
    switch (contentType) {
      case "track":
        return "Song";
      case "album":
        return "Album";
      case "playlist":
        return "Playlist";
      case "artist":
        return "Artist";
      default:
        return "Content";
    }
  },

  /**
   * Create a shareable song object from music content
   */
  createShareableSong(content: MusicContent) {
    return {
      id: content.id,
      title: content.title,
      artist: content.artist || "Unknown Artist",
      album: content.album,
      artwork: content.artwork,
      service: content.service,
      external_url: content.externalUrl,
    };
  },
};
