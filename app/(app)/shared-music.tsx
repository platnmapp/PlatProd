import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import ShareExtension from "../../components/ShareExtension";
import SkeletonLoader from "../../components/SkeletonLoader";
import {
  MusicContent,
  MusicContentService,
} from "../../lib/musicContentService";
import { MusicLinkParser } from "../../lib/musicLinkParser";
import { useAuth } from "../context/AuthContext";

export default function SharedMusic() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ url?: string }>();
  const [musicContent, setMusicContent] = useState<MusicContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareExtension, setShowShareExtension] = useState(false);

  const sharedUrl = params.url || "";

  useEffect(() => {
    console.log("=== SHARED MUSIC SCREEN DEBUG ===");
    console.log("ALL PARAMS:", params);
    console.log("sharedUrl from params:", sharedUrl);
    console.log("sharedUrl length:", sharedUrl?.length);
    console.log("sharedUrl type:", typeof sharedUrl);
    console.log("showShareExtension:", showShareExtension);
    console.log("musicContent:", musicContent);
    console.log("isLoading:", loading);
    console.log("user:", user ? "authenticated" : "not authenticated");

    if (sharedUrl && sharedUrl.length > 0) {
      console.log("Processing shared URL:", sharedUrl);
      handleSharedLink(sharedUrl);
    } else {
      console.log("No shared URL provided - staying on screen for debugging");
      console.log("Params received:", JSON.stringify(params));
      // Don't auto-navigate away - let's debug what's happening
      setLoading(false);
      setError("No URL provided. Debug info: " + JSON.stringify(params));
    }
  }, [sharedUrl]);

  const handleSharedLink = async (url: string) => {
    console.log("handleSharedLink called with URL:", url);
    setLoading(true);

    try {
      const parsedLink = MusicLinkParser.parseLink(url);

      if (!parsedLink.isSupported) {
        Alert.alert(
          "Error",
          MusicLinkParser.getFriendlyErrorMessage(parsedLink)
        );
        setLoading(false);
        return;
      }

      console.log("Calling MusicContentService.fetchContent...");
      const contentResult = await MusicContentService.fetchContent(
        parsedLink,
        user?.id
      );
      console.log("MusicContentService returned:", contentResult);

      if (contentResult.success && contentResult.content) {
        setMusicContent(contentResult.content);
        setShowShareExtension(true);
        console.log("Set showShareExtension to true");
      } else {
        console.log(
          "No content returned from MusicContentService",
          contentResult.error
        );
        Alert.alert(
          "Error",
          contentResult.error || "Could not process this music link"
        );
      }
    } catch (error) {
      console.error("Error processing shared link:", error);
      Alert.alert("Error", "Failed to process music link");
    } finally {
      setLoading(false);
    }
  };

  const handleDismissShare = () => {
    console.log("SharedMusic: Dismissing share extension");
    setShowShareExtension(false);
    // Navigate to profile instead of back() to ensure we always go to a safe location
    // especially when coming from external share intents
    router.replace("/(app)/profile");
  };

  console.log(
    "SharedMusic: Render state - loading:",
    loading,
    "error:",
    error,
    "showShareExtension:",
    showShareExtension
  );

  if (loading) {
    console.log("SharedMusic: Showing loading state");
    return <SkeletonLoader />;
  }

  if (error) {
    console.log("SharedMusic: Showing error state:", error);
    return (
      <View className="flex-1 justify-center items-center px-8">
        <Ionicons name="musical-notes-outline" size={64} color="#6B7280" />
        <Text className="text-white text-xl font-semibold mt-4 mb-2 text-center">
          Sorry, we can't handle this
        </Text>
        <Text className="text-gray-400 text-center mb-6">{error}</Text>
        <Pressable
          className="bg-bg-neutral-700 px-6 py-3 rounded-full active:bg-neutral-800"
          onPress={() => router.replace("/(app)/profile")}
        >
          <Text className="text-white font-medium">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  console.log("SharedMusic: Rendering main view with modal");
  return (
    <View className="flex-1 bg-black">
      <Modal
        visible={showShareExtension}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleDismissShare}
      >
        <ShareExtension
          sharedText={sharedUrl}
          onDismiss={handleDismissShare}
          musicContent={musicContent}
        />
      </Modal>
    </View>
  );
}
