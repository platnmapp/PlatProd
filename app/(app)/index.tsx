import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
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
import CrossPlatformSearchResults from "../../components/CrossPlatformSearchResults";
import SkeletonLoader from "../../components/SkeletonLoader";
import ThumbsDownIcon from "../../components/ThumbsDownIcon";
import ThumbsUpIcon from "../../components/ThumbsUpIcon";
import { ActivityService } from "../../lib/activityService";
import { MusicUrlHandler, SearchResultTrack } from "../../lib/musicUrlHandler";
import {
  GroupedSharedSong,
  OptimizedQueriesService,
} from "../../lib/optimizedQueries";
import { useAuth } from "../context/AuthContext";

const { height: screenHeight } = Dimensions.get("window");

interface SharedSong {
  id: string;
  song_title: string;
  song_artist: string;
  song_album?: string;
  song_artwork?: string;
  external_url?: string;
  service: "spotify" | "apple";
  created_at: string;
  liked?: boolean | null;
  rated_at?: string;
  sender: {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

type SortOption = "recent" | "artist" | "title";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatTimestamp = (timestamp: string) => {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${diffWeeks}w`;
};

const getSenderDisplayName = (sender: SharedSong["sender"]) => {
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
  onLike,
  onDislike,
  user,
}: {
  song: GroupedSharedSong;
  index: number;
  onLike: (songId: string[]) => void;
  onDislike: (songId: string[]) => void;
  user: any;
}) {
  const translateX = useSharedValue(0);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const opacity = useSharedValue(1);

  // Track if component is still mounted
  const isMountedRef = useRef(true);

  // Swipe gradient overlay
  const swipeProgress = useSharedValue(0);
  const swipeDirection = useSharedValue(0); // -1 for left, 1 for right, 0 for none

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleReaction = (type: "like" | "dislike") => {
    // Prevent multiple reactions on the same item
    if (reaction) return;

    setReaction(type);

    // Start the database operation immediately
    if (type === "like") {
      onLike(song.shared_song_ids);
    } else {
      onDislike(song.shared_song_ids);
    }

    // Start fade out animation (just for visual effect)
    opacity.value = withTiming(0, { duration: 800 });
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
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
    })
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX > 100) {
        // Complete like
        runOnJS(handleReaction)("like");
        translateX.value = withTiming(500);
      } else if (event.translationX < -100) {
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
                top: 0,
                left: 0,
                right: 0,
                bottom: 16,
                borderRadius: 20,
              },
            ]}
            pointerEvents="none"
          />

          <Pressable
            className="mb-4 bg-neutral-900 rounded-[20px] p-4 active:bg-neutral-800"
            style={{ position: "relative", zIndex: 1 }}
            onPress={() => {
              if (song.external_url) {
                MusicUrlHandler.openWithConfirmation(
                  song.external_url,
                  song.service,
                  song.song_title,
                  user?.id
                );
              }
            }}
          >
            {/* Song Info */}
            <View className="flex-row items-center mb-2">
              <View className="w-16 h-16 rounded-lg mr-3 items-center justify-center p-12">
                {song.song_artwork ? (
                  <Image
                    source={{ uri: song.song_artwork }}
                    className="w-24 h-24 rounded-[10px]"
                    defaultSource={require("../../assets/images/placeholder.png")}
                  />
                ) : (
                  <Ionicons name="musical-notes" size={24} color="#9CA3AF" />
                )}
              </View>
              <View className="flex-1">
                {/* SONG TITLE: Horizontal auto-scroll, one line */}
                <Text
                  className="text-white font-semibold text-lg"
                  // Prevents breaking into two lines
                  ellipsizeMode="clip"
                  style={{ minWidth: "100%" /* ensures no jumpy shrink */ }}
                >
                  {song.song_title}
                </Text>

                {/* ARTIST NAME: truncate with ... at end */}
                <Text
                  className="text-gray-400"
                  numberOfLines={1}
                  ellipsizeMode="tail" // cuts off at end with ...
                >
                  {song.song_artist}
                </Text>
              </View>

              {/* Action Buttons: Cross-platform, Like/Dislike */}
              <View className="flex-row items-center space-x-3 ml-4">
                {/* Cross-platform Button - Only show for Spotify songs */}
                {song.service === "spotify" && song.external_url && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      if (song.external_url) {
                        MusicUrlHandler.mapAndOpen(
                          song.external_url,
                          "apple",
                          song.song_title
                        );
                      }
                    }}
                    className="w-9 h-9 rounded-full items-center justify-center mr-2"
                  >
                    {/* <Ionicons name="logo-apple" size={16} color="#9CA3AF" /> */}
                  </Pressable>
                )}

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleReaction("dislike");
                  }}
                  className={`w-9 h-9 rounded-full items-center justify-center active:bg-neutral-800 mr-2 ${
                    reaction === "dislike" ? "bg-red-600" : "bg-neutral-700"
                  }`}
                  disabled={reaction !== null}
                >
                  <ThumbsDownIcon
                    size={18}
                    color={reaction === "dislike" ? "#FFFFFF" : "#9CA3AF"}
                  />
                </Pressable>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleReaction("like");
                  }}
                  className={`w-9 h-9 rounded-full items-center justify-center active:bg-neutral-800 ${
                    reaction === "like" ? "bg-green-600" : "bg-neutral-700"
                  }`}
                  disabled={reaction !== null}
                >
                  <ThumbsUpIcon
                    size={18}
                    color={reaction === "like" ? "#FFFFFF" : "#9CA3AF"}
                  />
                </Pressable>
              </View>
            </View>

            <View className="h-px bg-[#282828] my-2" />

            {/* Sender Info */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                {/* Sender Avatars */}
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
                  className="text-gray-400 font-bold text-sm ml-2 shrink"
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
              <View className="flex-row items-center">
                <Text className="text-gray-500 text-sm">
                  {formatTimestamp(song.latest_created_at)}
                </Text>
                {song.external_url && (
                  <Ionicons
                    name={MusicUrlHandler.getServiceIcon(song.service) as any}
                    size={14}
                    color="#6B7280"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>
            </View>
          </Pressable>
        </Animatable.View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function Hitlist() {
  const { user } = useAuth();
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [currentSort, setCurrentSort] = useState<SortOption>("recent");
  const [sharedSongs, setSharedSongs] = useState<GroupedSharedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  // Search functionality state
  const [searchText, setSearchText] = useState("");
  const [filteredSongs, setFilteredSongs] = useState<GroupedSharedSong[]>([]);

  // Track pending reactions to prevent duplicate database calls
  const [pendingReactions, setPendingReactions] = useState(new Set<string>());

  // Cross-platform search results modal state
  const [searchResultsVisible, setSearchResultsVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultTrack[]>([]);
  const [searchTargetService, setSearchTargetService] = useState<
    "spotify" | "apple"
  >("spotify");
  const [searchOriginalMetadata, setSearchOriginalMetadata] = useState<{
    title: string;
    artist: string;
  }>({ title: "", artist: "" });

  useEffect(() => {
    if (user) {
      fetchSharedSongs();
    }

    // Log screen view analytics
    // analytics().logEvent("screen_view", { screen_name: "Hitlist" });
  }, [user]);

  // Filter songs based on search text
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredSongs(sharedSongs);
    } else {
      const filtered = sharedSongs.filter(
        (song) =>
          song.song_title.toLowerCase().includes(searchText.toLowerCase()) ||
          song.song_artist.toLowerCase().includes(searchText.toLowerCase()) ||
          song.senders.some((sender) =>
            getSenderDisplayName(sender)
              .toLowerCase()
              .includes(searchText.toLowerCase())
          )
      );
      setFilteredSongs(filtered);
    }
  }, [searchText, sharedSongs]);

  // Set up cross-platform search results callback
  useEffect(() => {
    const handleSearchResults = (
      results: SearchResultTrack[],
      targetService: "spotify" | "apple",
      originalMetadata: { title: string; artist: string }
    ) => {
      setSearchResults(results);
      setSearchTargetService(targetService);
      setSearchOriginalMetadata(originalMetadata);
      setSearchResultsVisible(true);
    };

    MusicUrlHandler.setSearchResultsCallback(handleSearchResults);

    // Cleanup
    return () => {
      MusicUrlHandler.setSearchResultsCallback(() => {});
    };
  }, []);

  const fetchSharedSongs = async (refresh: boolean = false) => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await OptimizedQueriesService.getInboxSongs(
        user.id,
        undefined,
        refresh
      );
      setSharedSongs(result.songs);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error fetching shared songs:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreSongs = async () => {
    if (!user || !hasMore || loadingMore || !nextCursor) return;

    try {
      setLoadingMore(true);
      const result = await OptimizedQueriesService.getInboxSongs(
        user.id,
        nextCursor
      );
      setSharedSongs((prev) => [...prev, ...result.songs]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Error loading more songs:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLike = async (songIds: string[]) => {
    if (!user) return;

    const songKey = songIds.join(",");
    if (pendingReactions.has(songKey)) return;

    setPendingReactions((prev) => new Set(prev).add(songKey));

    try {
      const songToUpdate = sharedSongs.find((group) =>
        group.shared_song_ids.some((id) => songIds.includes(id))
      );

      console.log(
        "Starting like operation for song:",
        songToUpdate?.song_title
      );

      // Update using optimized service (handles cache updates too)
      const { success, error } = await OptimizedQueriesService.reactToSong(
        user.id,
        songIds,
        true
      );

      if (!success) {
        console.error("Error liking song:", error);
        // Since animation already removed the song, refresh the list to bring it back
        fetchSharedSongs();
        return;
      }

      console.log("Like operation completed successfully");

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
      setSharedSongs((prev) =>
        prev.filter(
          (group) => !group.shared_song_ids.some((id) => songIds.includes(id))
        )
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
            console.log("Activity creation result:", result);
          }
        }
      }
    } catch (error) {
      console.error("Error liking song:", error);
      // Since animation already removed the song, refresh the list to bring it back
      fetchSharedSongs();
    } finally {
      setPendingReactions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(songKey);
        return newSet;
      });
    }
  };

  const handleDislike = async (songIds: string[]) => {
    if (!user) return;

    const songKey = songIds.join(",");
    if (pendingReactions.has(songKey)) return;

    setPendingReactions((prev) => new Set(prev).add(songKey));

    try {
      const songToUpdate = sharedSongs.find((group) =>
        group.shared_song_ids.some((id) => songIds.includes(id))
      );

      console.log(
        "Starting dislike operation for song:",
        songToUpdate?.song_title
      );

      // Update using optimized service (handles cache updates too)
      const { success, error } = await OptimizedQueriesService.reactToSong(
        user.id,
        songIds,
        false
      );

      if (!success) {
        console.error("Error disliking song:", error);
        // Since animation already removed the song, refresh the list to bring it back
        fetchSharedSongs();
        return;
      }

      console.log("Dislike operation completed successfully");

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
      setSharedSongs((prev) =>
        prev.filter(
          (group) => !group.shared_song_ids.some((id) => songIds.includes(id))
        )
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
            console.log("Activity creation result:", result);
          }
        }
      }
    } catch (error) {
      console.error("Error disliking song:", error);
      // Since animation already removed the song, refresh the list to bring it back
      fetchSharedSongs();
    } finally {
      setPendingReactions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(songKey);
        return newSet;
      });
    }
  };

  const sortedSharedSongs = useMemo(() => {
    const sorted = [...filteredSongs];

    switch (currentSort) {
      case "artist":
        return sorted.sort((a, b) =>
          a.song_artist.localeCompare(b.song_artist)
        );
      case "title":
        return sorted.sort((a, b) => a.song_title.localeCompare(b.song_title));
      case "recent":
      default:
        return sorted.sort(
          (a, b) =>
            new Date(b.latest_created_at).getTime() -
            new Date(a.latest_created_at).getTime()
        );
    }
  }, [filteredSongs, currentSort]);

  const handleSortSelection = (sortOption: SortOption) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentSort(sortOption);
    setIsFilterModalVisible(false);
  };

  const renderSortModal = () => (
    <Modal
      visible={isFilterModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setIsFilterModalVisible(false)}
    >
      <Pressable
        className="flex-1 bg-black/50"
        onPress={() => setIsFilterModalVisible(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable>
            <View
              className="bg-neutral-800 rounded-t-3xl px-4 pb-8"
              style={{ paddingBottom: 34 }}
            >
              {/* Handle Bar */}
              <View className="w-12 h-1 bg-neutral-700 rounded-full self-center mt-3 mb-6" />

              {/* Header */}
              <Text className="text-gray-400 text-center  mb-6">
                Sort list by
              </Text>

              {/* Sort Options */}
              <View className="space-y-4">
                <Pressable
                  className="py-4 active:bg-neutral-800"
                  onPress={() => handleSortSelection("recent")}
                >
                  <Text
                    className={`text-center text-lg ${
                      currentSort === "recent"
                        ? "text-white font-semibold"
                        : "text-gray-400"
                    }`}
                  >
                    Most Recent
                  </Text>
                </Pressable>

                <Pressable
                  className="py-4 active:bg-neutral-800"
                  onPress={() => handleSortSelection("artist")}
                >
                  <Text
                    className={`text-center text-lg ${
                      currentSort === "artist"
                        ? "text-white font-semibold"
                        : "text-gray-400"
                    }`}
                  >
                    By Artist
                  </Text>
                </Pressable>

                <Pressable
                  className="py-4 active:bg-neutral-800"
                  onPress={() => handleSortSelection("title")}
                >
                  <Text
                    className={`text-center text-lg ${
                      currentSort === "title"
                        ? "text-white font-semibold"
                        : "text-gray-400"
                    }`}
                  >
                    By Title
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
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
      <View className="pt-1 px-4 mb-6 ">
        <Text className="text-white text-3xl font-bold">Your Hitlist</Text>
        <Text className="text-gray-400 text-xl mb-4">
          Songs your friends think you should hear
        </Text>

        {/* Search Bar */}
        <View className="flex-row items-center space-x-3">
          <View className="flex-1 flex-row items-center bg-neutral-700 rounded-full px-4 py-4">
            <Ionicons name="search" size={22} color="#9CA3AF" />
            <TextInput
              placeholder="Search for Artists/Songs..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-white pb-1 ml-3 text-xl"
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Pressable
            className="ml-4 px-2 w-14 h-14 border-neutral-700 border-2 rounded-lg items-center justify-center active:bg-neutral-800"
            onPress={() => setIsFilterModalVisible(true)}
          >
            <Ionicons name="filter-outline" size={22} color="#9CA3AF" />
          </Pressable>
        </View>
      </View>

      {/* Songs List */}
      <FlatList
        data={sortedSharedSongs}
        keyExtractor={(item) => item.groupKey}
        renderItem={({ item, index }) => (
          <SongItem
            song={item}
            index={index}
            onLike={handleLike}
            onDislike={handleDislike}
            user={user}
          />
        )}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreSongs}
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
            <Ionicons name="musical-notes-outline" size={64} color="#9CA3AF" />
            <Text className="text-white text-lg text-center mb-2 mt-4">
              {searchText.trim() ? "No songs found" : "No songs shared yet"}
            </Text>
            <Text className="text-gray-400 text-sm text-center">
              {searchText.trim()
                ? "Try adjusting your search terms"
                : "When friends share songs with you, they'll appear here"}
            </Text>
          </View>
        }
      />

      {/* Bottom Navigation */}
      <View className="flex-row">
        <Pressable className="flex-1 items-center py-3 active:bg-neutral-800">
          <Ionicons name="home" size={24} color="#ffffff" />
          <Text className="text-white text-xs mt-1">Hitlist</Text>
        </Pressable>
        <Pressable
          className="flex-1 items-center py-3 active:bg-neutral-800"
          onPress={() => router.push("/(app)/activity")}
        >
          <Ionicons name="heart-outline" size={24} color="#9CA3AF" />
          <Text className="text-gray-400 text-xs mt-1">Activity</Text>
        </Pressable>
        <Pressable
          className="flex-1 items-center py-3 active:bg-neutral-800"
          onPress={() => router.push("/(app)/profile")}
        >
          <Ionicons name="person-outline" size={24} color="#9CA3AF" />
          <Text className="text-gray-400 text-xs mt-1">Profile</Text>
        </Pressable>
      </View>

      {/* Sort Modal */}
      {renderSortModal()}

      {/* Cross-Platform Search Results Modal */}
      <CrossPlatformSearchResults
        visible={searchResultsVisible}
        results={searchResults}
        targetService={searchTargetService}
        originalMetadata={searchOriginalMetadata}
        onClose={() => setSearchResultsVisible(false)}
      />
    </Animatable.View>
  );
}
