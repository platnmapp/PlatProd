import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

// Spotify API configuration
const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET || "";

// Define the scopes we need for Spotify
const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-library-read",
  "user-library-modify",
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "playlist-modify-public",
  "playlist-modify-private",
].join(" ");

// Create redirect URI based on platform
const getRedirectUri = () => {
  if (Platform.OS === "web") {
    // Web / Localhost callback (Expo Web or manual testing)
    return "http://127.0.0.1:19006/callback";
  }

  // Native (development & production): use a specific callback path accepted by Spotify dashboard
  // Result: platnm://spotify-callback
  return AuthSession.makeRedirectUri({
    scheme: "platnm",
    path: "spotify-callback",
  });
};

// Spotify API endpoints
const SPOTIFY_ENDPOINTS = {
  authorize: "https://accounts.spotify.com/authorize",
  token: "https://accounts.spotify.com/api/token",
  user: "https://api.spotify.com/v1/me",
};

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string; height: number; width: number }>;
  country: string;
  product: string;
}

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string; height: number; width: number }>;
  tracks: {
    total: number;
  };
}

export class SpotifyAuth {
  private redirectUri: string;

  constructor() {
    this.redirectUri = getRedirectUri();
    console.log("🎵 Spotify Redirect URI:", this.redirectUri);
    console.log(
      "👆 Add this URI to your Spotify app's redirect URIs in the Spotify Developer Dashboard"
    );
  }

  // Generate PKCE code challenge for security
  private async generateCodeChallenge(): Promise<{
    codeVerifier: string;
    codeChallenge: string;
  }> {
    const codeVerifier =
      Crypto.randomUUID().replace(/-/g, "") +
      Crypto.randomUUID().replace(/-/g, "");
    const codeChallengeDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    return {
      codeVerifier,
      codeChallenge: codeChallengeDigest
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, ""),
    };
  }

  // Start Spotify OAuth flow
  async authenticateWithSpotify(): Promise<{
    success: boolean;
    tokens?: SpotifyTokens;
    user?: SpotifyUser;
    error?: string;
  }> {
    try {
      if (!SPOTIFY_CLIENT_ID) {
        throw new Error("Spotify Client ID not configured");
      }

      // Generate PKCE challenge
      const { codeVerifier, codeChallenge } =
        await this.generateCodeChallenge();

      // Create auth request
      const authRequestConfig: AuthSession.AuthRequestConfig = {
        clientId: SPOTIFY_CLIENT_ID,
        scopes: SPOTIFY_SCOPES.split(" "),
        redirectUri: this.redirectUri,
        responseType: AuthSession.ResponseType.Code,
        extraParams: {
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        },
      };

      const authRequest = new AuthSession.AuthRequest(authRequestConfig);

      // Start the authentication session
      const authResult = await authRequest.promptAsync({
        authorizationEndpoint: SPOTIFY_ENDPOINTS.authorize,
      });

      console.log("Spotify auth result:", authResult);

      if (authResult.type !== "success") {
        return {
          success: false,
          error:
            authResult.type === "cancel"
              ? "User cancelled authentication"
              : "Authentication failed",
        };
      }

      // Exchange authorization code for access token
      const tokenResult = await this.exchangeCodeForTokens(
        authResult.params.code,
        codeVerifier
      );

      if (!tokenResult.success || !tokenResult.tokens) {
        return {
          success: false,
          error: tokenResult.error || "Failed to get access tokens",
        };
      }

      // Get user profile
      const userResult = await this.getSpotifyUser(
        tokenResult.tokens.access_token
      );

      if (!userResult.success || !userResult.user) {
        return {
          success: false,
          error: userResult.error || "Failed to get user profile",
        };
      }

      return {
        success: true,
        tokens: tokenResult.tokens,
        user: userResult.user,
      };
    } catch (error) {
      console.error("Spotify authentication error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // Exchange authorization code for access tokens
  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string
  ): Promise<{ success: boolean; tokens?: SpotifyTokens; error?: string }> {
    try {
      const response = await fetch(SPOTIFY_ENDPOINTS.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: this.redirectUri,
          client_id: SPOTIFY_CLIENT_ID,
          code_verifier: codeVerifier,
        }).toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Token exchange error:", data);
        return {
          success: false,
          error:
            data.error_description ||
            data.error ||
            "Failed to exchange code for tokens",
        };
      }

      return {
        success: true,
        tokens: data as SpotifyTokens,
      };
    } catch (error) {
      console.error("Token exchange error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Network error during token exchange",
      };
    }
  }

  // Get Spotify user profile
  private async getSpotifyUser(
    accessToken: string
  ): Promise<{ success: boolean; user?: SpotifyUser; error?: string }> {
    try {
      console.log(
        "Fetching Spotify user profile with token:",
        accessToken.substring(0, 20) + "..."
      );

      const response = await fetch(SPOTIFY_ENDPOINTS.user, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("Spotify user profile response status:", response.status);
      console.log("Spotify user profile response headers:", response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Spotify user profile HTTP error:",
          response.status,
          errorText
        );

        // Try to parse as JSON if possible, otherwise use the text
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          return {
            success: false,
            error: `HTTP ${response.status}: ${errorText || response.statusText}`,
          };
        }

        return {
          success: false,
          error:
            errorData.error?.message ||
            `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const responseText = await response.text();
      console.log(
        "Spotify user profile response text:",
        responseText.substring(0, 200) + "..."
      );

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(
          "Failed to parse Spotify user profile response as JSON:",
          parseError
        );
        console.error("Response text:", responseText);
        return {
          success: false,
          error: "Invalid JSON response from Spotify API",
        };
      }

      console.log("Spotify user profile data:", data);

      return {
        success: true,
        user: data as SpotifyUser,
      };
    } catch (error) {
      console.error("User profile error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Network error while getting user profile",
      };
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean;
    tokens?: Partial<SpotifyTokens>;
    error?: string;
  }> {
    try {
      // Use client credentials for token refresh (Basic auth)
      const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
      
      const response = await fetch(SPOTIFY_ENDPOINTS.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }).toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Token refresh error:", data);
        return {
          success: false,
          error:
            data.error_description || data.error || "Failed to refresh token",
        };
      }

      return {
        success: true,
        tokens: data,
      };
    } catch (error) {
      console.error("Token refresh error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Network error during token refresh",
      };
    }
  }
}

export class SpotifyAPI {
  private accessToken: string;
  private refreshToken?: string;
  private userId?: string;
  private onTokenRefresh?: (newToken: string, expiresAt: string) => Promise<void>;

  constructor(
    accessToken: string,
    refreshToken?: string,
    userId?: string,
    onTokenRefresh?: (newToken: string, expiresAt: string) => Promise<void>
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.userId = userId;
    this.onTokenRefresh = onTokenRefresh;
  }

  // Refresh access token if needed
  private async ensureValidToken(): Promise<boolean> {
    // If we have a refresh token and callback, try to refresh
    if (this.refreshToken && this.onTokenRefresh && this.userId) {
      try {
        const auth = new SpotifyAuth();
        const result = await auth.refreshAccessToken(this.refreshToken);
        
        if (result.success && result.tokens?.access_token) {
          this.accessToken = result.tokens.access_token;
          
          // Calculate expiration time (default 1 hour if not provided)
          const expiresIn = result.tokens.expires_in || 3600;
          const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
          
          // Update the token in the database
          await this.onTokenRefresh(this.accessToken, expiresAt);
          
          return true;
        }
      } catch (error) {
        console.error("Error refreshing Spotify token:", error);
      }
    }
    
    return false;
  }

  // Search for tracks
  async searchTracks(
    query: string,
    limit: number = 20
  ): Promise<{
    success: boolean;
    tracks?: SpotifyTrack[];
    error?: string;
  }> {
    try {
      let response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      // If we get a 401 or 403, try refreshing the token
      if ((response.status === 401 || response.status === 403) && await this.ensureValidToken()) {
        // Retry the request with the new token
        response = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          // Use the default error message
        }
        
        throw new Error(errorMessage);
      }

      const data: SpotifySearchResult = await response.json();

      return {
        success: true,
        tracks: data.tracks.items,
      };
    } catch (error) {
      console.error("Spotify search error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  }

  // Get user's saved tracks
  async getUserSavedTracks(
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    success: boolean;
    tracks?: SpotifyTrack[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        tracks: data.items.map((item: any) => item.track),
      };
    } catch (error) {
      console.error("Spotify saved tracks error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get saved tracks",
      };
    }
  }

  // Get user's top tracks
  async getUserTopTracks(
    limit: number = 20,
    timeRange: "short_term" | "medium_term" | "long_term" = "medium_term"
  ): Promise<{
    success: boolean;
    tracks?: SpotifyTrack[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        tracks: data.items,
      };
    } catch (error) {
      console.error("Spotify top tracks error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get top tracks",
      };
    }
  }

  // Get user's playlists
  async getUserPlaylists(limit: number = 20): Promise<{
    success: boolean;
    playlists?: SpotifyPlaylist[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/playlists?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        playlists: data.items,
      };
    } catch (error) {
      console.error("Spotify playlists error:", error);
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
    tracks?: SpotifyTrack[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        tracks: data.items.map((item: any) => item.track),
      };
    } catch (error) {
      console.error("Spotify recently played error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get recently played",
      };
    }
  }

  async getArtists(
    artistIds: string[]
  ): Promise<{ success: boolean; artists?: SpotifyArtist[]; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: "Access token not set" };
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/artists?ids=${artistIds.join(",")}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || "Failed to fetch artists",
        };
      }

      const data = await response.json();
      return { success: true, artists: data.artists };
    } catch (error) {
      console.error("Error fetching artists from Spotify:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  }
}
