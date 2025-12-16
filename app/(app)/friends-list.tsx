import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import * as Animatable from "react-native-animatable";
import SkeletonLoader from "../../components/SkeletonLoader";
import { Friend, ShareExtensionService } from "../../lib/shareExtensionService";
import { useAuth } from "../context/AuthContext";

export default function FriendsList() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadFriends();
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userFriends = await ShareExtensionService.getUserFriends(
        user.id,
        false
      );
      setFriends(userFriends);
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (friend: Friend): string => {
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

  const handleFriendPress = (friend: Friend) => {
    router.push({
      pathname: "/(app)/friend-profile",
      params: {
        friendId: friend.id,
        friendName: getDisplayName(friend),
      },
    });
  };

  const renderFriendItem = (friend: Friend, index: number) => (
    <Animatable.View animation="fadeInUp" duration={500} delay={index * 100}>
      <Pressable
        key={friend.id}
        className="flex-row items-center py-4 px-4 border border-neutral-700 rounded-2xl mb-3 active:bg-neutral-800"
        onPress={() => handleFriendPress(friend)}
      >
        {/* Friend Avatar */}
        <View className="w-12 h-12 rounded-full mr-3 bg-neutral-700 items-center justify-center">
          {friend.avatar_url ? (
            <Image
              source={{ uri: friend.avatar_url }}
              className="w-12 h-12 rounded-full"
              defaultSource={require("../../assets/images/placeholder.png")}
            />
          ) : (
            <Text className="text-white text-lg font-bold">
              {getUserInitials(friend)}
            </Text>
          )}
        </View>

        {/* Friend Info */}
        <View className="flex-1">
          <Text className="text-white font-semibold ">
            {getDisplayName(friend)}
          </Text>
          {friend.username && (
            <Text className="text-gray-400 text-lg">@{friend.username}</Text>
          )}
        </View>

        {/* Arrow Icon */}
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </Pressable>
    </Animatable.View>
  );

  if (loading) {
    return <SkeletonLoader />;
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
          <Text className="text-white text-xl font-semibold">
            Friends ({friends.length})
          </Text>
        </View>
      </View>

      {/* Friends List */}
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {friends.length > 0 ? (
          friends.map((friend, index) => renderFriendItem(friend, index))
        ) : (
          <View className="flex-1 justify-center items-center px-8 py-20">
            <Ionicons name="people-outline" size={64} color="#9CA3AF" />
            <Text className="text-white text-lg text-center mb-2 mt-4">
              No friends yet
            </Text>
            <Text className="text-gray-400 text-lg text-center mb-6">
              Add friends to start sharing music
            </Text>
            <Pressable
              className="bg-white px-6 py-3 rounded-full active:bg-neutral-800"
              onPress={() => router.push("/(app)/friends")}
            >
              <Text className="text-black font-semibold">Add Friends</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Animatable.View>
  );
}
