import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SkeletonLoader from "../../components/SkeletonLoader";
import { FavoriteSong, FavoriteSongsService } from "../../lib/favoriteSongs";
import { ImageUploadService } from "../../lib/imageUpload";
import { UserProfile, UserProfileService } from "../../lib/userProfile";
import { useAuth } from "../context/AuthContext";

export default function EditProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [username, setUsername] = useState("");
  const [favoriteSongs, setFavoriteSongs] = useState<FavoriteSong[]>([]);

  useEffect(() => {
    loadUserData();
  }, [user]);

  // Reload favorite songs when screen is focused (e.g., returning from song picker)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadFavoriteSongs();
      }
    }, [user])
  );

  const loadFavoriteSongs = async () => {
    if (!user) return;

    try {
      const { success, songs: userFavoriteSongs } =
        await FavoriteSongsService.getUserFavoriteSongs(user.id);
      if (success && userFavoriteSongs) {
        setFavoriteSongs(userFavoriteSongs);
      }
    } catch (error) {
      console.error("Error loading favorite songs:", error);
    }
  };

  const loadUserData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { profile: userProfile, error } =
        await UserProfileService.getUserProfile(user.id);

      if (error) {
        console.error("Error loading profile:", error);
        Alert.alert("Error", "Failed to load profile data");
        return;
      }

      if (userProfile) {
        setProfile(userProfile);
        setUsername(userProfile.username || "");
      }

      // Load favorite songs
      await loadFavoriteSongs();
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert("Error", "Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfilePicture = async () => {
    if (!user) return;

    setUploadingImage(true);
    try {
      const result = await ImageUploadService.updateProfilePicture(user.id);

      if (result.success && result.url) {
        // Update local profile state
        setProfile((prev) =>
          prev ? { ...prev, avatar_url: result.url } : null
        );
        Alert.alert("Success", "Profile picture updated successfully!");
      } else {
        Alert.alert(
          "Error",
          result.error || "Failed to update profile picture"
        );
      }
    } catch (error) {
      console.error("Error updating profile picture:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEditFavoriteSong = (position: number) => {
    if (!profile) return;

    const isSpotifyConnected = UserProfileService.isSpotifyConnected(profile);
    const isAppleMusicConnected =
      UserProfileService.isAppleMusicConnected(profile);

    // Check what services are connected
    if (!isSpotifyConnected && !isAppleMusicConnected) {
      // No services connected - ask user to connect
      Alert.alert(
        "Connect Music Service",
        "To edit favorite songs, you need to connect a music service first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Connect Service",
            onPress: () => router.push("/(accountsetup)/linkaccount"),
          },
        ]
      );
      return;
    }

    if (isSpotifyConnected && isAppleMusicConnected) {
      // Both services connected - show choice dialog
      Alert.alert(
        "Choose Music Service",
        "Which music service would you like to use?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Spotify",
            onPress: () => openSpotifyPicker(position),
          },
          {
            text: "Apple Music",
            onPress: () => openAppleMusicPicker(position),
          },
        ]
      );
    } else if (isSpotifyConnected) {
      // Only Spotify connected
      openSpotifyPicker(position);
    } else if (isAppleMusicConnected) {
      // Only Apple Music connected
      openAppleMusicPicker(position);
    }
  };

  const openSpotifyPicker = async (position: number) => {
    router.push({
      pathname: "/(app)/song-picker",
      params: {
        service: "spotify",
        index: position.toString(),
        editing: "true",
      },
    });
  };

  const openAppleMusicPicker = async (position: number) => {
    router.push({
      pathname: "/(app)/song-picker",
      params: {
        service: "apple",
        index: position.toString(),
        editing: "true",
      },
    });
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    try {
      // Update username if it has changed
      if (username !== profile.username) {
        const { error } = await UserProfileService.updateUserProfile(user.id, {
          username: username.trim(),
        });

        if (error) {
          Alert.alert("Error", "Failed to update username");
          return;
        }
      }

      Alert.alert("Success", "Profile updated successfully", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save changes");
    }
  };

  const renderFavoriteSongTile = (position: number, index: number) => {
    const favoriteSong = favoriteSongs.find(
      (song) => song.position === position
    );

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={500}
        delay={index * 100}
        key={position}
        className="relative flex-1 mx-1"
      >
        <Pressable
          className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-700 active:bg-neutral-800"
          onPress={() => handleEditFavoriteSong(position)}
        >
          {favoriteSong ? (
            <Image
              source={{ uri: favoriteSong.song_artwork }}
              className="w-full h-full"
              defaultSource={require("../../assets/images/placeholder.png")}
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-neutral-700 items-center justify-center">
              <Ionicons name="add" size={24} color="#9CA3AF" />
            </View>
          )}

          {/* Edit Icon */}
          <Pressable
            className="absolute top-2 right-2 w-6 h-6 bg-black bg-opacity-70 rounded-full items-center justify-center active:bg-neutral-800"
            onPress={() => handleEditFavoriteSong(position)}
          >
            <Ionicons name="pencil" size={10} color="white" />
          </Pressable>
        </Pressable>

        {/* Song Info */}
        <View className="mt-3 h-12">
          {favoriteSong ? (
            <>
              <Text
                className="text-white text-xs font-semibold leading-tight text-center"
                numberOfLines={2}
                style={{ lineHeight: 14 }}
              >
                {favoriteSong.song_title}
              </Text>
              <Text
                className="text-gray-400 text-xs mt-1 text-center"
                numberOfLines={1}
              >
                {favoriteSong.song_artist}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-gray-400 text-xs font-semibold text-center">
                Song {position}
              </Text>
              <Text className="text-gray-500 text-xs mt-1 text-center">
                Artist
              </Text>
            </>
          )}
        </View>
      </Animatable.View>
    );
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-black justify-center items-center px-4">
        <Text className="text-white text-lg text-center mb-4">
          Unable to load profile data
        </Text>
        <TouchableOpacity
          className="bg-white px-6 py-3 rounded-full active:bg-neutral-800"
          onPress={loadUserData}
        >
          <Text className="text-black font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animatable.View
      animation="fadeIn"
      duration={500}
      className="flex-1 bg-black"
    >
      {/* Header */}
      <View className="pt-12 pb-6 px-4">
        <View className="flex-row items-center">
          <Pressable
            className="mr-4 active:bg-neutral-800"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </Pressable>
          <Text className="text-white text-xl font-semibold">Edit Profile</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Profile Picture */}
        <View className="items-center mb-8">
          <View className="relative">
            <View className="w-28 h-28 rounded-full overflow-hidden bg-bg-neutral-700">
              {profile.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  className="w-full h-full"
                  defaultSource={require("../../assets/images/placeholder.png")}
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <Text className="text-white text-3xl font-bold">
                    {(
                      profile.first_name?.[0] ||
                      profile.username?.[0] ||
                      "U"
                    ).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Edit Icon */}
            <Pressable
              className={`absolute bottom-0 right-0 w-8 h-8 rounded-full items-center justify-center border-2 border-black active:bg-neutral-800 ${
                uploadingImage ? "bg-gray-500" : "bg-gray-600"
              }`}
              onPress={handleEditProfilePicture}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="pencil" size={16} color="white" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Username */}
        <View className="mb-8">
          <Text className="text-white  font-medium mb-3">Username</Text>
          <View className="bg-neutral-700 rounded-xl px-4 py-4">
            <TextInput
              className="text-white"
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Favorite Songs */}
        <View className="mb-8">
          <Text className="text-white  font-medium mb-4">Favorite Songs</Text>
          <View className="flex-row justify-between px-2">
            {[1, 2, 3].map((position, index) =>
              renderFavoriteSongTile(position, index)
            )}
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-4 pb-8">
        <Pressable
          className="bg-white rounded-full py-4 items-center active:bg-neutral-800"
          onPress={handleSave}
        >
          <Text className="text-black  font-semibold">Save</Text>
        </Pressable>
      </View>
    </Animatable.View>
  );
}
