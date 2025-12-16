import { router } from "expo-router";
import { MusicLinkParser } from "./musicLinkParser";

export interface SharedContent {
  type: "music" | "text" | "url";
  content: string;
  source?: string;
}

export class DeepLinkHandler {
  private static pendingDeepLink: string | null = null;
  private static isUserReady: boolean = false;

  /**
   * Set user ready state (called when auth completes)
   */
  static setUserReady(ready: boolean) {
    this.isUserReady = ready;
    
    // Process pending deep link if user just became ready
    if (ready && this.pendingDeepLink) {
      console.log("User ready, processing pending deep link:", this.pendingDeepLink);
      const link = this.pendingDeepLink;
      this.pendingDeepLink = null;
      this.handleAppUrl(link);
    }
  }

  /**
   * Handle incoming shared content
   */
  static handleSharedContent(content: SharedContent): boolean {
    console.log("Handling shared content:", content);

    switch (content.type) {
      case "music":
      case "url":
      case "text":
        return this.handleMusicLink(content.content);
      default:
        console.warn("Unknown content type:", content.type);
        return false;
    }
  }

  /**
   * Handle music links from shared content
   */
  static handleMusicLink(url: string, forceHandle: boolean = false): boolean {
    if (!this.isUserReady && !forceHandle) {
      console.log("User not ready, will handle music link later");
      return false;
    }

    // Parse the music link
    const parsedLink = MusicLinkParser.parseLink(url);

    if (parsedLink.isSupported || this.isMusicRelated(url)) {
      console.log("Navigating to shared music screen with:", url);
      
      // Use push for better navigation flow when app is running
      console.log("About to navigate to shared-music with params:", {
        url: encodeURIComponent(url),
        supported: parsedLink.isSupported.toString(),
      });
      
      router.push({
        pathname: "/(app)/shared-music",
        params: {
          url: encodeURIComponent(url),
          supported: parsedLink.isSupported.toString(),
        },
      });
      return true;
    }

    console.log("URL not music-related:", url);
    return false;
  }

  /**
   * Check if URL is music-related
   */
  private static isMusicRelated(url: string): boolean {
    const musicDomains = [
      "open.spotify.com",
      "music.apple.com",
      "youtube.com/watch",
      "youtu.be",
      "soundcloud.com",
      "tidal.com",
      "deezer.com",
      "pandora.com",
      "music.amazon.com",
      "bandcamp.com",
    ];

    return musicDomains.some((domain) => url.includes(domain));
  }

  /**
   * Parse app URL and route accordingly
   */
  static handleAppUrl(url: string): boolean {
    console.log("Handling app URL:", url);
    console.log("Current user ready state:", this.isUserReady);

    try {
      const urlObj = new URL(url);

      if (urlObj.protocol === "platnm:") {
        const path = urlObj.pathname;

        if (path === "shared-music" || path === "/shared-music") {
          const musicUrl = urlObj.searchParams.get("url");
          if (musicUrl) {
            // For share links, always try to handle immediately 
            // even if user ready state is temporarily false (e.g., app in background)
            console.log("Processing shared music URL immediately:", musicUrl);
            return this.handleMusicLink(decodeURIComponent(musicUrl), true);
          }
        }

        if (path === "spotify-callback" || path === "/spotify-callback") {
          // Spotify OAuth callback - just acknowledge it's handled
          // The actual OAuth flow is managed by AuthSession
          console.log("Handled Spotify OAuth callback");
          return true;
        }
      }
    } catch (error) {
      console.error("Error parsing app URL:", error);
    }

    // If user not ready and not a share link, store for later
    if (!this.isUserReady) {
      console.log("User not ready, storing pending deep link:", url);
      this.pendingDeepLink = url;
      return true; // Return true since we'll handle it later
    }

    return false;
  }

  /**
   * Handle Android intent data
   */
  static handleAndroidIntent(intent: any): boolean {
    console.log("Handling Android intent:", intent);

    if (intent.action === "android.intent.action.SEND") {
      const text = intent.extras?.["android.intent.extra.TEXT"];
      if (text) {
        return this.handleSharedContent({
          type: "text",
          content: text,
          source: "android_intent",
        });
      }
    }

    return false;
  }

  /**
   * Handle iOS share extension data
   */
  static handleiOSShareExtension(sharedData: any): boolean {
    console.log("Handling iOS share extension:", sharedData);

    if (sharedData.text) {
      return this.handleSharedContent({
        type: "text",
        content: sharedData.text,
        source: "ios_share_extension",
      });
    }

    if (sharedData.url) {
      return this.handleSharedContent({
        type: "url",
        content: sharedData.url,
        source: "ios_share_extension",
      });
    }

    return false;
  }

  /**
   * Generate shareable URL
   */
  static generateShareUrl(musicUrl: string): string {
    const appScheme = "platnm://";
    const encodedUrl = encodeURIComponent(musicUrl);
    return `${appScheme}shared-music?url=${encodedUrl}`;
  }

  // Remove duplicate handleMusicLink method - using the one above

  /**
   * Complete sharing and return to main app
   */
  static completeSharing() {
    console.log("Completing share, returning to profile");
    router.replace("/(app)/profile");
  }

  /**
   * Clear any pending deep links (useful for cleanup)
   */
  static clearPending() {
    this.pendingDeepLink = null;
  }
}
