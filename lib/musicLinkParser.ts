export type MusicService = "spotify" | "apple" | "unknown";
export type MusicContentType =
  | "track"
  | "album"
  | "playlist"
  | "artist"
  | "unknown";

export interface ParsedMusicLink {
  service: MusicService;
  contentType: MusicContentType;
  id: string;
  originalUrl: string;
  isSupported: boolean;
  errorMessage?: string;
}

export interface MusicContent {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  service: MusicService;
  contentType: MusicContentType;
  externalUrl: string;
  trackCount?: number; // For albums/playlists
  duration?: number; // In milliseconds
  description?: string; // For playlists
}

export class MusicLinkParser {
  // Spotify URL patterns
  private static readonly SPOTIFY_PATTERNS = {
    track: /https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(\?.*)?/,
    album: /https:\/\/open\.spotify\.com\/album\/([a-zA-Z0-9]+)(\?.*)?/,
    playlist: /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)(\?.*)?/,
    artist: /https:\/\/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)(\?.*)?/,
  };

  // Apple Music URL patterns
  private static readonly APPLE_MUSIC_PATTERNS = {
    track:
      /https:\/\/music\.apple\.com\/[a-z]{2}\/album\/[^\/]+\/(\d+)\?i=(\d+)/,
    album: /https:\/\/music\.apple\.com\/[a-z]{2}\/album\/[^\/]+\/(\d+)/,
    playlist:
      /https:\/\/music\.apple\.com\/[a-z]{2}\/playlist\/[^\/]+\/pl\.([a-zA-Z0-9]+)/,
    artist: /https:\/\/music\.apple\.com\/[a-z]{2}\/artist\/[^\/]+\/(\d+)/,
  };

  /**
   * Parse a music link and extract service, content type, and ID
   */
  static parseLink(url: string): ParsedMusicLink {
    if (!url || typeof url !== "string") {
      return {
        service: "unknown",
        contentType: "unknown",
        id: "",
        originalUrl: url || "",
        isSupported: false,
        errorMessage: "Invalid URL provided",
      };
    }

    const trimmedUrl = url.trim();

    // Try Spotify patterns
    const spotifyResult = this.parseSpotifyLink(trimmedUrl);
    if (spotifyResult.isSupported) {
      return spotifyResult;
    }

    // Try Apple Music patterns
    const appleMusicResult = this.parseAppleMusicLink(trimmedUrl);
    if (appleMusicResult.isSupported) {
      return appleMusicResult;
    }

    // Check if it's a music-related URL but unsupported
    const isMusicRelated = this.isMusicRelatedUrl(trimmedUrl);

    return {
      service: "unknown",
      contentType: "unknown",
      id: "",
      originalUrl: trimmedUrl,
      isSupported: false,
      errorMessage: isMusicRelated
        ? "This music service is not supported yet"
        : "This doesn't appear to be a music link",
    };
  }

  /**
   * Parse Spotify links
   */
  private static parseSpotifyLink(url: string): ParsedMusicLink {
    for (const [contentType, pattern] of Object.entries(
      this.SPOTIFY_PATTERNS
    )) {
      const match = url.match(pattern);
      if (match) {
        return {
          service: "spotify",
          contentType: contentType as MusicContentType,
          id: match[1],
          originalUrl: url,
          isSupported: true,
        };
      }
    }

    // Check if it's a Spotify URL but unsupported format
    if (url.includes("open.spotify.com")) {
      return {
        service: "spotify",
        contentType: "unknown",
        id: "",
        originalUrl: url,
        isSupported: false,
        errorMessage: "This Spotify link format is not supported",
      };
    }

    return {
      service: "unknown",
      contentType: "unknown",
      id: "",
      originalUrl: url,
      isSupported: false,
    };
  }

  /**
   * Parse Apple Music links
   */
  private static parseAppleMusicLink(url: string): ParsedMusicLink {
    // Track (has both album ID and track ID)
    const trackMatch = url.match(this.APPLE_MUSIC_PATTERNS.track);
    if (trackMatch) {
      return {
        service: "apple",
        contentType: "track",
        id: trackMatch[2], // Track ID
        originalUrl: url,
        isSupported: true,
      };
    }

    // Album
    const albumMatch = url.match(this.APPLE_MUSIC_PATTERNS.album);
    if (albumMatch) {
      return {
        service: "apple",
        contentType: "album",
        id: albumMatch[1],
        originalUrl: url,
        isSupported: true,
      };
    }

    // Playlist
    const playlistMatch = url.match(this.APPLE_MUSIC_PATTERNS.playlist);
    if (playlistMatch) {
      return {
        service: "apple",
        contentType: "playlist",
        id: playlistMatch[1],
        originalUrl: url,
        isSupported: true,
      };
    }

    // Artist
    const artistMatch = url.match(this.APPLE_MUSIC_PATTERNS.artist);
    if (artistMatch) {
      return {
        service: "apple",
        contentType: "artist",
        id: artistMatch[1],
        originalUrl: url,
        isSupported: true,
      };
    }

    // Check if it's an Apple Music URL but unsupported format
    if (url.includes("music.apple.com")) {
      return {
        service: "apple",
        contentType: "unknown",
        id: "",
        originalUrl: url,
        isSupported: false,
        errorMessage: "This Apple Music link format is not supported",
      };
    }

    return {
      service: "unknown",
      contentType: "unknown",
      id: "",
      originalUrl: url,
      isSupported: false,
    };
  }

  /**
   * Check if URL is music-related but from unsupported service
   */
  private static isMusicRelatedUrl(url: string): boolean {
    const musicDomains = [
      "youtube.com/watch",
      "youtu.be",
      "soundcloud.com",
      "tidal.com",
      "deezer.com",
      "pandora.com",
      "amazon.com/music",
      "music.amazon.com",
      "bandcamp.com",
    ];

    return musicDomains.some((domain) => url.includes(domain));
  }

  /**
   * Get display name for music service
   */
  static getServiceDisplayName(service: MusicService): string {
    switch (service) {
      case "spotify":
        return "Spotify";
      case "apple":
        return "Apple Music";
      default:
        return "Unknown Service";
    }
  }

  /**
   * Get display name for content type
   */
  static getContentTypeDisplayName(contentType: MusicContentType): string {
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
  }

  /**
   * Generate a friendly error message for unsupported links
   */
  static getFriendlyErrorMessage(parsedLink: ParsedMusicLink): string {
    if (parsedLink.isSupported) {
      return "";
    }

    if (parsedLink.errorMessage) {
      return parsedLink.errorMessage;
    }

    if (parsedLink.service === "spotify" || parsedLink.service === "apple") {
      const serviceName = this.getServiceDisplayName(parsedLink.service);
      return `Sorry, we can't handle this ${serviceName} link format yet.`;
    }

    return "Sorry, we can't handle this type of music link yet. We support Spotify and Apple Music links.";
  }

  /**
   * Validate if we can fetch content for this parsed link
   */
  static canFetchContent(parsedLink: ParsedMusicLink): boolean {
    if (!parsedLink.isSupported) {
      return false;
    }

    // Currently we can fetch Spotify content and some Apple Music content
    if (parsedLink.service === "spotify") {
      return ["track", "album", "playlist"].includes(parsedLink.contentType);
    }

    if (parsedLink.service === "apple") {
      // Apple Music API is more restricted, but we can show basic info
      return ["track", "album", "playlist"].includes(parsedLink.contentType);
    }

    return false;
  }
}
