import { AppleMusicAndroid } from "./appleMusicAndroid";
import { MusicKitNative } from "./musicKitNative";

// Apple Music API configuration
const APPLE_MUSIC_KEY_ID = process.env.EXPO_PUBLIC_APPLE_MUSIC_KEY_ID || "";
const APPLE_MUSIC_TEAM_ID = process.env.EXPO_PUBLIC_APPLE_MUSIC_TEAM_ID || "";
const APPLE_MUSIC_PRIVATE_KEY =
  process.env.EXPO_PUBLIC_APPLE_MUSIC_PRIVATE_KEY || "";

// Apple Music API endpoints
const APPLE_MUSIC_ENDPOINTS = {
  storefront: "https://api.music.apple.com/v1/me/storefront",
  search: "https://api.music.apple.com/v1/catalog/{storefront}/search",
  library: "https://api.music.apple.com/v1/me/library",
  recommendations: "https://api.music.apple.com/v1/me/recommendations",
  recentlyPlayed: "https://api.music.apple.com/v1/me/recent/played",
};

export interface AppleMusicUser {
  id: string;
  attributes: {
    name: string;
  };
}

export interface AppleMusicTokens {
  userToken: string;
  developerToken: string;
  expiresAt: number;
}

export interface AppleMusicTrack {
  id: string;
  type: string;
  attributes: {
    name: string;
    artistName: string;
    albumName: string;
    artwork?: {
      url: string;
      width: number;
      height: number;
    };
    previews?: { url: string }[];
    url?: string;
    durationInMillis: number;
    genreNames: string[];
  };
}

export interface AppleMusicSearchResult {
  songs?: {
    data: AppleMusicTrack[];
    next?: string;
  };
  albums?: {
    data: AppleMusicAlbum[];
    next?: string;
  };
  artists?: {
    data: AppleMusicArtist[];
    next?: string;
  };
}

export interface AppleMusicPlaylist {
  id: string;
  type: "playlists";
  attributes: {
    name: string;
    description?: {
      standard: string;
    };
    artwork?: {
      url: string;
      width: number;
      height: number;
    };
    trackCount: number;
  };
}

export interface AppleMusicAlbum {
  id: string;
  type: "albums";
  attributes: {
    name: string;
    artistName: string;
    artwork?: {
      url: string;
      width: number;
      height: number;
    };
    trackCount: number;
  };
}

export interface AppleMusicArtist {
  id: string;
  type: "artists";
  attributes: {
    name: string;
  };
}

export class AppleMusicAuth {
  private developerToken: string | null = null;

  constructor() {
    console.log("🍎 Apple Music Auth initialized");
    console.log(
      "Make sure to add your Apple Music credentials to environment variables"
    );
  }

  // Android web authentication using Apple Music web API
  private async authenticateWithAndroidWeb(developerToken: string): Promise<{
    success: boolean;
    userToken?: string;
    error?: string;
  }> {
    try {
      console.log("🤖 Starting Apple Music web authentication for Android...");
      
      if (!AppleMusicAndroid.isAvailable()) {
        return {
          success: false,
          error: "Apple Music web authentication not available on this platform."
        };
      }

      // Initialize MusicKit JS first
      await AppleMusicAndroid.initialize(developerToken);
      
      const result = await AppleMusicAndroid.authenticate();
      
      if (result.success && result.userToken) {
        console.log("🤖 Apple Music Android web authentication successful");
        return {
          success: true,
          userToken: result.userToken
        };
      } else {
        console.error("🤖 Apple Music Android web authentication failed:", result.error);
        return {
          success: false,
          error: result.error || "Android web authentication failed"
        };
      }
      
    } catch (error) {
      console.error("🤖 Android web authentication error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Android web authentication failed"
      };
    }
  }

  // Generate JWT Developer Token for Apple Music API
  private async generateDeveloperToken(): Promise<string> {
    if (this.developerToken) {
      return this.developerToken;
    }

    try {
      if (!APPLE_MUSIC_KEY_ID || !APPLE_MUSIC_TEAM_ID) {
        throw new Error(
          "Apple Music credentials not configured. Please add EXPO_PUBLIC_APPLE_MUSIC_KEY_ID and EXPO_PUBLIC_APPLE_MUSIC_TEAM_ID to your environment variables."
        );
      }

      console.log("🍎 Generating Apple Music Developer Token...");
      console.log("Key ID:", APPLE_MUSIC_KEY_ID);
      console.log("Team ID:", APPLE_MUSIC_TEAM_ID);

      // Call your server endpoint to generate the JWT token
      const serverUrl =
        process.env.EXPO_PUBLIC_APPLE_MUSIC_JWT_SERVER_URL ||
        "https://platnm-token-gen.onrender.com";
      const response = await fetch(`${serverUrl}/apple-music-token`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.success || !data.token) {
        throw new Error(data.error || "Failed to generate token on server");
      }

      console.log("🍎 Successfully generated Apple Music Developer Token");
      this.developerToken = data.token;
      return data.token;
    } catch (error) {
      console.error("Developer token generation error:", error);

      // If server is not available, provide helpful instructions
      if (
        error instanceof Error &&
        (error.message.includes("fetch") || error.message.includes("Network"))
      ) {
        throw new Error(`
Apple Music JWT Server not available. Please:

1. Set up the JWT server:
   cd server
   npm install
   npm start

2. Make sure your server is running on ${process.env.EXPO_PUBLIC_APPLE_MUSIC_JWT_SERVER_URL || "https://platnm-token-gen.onrender.com"}

3. Add your .p8 private key file path to server environment variables

For detailed setup instructions, see APPLE_MUSIC_SETUP.md
        `);
      }

      throw error;
    }
  }

  // Initialize MusicKit and request user authorization
  async authenticateWithAppleMusic(): Promise<{
    success: boolean;
    tokens?: AppleMusicTokens;
    user?: AppleMusicUser;
    error?: string;
  }> {
    try {

      // Generate developer token first
      let developerToken: string;
      try {
        developerToken = await this.generateDeveloperToken();
        console.log("🍎 Developer Token:", developerToken);
      } catch (jwtError) {
        console.log("JWT generation failed:", jwtError);
        return {
          success: false,
          error:
            jwtError instanceof Error
              ? jwtError.message
              : "JWT generation failed",
        };
      }

      // Check if Apple Music is available
      if (!MusicKitNative.isAvailable()) {
        return {
          success: false,
          error: "Apple Music is not available on this platform",
        };
      }

      // iOS: Use native authentication
      if (MusicKitNative.isNativeSupported()) {
        console.log("🍎 Using native authentication for iOS...");
        
        // Request Apple Music authorization first
        console.log("🍎 Requesting Apple Music authorization...");
        const authResult = await MusicKitNative.requestAuthorization();

        if (!authResult.success) {
          return {
            success: false,
            error:
              authResult.error || `Authorization failed: ${authResult.status}`,
          };
        }

        // Request user token with the developer token
        console.log("🍎 Requesting user token with developer token...");
        const userTokenResult =
          await MusicKitNative.requestUserToken(developerToken);

        if (!userTokenResult.success || !userTokenResult.userToken) {
          return {
            success: false,
            error: userTokenResult.error || "Failed to get user token",
          };
        }

        console.log("🍎 Successfully obtained Apple Music user token");

        // Create tokens object
        const tokens: AppleMusicTokens = {
          userToken: userTokenResult.userToken,
          developerToken: developerToken,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        };

        // Create user object (we'll use a default since MusicKit doesn't provide user info directly)
        const user: AppleMusicUser = {
          id: "musickit_user_" + Date.now(),
          attributes: {
            name: "Apple Music User",
          },
        };

        console.log("🍎 Apple Music authorization completed successfully");

        return {
          success: true,
          tokens: tokens,
          user: user,
        };
      }

      // Android: Simple connection status (no tokens needed since we use Edge Function)
      else {
        console.log("🤖 Using simplified Apple Music connection for Android...");
        const androidAuthResult = await this.authenticateWithAndroidWeb(developerToken);
        
        if (!androidAuthResult.success) {
          return {
            success: false,
            error: androidAuthResult.error || "Android web authentication failed",
          };
        }

        // For Android, we just mark as connected - no tokens needed!
        // The Edge Function handles Apple Music API calls using server-side tokens
        const tokens: AppleMusicTokens = {
          userToken: "android_edge_function", // Identifier that this uses Edge Function
          developerToken: developerToken,
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year (doesn't matter)
        };

        const user: AppleMusicUser = {
          id: "android_edge_function_user_" + Date.now(),
          attributes: {
            name: "Apple Music User (Android)",
          },
        };

        console.log("🤖 Apple Music Android connection completed successfully (using Edge Function)");

        return {
          success: true,
          tokens: tokens,
          user: user,
        };
      }
    } catch (error) {
      console.error("Apple Music authentication error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  // Check if user is authorized for Apple Music
  async checkAuthorizationStatus(): Promise<{
    isAuthorized: boolean;
    hasSubscription: boolean;
  }> {
    if (!MusicKitNative.isAvailable()) {
      return {
        isAuthorized: false,
        hasSubscription: false,
      };
    }

    try {
      const [statusResult, subscriptionResult] = await Promise.all([
        MusicKitNative.checkAuthorizationStatus(),
        MusicKitNative.hasAppleMusicSubscription(),
      ]);

      return {
        isAuthorized: statusResult.isAuthorized,
        hasSubscription: subscriptionResult.hasSubscription,
      };
    } catch (error) {
      console.error("Error checking Apple Music status:", error);
      return {
        isAuthorized: false,
        hasSubscription: false,
      };
    }
  }
}

export class AppleMusicAPI {
  private userToken: string;
  private developerToken: string;

  constructor(tokens: AppleMusicTokens) {
    this.userToken = tokens.userToken;
    this.developerToken = tokens.developerToken;
  }

  // Get user's storefront (country/region)
  async getUserStorefront(): Promise<{
    success: boolean;
    storefront?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(APPLE_MUSIC_ENDPOINTS.storefront, {
        headers: {
          Authorization: `Bearer ${this.developerToken}`,
          "Music-User-Token": this.userToken,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const storefront = data.data?.[0]?.id || "us"; // Default to US

      return {
        success: true,
        storefront,
      };
    } catch (error) {
      console.error("Apple Music storefront error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get storefront",
      };
    }
  }

  // Search for tracks
  async searchTracks(
    query: string,
    limit: number = 20
  ): Promise<{
    success: boolean;
    tracks?: AppleMusicTrack[];
    error?: string;
  }> {
    try {
      const storefrontResult = await this.getUserStorefront();
      if (!storefrontResult.success) {
        throw new Error(storefrontResult.error);
      }

      const storefront = storefrontResult.storefront;
      const searchUrl =
        APPLE_MUSIC_ENDPOINTS.search.replace("{storefront}", storefront!) +
        `?term=${encodeURIComponent(query)}&types=songs&limit=${limit}`;

          // Build headers conditionally
    const headers: any = {
      Authorization: `Bearer ${this.developerToken}`,
    };

    // Only add user token if it exists and isn't empty
    if (this.userToken && this.userToken.trim().length > 0) {
      headers["Music-User-Token"] = this.userToken;
    }

    const response = await fetch(searchUrl, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: { results: AppleMusicSearchResult } = await response.json();

      return {
        success: true,
        tracks: data.results.songs?.data || [],
      };
    } catch (error) {
      console.error("Apple Music search error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  }

  // Get user's library songs
  async getUserLibrarySongs(
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    success: boolean;
    tracks?: AppleMusicTrack[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${APPLE_MUSIC_ENDPOINTS.library}/songs?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${this.developerToken}`,
            "Music-User-Token": this.userToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        tracks: data.data || [],
      };
    } catch (error) {
      console.error("Apple Music library songs error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get library songs",
      };
    }
  }

  // Get user's library playlists
  async getUserPlaylists(limit: number = 20): Promise<{
    success: boolean;
    playlists?: AppleMusicPlaylist[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${APPLE_MUSIC_ENDPOINTS.library}/playlists?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.developerToken}`,
            "Music-User-Token": this.userToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        playlists: data.data || [],
      };
    } catch (error) {
      console.error("Apple Music playlists error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get playlists",
      };
    }
  }

  // Get recently played tracks
  async getRecentlyPlayed(limit: number = 20): Promise<{
    success: boolean;
    tracks?: AppleMusicTrack[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${APPLE_MUSIC_ENDPOINTS.recentlyPlayed}/tracks?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.developerToken}`,
            "Music-User-Token": this.userToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        tracks: data.data || [],
      };
    } catch (error) {
      console.error("Apple Music recently played error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get recently played",
      };
    }
  }

  // Get recommendations
  async getRecommendations(limit: number = 20): Promise<{
    success: boolean;
    tracks?: AppleMusicTrack[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${APPLE_MUSIC_ENDPOINTS.recommendations}?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.developerToken}`,
            "Music-User-Token": this.userToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract tracks from recommendations (which can include albums, playlists, etc.)
      const tracks: AppleMusicTrack[] = [];
      data.data?.forEach((item: any) => {
        if (item.type === "songs") {
          tracks.push(item);
        } else if (item.relationships?.tracks?.data) {
          tracks.push(...item.relationships.tracks.data);
        }
      });

      return {
        success: true,
        tracks: tracks.slice(0, limit),
      };
    } catch (error) {
      console.error("Apple Music recommendations error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get recommendations",
      };
    }
  }

  // Static method for Android to search Apple Music using MusicKit JS approach
  static async searchCatalogAndroid(
    query: string, 
    limit: number = 20, 
    storefront: string = 'us'
  ): Promise<{
    success: boolean;
    tracks?: AppleMusicTrack[];
    error?: string;
  }> {
    try {
      // Use AppleMusicAndroid class that implements MusicKit JS
      const result = await AppleMusicAndroid.searchCatalog(query, limit, ['songs']);
      
      if (result.success && result.results) {
        // Convert results to AppleMusicTrack format
        const tracks: AppleMusicTrack[] = result.results.map((song: any) => ({
          id: song.id,
          type: song.type,
          attributes: {
            name: song.attributes.name,
            artistName: song.attributes.artistName,
            albumName: song.attributes.albumName,
            artwork: song.attributes.artwork,
            previews: song.attributes.previews,
            url: song.attributes.url,
            durationInMillis: song.attributes.durationInMillis,
            genreNames: song.attributes.genreNames || [],
          }
        }));

        return {
          success: true,
          tracks: tracks.slice(0, limit),
        };
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (error) {
      console.error("Apple Music Android search error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  }
}
