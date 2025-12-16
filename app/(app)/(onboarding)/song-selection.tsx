import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SkeletonLoader from "../../../components/SkeletonLoader";
import {
  AppleMusicAPI,
  AppleMusicTokens,
  AppleMusicTrack,
} from "../../../lib/appleMusic";
import { CacheService } from "../../../lib/cacheService";
import { FavoriteSongsService } from "../../../lib/favoriteSongs";
import { SpotifyAPI, SpotifyTrack } from "../../../lib/spotify";
import { supabase } from "../../../lib/supabase";
import { UserProfileService } from "../../../lib/userProfile";
import { useAuth } from "../../context/AuthContext";

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  preview_url?: string;
  genres?: string[];
}

export default function SongSelectionScreen() {
  const [searchText, setSearchText] = useState("");
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [spotifyAPI, setSpotifyAPI] = useState<SpotifyAPI | null>(null);
  const [appleMusicAPI, setAppleMusicAPI] = useState<AppleMusicAPI | null>(
    null
  );
  const [genres, setGenres] = useState<{ [key: string]: Song[] }>({});
  const [service, setService] = useState<"spotify" | "apple" | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      determineServiceAndFetchSongs();
    }
  }, [user]);

  const determineServiceAndFetchSongs = async () => {
    if (!user) return;

    const { profile } = await UserProfileService.getUserProfile(user.id);
    if (!profile) {
      setLoading(false);
      return;
    }

    const isSpotifyConnected = UserProfileService.isSpotifyConnected(profile);
    const isAppleMusicConnected =
      UserProfileService.isAppleMusicConnected(profile);

    if (isSpotifyConnected) {
      initializeSpotifyAPI();
    } else if (isAppleMusicConnected) {
      initializeAppleMusicAPI();
    } else {
      setLoading(false);
    }
  };

  const initializeSpotifyAPI = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { profile } = await UserProfileService.getUserProfile(user.id);

      if (!profile || !profile.spotify_access_token) {
        setLoading(false);
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
      const loadedSongs = await loadSpotifyTopTracks(api);
      if (loadedSongs.length === 0) {
        await loadDefaultSongs(api);
      }
    } catch (error) {
      console.error("Error initializing Spotify API:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeAppleMusicAPI = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { profile } = await UserProfileService.getUserProfile(user.id);

      if (!profile) {
        setLoading(false);
        return;
      }

      if (
        !profile.apple_music_user_token ||
        !profile.apple_music_developer_token
      ) {
        // Check if this is an Android user with limited access
        if (profile.apple_music_connected && !profile.apple_music_user_token) {
          console.log(
            "Android user detected - enabling search-based Apple Music access via Edge Function"
          );
          // Set a flag to enable search-based mode for Android Apple Music users
          setService("apple");
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      const tokens: AppleMusicTokens = {
        userToken: profile.apple_music_user_token,
        developerToken: profile.apple_music_developer_token,
        expiresAt: profile.apple_music_token_expires_at
          ? new Date(profile.apple_music_token_expires_at).getTime()
          : Date.now() + 24 * 60 * 60 * 1000,
      };

      const api = new AppleMusicAPI(tokens);
      setAppleMusicAPI(api);
      const loadedSongs = await loadAppleMusicLibrarySongs(api);
      if (loadedSongs.length === 0) {
        await loadDefaultSongs(api);
      }
    } catch (error) {
      console.error("Error initializing Apple Music API:", error);
    } finally {
      setLoading(false);
    }
  };

  const convertSpotifyTrackToSong = (
    track: SpotifyTrack,
    artistGenres: string[] = []
  ): Song => {
    return {
      id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      artwork: track.album.images[0]?.url || "",
      preview_url: track.preview_url || undefined,
      genres: artistGenres,
    };
  };

  const convertAppleMusicTrackToSong = (track: AppleMusicTrack): Song => {
    return {
      id: track.id,
      title: track.attributes.name,
      artist: track.attributes.artistName,
      album: track.attributes.albumName,
      artwork:
        track.attributes.artwork?.url
          .replace("{w}", "300")
          .replace("{h}", "300") || "",
      preview_url: track.attributes.previews?.[0]?.url,
      genres: track.attributes.genreNames,
    };
  };

  const loadSpotifyTopTracks = async (api: SpotifyAPI): Promise<Song[]> => {
    try {
      const result = await api.getUserTopTracks(50);
      if (result.success && result.tracks) {
        const artistIds = result.tracks.flatMap((track) =>
          track.artists.map((artist) => artist.id)
        );
        const { artists } = await api.getArtists(artistIds);
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
        return convertedSongs;
      }
    } catch (error) {
      console.error("Error loading Spotify top tracks:", error);
    }
    return [];
  };

  const loadAppleMusicLibrarySongs = async (
    api: AppleMusicAPI
  ): Promise<Song[]> => {
    try {
      const result = await api.getUserLibrarySongs(50);
      if (result.success && result.tracks) {
        const convertedSongs = result.tracks.map(convertAppleMusicTrackToSong);
        setSongs(convertedSongs);
        groupSongsByGenre(convertedSongs);
        return convertedSongs;
      }
    } catch (error) {
      console.error("Error loading Apple Music library songs:", error);
    }
    return [];
  };

  const loadDefaultSongs = async (api: SpotifyAPI | AppleMusicAPI) => {
    let defaultSongs: Song[] = [];
    const searchTerm = "popular hits";
    if (api instanceof SpotifyAPI) {
      const result = await api.searchTracks(searchTerm, 20);
      if (result.success && result.tracks) {
        const artistIds = result.tracks.flatMap((track) =>
          track.artists.map((artist) => artist.id)
        );
        const { artists } = await api.getArtists(artistIds);
        const artistGenreMap = new Map<string, string[]>();
        artists?.forEach((artist) => {
          artistGenreMap.set(artist.id, artist.genres);
        });

        defaultSongs = result.tracks.map((track) => {
          const artistGenres = track.artists.flatMap(
            (artist) => artistGenreMap.get(artist.id) || []
          );
          return convertSpotifyTrackToSong(track, artistGenres);
        });
      }
    } else if (api instanceof AppleMusicAPI) {
      const result = await api.searchTracks(searchTerm, 20);
      if (result.success && result.tracks) {
        defaultSongs = result.tracks.map(convertAppleMusicTrackToSong);
      }
    }
    setSongs(defaultSongs);
    groupSongsByGenre(defaultSongs);
  };

  const groupSongsByGenre = (songsToGroup: Song[]) => {
    const grouped: { [key: string]: Song[] } = {};
    songsToGroup.forEach((song) => {
      (song.genres?.length ? song.genres : ["Misc"]).forEach((genre) => {
        if (!grouped[genre]) {
          grouped[genre] = [];
        }
        grouped[genre].push(song);
      });
    });
    setGenres(grouped);
  };

  const handleSearch = async (query: string) => {
    setSearchText(query);
    if (!query.trim()) {
      return;
    }

    setSearching(true);
    let searchResults: Song[] = [];

    if (spotifyAPI) {
      const result = await spotifyAPI.searchTracks(query, 20);
      if (result.success && result.tracks) {
        searchResults = result.tracks.map((t) => convertSpotifyTrackToSong(t));
      }
    } else if (appleMusicAPI) {
      const result = await appleMusicAPI.searchTracks(query, 20);
      if (result.success && result.tracks) {
        searchResults = result.tracks.map(convertAppleMusicTrackToSong);
      }
    } else if (service === "apple") {
      // Android Apple Music users - use MusicKit JS for search
      try {
        const result = await AppleMusicAPI.searchCatalogAndroid(
          query,
          20,
          "us"
        );

        if (result.success && result.tracks) {
          searchResults = result.tracks.map(convertAppleMusicTrackToSong);
        } else {
          console.error("❌ Apple Music search failed:", result.error);
        }
      } catch (error) {
        console.error("❌ Apple Music search via MusicKit JS failed:", error);
      }
    }

    setSongs(searchResults);
    setSearching(false);
  };

  const toggleSongSelection = (song: Song) => {
    const isSelected = selectedSongs.some((s) => s.id === song.id);
    if (isSelected) {
      setSelectedSongs((prev) => prev.filter((s) => s.id !== song.id));
    } else {
      if (selectedSongs.length < 3) {
        setSelectedSongs((prev) => [...prev, song]);
      } else {
        Alert.alert(
          "Maximum 3 songs",
          "You can only select up to 3 favorite songs."
        );
      }
    }
  };

  const handleContinue = async () => {
    if (!user) return;

    try {
      for (let i = 0; i < selectedSongs.length; i++) {
        const song = selectedSongs[i];
        const favoriteSongInput =
          FavoriteSongsService.convertToFavoriteSongInput(
            song,
            spotifyAPI ? "spotify" : "apple"
          );
        await FavoriteSongsService.saveFavoriteSong(
          user.id,
          i + 1,
          favoriteSongInput
        );
      }
      router.push("/(app)");
    } catch (error) {
      console.error("Error saving favorite songs:", error);
    }
  };

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
          Select up to 3 of your favorite songs.
        </Text>
        <View className="flex-row items-center bg-neutral-800 rounded-lg px-4 mt-4">
          <Ionicons name="search" size={20} color="gray" />
          <TextInput
            className="flex-1 text-white p-2 ml-2"
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
        {searchText ? (
          <View className="flex-row flex-wrap justify-between">
            {songs.map((song) => (
              <TouchableOpacity
                key={song.id}
                className="w-[30%] mb-4"
                onPress={() => toggleSongSelection(song)}
              >
                <Image
                  source={{ uri: song.artwork }}
                  className="w-full aspect-square rounded-lg"
                />
                {selectedSongs.some((s) => s.id === song.id) && (
                  <View className="absolute top-1 right-1 bg-white rounded-full">
                    <Ionicons name="checkmark-circle" size={24} color="green" />
                  </View>
                )}
                <Text className="text-white mt-1" numberOfLines={1}>
                  {song.title}
                </Text>
                <Text className="text-gray-400 text-sm" numberOfLines={1}>
                  {song.artist}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : Object.keys(genres).length > 0 ? (
          Object.keys(genres).map((genre) => (
            <View key={genre}>
              <Text className="text-white text-xl font-bold mb-2">{genre}</Text>
              <View className="flex-row flex-wrap justify-between">
                {genres[genre].slice(0, 6).map((song) => (
                  <TouchableOpacity
                    key={song.id}
                    className="w-[30%] mb-4"
                    onPress={() => toggleSongSelection(song)}
                  >
                    <Image
                      source={{ uri: song.artwork }}
                      className="w-full aspect-square rounded-lg"
                    />
                    {selectedSongs.some((s) => s.id === song.id) && (
                      <View className="absolute top-1 right-1 bg-white rounded-full">
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="green"
                        />
                      </View>
                    )}
                    <Text className="text-white mt-1" numberOfLines={1}>
                      {song.title}
                    </Text>
                    <Text className="text-gray-400 text-sm" numberOfLines={1}>
                      {song.artist}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {genres[genre].length > 6 && (
                <TouchableOpacity className="bg-neutral-800 rounded-lg py-3 items-center mt-4">
                  <Text className="text-white">More {genre}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        ) : (
          <View className="flex-1 justify-center items-center py-20">
            <Ionicons name="musical-notes-outline" size={64} color="#9CA3AF" />
            <Text className="text-white text-lg text-center mb-2 mt-4">
              No songs found
            </Text>
            <Text className="text-gray-400 text-sm text-center">
              Connect a music service to see your top songs, or try searching.
            </Text>
          </View>
        )}
      </ScrollView>
      <View className="px-4 py-2">
        <TouchableOpacity
          className="bg-white rounded-full py-4 items-center"
          onPress={handleContinue}
          disabled={selectedSongs.length === 0}
        >
          <Text className="text-black font-bold">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
