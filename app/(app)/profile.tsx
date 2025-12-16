import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import SkeletonLoader from "../../components/SkeletonLoader";
import ThumbsDownIcon from "../../components/ThumbsDownIcon";
import ThumbsUpIcon from "../../components/ThumbsUpIcon";
import { ActivityService } from "../../lib/activityService";
import { FavoriteSong, FavoriteSongsService } from "../../lib/favoriteSongs";
import {
  GroupedReactedSong,
  OptimizedQueriesService,
} from "../../lib/optimizedQueries";
import {
  UserProfile,
  UserProfileService,
  UserStats,
} from "../../lib/userProfile";
import { useAuth } from "../context/AuthContext";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
interface ReactedSong {
  id: string;
  song_title: string;
  song_artist: string;
  song_album?: string;
  song_artwork?: string;
  external_url?: string;
  service: "spotify" | "apple";
  created_at: string;
  reaction?: "liked" | "disliked";
  sender: {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

const getSenderDisplayName = (sender: ReactedSong["sender"]) => {
  if (sender.first_name && sender.last_name) {
    return `${sender.first_name} ${sender.last_name}`;
  }
  if (sender.first_name) return sender.first_name;
  if (sender.username) return sender.username;
  return "Unknown User";
};

function SongItem({
  song,
  index,
  isQueue = false,
  onLike,
  onDislike,
}: {
  song: GroupedReactedSong;
  index: number;
  isQueue?: boolean;
  onLike?: (songId: string) => void;
  onDislike?: (songId: string) => void;
}) {
  const translateX = useSharedValue(0);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const opacity = useSharedValue(1);

  // Swipe gradient overlay
  const swipeProgress = useSharedValue(0);
  const swipeDirection = useSharedValue(0); // -1 for left, 1 for right, 0 for none

  // TV closing animation
  const isCompleting = useSharedValue(false);
  const completionProgress = useSharedValue(0);

  const handleReaction = (type: "like" | "dislike") => {
    if (!isQueue) return;

    setReaction(type);

    // Start the database operation immediately
    if (type === "like" && onLike) {
      onLike(song.reacted_song_ids[0]);
    } else if (type === "dislike" && onDislike) {
      onDislike(song.reacted_song_ids[0]);
    }

    // Start fade out animation (just for visual effect)
    opacity.value = withTiming(0, { duration: 800 });
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (isQueue) {
        translateX.value = event.translationX;

        // Update swipe progress and direction
        const progress = Math.min(Math.abs(event.translationX) / 150, 1);
        swipeProgress.value = progress;

        if (event.translationX > 10) {
          swipeDirection.value = 1; // Right swipe (like)
        } else if (event.translationX < -10) {
          swipeDirection.value = -1; // Left swipe (dislike)
        } else {
          swipeDirection.value = 0;
        }
      }
    })
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (!isQueue) return;

      if (event.translationX > 100 && onLike) {
        // Complete like
        runOnJS(handleReaction)("like");
        translateX.value = withTiming(500);
      } else if (event.translationX < -100 && onDislike) {
        // Complete dislike
        runOnJS(handleReaction)("dislike");
        translateX.value = withTiming(-500);
      } else {
        // Reset swipe states
        translateX.value = withSpring(0);
        swipeProgress.value = withSpring(0);
        swipeDirection.value = 0;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value * (1 - Math.abs(translateX.value) / 500),
  }));

  // Swipe background style - shows behind the card as it's swiped
  const swipeBackgroundStyle = useAnimatedStyle(() => {
    const progress = swipeProgress.value;
    const direction = swipeDirection.value;

    if (direction === 0 || progress === 0) {
      return {
        opacity: 0,
      };
    }

    // Background color based on swipe direction
    const backgroundColor = direction === 1 ? "#027B1B" : "#B91030";

    return {
      backgroundColor,
      opacity: progress * 0.9,
    };
  });

  // TV closing animation style (simplified)
  const tvClosingStyle = useAnimatedStyle(() => ({
    opacity: 0,
    height: 0,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={animatedStyle}>
        <Animatable.View
          animation="fadeInUp"
          duration={500}
          delay={index * 100}
          key={song.groupKey}
          className="relative"
        >
          {/* Swipe Background - appears behind the card */}
          <Animated.View
            style={[
              swipeBackgroundStyle,
              {
                position: "absolute",
                top: 12,
                left: 16,
                right: 16,
                bottom: 0,
                borderRadius: 16,
              },
            ]}
            pointerEvents="none"
          />

          <View
            className="mx-4 p-4 mt-3 rounded-2xl border border-[#1B1B1B]"
            style={{ position: "relative", zIndex: 1 }}
          >
            <View className="flex-row items-center">
              <Image
                source={{ uri: song.song_artwork }}
                className="w-16 h-16 rounded-lg mr-3"
                defaultSource={require("../../assets/images/placeholder.png")}
              />
              <View className="flex-1 mr-3">
                <Text
                  className="text-white font-semibold text-lg"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {song.song_title}
                </Text>
                <Text
                  className="text-gray-400"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {song.song_artist}
                </Text>
              </View>

              {/* Reaction Indicator */}
              {isQueue && onLike && onDislike ? (
                <View className="flex-row space-x-3">
                  <Pressable
                    className={`w-9 h-9 rounded-full items-center justify-center mr-2 active:bg-neutral-800 ${
                      reaction === "dislike" ? "bg-red-600" : "bg-neutral-700"
                    }`}
                    onPress={() => handleReaction("dislike")}
                  >
                    <ThumbsDownIcon
                      size={18}
                      color={reaction === "dislike" ? "#FFFFFF" : "#9CA3AF"}
                    />
                  </Pressable>
                  <Pressable
                    className={`w-9 h-9 rounded-full items-center justify-center active:bg-neutral-800 ${
                      reaction === "like" ? "bg-green-600" : "bg-neutral-700"
                    }`}
                    onPress={() => handleReaction("like")}
                  >
                    <ThumbsUpIcon
                      size={18}
                      color={reaction === "like" ? "#FFFFFF" : "#9CA3AF"}
                    />
                  </Pressable>
                </View>
              ) : !isQueue && song.reaction ? (
                <View className="items-center justify-center">
                  <View
                    className={`px-2 py-1 rounded-full flex-row items-center ${
                      song.reaction === "liked"
                        ? "border border-green-600"
                        : "border border-red-600"
                    }`}
                  >
                    {song.reaction === "liked" ? (
                      <ThumbsUpIcon size={12} color="#16a34a" />
                    ) : (
                      <ThumbsDownIcon size={12} color="#dc2626" />
                    )}
                    <Text
                      className={`text-xs font-medium ml-1 ${
                        song.reaction === "liked"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {song.reaction === "liked" ? "Liked" : "Disliked"}
                    </Text>
                  </View>
                </View>
              ) : !isQueue ? (
                <Ionicons
                  name={
                    song.service === "spotify" ? "musical-notes" : "logo-apple"
                  }
                  size={16}
                  color={song.service === "spotify" ? "#1DB954" : "#FA7268"}
                />
              ) : null}
            </View>

            <View className="h-0.5 bg-gray-800 mt-4 mb-2" />

            {/* Sender info */}
            {!isQueue && (
              <View className="flex-row items-center">
                <View className="flex-row items-center flex-1">
                  <View className="flex-row">
                    {song.senders.slice(0, 3).map((sender, i) => (
                      <View
                        key={sender.id + i}
                        className={`w-6 h-6 rounded-full bg-neutral-700 items-center justify-center border-2 border-black ${
                          i > 0 ? "-ml-2" : ""
                        }`}
                      >
                        {sender.avatar_url ? (
                          <Image
                            source={{ uri: sender.avatar_url }}
                            className="w-full h-full rounded-full"
                            defaultSource={require("../../assets/images/placeholder.png")}
                          />
                        ) : (
                          <Text className="text-white text-xs font-bold">
                            {getSenderDisplayName(sender)[0]?.toUpperCase() ||
                              "U"}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                  <Text
                    className="text-gray-400 text-sm ml-2 shrink"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    <Text className="font-bold">
                      {getSenderDisplayName(song.senders[0])}
                    </Text>
                    {song.senders.length > 1 &&
                      ` and ${song.senders.length - 1} other${
                        song.senders.length - 1 > 1 ? "s" : ""
                      }`}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* TV Closing Animation */}
          <Animated.View
            style={[
              tvClosingStyle,
              {
                position: "absolute",
                bottom: 20,
                left: 32,
                right: 32,
                borderRadius: 2,
                zIndex: 10,
              },
            ]}
            pointerEvents="none"
          />
        </Animatable.View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState("My Queue");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reactedSongs, setReactedSongs] = useState<GroupedReactedSong[]>([]);
  const [queuedSongs, setQueuedSongs] = useState<GroupedReactedSong[]>([]);
  const [favoriteSongs, setFavoriteSongs] = useState<FavoriteSong[]>([]);
  // Pagination state for queue
  const [queueLoadingMore, setQueueLoadingMore] = useState(false);
  const [queueNextCursor, setQueueNextCursor] = useState<string | undefined>();
  const [queueHasMore, setQueueHasMore] = useState(false);
  // Pagination state for archive
  const [archiveLoadingMore, setArchiveLoadingMore] = useState(false);
  const [archiveNextCursor, setArchiveNextCursor] = useState<
    string | undefined
  >();
  const [archiveHasMore, setArchiveHasMore] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadUserData();
  }, [user]);

  // Reload favorite songs when screen is focused (e.g., returning from song picker)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadFavoriteSongs();
        // Also reload profile data in case avatar was updated
        loadUserData();
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
      // Fetch user profile
      const { profile: userProfile, error } =
        await UserProfileService.getUserProfile(user.id);

      if (error) {
        console.error("Error loading profile:", error);
        Alert.alert("Error", "Failed to load profile data");
        return;
      }

      setProfile(userProfile);

      // Fetch user stats
      const userStats = await UserProfileService.getUserStats(user.id);
      setStats(userStats);

      // Fetch favorite songs and reacted songs
      await Promise.all([
        loadFavoriteSongs(),
        fetchReactedSongs(),
        fetchQueuedSongs(),
      ]);
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert("Error", "Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const handleSettings = () => {
    router.push("/(app)/settings");
  };

  const fetchQueuedSongs = async (refresh: boolean = false) => {
    if (!user) return;

    try {
      // Always force refresh for queue to ensure new songs show up immediately
      const result = await OptimizedQueriesService.getQueuedSongs(
        user.id,
        undefined,
        true // Always force refresh for queue
      );
      setQueuedSongs(result.songs);
      setQueueNextCursor(result.nextCursor);
      setQueueHasMore(result.hasMore);
    } catch (error) {
      console.error("Error fetching queued songs:", error);
    }
  };

  const loadMoreQueuedSongs = async () => {
    if (!user || !queueHasMore || queueLoadingMore || !queueNextCursor) return;

    try {
      setQueueLoadingMore(true);
      const result = await OptimizedQueriesService.getQueuedSongs(
        user.id,
        queueNextCursor
      );
      setQueuedSongs((prev) => [...prev, ...result.songs]);
      setQueueNextCursor(result.nextCursor);
      setQueueHasMore(result.hasMore);
    } catch (error) {
      console.error("Error loading more queued songs:", error);
    } finally {
      setQueueLoadingMore(false);
    }
  };

  const fetchReactedSongs = async (refresh: boolean = false) => {
    if (!user) return;

    try {
      const result = await OptimizedQueriesService.getArchiveSongs(
        user.id,
        undefined,
        refresh
      );
      setReactedSongs(result.songs);
      setArchiveNextCursor(result.nextCursor);
      setArchiveHasMore(result.hasMore);
    } catch (error) {
      console.error("Error fetching reacted songs:", error);
    }
  };

  const loadMoreReactedSongs = async () => {
    if (!user || !archiveHasMore || archiveLoadingMore || !archiveNextCursor)
      return;

    try {
      setArchiveLoadingMore(true);
      const result = await OptimizedQueriesService.getArchiveSongs(
        user.id,
        archiveNextCursor
      );
      setReactedSongs((prev) => [...prev, ...result.songs]);
      setArchiveNextCursor(result.nextCursor);
      setArchiveHasMore(result.hasMore);
    } catch (error) {
      console.error("Error loading more reacted songs:", error);
    } finally {
      setArchiveLoadingMore(false);
    }
  };

  const handleQueueLike = async (songId: string) => {
    if (!user) return;

    // Find the song to update for activity creation
    const songToUpdate = queuedSongs.find(
      (song) => song.reacted_song_ids[0] === songId
    );

    console.log(
      "Starting queue like operation for song:",
      songToUpdate?.song_title
    );

    // Update using optimized service (handles cache updates too)
    const { success, error } = await OptimizedQueriesService.reactToSong(
      user.id,
      [songId],
      true
    );

    if (!success) {
      console.error("Error liking song:", error);
      // Since animation already removed the song, refresh the list to bring it back
      fetchQueuedSongs();
      return;
    }

    console.log("Queue like operation completed successfully");

    // Animate the remaining songs moving up
    LayoutAnimation.configureNext({
      duration: 400,
      create: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
        springDamping: 0.8,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.7,
        property: LayoutAnimation.Properties.scaleY,
      },
      delete: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    // Remove the song from the list after successful database update
    setQueuedSongs((prev) =>
      prev.filter((song) => song.reacted_song_ids[0] !== songId)
    );

    // Create activities for the senders (excluding self)
    if (songToUpdate) {
      for (const sender of songToUpdate.senders) {
        // Don't create activity if user is reacting to their own song
        if (sender.id !== user.id) {
          const result = await ActivityService.createSongLikedActivity(
            user.id,
            sender.id,
            songToUpdate.song_title,
            songToUpdate.song_artist,
            songToUpdate.song_artwork
          );
          console.log("Queue like activity creation result:", result);
        }
      }
    }

    // Refresh archive to show the newly reacted song
    fetchReactedSongs();
  };

  const handleQueueDislike = async (songId: string) => {
    if (!user) return;

    // Find the song to update for activity creation
    const songToUpdate = queuedSongs.find(
      (song) => song.reacted_song_ids[0] === songId
    );

    console.log(
      "Starting queue dislike operation for song:",
      songToUpdate?.song_title
    );

    // Update using optimized service (handles cache updates too)
    const { success, error } = await OptimizedQueriesService.reactToSong(
      user.id,
      [songId],
      false
    );

    if (!success) {
      console.error("Error disliking song:", error);
      // Since animation already removed the song, refresh the list to bring it back
      fetchQueuedSongs();
      return;
    }

    console.log("Queue dislike operation completed successfully");

    // Animate the remaining songs moving up
    LayoutAnimation.configureNext({
      duration: 400,
      create: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
        springDamping: 0.8,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.7,
        property: LayoutAnimation.Properties.scaleY,
      },
      delete: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    // Remove the song from the list after successful database update
    setQueuedSongs((prev) =>
      prev.filter((song) => song.reacted_song_ids[0] !== songId)
    );

    // Create activities for the senders (excluding self)
    if (songToUpdate) {
      for (const sender of songToUpdate.senders) {
        // Don't create activity if user is reacting to their own song
        if (sender.id !== user.id) {
          const result = await ActivityService.createSongDislikedActivity(
            user.id,
            sender.id,
            songToUpdate.song_title,
            songToUpdate.song_artist,
            songToUpdate.song_artwork
          );
          console.log("Queue dislike activity creation result:", result);
        }
      }
    }

    // Refresh archive to show the newly reacted song
    fetchReactedSongs();
  };

  const handleAddFavoriteSong = async (index: number) => {
    if (!profile) {
      console.log("No profile found, returning");
      return;
    }

    const isSpotifyConnected = UserProfileService.isSpotifyConnected(profile);
    const isAppleMusicConnected =
      UserProfileService.isAppleMusicConnected(profile);

    // Check what services are connected
    if (!isSpotifyConnected && !isAppleMusicConnected) {
      // No services connected - ask user to connect
      Alert.alert(
        "Connect Music Service",
        "To add favorite songs, you need to connect a music service first.",
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
            onPress: () => openSpotifyPicker(index),
          },
          {
            text: "Apple Music",
            onPress: () => openAppleMusicPicker(index),
          },
        ]
      );
    } else if (isSpotifyConnected) {
      // Only Spotify connected
      openSpotifyPicker(index);
    } else if (isAppleMusicConnected) {
      // Only Apple Music connected
      openAppleMusicPicker(index);
    }
  };

  const openSpotifyPicker = async (index: number) => {
    router.push({
      pathname: "/(app)/song-picker",
      params: {
        service: "spotify",
        index: index.toString(),
      },
    });
  };

  const openAppleMusicPicker = async (index: number) => {
    router.push({
      pathname: "/(app)/song-picker",
      params: {
        service: "apple",
        index: index.toString(),
      },
    });
  };

  const handleTabChange = (tab: "My Queue" | "Archive") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
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
          className="bg-white px-6 py-3 rounded-full"
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
      <FlatList
        data={activeTab === "My Queue" ? queuedSongs : reactedSongs}
        keyExtractor={(item) => item.groupKey}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View className="pb-6 px-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-3xl font-bold">
                  {profile.username || "user"}
                </Text>
                <View className="px-3 py-1 rounded-full">
                  <Text className="text-green-600 text-base font-semibold">
                    ● {stats?.streak_days || 0} Day Streak
                  </Text>
                </View>
              </View>

              {/* Profile Section */}
              <View className="flex-row items-center mb-4">
                <View className="w-24 h-24 rounded-full mr-4 bg-bg-neutral-700 items-center justify-center">
                  {profile.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      className="w-20 h-20 rounded-full"
                    />
                  ) : (
                    <Text className="text-white text-3xl font-bold">
                      {(
                        profile.first_name?.[0] ||
                        profile.username?.[0] ||
                        "U"
                      ).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View className="flex-row flex-1 justify-around items-center">
                  <Pressable
                    className="items-center active:bg-neutral-800"
                    onPress={() => router.push("/(app)/friends-list")}
                  >
                    <Text className="text-white text-2xl font-bold">
                      {stats?.friends_count || 0}
                    </Text>
                    <Text className="text-gray-400 text-sm">Friends</Text>
                  </Pressable>
                  <View className="w-px h-8 bg-neutral-700" />
                  <View className="items-center">
                    <Text className="text-white text-2xl font-bold">
                      {stats?.songs_sent_count || 0}
                    </Text>
                    <Text className="text-gray-400 text-sm">Songs Sent</Text>
                  </View>
                  <View className="w-px h-8 bg-neutral-700" />
                  <View className="items-center">
                    <Text className="text-white text-2xl font-bold">
                      {stats?.likes_received_count || 0}
                    </Text>
                    <Text className="text-gray-400 text-sm">Likes</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row mb-6 gap-3">
                <Pressable
                  className="bg-[#1B1B1B] border-2 border-neutral-800 py-2 rounded-[20px] active:bg-neutral-800 flex-1 items-center"
                  onPress={() => router.push("/(app)/edit-profile")}
                >
                  <Text className="text-white text-md">Edit Profile</Text>
                </Pressable>
                <Pressable
                  className="bg-[#1B1B1B] border-2 border-neutral-800 py-2 rounded-[20px] active:bg-neutral-800 flex-1 items-center"
                  onPress={() =>
                    router.push({
                      pathname: "/(accountsetup)/linkaccount",
                      params: { context: "profile" },
                    })
                  }
                >
                  <Text className="text-white text-md">
                    {UserProfileService.hasConnectedMusicService(profile)
                      ? "Manage Apps"
                      : "Link Apps"}
                  </Text>
                </Pressable>
                <Pressable
                  className="bg-[#1B1B1B] border-2 border-neutral-800 py-2 rounded-[20px] active:bg-neutral-800 flex-1 items-center"
                  onPress={handleSettings}
                >
                  <Text className="text-white text-md">Settings</Text>
                </Pressable>
              </View>

              {/* Favorite Songs */}
              <View className="mb-6">
                <Text className="text-white text-xl font-semibold mb-4">
                  Favorite Songs
                </Text>
                <View className="flex-row justify-center gap-2">
                  {[1, 2, 3].map((position) => {
                    const favoriteSong = favoriteSongs.find(
                      (song) => song.position === position
                    );

                    return (
                      <View key={position} className="items-center flex-1 ml-1 mr-1">
                        <Pressable
                          className="active:bg-neutral-800 w-full aspect-square rounded-lg overflow-hidden"
                          onPress={() => {
                            console.log(
                              "Pressable pressed for position:",
                              position
                            );
                            if (!favoriteSong) {
                              handleAddFavoriteSong(position);
                            }
                          }}
                        >
                          {favoriteSong ? (
                            <Image
                              source={{ uri: favoriteSong.song_artwork }}
                              className="w-full h-full"
                              defaultSource={require("../../assets/images/placeholder.png")}
                            />
                          ) : (
                            <View className="w-full h-full bg-neutral-700 rounded-lg border border-neutral-700 justify-center items-center">
                              <Ionicons name="add" size={32} color="#9CA3AF" />
                            </View>
                          )}
                        </Pressable>

                        {/* Song title and artist outside Pressable, so active background does not affect text */}
                        <View className="w-full mt-2">
                          {favoriteSong ? (
                            <>
                              <Text
                                className="text-white text-xs font-bold text-center"
                                numberOfLines={1}
                              >
                                {favoriteSong.song_title}
                              </Text>
                              <Text
                                className="text-gray-400 text-xs text-center mt-0.5"
                                numberOfLines={1}
                              >
                                {favoriteSong.song_artist}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text className="text-gray-400 text-s text-center font-bold">
                                Song {position}
                              </Text>
                              <Text className="text-gray-500 text-s text-center mt-0.5">
                                Artist
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Tabs */}
            <View className="relative mb-2">
              <View className="flex-row">
                <Pressable
                  className="flex-1 pb-4 items-center"
                  onPress={() => handleTabChange("My Queue")}
                >
                  <Text
                    className={` text-lg ${
                      activeTab === "My Queue" ? "text-white" : "text-gray-400"
                    }`}
                  >
                    My Queue
                  </Text>
                </Pressable>
                <Pressable
                  className="flex-1 pb-4 items-center"
                  onPress={() => handleTabChange("Archive")}
                >
                  <Text
                    className={` text-lg ${
                      activeTab === "Archive" ? "text-white" : "text-gray-400"
                    }`}
                  >
                    Archive
                  </Text>
                </Pressable>
              </View>
              <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B1B1B]" />
              <Animatable.View
                animation={
                  activeTab === "My Queue" ? "fadeInLeft" : "fadeInRight"
                }
                duration={300}
                className={`absolute bottom-0 h-0.5 bg-white w-1/2 ${
                  activeTab === "My Queue" ? "left-0" : "left-1/2"
                }`}
              />
            </View>
          </>
        }
        renderItem={({ item, index }) =>
          activeTab === "My Queue" ? (
            <SongItem
              key={item.groupKey}
              song={item}
              index={index}
              isQueue={true}
              onLike={handleQueueLike}
              onDislike={handleQueueDislike}
            />
          ) : (
            <SongItem key={item.groupKey} song={item} index={index} />
          )
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center px-8 py-20">
            {activeTab === "My Queue" ? (
              <>
                <Ionicons name="list-outline" size={64} color="#9CA3AF" />
                <Text className="text-white text-lg text-center mb-2 mt-4">
                  Your queue is empty
                </Text>
                <Text className="text-gray-400 text-sm text-center">
                  Share songs to yourself to add them to your queue
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="musical-notes-outline"
                  size={64}
                  color="#9CA3AF"
                />
                <Text className="text-white text-lg text-center mb-2 mt-4">
                  No reactions yet
                </Text>
                <Text className="text-gray-400 text-sm text-center">
                  Songs you've liked or disliked will appear here
                </Text>
              </>
            )}
          </View>
        }
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onEndReached={
          activeTab === "My Queue" ? loadMoreQueuedSongs : loadMoreReactedSongs
        }
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => {
          const isLoadingMore =
            activeTab === "My Queue" ? queueLoadingMore : archiveLoadingMore;
          return isLoadingMore ? (
            <View className="py-4 justify-center items-center">
              <Text className="text-gray-400">Loading more...</Text>
            </View>
          ) : null;
        }}
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
        <Pressable
          className="flex-1 items-center py-3 active:bg-neutral-800"
          onPress={() => router.push("/(app)/activity")}
        >
          <Ionicons name="heart-outline" size={24} color="#9CA3AF" />
          <Text className="text-gray-400 text-xs mt-1">Activity</Text>
        </Pressable>
        <Pressable className="flex-1 items-center py-3 active:bg-neutral-800">
          <Ionicons name="person" size={24} color="#ffffff" />
          <Text className="text-white text-xs mt-1">Profile</Text>
        </Pressable>
      </View>
    </Animatable.View>
  );
}
