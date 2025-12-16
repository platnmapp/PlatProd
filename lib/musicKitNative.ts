import { Platform } from "react-native";
import AppleMusicUserToken from "react-native-apple-music-user-token";

export interface MusicKitAuthResult {
  success: boolean;
  userToken?: string;
  status: "authorized" | "denied" | "restricted" | "notDetermined" | "unknown";
  error?: string;
}

export interface MusicKitStatusResult {
  status: string;
  isAuthorized: boolean;
}

export interface MusicKitSubscriptionResult {
  hasSubscription: boolean;
  canPlayCatalogContent: boolean;
}

export class MusicKitNative {
  static isAvailable(): boolean {
    // Apple Music is available on both platforms: native on iOS, web-based on Android
    return Platform.OS === "ios" || Platform.OS === "android";
  }

  static isNativeSupported(): boolean {
    // Native SDK is only available on iOS
    return Platform.OS === "ios";
  }

  static async requestAuthorization(): Promise<MusicKitAuthResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        status: "unknown",
        error: "Apple Music is not available on this platform",
      };
    }

    // iOS: Use native SDK
    if (this.isNativeSupported()) {
      try {
        console.log("🍎 Requesting Apple Music authorization (iOS native)...");
        await AppleMusicUserToken.requestAuthorization();

        console.log("🍎 Apple Music authorization granted successfully");
        return {
          success: true,
          status: "authorized",
        };
      } catch (error: any) {
        console.error("Apple Music authorization error:", error);

        // Provide more specific error messages
        let errorMessage = "Authorization failed";
        if (
          error.message?.includes("denied") ||
          error.message?.includes("permission")
        ) {
          errorMessage =
            "User denied Apple Music access. Please grant permission in Settings → Privacy & Security → Media & Apple Music.";
        } else if (error.message?.includes("subscription")) {
          errorMessage =
            "Apple Music subscription required. Please subscribe to Apple Music to use this feature.";
        } else if (
          error.code === 0 ||
          error.message?.includes("native code: 0")
        ) {
          errorMessage =
            "Apple Music permission denied or unavailable. Please check your Apple Music subscription and app permissions.";
        }

        return {
          success: false,
          status: "denied",
          error: errorMessage,
        };
      }
    }

    // Android: Use web-based authentication
    console.log("🍎 Apple Music web-based authentication not yet implemented for Android");
    return {
      success: false,
      status: "unknown",
      error: "Web-based authentication will be handled by AppleMusicAuth class",
    };
  }

  static async checkAuthorizationStatus(): Promise<MusicKitStatusResult> {
    if (!this.isAvailable()) {
      return {
        status: "unknown",
        isAuthorized: false,
      };
    }

    // Note: The library doesn't provide a status check method
    // We'll assume authorized if we can request tokens
    return {
      status: "authorized",
      isAuthorized: true,
    };
  }

  static async hasAppleMusicSubscription(): Promise<MusicKitSubscriptionResult> {
    if (!this.isAvailable()) {
      return {
        hasSubscription: false,
        canPlayCatalogContent: false,
      };
    }

    // Note: The library doesn't provide subscription checking
    // We'll assume the user has access (API calls will fail if they don't)
    return {
      hasSubscription: true,
      canPlayCatalogContent: true,
    };
  }

  static async requestUserToken(developerToken: string): Promise<{
    success: boolean;
    userToken?: string;
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: "Apple Music is not available on this platform",
      };
    }

    // iOS: Use native SDK
    if (this.isNativeSupported()) {
      try {
        console.log("🍎 Requesting user token with developer token (iOS native)...");

        const userToken =
          await AppleMusicUserToken.requestUserTokenForDeveloperToken(
            developerToken
          );
        console.log("🍎 User Token:", userToken);

        console.log("🍎 Successfully obtained user token");
        return {
          success: true,
          userToken: userToken,
        };
      } catch (error: any) {
        console.error("Apple Music user token error:", error);

        let errorMessage = "Failed to get user token";
        if (error.code === 0 || error.message?.includes("native code: 0")) {
          errorMessage =
            "Apple Music access denied. Please ensure you have an active Apple Music subscription and have granted permission to this app.";
        } else if (error.message?.includes("subscription")) {
          errorMessage =
            "Apple Music subscription required to access user token.";
        }

        return {
          success: false,
          error: errorMessage,
        };
      }
    }

    // Android: Web-based authentication doesn't need this method
    console.log("🍎 User token will be obtained through web authentication on Android");
    return {
      success: false,
      error: "User token handled by web authentication flow on Android",
    };
  }
}

export default MusicKitNative;
