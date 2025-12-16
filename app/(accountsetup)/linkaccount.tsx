import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import {
  AppleMusicAuth,
  AppleMusicTokens,
  AppleMusicUser,
} from "../../lib/appleMusic";
import { CacheService } from "../../lib/cacheService";
import { SpotifyAuth, SpotifyTokens, SpotifyUser } from "../../lib/spotify";
import { supabase } from "../../lib/supabase";
import { UserProfileService } from "../../lib/userProfile";
import { useAuth } from "../context/AuthContext";

export default function LinkAccount() {
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [isConnectingApple, setIsConnectingApple] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [appleMusicConnected, setAppleMusicConnected] = useState(false);
  const { user } = useAuth();
  const { context } = useLocalSearchParams<{ context?: string }>();
  const isOnboarding = context === "onboarding";

  useEffect(() => {
    checkConnectionStatus();
  }, [user]);

  const checkConnectionStatus = async () => {
    if (!user) return;

    try {
      const { profile } = await UserProfileService.getUserProfile(user.id);
      if (profile) {
        setSpotifyConnected(UserProfileService.isSpotifyConnected(profile));
        setAppleMusicConnected(
          UserProfileService.isAppleMusicConnected(profile)
        );
      }
    } catch (error) {
      console.error("Error checking connection status:", error);
    }
  };

  const handleSpotifyAuth = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to connect Spotify");
      return;
    }

    if (spotifyConnected) {
      // Already connected, show disconnect option
      Alert.alert(
        "Spotify Connected",
        "Your Spotify account is already connected. Would you like to disconnect?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: disconnectSpotify,
          },
        ]
      );
      return;
    }

    setIsConnectingSpotify(true);

    try {
      const spotifyAuth = new SpotifyAuth();
      const result = await spotifyAuth.authenticateWithSpotify();

      if (result.success && result.tokens && result.user) {
        // Store Spotify data in user profile
        await saveSpotifyDataToProfile(result.tokens, result.user);
        setSpotifyConnected(true);
        // Force refresh connection status
        await checkConnectionStatus();

        Alert.alert(
          "Success!",
          `Connected to Spotify as ${result.user.display_name}`,
          [
            {
              text: "Continue",
              onPress: () => {
                // Check if we should continue to onboarding or stay here
                if (!appleMusicConnected) {
                  // Stay on this page to potentially connect Apple Music
                  return;
                }
                router.replace("/(app)/(onboarding)/carousel");
              },
            },
          ]
        );
      } else {
        console.error("Spotify auth failed:", result.error);
        Alert.alert(
          "Authentication Failed",
          result.error || "Failed to connect to Spotify"
        );
      }
    } catch (error) {
      console.error("Spotify authentication error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsConnectingSpotify(false);
    }
  };

  const handleAppleMusicAuth = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to connect Apple Music");
      return;
    }

    if (appleMusicConnected) {
      // Already connected, show disconnect option
      Alert.alert(
        "Apple Music Connected",
        "Your Apple Music account is already connected. Would you like to disconnect?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: disconnectAppleMusic,
          },
        ]
      );
      return;
    }

    setIsConnectingApple(true);

    try {
      const appleMusicAuth = new AppleMusicAuth();
      const result = await appleMusicAuth.authenticateWithAppleMusic();

      if (result.success && result.tokens && result.user) {
        // Store Apple Music data in user profile
        await saveAppleMusicDataToProfile(result.tokens, result.user);
        setAppleMusicConnected(true);
        // Force refresh connection status
        await checkConnectionStatus();

        Alert.alert(
          "Success!",
          `Connected to Apple Music as ${result.user.attributes.name}`,
          [
            {
              text: "Continue",
              onPress: () => {
                // Check if we should continue to onboarding or stay here
                if (!spotifyConnected) {
                  // Stay on this page to potentially connect Spotify
                  return;
                }
                router.replace("/(app)/(onboarding)/carousel");
              },
            },
          ]
        );
      } else {
        console.error("Apple Music auth failed:", result.error);
        Alert.alert(
          "Authentication Failed",
          result.error || "Failed to connect to Apple Music"
        );
      }
    } catch (error) {
      console.error("Apple Music authentication error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsConnectingApple(false);
    }
  };

  const disconnectSpotify = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          spotify_user_id: null,
          spotify_display_name: null,
          spotify_email: null,
          spotify_access_token: null,
          spotify_refresh_token: null,
          spotify_token_expires_at: null,
          spotify_connected_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) {
        console.error("Error disconnecting Spotify:", error);
        Alert.alert("Error", "Failed to disconnect Spotify");
        return;
      }

      setSpotifyConnected(false);
      // Invalidate cache to force fresh data on next fetch
      if (user?.id) {
        CacheService.invalidateUserProfile(user.id);
      }
      Alert.alert("Success", "Spotify account disconnected");
    } catch (error) {
      console.error("Error disconnecting Spotify:", error);
      Alert.alert("Error", "Failed to disconnect Spotify");
    }
  };

  const disconnectAppleMusic = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          apple_music_user_id: null,
          apple_music_user_name: null,
          apple_music_user_token: null,
          apple_music_developer_token: null,
          apple_music_token_expires_at: null,
          apple_music_connected: false,
          apple_music_connected_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) {
        console.error("Error disconnecting Apple Music:", error);
        Alert.alert("Error", "Failed to disconnect Apple Music");
        return;
      }

      setAppleMusicConnected(false);
      // Invalidate cache to force fresh data on next fetch
      if (user?.id) {
        CacheService.invalidateUserProfile(user.id);
      }
      Alert.alert("Success", "Apple Music account disconnected");
    } catch (error) {
      console.error("Error disconnecting Apple Music:", error);
      Alert.alert("Error", "Failed to disconnect Apple Music");
    }
  };

  const saveSpotifyDataToProfile = async (
    tokens: SpotifyTokens,
    spotifyUser: SpotifyUser
  ) => {
    try {
      // Update user profile with Spotify data
      const { error } = await supabase.from("profiles").upsert({
        id: user?.id,
        spotify_user_id: spotifyUser.id,
        spotify_display_name: spotifyUser.display_name,
        spotify_email: spotifyUser.email,
        spotify_access_token: tokens.access_token,
        spotify_refresh_token: tokens.refresh_token,
        spotify_token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
        spotify_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error saving Spotify data:", error);
        // Don't throw error here - the auth was successful even if saving failed
        Alert.alert(
          "Warning",
          "Spotify connected but failed to save some data. You may need to reconnect later."
        );
      } else {
        console.log("Spotify data saved successfully");
        // Invalidate cache to force fresh data on next fetch
        if (user?.id) {
          CacheService.invalidateUserProfile(user.id);
        }
      }
    } catch (error) {
      console.error("Error saving Spotify data:", error);
    }
  };

  const saveAppleMusicDataToProfile = async (
    tokens: AppleMusicTokens,
    appleMusicUser: AppleMusicUser
  ) => {
    try {
      // Check connection type: iOS native, Android Edge Function, or basic
      const isAndroidEdgeFunction =
        tokens.userToken === "android_edge_function";
      const isIosNativeAuth =
        !isAndroidEdgeFunction && tokens.userToken && tokens.userToken !== "";
      const isAndroidWebAuth = !isIosNativeAuth && !isAndroidEdgeFunction;

      const profileData: any = {
        id: user?.id,
        apple_music_user_id: appleMusicUser.id,
        apple_music_user_name: appleMusicUser.attributes.name,
        apple_music_connected: true,
        apple_music_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isIosNativeAuth) {
        // Save full tokens for iOS native authentication
        profileData.apple_music_user_token = tokens.userToken;
        profileData.apple_music_developer_token = tokens.developerToken;
        profileData.apple_music_token_expires_at = new Date(
          tokens.expiresAt
        ).toISOString();
        console.log("Saving iOS native Apple Music tokens");
      } else if (isAndroidEdgeFunction) {
        // For Android Edge Function: save identifier for UI but no real tokens needed
        profileData.apple_music_user_token = "android_edge_function";
        profileData.apple_music_developer_token = tokens.developerToken;
        profileData.apple_music_token_expires_at = new Date(
          tokens.expiresAt
        ).toISOString();
        console.log("Saving Android Edge Function connection status");
      } else {
        // Fallback case: save connection but no tokens
        profileData.apple_music_developer_token = tokens.developerToken;
        profileData.apple_music_user_token = null;
        console.log("Saving basic Apple Music connection");
      }

      const { error } = await supabase.from("profiles").upsert(profileData);

      if (error) {
        console.error("Error saving Apple Music data:", error);
        // Don't throw error here - the auth was successful even if saving failed
        Alert.alert(
          "Warning",
          "Apple Music connected but failed to save some data. You may need to reconnect later."
        );
      } else {
        console.log("Apple Music data saved successfully");
        // Invalidate cache to force fresh data on next fetch
        if (user?.id) {
          CacheService.invalidateUserProfile(user.id);
        }
      }
    } catch (error) {
      console.error("Error saving Apple Music data:", error);
    }
  };

  const canProceed = () => {
    return spotifyConnected || appleMusicConnected;
  };

  return (
    <Animatable.View
      animation="fadeIn"
      duration={500}
      className="flex-1 bg-[#111] p-5 pt-20"
    >
      {isOnboarding ? (
        <Pressable
          className="absolute top-12 left-5 pt-10 active:bg-neutral-800"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
      ) : (
        <Pressable
          className="absolute top-12 right-5 pt-10 active:bg-neutral-800"
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="white" />
        </Pressable>
      )}
      <View className="flex-1 justify-start pt-10">
        {/* Title and subtitle */}
        <Text className="text-white text-2xl font-bold mt-16 mb-2">
          Link Music Account
        </Text>
        <Text className="text-gray-400  mb-8">
          This will help sync your data across multiple platforms
        </Text>

        {/* Illustration (placeholder image) */}
        <View className="items-center mb-10 pb-10 pt-10">
          <Image
            source={require("../../assets/images/placeholder.png")}
            className="w-48 h-64"
            resizeMode="contain"
          />
        </View>

        {/* Spotify Button */}
        <Pressable
          className={`flex-row items-center justify-center rounded-full py-4 mb-4 active:bg-green-700 ${
            spotifyConnected ? "bg-green-700" : "bg-green-600"
          } ${isConnectingSpotify ? "opacity-70" : ""}`}
          onPress={handleSpotifyAuth}
          disabled={isConnectingSpotify}
        >
          {isConnectingSpotify ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons
              name={spotifyConnected ? "checkmark-circle" : "musical-notes"}
              size={24}
              color="white"
              style={{ marginRight: 8 }}
            />
          )}
          <Text className="text-white  font-semibold">
            {isConnectingSpotify
              ? "Connecting..."
              : spotifyConnected
                ? "Spotify Connected"
                : "Sync Spotify Account"}
          </Text>
        </Pressable>

        {/* Apple Music Button */}
        <Pressable
          className={`flex-row items-center justify-center rounded-full py-4 mb-4 active:bg-red-700 ${
            appleMusicConnected ? "bg-red-700" : "bg-red-600"
          } ${isConnectingApple ? "opacity-70" : ""}`}
          onPress={handleAppleMusicAuth}
          disabled={isConnectingApple}
        >
          {isConnectingApple ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons
              name={appleMusicConnected ? "checkmark-circle" : "logo-apple"}
              size={24}
              color="white"
              style={{ marginRight: 8 }}
            />
          )}
          <Text className="text-white  font-semibold">
            {isConnectingApple
              ? "Connecting..."
              : appleMusicConnected
                ? "Apple Music Connected"
                : Platform.OS === "ios"
                  ? "Sync Apple Music"
                  : "Sync Apple Music (Web)"}
          </Text>
        </Pressable>
        {Platform.OS === "android" && !appleMusicConnected && (
          <Text className="text-gray-400 text-xs text-center -mt-2 mb-2">
            Uses same music service as iOS - full sharing support
          </Text>
        )}

        {/* Continue/Skip section */}
        {isOnboarding && (
          <View className="mt-8">
            {canProceed() ? (
              <Pressable
                className="bg-white rounded-full py-4 mb-4 active:bg-neutral-800"
                onPress={() =>
                  router.replace("/(app)/(onboarding)/song-selection")
                }
              >
                <Text className="text-black  font-semibold text-center">
                  Continue
                </Text>
              </Pressable>
            ) : (
              <Pressable
                className="items-center mt-2 active:bg-neutral-800"
                onPress={() => {
                  /* skip logic here */
                  router.replace("/(app)/profile");
                }}
              >
                <Text className="text-gray-300 ">Skip for now</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Animatable.View>
  );
}
