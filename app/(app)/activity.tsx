import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Image, Pressable, Text, View } from "react-native";
import * as Animatable from "react-native-animatable";
import AddPersonIcon from "../../components/AddPersonIcon";
import SkeletonLoader from "../../components/SkeletonLoader";
import {
  ActivityGrouped,
  Activity as ActivityItem,
  ActivityService,
} from "../../lib/activityService";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Activity() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [groupedActivities, setGroupedActivities] = useState<ActivityGrouped>({
    new: [],
    earlierToday: [],
    yesterday: [],
    older: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [processedFriendRequests, setProcessedFriendRequests] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    fetchActivities();
  }, [user]);

  // Refresh activities when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchActivities();
      }
    }, [user])
  );

  const fetchActivities = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await ActivityService.getUserActivities(user.id);
      setActivities(result.activities);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);

      const grouped = ActivityService.groupActivitiesByTime(result.activities);
      setGroupedActivities(grouped);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreActivities = async () => {
    if (!user || !hasMore || loadingMore || !nextCursor) return;

    try {
      setLoadingMore(true);
      const result = await ActivityService.getUserActivities(
        user.id,
        nextCursor
      );
      const newActivities = [...activities, ...result.activities];
      setActivities(newActivities);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);

      const grouped = ActivityService.groupActivitiesByTime(newActivities);
      setGroupedActivities(grouped);
    } catch (error) {
      console.error("Error loading more activities:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFriendRequest = async (
    activity: ActivityItem,
    action: "accept" | "decline"
  ) => {
    if (!user) return;

    setProcessedFriendRequests((prev) => new Set(prev).add(activity.id));

    try {
      if (action === "accept") {
        // Accept the friend request in the friendships table
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("user_id", activity.actor_id)
          .eq("friend_id", user.id)
          .eq("status", "pending");

        if (error) {
          console.error("Error accepting friend request:", error);
          Alert.alert("Error", "Failed to accept friend request");
          return;
        }

        // Create activity for the original sender
        await ActivityService.createFriendAcceptedActivity(
          user.id,
          activity.actor_id
        );

        Alert.alert("Success", "Friend request accepted!");
      } else {
        // Decline the friend request
        const { error } = await supabase
          .from("friendships")
          .update({ status: "declined" })
          .eq("user_id", activity.actor_id)
          .eq("friend_id", user.id)
          .eq("status", "pending");

        if (error) {
          console.error("Error declining friend request:", error);
          Alert.alert("Error", "Failed to decline friend request");
          return;
        }

        Alert.alert("Request declined", "Friend request declined");
      }

      // Mark activity as completed
      await ActivityService.markActivityCompleted(activity.id);

      // Refresh activities
      fetchActivities();
    } catch (error) {
      console.error(`Error ${action}ing friend request:`, error);
      Alert.alert("Error", `Failed to ${action} friend request`);
    }
  };

  const getActivityText = (activity: ActivityItem) => {
    switch (activity.type) {
      case "friend_request":
        return "Added you as a friend!";
      case "friend_accepted":
        return "Accepted your friend request!";
      case "song_liked":
        return `Liked your hit - ${activity.song_title}`;
      case "song_disliked":
        return `Disliked your hit - ${activity.song_title}`;
      case "song_sent":
        return `Shared "${activity.song_title}" with you`;
      default:
        return "Unknown activity";
    }
  };

  const getActivityTextColor = (activity: ActivityItem) => {
    switch (activity.type) {
      case "friend_accepted":
        return "text-green-500";
      default:
        return "text-white";
    }
  };

  const renderActivityText = (activity: ActivityItem) => {
    switch (activity.type) {
      case "song_liked":
        return (
          <Text className="text-lg mt-1" numberOfLines={1} ellipsizeMode="tail">
            <Text className="text-green-500">Liked</Text>
            <Text className="text-white">
              {" "}
              your hit - {activity.song_title}
            </Text>
          </Text>
        );
      case "song_disliked":
        return (
          <Text className="text-lg mt-1" numberOfLines={1} ellipsizeMode="tail">
            <Text className="text-red-500">Disliked</Text>
            <Text className="text-white">
              {" "}
              your hit - {activity.song_title}
            </Text>
          </Text>
        );
      default:
        return (
          <Text
            className={`text-lg mt-1 ${getActivityTextColor(activity)}`}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {getActivityText(activity)}
          </Text>
        );
    }
  };

  const renderActivityItem = (activity: ActivityItem, index: number) => {
    if (activity.actor.id === user?.id) {
      return null; // Don't render anything if it's the same user
    }

    const isProcessed = processedFriendRequests.has(activity.id);
    const actorName =
      activity.actor.id === user?.id
        ? "You"
        : ActivityService.getActorDisplayName(activity.actor);
    const timestamp = ActivityService.formatTimestamp(activity.created_at);

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={500}
        delay={index * 100}
        key={activity.id}
        className="bg-neutral-900/30 p-4 rounded-lg"
      >
        <View className="flex-row items-center">
          {/* User Avatar */}
          <View className="w-12 h-12 rounded-full mr-3 bg-neutral-700 items-center justify-center">
            {activity.actor.avatar_url ? (
              <Image
                source={{ uri: activity.actor.avatar_url }}
                className="w-12 h-12 rounded-full"
                defaultSource={require("../../assets/images/placeholder.png")}
              />
            ) : (
              <Text className="text-white text-xl font-bold">
                {actorName[0]?.toUpperCase() || "U"}
              </Text>
            )}
          </View>

          {/* Content */}
          <View className="flex-1">
            <View className="flex-row items-center flex-1">
              <Text
                className="text-white font-semibold mr-2 shrink"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {actorName}
              </Text>
              <Text className="text-gray-500 text-xs">{timestamp}</Text>
            </View>
            {renderActivityText(activity)}
          </View>

          {/* Right Side Content */}
          <View className="flex-row items-center ml-2">
            {/* Song Artwork */}
            {activity.song_artwork && (
              <Image
                source={{ uri: activity.song_artwork }}
                className="w-10 h-10 rounded-lg mr-3"
                defaultSource={require("../../assets/images/placeholder.png")}
              />
            )}

            {/* Action Buttons */}
            {activity.type === "friend_request" &&
              activity.is_actionable &&
              !activity.is_completed &&
              !isProcessed && (
                <Pressable
                  className="bg-white px-4 py-2 rounded-full active:bg-gray-200"
                  onPress={() => handleFriendRequest(activity, "accept")}
                >
                  <Text className="text-black font-medium text-lg">
                    Add&nbsp;Back
                  </Text>
                </Pressable>
              )}

            {((activity.type === "friend_accepted" && activity.is_completed) ||
              activity.is_completed ||
              isProcessed) && (
              <View className="border-2 border-neutral-700 px-4 py-2 rounded-full flex-row items-center">
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                <Text className="text-white font-medium text-lg">
                  {activity.type === "friend_request" || isProcessed
                    ? "Added"
                    : activity.type === "friend_accepted"
                      ? "Friends"
                      : "Done"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Animatable.View>
    );
  };

  const renderSection = (title: string, items: ActivityItem[]) => {
    if (items.length === 0) return null;

    return (
      <View className="mb-8">
        <View className="mb-4">
          <Text className="text-white text-xl font-bold px-4">{title}</Text>
          <View className="h-0.5 bg-neutral-800 mt-2" />
        </View>
        <View className="space-y-2">
          {items.map((item, index) => renderActivityItem(item, index))}
        </View>
      </View>
    );
  };

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
      <View className="pt-1 pb-6 px-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-3xl font-bold">Activity</Text>
            <Text className="text-gray-400 text-xl mt-1">
              Recent notifications from friends
            </Text>
          </View>
          <Pressable
            className="w-[3rem] h-[3rem] border-2 border-neutral-700 rounded-lg items-center justify-center active:bg-neutral-800"
            onPress={() => router.push("/(app)/friends")}
          >
            <AddPersonIcon size={25} color="white" />
          </Pressable>
        </View>
      </View>

      {/* Activity Feed */}
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => renderActivityItem(item, index)}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreActivities}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() =>
          loadingMore ? (
            <View className="py-4 justify-center items-center">
              <Text className="text-gray-400">Loading more...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center px-8 py-20">
            <Ionicons name="notifications-outline" size={64} color="#9CA3AF" />
            <Text className="text-white text-xl text-center mb-2 mt-4">
              No activities yet
            </Text>
            <Text className="text-gray-400 text-lg text-center">
              Activities from your friends will appear here
            </Text>
          </View>
        }
      />

      {/* Bottom Navigation */}
      <View className="flex-row ">
        <Pressable
          className="flex-1 items-center py-3 active:bg-neutral-800"
          onPress={() => router.push("/(app)")}
        >
          <Ionicons name="home-outline" size={24} color="#9CA3AF" />
          <Text className="text-gray-400 text-xs mt-1">Hitlist</Text>
        </Pressable>
        <Pressable className="flex-1 items-center py-3 active:bg-neutral-800">
          <Ionicons name="heart" size={24} color="#ffffff" />
          <Text className="text-white text-xs mt-1">Activity</Text>
        </Pressable>
        <Pressable
          className="flex-1 items-center py-3 active:bg-neutral-800"
          onPress={() => router.push("/(app)/profile")}
        >
          <Ionicons name="person-outline" size={24} color="#9CA3AF" />
          <Text className="text-gray-400 text-xs mt-1">Profile</Text>
        </Pressable>
      </View>
    </Animatable.View>
  );
}
