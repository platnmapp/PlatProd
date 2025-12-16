import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import CrossPlatformSearchResults from "../../components/CrossPlatformSearchResults";
import SkeletonLoader from "../../components/SkeletonLoader";
import ThumbsDownIcon from "../../components/ThumbsDownIcon";
import ThumbsUpIcon from "../../components/ThumbsUpIcon";
import { FavoriteSong, FavoriteSongsService } from "../../lib/favoriteSongs";
import { MusicUrlHandler, SearchResultTrack } from "../../lib/musicUrlHandler";
import { supabase } from "../../lib/supabase";
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
interface SharedSongWithHistory {
  id: string;
  song_title: string;
  song_artist: string;
  song_album?: string;
  song_artwork?: string;
  external_url?: string;
  service: "spotify" | "apple";
  created_at: string;
  liked?: boolean;
  viewed?: boolean;
  sender_id: string;
  receiver_id: string;
}

interface HitRate {
  percentage: number;
  totalSongs: number;
  likedSongs: number;
}

export default function FriendProfile() {
  const { friendId, friendName } = useLocalSearchParams<{
    friendId: string;
    friendName: string;
  }>();
  const [activeTab, setActiveTab] = useState("Sent");
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [friendStats, setFriendStats] = useState<UserStats | null>(null);
  const [friendFavoriteSongs, setFriendFavoriteSongs] = useState<
    FavoriteSong[]
  >([]);
  const [sentSongs, setSentSongs] = useState<SharedSongWithHistory[]>([]);
  const [receivedSongs, setReceivedSongs] = useState<SharedSongWithHistory[]>(
    []
  );
  const [sentHitRate, setSentHitRate] = useState<HitRate>({
    percentage: 0,
    totalSongs: 0,
    likedSongs: 0,
  });
  const [receivedHitRate, setReceivedHitRate] = useState<HitRate>({
    percentage: 0,
    totalSongs: 0,
    likedSongs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] =
    useState<UserProfile | null>(null);
  const { user } = useAuth();

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
    if (friendId && user) {
      loadFriendData();
    }
  }, [friendId, user]);

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

  const loadFriendData = async () => {
    if (!friendId || !user) return;

    try {
      setLoading(true);

      // Load friend profile
      const { profile: friend, error: profileError } =
        await UserProfileService.getUserProfile(friendId);

      if (profileError) {
        console.error("Error loading friend profile:", profileError);
      } else {
        setFriendProfile(friend);
      }

      // Load friend stats
      const stats = await UserProfileService.getUserStats(friendId);
      setFriendStats(stats);

      // Load friend's favorite songs
      console.log("Attempting to load favorite songs for friendId:", friendId);

      // Test direct Supabase query to check RLS policies
      console.log("Testing direct Supabase query for favorite songs...");
      const { data: testData, error: testError } = await supabase
        .from("favorite_songs")
        .select("*")
        .eq("user_id", friendId);
      console.log("Direct Supabase query result:", { testData, testError });

      const {
        success,
        songs: favSongs,
        error: favError,
      } = await FavoriteSongsService.getUserFavoriteSongs(friendId);
      console.log("Friend favorite songs result:", {
        success,
        favSongs: favSongs ? favSongs.length : 0,
        favError,
        friendId,
        currentUserId: user.id,
      });
      if (success && favSongs) {
        console.log("Successfully loaded friend's favorite songs:", favSongs);
        setFriendFavoriteSongs(favSongs);
      } else {
        console.error("Failed to load friend's favorite songs:", {
          error: favError,
          friendId,
          success,
        });
      }

      // Load current user's profile
      const { profile: currentUser, error: currentUserError } =
        await UserProfileService.getUserProfile(user.id);
      if (!currentUserError && currentUser) {
        setCurrentUserProfile(currentUser);
      }

      // Load shared history and calculate hit rates
      await Promise.all([loadSentSongs(), loadReceivedSongs()]);
    } catch (error) {
      console.error("Error loading friend data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: "Sent" | "Received") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  const loadSentSongs = async () => {
    if (!friendId || !user) return;

    try {
      // Songs sent from current user to friend
      const { data, error } = await supabase
        .from("shared_songs")
        .select("*")
        .eq("sender_id", user.id)
        .eq("receiver_id", friendId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching sent songs:", error);
        return;
      }

      const songs = data || [];
      console.log("Sent songs data:", songs);
      setSentSongs(songs);

      // Calculate hit rate for sent songs (songs that friend liked)
      const totalSongs = songs.length;
      const likedSongs = songs.filter((song) => song.liked === true).length;
      const percentage =
        totalSongs > 0 ? Math.round((likedSongs / totalSongs) * 100) : 0;

      setSentHitRate({ percentage, totalSongs, likedSongs });
    } catch (error) {
      console.error("Error loading sent songs:", error);
    }
  };

  const loadReceivedSongs = async () => {
    if (!friendId || !user) return;

    try {
      // Songs received from friend to current user
      const { data, error } = await supabase
        .from("shared_songs")
        .select("*")
        .eq("sender_id", friendId)
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching received songs:", error);
        return;
      }

      const songs = data || [];
      setReceivedSongs(songs);

      // Calculate hit rate for received songs (songs that current user liked)
      const totalSongs = songs.length;
      const likedSongs = songs.filter((song) => song.liked === true).length;
      const percentage =
        totalSongs > 0 ? Math.round((likedSongs / totalSongs) * 100) : 0;

      setReceivedHitRate({ percentage, totalSongs, likedSongs });
    } catch (error) {
      console.error("Error loading received songs:", error);
    }
  };

  const getSongDisplayInfo = (song: SharedSongWithHistory) => {
    const hasUnknownData =
      song.song_title === "Unknown Title" ||
      song.song_title === "Unknown Track" ||
      song.song_artist === "Unknown Artist" ||
      song.song_artist === "Connect Spotify for full details";

    return {
      title: hasUnknownData
        ? `${song.service === "spotify" ? "Spotify" : "Apple Music"} Track`
        : song.song_title,
      artist: hasUnknownData
        ? "Limited metadata - connect music service"
        : song.song_artist,
      hasLimitedData: hasUnknownData,
    };
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const created = new Date(timestamp);
    const diffMs = now.getTime() - created.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffSeconds < 60) return `${diffSeconds}s`;
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 48) return `${diffHours}h`; // Less than 2 days
    return `${diffDays}d`;
  };

  const getStatusDisplay = (song: SharedSongWithHistory, isSent: boolean) => {
    if (song.liked === null) {
      return {
        text: "Pending",
        className: "border-2 border-neutral-700 px-3 py-1 rounded-full",
        textClassName: "text-gray-400 font-medium text-sm",
        icon: "time-outline" as const,
        iconColor: "#9CA3AF",
      };
    } else if (song.liked === true) {
      return {
        text: "Liked",
        className: "border-2 border-green-600 px-3 py-1 rounded-full",
        textClassName: "text-green-600 font-medium text-sm",
        icon: "thumbs-up" as const,
        iconColor: "#10B981",
      };
    } else {
      return {
        text: "Disliked",
        className: "border-2 border-red-600 px-3 py-1 rounded-full",
        textClassName: "text-red-600 font-medium text-sm",
        icon: "thumbs-down" as const,
        iconColor: "#EF4444",
      };
    }
  };

  const renderSongItem = (
    song: SharedSongWithHistory,
    isSent: boolean,
    index: number
  ) => {
    const displayInfo = getSongDisplayInfo(song);
    const timeAgo = formatTimeAgo(song.created_at);
    const status = getStatusDisplay(song, isSent);

    return (
      <Pressable
        key={song.id}
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
        <Animatable.View
          animation="fadeInUp"
          duration={500}
          delay={index * 100}
          className="flex-row items-center py-4 px-4 border-b border-gray-800"
        >
          {/* Song Artwork */}
          {song.song_artwork ? (
            <Image
              source={{ uri: song.song_artwork }}
              className="w-12 h-12 rounded-lg mr-3"
              defaultSource={require("../../assets/images/placeholder.png")}
            />
          ) : (
            <View className="w-12 h-12 rounded-lg mr-3 bg-neutral-700 items-center justify-center">
              <Ionicons name="musical-notes" size={20} color="#9CA3AF" />
            </View>
          )}

          {/* Song Info */}
          <View className="flex-1">
            <Text
              className="text-white font-semibold"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayInfo.title}{" "}
              <Text className="text-gray-400 text-sm">• {timeAgo}</Text>
            </Text>
          </View>

          {/* Status */}
          <View className="flex-row items-center">
            <View className={status.className}>
              <View className="flex-row items-center">
                {status.icon === "thumbs-up" ? (
                  <ThumbsUpIcon size={14} color={status.iconColor} />
                ) : status.icon === "thumbs-down" ? (
                  <ThumbsDownIcon size={14} color={status.iconColor} />
                ) : (
                  <Ionicons
                    name={status.icon}
                    size={14}
                    color={status.iconColor}
                  />
                )}
                <Text className={`${status.textClassName} ml-1`}>
                  {status.text}
                </Text>
              </View>
            </View>
            {song.external_url && (
              <View className="flex-row items-center">
                <Ionicons
                  name={MusicUrlHandler.getServiceIcon(song.service) as any}
                  size={12}
                  color="#6B7280"
                  style={{ marginLeft: 8 }}
                />
                {/* Cross-platform button for Spotify songs */}
                {song.service === "spotify" && (
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
                    className="ml-1 p-1"
                  >
                    <Ionicons name="logo-apple" size={10} color="#6B7280" />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </Animatable.View>
      </Pressable>
    );
  };

  const renderHitRate = () => {
    const currentHitRate = activeTab === "Sent" ? sentHitRate : receivedHitRate;
    const displayName =
      friendProfile?.first_name || friendProfile?.username || friendName;

    // Determine progress bar color based on percentage
    const getProgressBarColor = (percentage: number) => {
      if (percentage >= 80) return "bg-green-500";
      if (percentage >= 40) return "bg-yellow-500";
      return "bg-red-500";
    };

    const progressBarColor = getProgressBarColor(currentHitRate.percentage);

    return (
      <View className="mb-6 mt-4">
        <Text className="text-white text-lg font-semibold mb-1">Hit Rate</Text>
        <Text className="text-gray-400 text-sm mb-4">
          Percentage of liked recommendations
        </Text>

        {/* Progress Bar */}
        <View className="flex-row items-center mb-4">
          <View className="flex-1 h-2 bg-neutral-700 rounded-full overflow-hidden mr-4">
            <View
              className={`h-full ${progressBarColor} rounded-full`}
              style={{ width: `${currentHitRate.percentage}%` }}
            />
          </View>
          <Text className="text-white text-lg font-bold">
            {currentHitRate.percentage}%
          </Text>
        </View>

        {/* User info */}
        <View className="flex-row items-center">
          <View className="w-6 h-6 rounded-full mr-2 bg-neutral-700 items-center justify-center">
            {activeTab === "Sent" ? (
              friendProfile?.avatar_url ? (
                <Image
                  source={{ uri: friendProfile.avatar_url }}
                  className="w-6 h-6 rounded-full"
                  defaultSource={require("../../assets/images/placeholder.png")}
                />
              ) : (
                <Text className="text-white text-xs font-bold">
                  {displayName?.[0]?.toUpperCase() || "F"}
                </Text>
              )
            ) : currentUserProfile?.avatar_url ? (
              <Image
                source={{ uri: currentUserProfile.avatar_url }}
                className="w-6 h-6 rounded-full"
                defaultSource={require("../../assets/images/placeholder.png")}
              />
            ) : (
              <Text className="text-white text-xs font-bold">
                {(
                  currentUserProfile?.first_name?.[0] ||
                  currentUserProfile?.username?.[0] ||
                  "Y"
                ).toUpperCase()}
              </Text>
            )}
          </View>
          <Text className="text-gray-400 text-sm">
            {activeTab === "Sent" ? displayName : "You"}
          </Text>
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
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="pb-6 px-4">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center justify-between w-full">
              <Text className="text-white text-3xl font-bold">
                {friendProfile?.username || friendName || "Friend"}
              </Text>
              <Pressable
                className="active:bg-neutral-800"
                onPress={() => router.back()}
              >
                <Ionicons name="close-outline" size={24} color="white" />
              </Pressable>
            </View>
          </View>

          {/* Friend Profile Section */}
          {friendProfile && (
            <View className="flex-row items-center mb-6">
              <View className="w-24 h-24 rounded-full mr-4 bg-neutral-700 items-center justify-center">
                {friendProfile.avatar_url ? (
                  <Image
                    source={{ uri: friendProfile.avatar_url }}
                    className="w-24 h-24 rounded-full"
                    defaultSource={require("../../assets/images/placeholder.png")}
                  />
                ) : (
                  <Text className="text-white text-3xl font-bold">
                    {(
                      friendProfile.first_name?.[0] ||
                      friendProfile.username?.[0] ||
                      "F"
                    ).toUpperCase()}
                  </Text>
                )}
              </View>
              <View className="flex-row flex-1 justify-around">
                <View className="items-center">
                  <Text className="text-white text-2xl font-bold">
                    {friendStats?.friends_count || 0}
                  </Text>
                  <Text className="text-gray-400 text-sm">Friends</Text>
                </View>
                <View className="items-center">
                  <Text className="text-white text-2xl font-bold">
                    {friendStats?.songs_sent_count || 0}
                  </Text>
                  <Text className="text-gray-400 text-sm">Songs Sent</Text>
                </View>
                <View className="items-center">
                  <Text className="text-white text-2xl font-bold">
                    {friendStats?.likes_received_count || 0}
                  </Text>
                  <Text className="text-gray-400 text-sm">Likes</Text>
                </View>
              </View>
            </View>
          )}

          {/* Favorite Songs */}
          <View className="mb-6">
            <Text className="text-white text-xl font-semibold mb-4">
              Favorite Songs
            </Text>
            {friendFavoriteSongs.length > 0 ? (
              <View className="flex-row justify-center gap-2">
                {[1, 2, 3].map((position) => {
                  const favoriteSong = friendFavoriteSongs.find(
                    (song) => song.position === position
                  );

                  return (
                    <View
                      key={position}
                      className="items-center flex-1 ml-1 mr-1"
                    >
                      {favoriteSong ? (
                        <>
                          <Image
                            source={{ uri: favoriteSong.song_artwork }}
                            className="w-full aspect-square rounded-lg"
                            defaultSource={require("../../assets/images/placeholder.png")}
                          />
                          <View className="w-full mt-2">
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
                          </View>
                        </>
                      ) : (
                        <>
                          <View className="w-full aspect-square bg-neutral-700 rounded-lg border border-neutral-700 justify-center items-center">
                            <Ionicons name="add" size={32} color="#9CA3AF" />
                          </View>
                          <View className="w-full mt-2">
                            <Text className="text-gray-400 text-xs text-center font-bold">
                              Song {position}
                            </Text>
                            <Text className="text-gray-500 text-xs text-center mt-0.5">
                              Artist
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="flex-row justify-center gap-2">
                {[1, 2, 3].map((position) => (
                  <View
                    key={position}
                    className="items-center flex-1 ml-1 mr-1"
                  >
                    <View className="w-full aspect-square bg-neutral-700 rounded-lg border border-neutral-700 justify-center items-center">
                      <Ionicons name="add" size={32} color="#9CA3AF" />
                    </View>
                    <View className="w-full mt-2">
                      <Text className="text-gray-400 text-xs text-center font-bold">
                        Song {position}
                      </Text>
                      <Text className="text-gray-500 text-xs text-center mt-0.5">
                        Artist
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/*
           Header */}
          <View className="border-2 border-neutral-900 rounded-2xl p-4">
            <View className="mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-white text-xl font-semibold mb-1">
                    Sharing History
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    Between You and @{friendProfile?.username || friendName}
                  </Text>
                </View>

                {/* Overlapping Avatars */}
                <View className="flex-row items-center">
                  {activeTab === "Sent" ? (
                    /* Sent: User (sender) overlaps friend */
                    <>
                      <View
                        className="w-10 h-10 rounded-full bg-neutral-700 items-center justify-center border-2 border-black"
                        style={{ zIndex: 2 }}
                      >
                        {currentUserProfile?.avatar_url ? (
                          <Image
                            source={{ uri: currentUserProfile.avatar_url }}
                            className="w-10 h-10 rounded-full border-2 border-black"
                            defaultSource={require("../../assets/images/placeholder.png")}
                          />
                        ) : (
                          <Text className="text-white text-sm font-bold">
                            {(
                              currentUserProfile?.first_name?.[0] ||
                              currentUserProfile?.username?.[0] ||
                              user?.email?.[0] ||
                              "Y"
                            ).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View className="w-10 h-10 rounded-full bg-neutral-700 items-center justify-center border-2 border-black -ml-3">
                        {friendProfile?.avatar_url ? (
                          <Image
                            source={{ uri: friendProfile.avatar_url }}
                            className="w-10 h-10 rounded-full"
                            defaultSource={require("../../assets/images/placeholder.png")}
                          />
                        ) : (
                          <Text className="text-white text-sm font-bold">
                            {(
                              friendProfile?.first_name?.[0] ||
                              friendProfile?.username?.[0] ||
                              "F"
                            ).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    </>
                  ) : (
                    /* Received: Friend (sender) overlaps user */
                    <>
                      <View className="w-10 h-10 rounded-full bg-neutral-700 items-center justify-center border-2 border-black">
                        {currentUserProfile?.avatar_url ? (
                          <Image
                            source={{ uri: currentUserProfile.avatar_url }}
                            className="w-10 h-10 rounded-full"
                            defaultSource={require("../../assets/images/placeholder.png")}
                          />
                        ) : (
                          <Text className="text-white text-sm font-bold">
                            {(
                              currentUserProfile?.first_name?.[0] ||
                              currentUserProfile?.username?.[0] ||
                              user?.email?.[0] ||
                              "Y"
                            ).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View className="w-10 h-10 rounded-full bg-neutral-700 items-center justify-center border-2 border-black -ml-3">
                        {friendProfile?.avatar_url ? (
                          <Image
                            source={{ uri: friendProfile.avatar_url }}
                            className="w-10 h-10 rounded-full border-2 border-black"
                            defaultSource={require("../../assets/images/placeholder.png")}
                          />
                        ) : (
                          <Text className="text-white text-sm font-bold">
                            {(
                              friendProfile?.first_name?.[0] ||
                              friendProfile?.username?.[0] ||
                              "F"
                            ).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    </>
                  )}
                </View>
              </View>
            </View>

            {/* Tabs */}
            <View className="flex-row">
              <Pressable
                className="flex-1 pb-2 active:bg-neutral-800"
                onPress={() => handleTabChange("Sent")}
              >
                <Text
                  className={` text-lg text-center ${
                    activeTab === "Sent" ? "text-white" : "text-gray-400"
                  }`}
                >
                  Sent
                </Text>
                {activeTab === "Sent" && (
                  <View className="h-0.5 bg-white mt-2" />
                )}
              </Pressable>
              <Pressable
                className="flex-1 pb-2 active:bg-neutral-800"
                onPress={() => handleTabChange("Received")}
              >
                <Text
                  className={` text-lg text-center ${
                    activeTab === "Received" ? "text-white" : "text-gray-400"
                  }`}
                >
                  Received
                </Text>
                {activeTab === "Received" && (
                  <View className="h-0.5 bg-white mt-2" />
                )}
              </Pressable>
            </View>

            {/* Hit Rate Section */}
            {(activeTab === "Sent"
              ? sentSongs.length > 0
              : receivedSongs.length > 0) && renderHitRate()}
            <View className="border-t border-neutral-900 pt-4">
              {activeTab === "Sent" ? (
                <>
                  <Text className="text-white text-lg font-semibold mb-1">
                    Sent Songs
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    {" "}
                    @{friendProfile?.username || friendName} opinion on your
                    recs
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-white text-lg font-semibold mb-1">
                    Received Songs
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    Your opinion on @{friendProfile?.username || friendName}{" "}
                    recs
                  </Text>
                </>
              )}
            </View>

            {/* Songs List */}
            <View className="pt-4 pb-6 -mx-4">
              {activeTab === "Sent" ? (
                sentSongs.length > 0 ? (
                  sentSongs.map((song, index) =>
                    renderSongItem(song, true, index)
                  )
                ) : (
                  <View className="flex-1 justify-center items-center px-12 py-20">
                    <Ionicons
                      name="paper-plane-outline"
                      size={64}
                      color="#9CA3AF"
                    />
                    <Text className="text-white text-lg text-center mb-2 mt-4">
                      No songs sent yet
                    </Text>
                    <Text className="text-gray-400 text-sm text-center">
                      Share a song with{" "}
                      {friendProfile?.first_name || friendName} to get started
                    </Text>
                  </View>
                )
              ) : receivedSongs.length > 0 ? (
                receivedSongs.map((song, index) =>
                  renderSongItem(song, false, index)
                )
              ) : (
                <View className="flex-1 justify-center items-center px-12 py-20">
                  <Ionicons
                    name="musical-notes-outline"
                    size={64}
                    color="#9CA3AF"
                  />
                  <Text className="text-white text-lg text-center mb-2 mt-4">
                    No songs received yet
                  </Text>
                  <Text className="text-gray-400 text-sm text-center">
                    {friendProfile?.first_name || friendName} hasn't shared any
                    songs with you yet
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

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
