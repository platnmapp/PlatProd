import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { MusicUrlHandler } from "../lib/musicUrlHandler";

interface SearchResultTrack {
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

interface CrossPlatformSearchResultsProps {
  visible: boolean;
  results: SearchResultTrack[];
  targetService: "spotify" | "apple";
  originalMetadata: { title: string; artist: string };
  onClose: () => void;
}

export default function CrossPlatformSearchResults({
  visible,
  results,
  targetService,
  originalMetadata,
  onClose,
}: CrossPlatformSearchResultsProps) {
  const [selectedTrack, setSelectedTrack] = useState<SearchResultTrack | null>(
    null
  );

  const getServiceDisplayName = (service: "spotify" | "apple"): string => {
    return service === "spotify" ? "Spotify" : "Apple Music";
  };

  const getTrackInfo = (track: SearchResultTrack) => {
    if (targetService === "spotify") {
      return {
        title: track.name || track.title || "Unknown Title",
        artist: track.artists?.[0]?.name || track.artist || "Unknown Artist",
        artwork: track.album?.images?.[0]?.url || track.artwork || "",
        url: track.external_urls?.spotify || track.url || "",
      };
    } else {
      // Handle Apple Music artwork URL template
      let artworkUrl = track.artwork || "";
      if (!artworkUrl && track.attributes?.artwork?.url) {
        artworkUrl = track.attributes.artwork.url
          .replace("{w}", "300")
          .replace("{h}", "300");
      }

      return {
        title:
          track.attributes?.name ||
          track.name ||
          track.title ||
          "Unknown Title",
        artist:
          track.attributes?.artistName || track.artist || "Unknown Artist",
        artwork: artworkUrl,
        url: track.attributes?.url || track.url || "",
      };
    }
  };

  const handleTrackSelection = (track: SearchResultTrack) => {
    setSelectedTrack(track);
    const trackInfo = getTrackInfo(track);

    Alert.alert(
      "Open Song",
      `Open "${trackInfo.title}" by ${trackInfo.artist} in ${getServiceDisplayName(targetService)}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: `Open ${getServiceDisplayName(targetService)}`,
          onPress: async () => {
            try {
              const result = await MusicUrlHandler.openMusicUrl(
                trackInfo.url,
                targetService
              );
              if (result.success) {
                onClose();
              } else {
                Alert.alert(
                  "Error",
                  result.error ||
                    `Failed to open ${getServiceDisplayName(targetService)}`
                );
              }
            } catch (error) {
              Alert.alert("Error", "An error occurred while opening the song");
            }
          },
        },
      ]
    );
  };

  const renderTrackItem = (track: SearchResultTrack, index: number) => {
    const trackInfo = getTrackInfo(track);
    const isSelected = selectedTrack?.id === track.id;

    return (
      <Animatable.View
        key={track.id || index}
        animation="fadeInUp"
        duration={500}
        delay={index * 100}
        className="w-[30%] mb-6 mx-[1.66%]"
      >
        <TouchableOpacity onPress={() => handleTrackSelection(track)}>
          <View className="relative">
            <Image
              source={{
                uri: trackInfo.artwork || undefined,
              }}
              className="w-full aspect-square rounded-lg"
              defaultSource={require("../assets/images/placeholder.png")}
              onError={(error) => {
                console.log("Image load error for:", trackInfo.artwork, error);
              }}
              onLoad={() => {
                console.log("Image loaded successfully:", trackInfo.artwork);
              }}
            />
            {isSelected && (
              <View className="absolute top-2 right-2 bg-green-500 rounded-full">
                <Ionicons name="checkmark-circle" size={24} color="white" />
              </View>
            )}
          </View>

          <Text
            className="text-white mt-2 text-sm font-medium"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {trackInfo.title}
          </Text>
          <Text
            className="text-gray-400 text-xs"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {trackInfo.artist}
          </Text>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="pt-12 px-4 pb-4 border-b border-neutral-800">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1 items-center">
              <Ionicons
                name={
                  targetService === "spotify"
                    ? "play-circle-outline"
                    : "logo-apple"
                }
                size={24}
                color="white"
              />
            </View>
            <View style={{ width: 24 }} />
          </View>

          <View className="mt-4">
            <Text className="text-white text-xl font-bold text-center">
              Choose from {getServiceDisplayName(targetService)}
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              Found {results.length} similar song
              {results.length !== 1 ? "s" : ""} for "{originalMetadata.title}"
            </Text>
          </View>
        </View>

        {/* Search Results */}
        <ScrollView className="flex-1 px-4 py-6">
          <View className="flex-row flex-wrap">
            {results.map((track, index) => renderTrackItem(track, index))}
          </View>

          {results.length === 0 && (
            <View className="flex-1 items-center justify-center">
              <Ionicons
                name="musical-notes-outline"
                size={64}
                color="#6B7280"
              />
              <Text className="text-gray-400 text-lg mt-4 text-center">
                No similar songs found
              </Text>
              <Text className="text-gray-500 text-sm mt-2 text-center">
                Try searching for the song manually in{" "}
                {getServiceDisplayName(targetService)}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="px-4 pb-8 pt-4 border-t border-neutral-800">
          <Text className="text-gray-500 text-xs text-center">
            Select a song to open it in {getServiceDisplayName(targetService)}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
