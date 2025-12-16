import { Alert, Linking } from 'react-native';
import { UserProfile, UserProfileService } from './userProfile';

// Define interfaces for search results
export interface SearchResultTrack {
  id: string;
  name?: string; // Spotify format
  title?: string; // Alternative format
  artist: string;
  artwork?: string;
  url: string;
  attributes?: {
    name: string;
    artistName: string;
    artwork?: {
      url: string;
    };
    url: string;
  }; // Apple Music format
  external_urls?: {
    spotify: string;
  }; // Spotify format
  artists?: Array<{
    name: string;
  }>; // Spotify format
  album?: {
    images?: Array<{
      url: string;
    }>;
  }; // Spotify format
}

// Global state for managing search results modal
let searchResultsCallback: ((
  results: SearchResultTrack[],
  targetService: 'spotify' | 'apple',
  originalMetadata: { title: string; artist: string }
) => void) | null = null;

export interface MusicUrlHandlerResult {
  success: boolean;
  error?: string;
}

/**
 * Utility class for handling music service URLs and deep linking
 */
export class MusicUrlHandler {
  /**
   * Open a music URL in the appropriate app
   * First tries to open in the native app, falls back to web browser
   */
  static async openMusicUrl(url: string, service?: 'spotify' | 'apple'): Promise<MusicUrlHandlerResult> {
    if (!url) {
      return {
        success: false,
        error: 'No URL provided'
      };
    }

    try {
      // Detect service from URL if not provided
      const detectedService = service || this.detectService(url);
      const serviceName = this.getServiceDisplayName(detectedService);
      
      // Try to open in native app first
      const nativeAppUrl = this.getNativeAppUrl(url, detectedService);
      if (nativeAppUrl) {
        try {
          const canOpenNative = await Linking.canOpenURL(nativeAppUrl);
          if (canOpenNative) {
            await Linking.openURL(nativeAppUrl);
            return { success: true };
          }
        } catch (nativeError) {
          console.log(`Native app opening failed for ${serviceName}:`, nativeError);
          // Continue to web fallback
        }
      }

      // Fall back to opening in browser
      try {
        const canOpenWeb = await Linking.canOpenURL(url);
        if (canOpenWeb) {
          await Linking.openURL(url);
          return { success: true };
        }
      } catch (webError) {
        console.log(`Web browser opening failed:`, webError);
      }

      // If we get here, both native and web failed
      return {
        success: false,
        error: `Unable to open ${serviceName}. Make sure the ${serviceName} app is installed or try opening the link in your browser.`
      };

    } catch (error) {
      console.error('Error opening music URL:', error);
      
      // Check for specific URL scheme errors
      if (error instanceof Error && error.message.includes('LSApplicationQueriesSchemes')) {
        return {
          success: false,
          error: 'App configuration error. Please update the app to enable music service integration.'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open music link'
      };
    }
  }

  /**
   * Show an alert and open the music URL when user confirms
   * Enhanced to show cross-platform options when user has multiple services connected
   */
  static async openWithConfirmation(
    url: string, 
    service?: 'spotify' | 'apple',
    songTitle?: string,
    userId?: string
  ): Promise<void> {
    const detectedService = service || this.detectService(url);
    const serviceName = this.getServiceDisplayName(detectedService);
    const title = songTitle ? `"${songTitle}"` : 'this song';
    
    // Check if user has multiple music services connected to show cross-platform options
    let userProfile: UserProfile | null = null;
    if (userId) {
      try {
        const result = await UserProfileService.getUserProfile(userId);
        userProfile = result.profile;
      } catch (error) {
        console.log('Could not fetch user profile for cross-platform options:', error);
      }
    }
    
    const buttons: any[] = [
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ];
    
    // Add original service option
    buttons.push({
      text: `Open ${serviceName}`,
      onPress: async () => {
        const result = await this.openMusicUrl(url, service);
        if (!result.success) {
          // Show error with fallback option
          Alert.alert(
            'Unable to Open',
            result.error || 'Could not open music link',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Open in Browser',
                onPress: async () => {
                  try {
                    await Linking.openURL(url);
                  } catch (browserError) {
                    Alert.alert('Error', 'Could not open link in browser');
                  }
                }
              }
            ]
          );
        }
      }
    });
    
    // Add cross-platform option if user has other services connected
    if (userProfile) {
      const hasSpotify = UserProfileService.isSpotifyConnected(userProfile);
      const hasAppleMusic = UserProfileService.isAppleMusicConnected(userProfile);
      
      if (detectedService === 'spotify' && hasAppleMusic) {
        buttons.push({
          text: 'Open in Apple Music',
          onPress: async () => {
            await this.mapAndOpen(url, 'apple', songTitle);
          }
        });
      } else if (detectedService === 'apple' && hasSpotify) {
        buttons.push({
          text: 'Open in Spotify',
          onPress: async () => {
            await this.mapAndOpen(url, 'spotify', songTitle);
          }
        });
      }
    }
    
    Alert.alert(
      `Open ${title}`,
      `Choose how you'd like to open this song:`,
      buttons
    );
  }

  /**
   * Detect music service from URL
   */
  private static detectService(url: string): 'spotify' | 'apple' | 'unknown' {
    if (url.includes('spotify.com')) return 'spotify';
    if (url.includes('music.apple.com')) return 'apple';
    return 'unknown';
  }

  /**
   * Get native app URL for deep linking
   */
  private static getNativeAppUrl(webUrl: string, service: 'spotify' | 'apple' | 'unknown'): string | null {
    switch (service) {
      case 'spotify':
        // Convert Spotify web URL to app URL
        // https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC -> spotify:track:4uLU6hMCjMI75M1A2tKUQC
        const spotifyMatch = webUrl.match(/https:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/);
        if (spotifyMatch) {
          return `spotify:${spotifyMatch[1]}:${spotifyMatch[2]}`;
        }
        break;
        
      case 'apple':
        // For Apple Music, we use the web URL directly as iOS handles the app switching
        // Apple Music app will automatically open if installed
        return webUrl;
        
      default:
        return null;
    }
    
    return null;
  }

  /**
   * Get display name for service
   */
  private static getServiceDisplayName(service: 'spotify' | 'apple' | 'unknown'): string {
    switch (service) {
      case 'spotify':
        return 'Spotify';
      case 'apple':
        return 'Apple Music';
      default:
        return 'Music App';
    }
  }

  /**
   * Check if URL is a valid music service URL
   */
  static isValidMusicUrl(url: string): boolean {
    if (!url) return false;
    return this.detectService(url) !== 'unknown';
  }

  /**
   * Get the service icon name for display
   */
  static getServiceIcon(service: 'spotify' | 'apple' | 'unknown'): 'play-circle-outline' | 'logo-apple' | 'musical-notes' {
    switch (service) {
      case 'spotify':
        return 'play-circle-outline';
      case 'apple':
        return 'logo-apple';
      default:
        return 'musical-notes';
    }
  }

  /**
   * Map and open a song URL in an alternative music service
   */
  static async mapAndOpen(
    sourceUrl: string, 
    targetService: 'spotify' | 'apple',
    songTitle?: string
  ): Promise<void> {
    try {
      const sourceService = this.detectService(sourceUrl);
      
      if (sourceService === 'unknown') {
        Alert.alert('Error', 'Unable to detect source music service');
        return;
      }

      if (sourceService === targetService) {
        Alert.alert('Info', `This song is already from ${this.getServiceDisplayName(targetService)}`);
        return;
      }

      if (sourceService === 'spotify' && targetService === 'apple') {
        // Spotify → Apple Music mapping
        await this.handleCrossPlatformMapping(sourceUrl, 'spotify', 'apple', songTitle);
      } else if (sourceService === 'apple' && targetService === 'spotify') {
        // Apple Music → Spotify mapping
        await this.handleCrossPlatformMapping(sourceUrl, 'apple', 'spotify', songTitle);
      } else {
        Alert.alert(
          'Not Supported',
          `Cross-platform mapping from ${this.getServiceDisplayName(sourceService)} to ${this.getServiceDisplayName(targetService)} is not supported`
        );
      }
    } catch (error) {
      console.error('Error in mapAndOpen:', error);
      Alert.alert(
        'Error',
        'An error occurred while trying to map the song to another service'
      );
    }
  }

  /**
   * Handle cross-platform mapping with fallback search
   */
  private static async handleCrossPlatformMapping(
    sourceUrl: string,
    sourceService: 'spotify' | 'apple',
    targetService: 'spotify' | 'apple',
    songTitle?: string
  ): Promise<void> {
    try {
      // First, try ISRC-based exact matching
      let targetUrl: string | null = null;
      let isrc: string | null = null;

      if (sourceService === 'spotify') {
        isrc = await this.getIsrcFromSpotify(sourceUrl);
        if (isrc) {
          targetUrl = await this.getAppleMusicUrlByIsrc(isrc);
        }
      } else if (sourceService === 'apple') {
        isrc = await this.getIsrcFromAppleMusic(sourceUrl);
        if (isrc) {
          targetUrl = await this.getSpotifyUrlByIsrc(isrc);
        }
      }

      // If exact match found, show confirmation and open
      if (targetUrl) {
        const title = songTitle ? `"${songTitle}"` : 'this song';
        const targetServiceName = this.getServiceDisplayName(targetService);
        
        Alert.alert(
          `Open in ${targetServiceName}`,
          `Found exact match! Would you like to open ${title} in ${targetServiceName}?`,
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: `Open ${targetServiceName}`,
              onPress: async () => {
                const result = await this.openMusicUrl(targetUrl!, targetService);
                if (!result.success) {
                  Alert.alert('Error', result.error || `Failed to open ${targetServiceName}`);
                }
              }
            }
          ]
        );
        return;
      }

      // If no exact match, offer fallback search
      await this.offerFallbackSearch(sourceUrl, sourceService, targetService, songTitle);
    } catch (error) {
      console.error('Error in handleCrossPlatformMapping:', error);
      Alert.alert('Error', 'An error occurred while trying to map the song');
    }
  }

  /**
   * Offer fallback search when exact ISRC match fails
   */
  private static async offerFallbackSearch(
    sourceUrl: string,
    sourceService: 'spotify' | 'apple',
    targetService: 'spotify' | 'apple',
    songTitle?: string
  ): Promise<void> {
    const targetServiceName = this.getServiceDisplayName(targetService);
    const title = songTitle ? `"${songTitle}"` : 'this song';

    Alert.alert(
      'Exact Match Not Found',
      `The specific version of ${title} is not available on ${targetServiceName}, but we can search for similar versions. Would you like us to search for this song?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Search',
          onPress: async () => {
            await this.performFallbackSearch(sourceUrl, sourceService, targetService, songTitle);
          }
        }
      ]
    );
  }

  /**
   * Perform fallback search by title and artist
   */
  private static async performFallbackSearch(
    sourceUrl: string,
    sourceService: 'spotify' | 'apple',
    targetService: 'spotify' | 'apple',
    songTitle?: string
  ): Promise<void> {
    try {
      // Get track metadata from source
      const metadata = await this.getTrackMetadata(sourceUrl, sourceService);
      
      if (!metadata) {
        Alert.alert('Error', 'Unable to get song information for search');
        return;
      }

      // Perform search on target service
      const searchResults = await this.searchByTitleAndArtist(
        metadata.title,
        metadata.artist,
        targetService
      );

      if (!searchResults || searchResults.length === 0) {
        Alert.alert(
          'No Results',
          `No similar songs found on ${this.getServiceDisplayName(targetService)}`
        );
        return;
      }

      // Show search results to user
      this.showSearchResults(searchResults, targetService, metadata);
    } catch (error) {
      console.error('Error in performFallbackSearch:', error);
      Alert.alert('Error', 'An error occurred while searching for the song');
    }
  }

  /**
   * Get track metadata from source URL
   */
  private static async getTrackMetadata(
    url: string,
    service: 'spotify' | 'apple'
  ): Promise<{ title: string; artist: string } | null> {
    try {
      if (service === 'spotify') {
        const trackMatch = url.match(/https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
        if (!trackMatch) return null;

        const trackId = trackMatch[1];
        const accessToken = await this.getSpotifyAccessToken();
        
        if (!accessToken) return null;

        const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) return null;

        const trackData = await response.json();
        return {
          title: trackData.name,
          artist: trackData.artists?.[0]?.name || 'Unknown Artist'
        };
      } else if (service === 'apple') {
        // Extract track ID from Apple Music URL and get metadata
        const trackMatch = url.match(/music\.apple\.com\/[^\/]+\/album\/[^\/]+\/(\d+)\?i=(\d+)/);
        if (!trackMatch) return null;

        const trackId = trackMatch[2];
        const serverUrl = process.env.EXPO_PUBLIC_APPLE_MUSIC_JWT_SERVER_URL || 'https://platnm-token-gen.onrender.com';
        
        const tokenResponse = await fetch(`${serverUrl}/apple-music-token`);
        if (!tokenResponse.ok) return null;
        
        const tokenData = await tokenResponse.json();
        if (!tokenData.success || !tokenData.token) return null;
        
        const trackResponse = await fetch(`https://api.music.apple.com/v1/catalog/us/songs/${trackId}`, {
          headers: {
            'Authorization': `Bearer ${tokenData.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!trackResponse.ok) return null;

        const trackData = await trackResponse.json();
        if (trackData.data && trackData.data.length > 0) {
          const track = trackData.data[0];
          return {
            title: track.attributes?.name || 'Unknown Title',
            artist: track.attributes?.artistName || 'Unknown Artist'
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting track metadata:', error);
      return null;
    }
  }

  /**
   * Search by title and artist on target service
   */
  private static async searchByTitleAndArtist(
    title: string,
    artist: string,
    targetService: 'spotify' | 'apple'
  ): Promise<any[] | null> {
    try {
      const query = `${title} ${artist}`;

      if (targetService === 'spotify') {
        const accessToken = await this.getSpotifyAccessToken();
        if (!accessToken) return null;

        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) return null;

        const searchData = await response.json();
        return searchData.tracks?.items || [];
      } else if (targetService === 'apple') {
        const serverUrl = process.env.EXPO_PUBLIC_APPLE_MUSIC_JWT_SERVER_URL || 'https://platnm-token-gen.onrender.com';
        
        const response = await fetch(`${serverUrl}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: query,
            limit: 5
          })
        });

        if (!response.ok) return null;

        const searchData = await response.json();
        return searchData.tracks || [];
      }

      return null;
    } catch (error) {
      console.error('Error searching by title and artist:', error);
      return null;
    }
  }

  /**
   * Register callback for search results UI
   */
  static setSearchResultsCallback(
    callback: (
      results: SearchResultTrack[],
      targetService: 'spotify' | 'apple',
      originalMetadata: { title: string; artist: string }
    ) => void
  ): void {
    searchResultsCallback = callback;
  }

  /**
   * Show search results to user for selection
   */
  private static showSearchResults(
    results: any[],
    targetService: 'spotify' | 'apple',
    originalMetadata: { title: string; artist: string }
  ): void {
    // Transform results to consistent format
    const transformedResults: SearchResultTrack[] = results.map((track, index) => {
      if (targetService === 'spotify') {
        return {
          id: track.id || `spotify-${index}`,
          name: track.name,
          artist: track.artists?.[0]?.name || 'Unknown Artist',
          url: track.external_urls?.spotify || '',
          artists: track.artists,
          album: track.album,
          external_urls: track.external_urls,
        };
      } else {
        // Process Apple Music artwork URL template
        let artworkUrl = '';
        if (track.attributes?.artwork?.url) {
          artworkUrl = track.attributes.artwork.url
            .replace('{w}', '300')
            .replace('{h}', '300');
          console.log('Apple Music artwork URL processed:', artworkUrl);
        } else {
          console.log('No artwork URL found for Apple Music track:', track.attributes?.name);
        }
        
        return {
          id: track.id || `apple-${index}`,
          artist: track.attributes?.artistName || 'Unknown Artist',
          artwork: artworkUrl,
          url: track.attributes?.url || '',
          attributes: {
            ...track.attributes,
            artwork: {
              ...track.attributes?.artwork,
              url: artworkUrl
            }
          },
        };
      }
    });

    // Use callback if available, otherwise fall back to alert
    if (searchResultsCallback) {
      searchResultsCallback(transformedResults, targetService, originalMetadata);
    } else {
      // Fallback to alert-based approach
      this.showSearchResultsAlert(transformedResults, targetService, originalMetadata);
    }
  }

  /**
   * Fallback alert-based search results (for backward compatibility)
   */
  private static showSearchResultsAlert(
    results: SearchResultTrack[],
    targetService: 'spotify' | 'apple',
    originalMetadata: { title: string; artist: string }
  ): void {
    const targetServiceName = this.getServiceDisplayName(targetService);
    
    // Create buttons for each result
    const buttons: any[] = [
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ];

    results.slice(0, 3).forEach((track, index) => {
      let trackTitle: string;
      let trackArtist: string;
      let trackUrl: string;

      if (targetService === 'spotify') {
        trackTitle = track.name || 'Unknown Title';
        trackArtist = track.artists?.[0]?.name || 'Unknown Artist';
        trackUrl = track.external_urls?.spotify || '';
      } else {
        trackTitle = track.attributes?.name || 'Unknown Title';
        trackArtist = track.attributes?.artistName || 'Unknown Artist';
        trackUrl = track.attributes?.url || '';
      }

      if (trackUrl) {
        buttons.push({
          text: `${trackTitle} - ${trackArtist}`,
          onPress: async () => {
            const result = await this.openMusicUrl(trackUrl, targetService);
            if (!result.success) {
              Alert.alert('Error', result.error || `Failed to open ${targetServiceName}`);
            }
          }
        });
      }
    });

    Alert.alert(
      `Choose from ${targetServiceName}`,
      `Found ${results.length} similar songs. Select one to open:`,
      buttons
    );
  }

  /**
   * Get ISRC from Spotify track URL
   */
  private static async getIsrcFromSpotify(spotifyUrl: string): Promise<string | null> {
    try {
      // Extract track ID from Spotify URL
      const trackMatch = spotifyUrl.match(/https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
      if (!trackMatch) {
        console.error('Invalid Spotify track URL format');
        return null;
      }

      const trackId = trackMatch[1];
      const accessToken = await this.getSpotifyAccessToken();
      
      if (!accessToken) {
        console.error('Failed to get Spotify access token');
        return null;
      }

      // Call Spotify Web API to get track details
      const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Spotify API request failed:', response.status, response.statusText);
        return null;
      }

      const trackData = await response.json();
      return trackData.external_ids?.isrc || null;
    } catch (error) {
      console.error('Error fetching ISRC from Spotify:', error);
      return null;
    }
  }

  /**
   * Get Apple Music URL by ISRC
   */
  private static async getAppleMusicUrlByIsrc(isrc: string): Promise<string | null> {
    try {
      // Use the dedicated ISRC search endpoint on the Apple Music JWT server
      const serverUrl = process.env.EXPO_PUBLIC_APPLE_MUSIC_JWT_SERVER_URL || 'https://platnm-token-gen.onrender.com';
      
      const response = await fetch(`${serverUrl}/search-by-isrc/${isrc}?storefront=us`);
      
      if (!response.ok) {
        console.error('Apple Music ISRC search failed:', response.status, response.statusText);
        return null;
      }
      
      const data = await response.json();
      
      if (data.success && data.url) {
        return data.url;
      } else {
        console.log('No Apple Music track found for ISRC:', isrc);
        return null;
      }
    } catch (error) {
      console.error('Error fetching Apple Music URL by ISRC:', error);
      return null;
    }
  }

  /**
   * Get ISRC from Apple Music track URL
   */
  private static async getIsrcFromAppleMusic(appleMusicUrl: string): Promise<string | null> {
    try {
      // Extract track ID from Apple Music URL
      // Example: https://music.apple.com/us/album/song-name/123456789?i=987654321
      const trackMatch = appleMusicUrl.match(/music\.apple\.com\/[^\/]+\/album\/[^\/]+\/(\d+)\?i=(\d+)/);
      if (!trackMatch) {
        console.error('Invalid Apple Music track URL format');
        return null;
      }

      const trackId = trackMatch[2]; // The track ID is after ?i=
      
      // Use the Apple Music JWT server to get track details
      const serverUrl = process.env.EXPO_PUBLIC_APPLE_MUSIC_JWT_SERVER_URL || 'https://platnm-token-gen.onrender.com';
      
      // Get token from the JWT server
      const tokenResponse = await fetch(`${serverUrl}/apple-music-token`);
      
      if (!tokenResponse.ok) {
        console.error('Failed to get Apple Music token from server:', tokenResponse.status);
        return null;
      }
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenData.success || !tokenData.token) {
        console.error('Invalid token response from server');
        return null;
      }
      
      // Get track details from Apple Music API
      const trackResponse = await fetch(`https://api.music.apple.com/v1/catalog/us/songs/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!trackResponse.ok) {
        console.error('Apple Music track API request failed:', trackResponse.status, trackResponse.statusText);
        return null;
      }

      const trackData = await trackResponse.json();
      
      if (trackData.data && trackData.data.length > 0) {
        const track = trackData.data[0];
        return track.attributes?.isrc || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching ISRC from Apple Music:', error);
      return null;
    }
  }

  /**
   * Get Spotify URL by ISRC
   */
  private static async getSpotifyUrlByIsrc(isrc: string): Promise<string | null> {
    try {
      const accessToken = await this.getSpotifyAccessToken();
      
      if (!accessToken) {
        console.error('Failed to get Spotify access token');
        return null;
      }

      // Search Spotify for track by ISRC
      const searchUrl = `https://api.spotify.com/v1/search?q=isrc:${isrc}&type=track&limit=1`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Spotify search API request failed:', response.status, response.statusText);
        return null;
      }

      const searchData = await response.json();
      
      if (searchData.tracks && searchData.tracks.items && searchData.tracks.items.length > 0) {
        const track = searchData.tracks.items[0];
        return track.external_urls?.spotify || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching Spotify URL by ISRC:', error);
      return null;
    }
  }

  /**
   * Get Spotify access token for API requests
   * Uses client credentials flow for app-level access
   */
  private static async getSpotifyAccessToken(): Promise<string | null> {
    try {
      // Get Spotify client credentials from environment
      const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        console.error('Spotify client credentials not configured');
        return null;
      }
      
      // Use client credentials flow for app-level access
      const credentials = btoa(`${clientId}:${clientSecret}`);
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      
      if (!response.ok) {
        console.error('Failed to get Spotify access token:', response.status, response.statusText);
        return null;
      }
      
      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting Spotify access token:', error);
      return null;
    }
  }
}
