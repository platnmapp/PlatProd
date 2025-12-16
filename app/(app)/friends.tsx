import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SkeletonLoader from "../../components/SkeletonLoader";
import { ActivityService } from "../../lib/activityService";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
interface DatabaseUser {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
  email?: string;
  isAdded: boolean;
}

interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  sender: {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

export default function Friends() {
  const [searchText, setSearchText] = useState("");
  const [users, setUsers] = useState<DatabaseUser[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    await Promise.all([fetchUsers(), fetchFriendRequests()]);
    setLoading(false);
  };

  const fetchFriendRequests = async () => {
    if (!currentUser) return;

    try {
      // Fetch pending friend requests sent to current user
      const { data: requests, error } = await supabase
        .from("friendships")
        .select("id, user_id, friend_id, status, created_at")
        .eq("friend_id", currentUser.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching friend requests:", error);
        return;
      }

      if (!requests || requests.length === 0) {
        setFriendRequests([]);
        return;
      }

      // Fetch sender profiles separately
      const senderIds = requests.map((req) => req.user_id);
      const { data: senders, error: sendersError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, avatar_url")
        .in("id", senderIds);

      if (sendersError) {
        console.error("Error fetching senders:", sendersError);
        return;
      }

      // Combine the data
      const transformedRequests: FriendRequest[] = requests.map((request) => {
        const sender = senders?.find((s) => s.id === request.user_id);
        return {
          id: request.id,
          user_id: request.user_id,
          friend_id: request.friend_id,
          status: request.status,
          created_at: request.created_at,
          sender: {
            id: sender?.id || "",
            first_name: sender?.first_name,
            last_name: sender?.last_name,
            username: sender?.username,
            avatar_url: sender?.avatar_url,
          },
        };
      });

      console.log("Friend requests data:", transformedRequests);
      setFriendRequests(transformedRequests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
    }
  };

  const fetchUsers = async () => {
    if (!currentUser) return;

    try {
      // Get existing friendships and pending requests to filter them out
      const { data: existingConnections } = await supabase
        .from("friendships")
        .select("user_id, friend_id")
        .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);

      const connectedUserIds = new Set();
      existingConnections?.forEach((conn) => {
        if (conn.user_id === currentUser.id) {
          connectedUserIds.add(conn.friend_id);
        } else {
          connectedUserIds.add(conn.user_id);
        }
      });

      // Fetch users excluding current user and already connected users
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, avatar_url, email")
        .neq("id", currentUser.id);

      if (error) {
        console.error("Error fetching users:", error);
        setUsers([]);
        return;
      }

      if (!data || data.length === 0) {
        setUsers([]);
        return;
      }

      // Filter out already connected users and transform data
      const availableUsers = data.filter(
        (dbUser) =>
          !connectedUserIds.has(dbUser.id) &&
          (dbUser.username || dbUser.first_name)
      );

      const transformedUsers: DatabaseUser[] = availableUsers.map((dbUser) => ({
        id: dbUser.id,
        first_name: dbUser.first_name,
        last_name: dbUser.last_name,
        username: dbUser.username,
        avatar_url: dbUser.avatar_url,
        email: dbUser.email,
        isAdded: false,
      }));

      setUsers(transformedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase.from("friendships").insert({
        user_id: currentUser.id,
        friend_id: userId,
        status: "pending",
      });

      if (error) {
        console.error("Error sending friend request:", error);
        Alert.alert("Error", "Failed to send friend request");
        return;
      }

      // Update UI to show request sent
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, isAdded: true } : user
        )
      );

      // Record activity for the recipient
      await ActivityService.createFriendRequestActivity(currentUser.id, userId);

      Alert.alert("Success", "Friend request sent!");
    } catch (error) {
      console.error("Error sending friend request:", error);
      Alert.alert("Error", "Failed to send friend request");
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (error) {
        console.error("Error accepting friend request:", error);
        Alert.alert("Error", "Failed to accept friend request");
        return;
      }

      // Find the original sender ID
      const originalRequest = friendRequests.find(
        (req) => req.id === requestId
      );
      if (originalRequest && currentUser) {
        // Record activity for the original sender (they get notified that their request was accepted)
        await ActivityService.createFriendAcceptedActivity(
          currentUser.id,
          originalRequest.user_id
        );
      }

      // Remove from friend requests list
      setFriendRequests((prev) => prev.filter((req) => req.id !== requestId));
      Alert.alert("Success", "Friend request accepted!");

      // Refresh data to update friend count
      fetchData();
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "Failed to accept friend request");
    }
  };

  const handleDeclineFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "declined" })
        .eq("id", requestId);

      if (error) {
        console.error("Error declining friend request:", error);
        Alert.alert("Error", "Failed to decline friend request");
        return;
      }

      // Remove from friend requests list
      setFriendRequests((prev) => prev.filter((req) => req.id !== requestId));
      Alert.alert("Request declined", "Friend request declined");
    } catch (error) {
      console.error("Error declining friend request:", error);
      Alert.alert("Error", "Failed to decline friend request");
    }
  };

  const handleInviteMoreFriends = () => {
    console.log("Invite more friends");
  };

  const getDisplayName = (
    user: DatabaseUser | FriendRequest["sender"]
  ): string => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) {
      return user.first_name;
    }
    if (user.username) {
      return user.username;
    }
    return "User";
  };

  const getUserInitials = (
    user: DatabaseUser | FriendRequest["sender"]
  ): string => {
    if (user.first_name) {
      return user.first_name[0].toUpperCase();
    }
    if (user.username) {
      return user.username[0].toUpperCase();
    }
    return "U";
  };

  const filteredUsers = users.filter(
    (user) =>
      getDisplayName(user).toLowerCase().includes(searchText.toLowerCase()) ||
      (user.username &&
        user.username.toLowerCase().includes(searchText.toLowerCase()))
  );

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [searchText]);

  const searchResults = searchText.trim() ? filteredUsers : [];

  const renderFriendRequestItem = (request: FriendRequest) => (
    <View
      key={request.id}
      className="flex-row items-center py-4 px-4 border-2 border-neutral-700 rounded-2xl mb-3"
    >
      {/* User Avatar */}
      <View className="w-12 h-12 rounded-full mr-3 bg-bg-neutral-700 items-center justify-center">
        {request.sender.avatar_url ? (
          <Image
            source={{ uri: request.sender.avatar_url }}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <Text className="text-white text-lg font-bold">
            {getUserInitials(request.sender)}
          </Text>
        )}
      </View>

      {/* User Info */}
      <View className="flex-1">
        <Text className="text-white font-semibold ">
          {getDisplayName(request.sender)}
        </Text>
        <Text className="text-gray-400 text-lg">
          {request.sender.username
            ? `@${request.sender.username}`
            : "Sent you a friend request"}
        </Text>
      </View>

      {/* Accept/Decline Buttons */}
      <View className="flex-row space-x-2">
        <Pressable
          className="bg-red-600 px-3 py-2 rounded-full active:bg-red-700"
          onPress={() => handleDeclineFriendRequest(request.id)}
        >
          <Text className="text-white text-xs font-semibold">Decline</Text>
        </Pressable>
        <Pressable
          className="bg-white-600 px-3 py-2 rounded-full active:bg-white-700"
          onPress={() => handleAcceptFriendRequest(request.id)}
        >
          <Text className="text-white text-xs font-semibold">Accept</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderUserItem = (user: DatabaseUser, index: number) => (
    <Animatable.View
      animation="fadeInUp"
      duration={500}
      delay={index * 100}
      key={user.id}
      className="flex-row items-center py-4 px-4 border-2 border-gray-800 rounded-2xl mb-3"
    >
      {/* User Avatar */}
      <View className="w-12 h-12 rounded-full mr-3 bg-bg-neutral-700 items-center justify-center">
        {user.avatar_url ? (
          <Image
            source={{ uri: user.avatar_url }}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <Text className="text-white text-lg font-bold">
            {getUserInitials(user)}
          </Text>
        )}
      </View>

      {/* User Info */}
      <View className="flex-1">
        <Text className="text-white font-semibold ">
          {getDisplayName(user)}
        </Text>
        <Text className="text-gray-400 text-lg">
          {user.username ? `@${user.username}` : user.email}
        </Text>
      </View>

      {/* Add Button */}
      <Pressable
        className={`w-8 h-8 rounded-full border-2 items-center justify-center active:bg-neutral-800 ${
          user.isAdded ? "bg-green-500 border-green-500" : "border-gray-500"
        }`}
        onPress={() => !user.isAdded && handleSendFriendRequest(user.id)}
        disabled={user.isAdded}
      >
        {user.isAdded && <Ionicons name="checkmark" size={16} color="white" />}
      </Pressable>
    </Animatable.View>
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8">
      <Text className="text-white text-lg text-center mb-4">
        Share this app to your friends
      </Text>
      <Pressable
        className="flex-row items-center justify-center bg-white px-6 py-3 rounded-full active:bg-neutral-800"
        onPress={handleInviteMoreFriends}
      >
        <Text className="text-black  font-medium mr-2">Invite friends</Text>
        <Ionicons name="paper-plane" size={20} color="black" />
      </Pressable>
    </View>
  );

  const renderLoadingState = () => <SkeletonLoader />;

  return (
    <Animatable.View
      animation="fadeIn"
      duration={500}
      className="flex-1 bg-black"
    >
      {/* Header */}
      <View className="pt-1 pb-6 px-4">
        <View className="flex-row items-center justify-center relative">
          <Pressable
            className="absolute left-0 active:bg-neutral-800"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </Pressable>
          <Text className="text-white text-xl font-semibold">
            Add your friends
          </Text>
        </View>
      </View>

      {loading ? (
        renderLoadingState()
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Friend Requests Section */}
          {friendRequests.length > 0 && (
            <View className="px-4 mb-6">
              <Text className="text-white text-lg font-semibold mb-4">
                Friend Requests
              </Text>
              {friendRequests.map(renderFriendRequestItem)}
            </View>
          )}

          {/* Search Bar */}
          {users.length > 0 && (
            <View className="px-4 mb-6">
              <View
                className={`flex-row items-center bg-neutral-700 rounded-full px-4 py-2 ${
                  isFocused ? "border border-gray-600" : ""
                }`}
              >
                <Ionicons name="search" size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 text-white ml-3 py-3"
                  placeholder="Search for Friends..."
                  placeholderTextColor="#9CA3AF"
                  value={searchText}
                  onChangeText={setSearchText}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </View>
            </View>
          )}

          {/* Search Results Section */}
          {searchText.trim() && (
            <View className="px-4 mb-6">
              <Text className="text-white text-2xl font-semibold mb-4">
                Search Results
              </Text>
              {searchResults.length > 0 ? (
                searchResults.map(renderUserItem)
              ) : (
                <View className="py-8 items-center">
                  <Ionicons name="search-outline" size={48} color="#9CA3AF" />
                  <Text className="text-gray-400 text-center mt-3">
                    No users found matching "{searchText}"
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Suggested Contacts */}
          <View className="px-4 flex-1">
            {users.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <Text className="text-white text-2xl font-semibold mb-4">
                  Suggested Contacts
                </Text>
                {users.map((user, index) => renderUserItem(user, index))}

                {/* Invite More Friends Button */}
                <Pressable
                  className="flex-row items-center justify-center py-4 mt-4 active:bg-neutral-800"
                  onPress={handleInviteMoreFriends}
                >
                  <Text className="text-white text-xl mr-2">
                    Invite more friends
                  </Text>
                  <Ionicons
                    name="paper-plane-outline"
                    size={20}
                    color="white"
                  />
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      )}

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
