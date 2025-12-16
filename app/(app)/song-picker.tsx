import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SkeletonLoader from "../../components/SkeletonLoader";
import {
  AppleMusicAPI,
  AppleMusicTokens,
  AppleMusicTrack,
} from "../../lib/appleMusic";
import { CacheService } from "../../lib/cacheService";
import { SpotifyAPI, SpotifyTrack } from "../../lib/spotify";
import { supabase } from "../../lib/supabase";
import { UserProfileService } from "../../lib/userProfile";
import { useAuth } from "../context/AuthContext";

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  preview_url?: string;
  genres?: string[];
}

export default function SongPicker() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    service: string;
    index: string;
    editing?: string;
  }>();
  const [searchText, setSearchText] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [spotifyAPI, setSpotifyAPI] = useState<SpotifyAPI | null>(null);
  const [appleMusicAPI, setAppleMusicAPI] = useState<AppleMusicAPI | null>(
    null
  );
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  const [genres, setGenres] = useState<{ [key: string]: Song[] }>({});

  const service = params.service || "spotify";
  const favoriteIndex = params.index || "1";
  const isEditing = params.editing === "true";

  useEffect(() => {
    if (service === "spotify") {
      initializeSpotifyAPI();
    } else if (service === "apple") {
      initializeAppleMusicAPI();
    }

    // Load existing favorite songs if editing
    if (isEditing) {
      loadExistingFavoriteSongs();
    }
  }, [user, service]);

  const loadExistingFavoriteSongs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("favorite_songs")
        .select("*")
        .eq("user_id", user.id)
        .order("position");

      if (error) {
        console.error("Error loading favorite songs:", error);
        return;
      }

      if (data) {
        const existingFavorites = data.map((song: any) => ({
          id: song.song_id,
          title: song.song_title,
          artist: song.song_artist,
          album: song.song_album || "",
          artwork: song.song_artwork || "",
          service: song.service,
        }));
        setSelectedSongs(existingFavorites);
      }
    } catch (error) {
      console.error("Error loading existing favorite songs:", error);
    }
  };

  const initializeSpotifyAPI = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { profile } = await UserProfileService.getUserProfile(user.id);

      if (!profile || !UserProfileService.isSpotifyConnected(profile)) {
        Alert.alert(
          "Spotify Not Connected",
          "Please connect your Spotify account to browse your music.",
          [
            { text: "Cancel", onPress: () => router.back() },
            {
              text: "Connect",
              onPress: () => router.push("/(accountsetup)/linkaccount"),
            },
          ]
        );
        return;
      }

      if (!profile.spotify_access_token) {
        Alert.alert(
          "Error",
          "No Spotify access token found. Please reconnect your account."
        );
        return;
      }

      // Create callback to update token in database when refreshed
      const onTokenRefresh = async (newToken: string, expiresAt: string) => {
        if (user?.id) {
          await supabase.from("profiles").update({
            spotify_access_token: newToken,
            spotify_token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }).eq("id", user.id);
          
          // Invalidate cache
          CacheService.invalidateUserProfile(user.id);
        }
      };

      const api = new SpotifyAPI(
        profile.spotify_access_token,
        profile.spotify_refresh_token,
        user.id,
        onTokenRefresh
      );
      setSpotifyAPI(api);

      // Load initial data - user's top tracks
      await loadSpotifyTopTracks(api);
    } catch (error) {
      console.error("Error initializing Spotify API:", error);
      Alert.alert("Error", "Failed to connect to Spotify. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const initializeAppleMusicAPI = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { profile } = await UserProfileService.getUserProfile(user.id);

      if (!profile || !UserProfileService.isAppleMusicConnected(profile)) {
        Alert.alert(
          "Apple Music Not Connected",
          "Please connect your Apple Music account to browse your music.",
          [
            { text: "Cancel", onPress: () => router.back() },
            {
              text: "Connect",
              onPress: () => router.push("/(accountsetup)/linkaccount"),
            },
          ]
        );
        return;
      }

      if (
        !profile.apple_music_user_token ||
        !profile.apple_music_developer_token
      ) {
        Alert.alert(
          "Apple Music Authentication Required",
          "Please connect Apple Music to access your music library and search features.",
          [
            { text: "Cancel", onPress: () => router.back() },
            {
              text: "Connect",
              onPress: () => router.push("/(accountsetup)/linkaccount"),
            },
          ]
        );
        return;
      }

      // Check if this is Android with Edge Function token (search-only mode)
      if (
        Platform.OS === "android" &&
        profile.apple_music_user_token === "android_edge_function"
      ) {
        console.log("Android Edge Function user - search-only mode enabled");
        setAppleMusicAPI(null); // No API instance needed

        // Show helpful message for Android users
        const defaultSongs: Song[] = [
          {
            id: "search_prompt",
            title: "Search Apple Music above",
            artist:
              "Full search access available - type a song name to get started",
            album: "",
            artwork: "",
          },
        ];
        setSongs(defaultSongs);
        setLoading(false);
        return;
      }

      // For iOS users, always try to use the native Apple Music API
      // Even if they previously connected on Android, iOS can use the native SDK
      if (Platform.OS === "ios") {
        try {
          console.log("🍎 iOS detected - using native Apple Music SDK");

          // Import the native Apple Music SDK properly
          const MusicKitNative = await import(
            "react-native-apple-music-user-token"
          );
          const nativeModule = MusicKitNative.default;

          if (nativeModule) {
            console.log("🍎 Native MusicKit available, requesting fresh token");

            try {
              // Request authorization if needed
              await nativeModule.requestAuthorization();

              // Get fresh user token for this session
              const userTokenResult =
                await nativeModule.requestUserTokenForDeveloperToken(
                  profile.apple_music_developer_token || ""
                );

              if (userTokenResult) {
                console.log(
                  "✅ Got fresh iOS Apple Music token for song picker"
                );

                // Create API with fresh tokens
                const tokens: AppleMusicTokens = {
                  userToken: userTokenResult,
                  developerToken: profile.apple_music_developer_token,
                  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                };

                const api = new AppleMusicAPI(tokens);
                setAppleMusicAPI(api);

                // Load initial data - user's library songs
                await loadAppleMusicLibrarySongs(api);
                return;
              }
            } catch (nativeError) {
              console.log("⚠️ Native Apple Music failed:", nativeError);
            }
          } else {
            console.log(
              "🍎 Native MusicKit not available, using stored tokens"
            );
          }
        } catch (error) {
          console.log(
            "⚠️ iOS native Apple Music failed, falling back to stored tokens:",
            error
          );
        }
      }

      // Handle stored tokens - check format since iOS native saves differently
      let userToken = profile.apple_music_user_token;

      // Check if token is stored as JSON object (from iOS native connection)
      if (typeof userToken === "string" && userToken.startsWith("{")) {
        try {
          const tokenObj = JSON.parse(userToken);
          userToken = tokenObj.token || userToken;
          console.log("🔧 Parsed iOS native token from stored JSON");
        } catch (e) {
          console.log("⚠️ Failed to parse stored token JSON, using as-is");
        }
      }

      console.log("🔍 Using stored Apple Music tokens for iOS");
      console.log(
        "🔍 Developer token present:",
        !!profile.apple_music_developer_token
      );
      console.log(
        "🔍 User token format:",
        typeof userToken,
        userToken?.substring(0, 20) + "..."
      );

      const tokens: AppleMusicTokens = {
        userToken: userToken,
        developerToken: profile.apple_music_developer_token,
        expiresAt: profile.apple_music_token_expires_at
          ? new Date(profile.apple_music_token_expires_at).getTime()
          : Date.now() + 24 * 60 * 60 * 1000,
      };

      const api = new AppleMusicAPI(tokens);
      setAppleMusicAPI(api);

      // Load initial data - user's library songs
      await loadAppleMusicLibrarySongs(api);
    } catch (error) {
      console.error("Error initializing Apple Music API:", error);
      Alert.alert(
        "Error",
        "Failed to connect to Apple Music. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const convertSpotifyTrackToSong = (
    track: SpotifyTrack,
    artistGenres: string[] = []
  ): Song => {
    const artwork = track.album.images[0]?.url || "";
    const artist = track.artists.map((a) => a.name).join(", ");

    return {
      id: track.id,
      title: track.name,
      artist: artist,
      album: track.album.name,
      artwork: artwork,
      preview_url: track.preview_url || undefined,
      genres: artistGenres,
    };
  };

  const convertAppleMusicTrackToSong = (track: AppleMusicTrack): Song => {
    const artwork =
      track.attributes.artwork?.url
        .replace("{w}", "300")
        .replace("{h}", "300") || "";

    return {
      id: track.id,
      title: track.attributes.name,
      artist: track.attributes.artistName,
      album: track.attributes.albumName,
      artwork: artwork,
      preview_url: track.attributes.previews?.[0]?.url,
      genres: track.attributes.genreNames,
    };
  };

  // Spotify functions
  const loadSpotifyTopTracks = async (api?: SpotifyAPI) => {
    const spotifyAPI_to_use = api || spotifyAPI;
    if (!spotifyAPI_to_use) return;

    try {
      setLoading(true);
      const result = await spotifyAPI_to_use.getUserTopTracks(50);

      if (result.success && result.tracks) {
        const artistIds = result.tracks.flatMap((track) =>
          track.artists.map((artist) => artist.id)
        );
        const { artists } = await spotifyAPI_to_use.getArtists(artistIds);
        const artistGenreMap = new Map<string, string[]>();
        artists?.forEach((artist) => {
          artistGenreMap.set(artist.id, artist.genres);
        });

        const convertedSongs = result.tracks.map((track) => {
          const artistGenres = track.artists.flatMap(
            (artist) => artistGenreMap.get(artist.id) || []
          );
          return convertSpotifyTrackToSong(track, artistGenres);
        });
        setSongs(convertedSongs);
        groupSongsByGenre(convertedSongs);
      } else {
        console.error("Failed to load top tracks:", result.error);
        setSongs([]);
      }
    } catch (error) {
      console.error("Error loading top tracks:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchSpotifyTracks = async (query: string) => {
    if (!spotifyAPI || !query.trim()) {
      if (!query.trim()) {
        setSongs([]);
      }
      return;
    }

    try {
      setSearching(true);
      const result = await spotifyAPI.searchTracks(query, 20);

      if (result.success && result.tracks) {
        const convertedSongs = result.tracks.map((track) =>
          convertSpotifyTrackToSong(track)
        );
        setSongs(convertedSongs);
      } else {
        console.error("Search failed:", result.error);
        setSongs([]);
      }
    } catch (error) {
      console.error("Error searching tracks:", error);
      setSongs([]);
    } finally {
      setSearching(false);
    }
  };

  // Apple Music functions
  const loadAppleMusicLibrarySongs = async (api?: AppleMusicAPI) => {
    const appleMusicAPI_to_use = api || appleMusicAPI;
    if (!appleMusicAPI_to_use) return;

    try {
      setLoading(true);
      const result = await appleMusicAPI_to_use.getUserLibrarySongs(50);

      if (result.success && result.tracks) {
        const convertedSongs = result.tracks.map(convertAppleMusicTrackToSong);
        setSongs(convertedSongs);
        groupSongsByGenre(convertedSongs);
      } else {
        console.error("Failed to load library songs:", result.error);
        setSongs([]);
      }
    } catch (error) {
      console.error("Error loading library songs:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchAppleMusicViaAndroid = async (query: string) => {
    try {
      console.log("🔍 Apple Music search requested for:", query);

      const result = await AppleMusicAPI.searchCatalogAndroid(query, 20, "us");

      if (result.success && result.tracks) {
        const convertedSongs = result.tracks.map(convertAppleMusicTrackToSong);
        setSongs(convertedSongs);
        console.log(
          `✅ Found ${convertedSongs.length} Apple Music results via MusicKit JS`
        );
      } else {
        console.log("No Apple Music results found:", result.error);
        setSongs([]);
      }
    } catch (error) {
      console.error("❌ Apple Music search error:", error);
      setSongs([]);
    }
  };

  const searchAppleMusicTracks = async (query: string) => {
    if (!query.trim()) {
      setSongs([]);
      return;
    }

    try {
      setSearching(true);

      // For Android users without API access, use MusicKit JS search
      if (!appleMusicAPI) {
        console.log("🔍 Using Apple Music MusicKit JS search for Android");
        await searchAppleMusicViaAndroid(query);
        return;
      }

      // For iOS users with API access
      const result = await appleMusicAPI.searchTracks(query, 20);

      if (result.success && result.tracks) {
        const convertedSongs = result.tracks.map(convertAppleMusicTrackToSong);
        setSongs(convertedSongs);
      } else {
        console.error("Search failed:", result.error);
        setSongs([]);
      }
    } catch (error) {
      console.error("Error searching tracks:", error);
      setSongs([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchText(query);
    if (service === "spotify") {
      searchSpotifyTracks(query);
    } else if (service === "apple") {
      searchAppleMusicTracks(query);
    }
  };

  const groupSongsByGenre = (songsToGroup: Song[]) => {
    const grouped: { [key: string]: Song[] } = {};
    songsToGroup.forEach((song) => {
      song.genres?.forEach((genre) => {
        if (!grouped[genre]) {
          grouped[genre] = [];
        }
        grouped[genre].push(song);
      });
    });
    setGenres(grouped);
  };

  const toggleSongSelection = (song: Song) => {
    if (selectedSongs.some((s) => s.id === song.id)) {
      setSelectedSongs(selectedSongs.filter((s) => s.id !== song.id));
    } else {
      if (selectedSongs.length < 3) {
        setSelectedSongs([...selectedSongs, song]);
      } else {
        Alert.alert("Maximum songs selected", "You can select up to 3 songs.");
      }
    }
  };

  const handleContinue = async () => {
    if (!user) return;

    try {
      const songData = selectedSongs.map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        artwork: song.artwork,
        service: service,
        preview_url: song.preview_url,
      }));

      await UserProfileService.updateFavoriteSongs(user.id, songData);

      if (isEditing) {
        router.back(); // Go back to edit-profile
      } else {
        router.push("/(app)/profile");
      }
    } catch (error) {
      console.error("Failed to save favorite songs:", error);
      Alert.alert("Error", "Failed to save your favorite songs.");
    }
  };

  const renderSongItem = (song: Song, index: number) => (
    <Animatable.View
      animation="fadeInUp"
      duration={500}
      delay={index * 100}
      className="w-[30%] mb-8"
    >
      <TouchableOpacity onPress={() => toggleSongSelection(song)}>
        <Image
          source={{ uri: song.artwork }}
          className="w-full aspect-square rounded-lg"
        />
        {selectedSongs.some((s) => s.id === song.id) && (
          <View className="absolute top-1 right-1 bg-black rounded-full">
            <Ionicons name="checkmark-circle" size={32} color="white" />
          </View>
        )}
        <Text
          className="text-white mt-1 text-sm"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {song.title}
        </Text>
        <Text
          className="text-gray-400 text-xs"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {song.artist}
        </Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  if (loading) {
    return <SkeletonLoader />;
  }

  return (
    <View className="flex-1 bg-black text-white">
      <View className="pt-12 px-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold mt-4">
          {isEditing
            ? "Edit your favorite songs."
            : "Select up to 3 of your favorite songs."}
        </Text>
        <View className="flex-row items-center bg-neutral-800 rounded-3xl px-4 mt-4 w-full">
          <Ionicons name="search" size={18} color="gray" />
          <TextInput
            className="flex-1 text-white text-xl pl-2 py-4"
            placeholder="Search for songs..."
            placeholderTextColor="gray"
            value={searchText}
            onChangeText={handleSearch}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close" size={20} color="gray" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <ScrollView className="px-4 mt-4">
        {selectedSongs.length > 0 && (
          <>
            <Text className="text-white text-xl font-bold mb-2">
              Selected Songs ({selectedSongs.length}/3)
            </Text>
            <FlatList
              data={selectedSongs}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  className="w-36 pr-2 pl-2"
                  onPress={() => toggleSongSelection(item)}
                >
                  <Image
                    source={{ uri: item.artwork }}
                    className="w-full aspect-square rounded-lg"
                  />
                  <View className="absolute top-1 right-1 bg-white rounded-full">
                    <Ionicons name="close" size={20} color="black" />
                  </View>
                  <Text
                    className="text-white mt-1 text-sm"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.title}
                  </Text>
                  <Text
                    className="text-gray-400 text-xs"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.artist}
                  </Text>
                </TouchableOpacity>
              )}
              className="mb-4"
            />
            <View className="h-px bg-neutral-700 my-4" />
          </>
        )}
        {searchText ? (
          <>
            <Text className="text-white text-xl font-bold mb-2">
              Search Results
            </Text>
            <View className="flex-row flex-wrap justify-between">
              {songs.map((song, index) => renderSongItem(song, index))}
            </View>
          </>
        ) : (
          Object.keys(genres).map((genre) => (
            <View key={genre}>
              <Text className="text-white text-xl font-bold mb-2">{genre}</Text>
              <View className="flex-row flex-wrap justify-between">
                {genres[genre]
                  .slice(0, 6)
                  .map((song, index) => renderSongItem(song, index))}
              </View>
              {genres[genre].length > 6 && (
                <TouchableOpacity className="bg-neutral-800 rounded-lg py-3 items-center mt-4">
                  <Text className="text-white">More {genre}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
      <View className="px-4 py-2">
        <TouchableOpacity
          className="bg-white rounded-full py-4 items-center"
          onPress={handleContinue}
          disabled={selectedSongs.length === 0}
        >
          <Text className="text-black font-bold">
            {isEditing ? "Save Changes" : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
