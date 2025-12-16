import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as Animatable from "react-native-animatable";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { signOut, deleteAccount } = useAuth();

  const handleSignOut = async () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/(register)/signup");
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. All your data, songs, and friendships will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await deleteAccount();
            if (result?.error) {
              Alert.alert(
                "Error",
                result.error.message || "Failed to delete account. Please try again."
              );
            } else {
              // Account deleted successfully, redirect to signup
              router.replace("/(auth)/(register)/signup");
            }
          },
        },
      ]
    );
  };

  const handleTermsAndConditions = () => {
    // TODO: Navigate to terms and conditions screen
    console.log("Navigate to Terms and Conditions");
  };

  const handlePrivacyPolicy = () => {
    // TODO: Navigate to privacy policy screen
    console.log("Navigate to Privacy Policy");
  };

  const handleChangePassword = () => {
    // TODO: Navigate to change password screen
    console.log("Navigate to Change Password");
  };

  const settingsOptions = [
    {
      title: "Terms and conditions",
      onPress: handleTermsAndConditions,
    },
    {
      title: "Privacy policy",
      onPress: handlePrivacyPolicy,
    },
    {
      title: "Change password",
      onPress: handleChangePassword,
    },
    {
      title: "Log out",
      onPress: handleSignOut,
    },
    {
      title: "Delete account",
      onPress: handleDeleteAccount,
      destructive: true,
    },
  ];

  return (
    <Animatable.View
      animation="fadeIn"
      duration={500}
      className="flex-1 bg-black"
    >
      <View className="mt-1 pb-6 px-4">
        <View className="flex-row items-center justify-center relative">
          <Pressable
            className="absolute left-0 active:bg-neutral-800"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </Pressable>
          <Text className="text-white text-xl font-semibold">Settings</Text>
        </View>
      </View>

      {/* Settings Options */}
      <View className="px-4 flex-1">
        <View className="space-y-3">
          {settingsOptions.map((option, index) => (
            <Pressable
              key={index}
              className="border-2 border-neutral-800 bg-neutral-900 rounded-3xl px-6 py-4 mb-3 active:bg-neutral-800"
              onPress={option.onPress}
            >
              <Text
                className={`text-lg ${
                  option.destructive ? "text-red-500" : "text-white"
                }`}
              >
                {option.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

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
