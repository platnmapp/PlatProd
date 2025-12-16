import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useAuth } from "../app/context/AuthContext";
import { MusicContent } from "../lib/musicContentService";
import { Friend, ShareExtensionService } from "../lib/shareExtensionService";
import { UserProfile, UserProfileService } from "../lib/userProfile";

interface ShareExtensionProps {
  sharedText: string;
  onDismiss: () => void;
  musicContent: MusicContent | null;
}

export default function ShareExtension({
  sharedText,
  onDismiss,
  musicContent,
}: ShareExtensionProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [parsedSong, setParsedSong] = useState<MusicContent | null>(null);
  const [currentUserProfile, setCurrentUserProfile] =
    useState<UserProfile | null>(null);
  const { user: currentUser } = useAuth();

  // Remove the internal handleDismiss since onDismiss prop handles navigation
  // const handleDismiss = () => {
  //   console.log("Share extension dismissed, navigating to profile");
  //   router.replace("/(app)/profile");
  // };

  useEffect(() => {
    if (currentUser) {
      loadInitialData();
    }
  }, [currentUser]);

  const loadInitialData = async () => {
    setLoading(true);
    if (musicContent) {
      setParsedSong(musicContent);
    }
    await Promise.all([loadFriends(), loadUserProfile()]);
    setLoading(false);
  };

  const loadFriends = async () => {
    if (!currentUser) return;
    try {
      const userFriends = await ShareExtensionService.getUserFriends(
        currentUser.id
      );
      setFriends(userFriends);
    } catch (error) {
      console.error("Error loading friends:", error);
    }
  };

  const loadUserProfile = async () => {
    if (!currentUser) return;
    try {
      const { profile } = await UserProfileService.getUserProfile(
        currentUser.id
      );
      setCurrentUserProfile(profile);
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const handleShare = async () => {
    if (!parsedSong || !currentUser || selectedFriends.size === 0) {
      Alert.alert("Error", "No song data available to share");
      return;
    }

    try {
      setSharing(true);
      const sharedSong = {
        ...parsedSong,
        artist: parsedSong.artist || "Unknown Artist",
        album: parsedSong.album,
        service: parsedSong.service as "spotify" | "apple",
        external_url: parsedSong.externalUrl,
      };

      const result = await ShareExtensionService.shareSongWithFriends(
        currentUser.id,
        sharedSong,
        Array.from(selectedFriends)
      );

      if (result.success) {
        Alert.alert("Success", "Song shared successfully!");
        onDismiss();
      } else {
        Alert.alert("Error", result.error || "Failed to share song");
      }
    } catch (error) {
      console.error("Error sharing song:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setSharing(false);
    }
  };

  const handleToggleFriend = (friendId: string) => {
    const newSelectedFriends = new Set(selectedFriends);
    if (newSelectedFriends.has(friendId)) {
      newSelectedFriends.delete(friendId);
    } else {
      newSelectedFriends.add(friendId);
    }
    setSelectedFriends(newSelectedFriends);
  };

  const handleAddToQueue = () => {
    if (currentUserProfile) {
      handleToggleFriend(currentUserProfile.id);
    }
  };

  const getFriendDisplayName = (friend: Friend): string => {
    if (friend.first_name && friend.last_name) {
      return `${friend.first_name} ${friend.last_name}`;
    }
    if (friend.first_name) {
      return friend.first_name;
    }
    if (friend.username) {
      return friend.username;
    }
    return "User";
  };

  const getUserInitials = (friend: Friend): string => {
    if (friend.first_name) {
      return friend.first_name[0].toUpperCase();
    }
    if (friend.username) {
      return friend.username[0].toUpperCase();
    }
    return "U";
  };

  const getUserProfileInitials = (profile: UserProfile): string => {
    if (profile.first_name) {
      return profile.first_name[0].toUpperCase();
    }
    if (profile.username) {
      return profile.username[0].toUpperCase();
    }
    return "U";
  };

  const renderQueueItem = () => {
    if (!currentUserProfile) return null;

    return (
      <View>
        {/* Separator line above queue item */}
        <View
          style={{
            backgroundColor: "#1B1B1B",
            height: 1,
            marginHorizontal: 0,
          }}
        />

        <TouchableOpacity
          key={currentUserProfile.id}
          style={{
            backgroundColor: "#0E0E0E",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: selectedFriends.has(currentUserProfile.id)
              ? "#FFFFFF"
              : "transparent",
            paddingHorizontal: 16,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            height: 72,
            marginVertical: 4,
          }}
          onPress={handleAddToQueue}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 12,
              backgroundColor: "#374151",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {currentUserProfile.avatar_url ? (
              <Image
                source={{ uri: currentUserProfile.avatar_url }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            ) : (
              <Text className="text-white text-base font-semibold">
                {getUserProfileInitials(currentUserProfile)}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold text-base">
              {UserProfileService.getDisplayName(currentUserProfile)}
            </Text>
            <Text className="text-gray-300 text-sm">
              @{currentUserProfile.username || "user"}
            </Text>
          </View>
          <View
            style={{
              width: 24,
              height: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selectedFriends.has(currentUserProfile.id) ? (
              <Ionicons name="checkmark-circle" size={24} color="white" />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color="#6B7280" />
            )}
          </View>
        </TouchableOpacity>

        {/* Separator line below queue item */}
        <View
          style={{
            backgroundColor: "#1B1B1B",
            height: 1,
            marginHorizontal: 0,
          }}
        />
      </View>
    );
  };

  const renderFriendItem = (friend: Friend, index: number) => (
    <Animatable.View animation="fadeInUp" duration={500} delay={index * 100}>
      <View>
        {/* Separator line above each cell */}
        <View
          style={{
            backgroundColor: "#1B1B1B",
            height: 1,
            marginHorizontal: 0,
          }}
        />

        <TouchableOpacity
          key={friend.id}
          style={{
            backgroundColor: "#0E0E0E",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: selectedFriends.has(friend.id)
              ? "#FFFFFF"
              : "transparent",
            paddingHorizontal: 16,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            height: 72,
            marginVertical: 4,
          }}
          onPress={() => handleToggleFriend(friend.id)}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 12,
              backgroundColor: "#374151",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {friend.avatar_url ? (
              <Image
                source={{ uri: friend.avatar_url }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            ) : (
              <Text className="text-white text-base font-semibold">
                {getUserInitials(friend)}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold text-base">
              {getFriendDisplayName(friend)}
            </Text>
            <Text className="text-gray-300 text-sm">@{friend.username}</Text>
          </View>
          <View
            style={{
              width: 24,
              height: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selectedFriends.has(friend.id) ? (
              <Ionicons name="checkmark-circle" size={24} color="white" />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color="#6B7280" />
            )}
          </View>
        </TouchableOpacity>

        {/* Separator line below the last cell */}
        {index === friends.length - 1 && (
          <View
            style={{
              backgroundColor: "#1B1B1B",
              height: 1,
              marginHorizontal: 0,
            }}
          />
        )}
      </View>
    </Animatable.View>
  );

  if (loading) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: "#0E0E0E" }}
      >
        <ActivityIndicator size="large" color="white" />
        <Text className="text-white mt-4">Loading friends...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#0E0E0E" }}>
      {/* Top section with dash, title, and cancel */}
      <View className="pt-2 px-4">
        {/* Top dash */}
        <View
          style={{
            backgroundColor: "#6B7280",
            height: 5,
            width: 40,
            borderRadius: 2.5,
            alignSelf: "center",
            marginTop: 8,
            marginBottom: 16,
          }}
        />

        {/* Title and Cancel button */}
        <View
          className="flex-row items-center justify-center mb-6"
          style={{ position: "relative" }}
        >
          <Text className="text-white text-lg font-bold">Platnm</Text>
          <TouchableOpacity
            onPress={onDismiss}
            style={{ position: "absolute", right: 0 }}
          >
            <Text className="text-gray-400 text-base">Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Song info header */}
        {parsedSong && (
          <View
            className="flex-row items-center mb-4 p-3"
            style={{
              backgroundColor: "#1B1B1B",
              borderRadius: 12,
              height: 84,
            }}
          >
            {parsedSong.artwork ? (
              <Image
                source={{ uri: parsedSong.artwork }}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  marginRight: 12,
                }}
              />
            ) : (
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  marginRight: 12,
                  backgroundColor: "#374151",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="musical-notes" size={32} color="#9CA3AF" />
              </View>
            )}
            <View className="flex-1">
              <Text
                className="text-white text-base font-bold"
                numberOfLines={1}
              >
                {parsedSong.title}
              </Text>
              <Text className="text-gray-300 text-base" numberOfLines={1}>
                {parsedSong.artist}
              </Text>
            </View>
          </View>
        )}

        {/* Search bar */}
        <View
          className="flex-row items-center px-4 mb-2 mt-2"
          style={{
            backgroundColor: "rgba(46, 46, 46, 1)",
            borderRadius: 18,
            height: 50,
          }}
        >
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search for friends"
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-white ml-3"
          />
        </View>
      </View>
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Add to Queue Section */}
        <Text className="text-[#9CA3AF] text-base font-semibold mt-6">
          Add to Queue
        </Text>
        {renderQueueItem()}

        {/* Share with Friends Section */}
        <Text className="text-[#9CA3AF] text-base font-semibold mb-2 mt-6">
          Share with Friends
        </Text>
        {friends.length > 0 ? (
          friends.map((friend, index) => renderFriendItem(friend, index))
        ) : (
          <View className="flex-1 justify-center items-center px-8 py-20">
            <Ionicons name="people-outline" size={64} color="#9CA3AF" />
            <Text className="text-white text-lg text-center mb-2 mt-4">
              No friends to share with
            </Text>
            <Text className="text-gray-400 text-sm text-center">
              Add friends to start sharing music
            </Text>
          </View>
        )}
      </ScrollView>
      <View className="px-4 pb-4">
        <TouchableOpacity
          style={{
            backgroundColor: selectedFriends.size > 0 ? "#FFFFFF" : "#374151",
            borderRadius: 25,
            height: 50,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={handleShare}
          disabled={selectedFriends.size === 0 || sharing}
        >
          {sharing ? (
            <ActivityIndicator
              size="small"
              color={selectedFriends.size > 0 ? "black" : "rgba(46, 46, 46, 1)"}
            />
          ) : (
            <Text
              style={{
                color:
                  selectedFriends.size > 0 ? "#000000" : "rgba(46, 46, 46, 1)",
                fontSize: 16,
                fontWeight: "bold",
              }}
            >
              Share
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
