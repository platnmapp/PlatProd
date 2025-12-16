import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

export default function OnboardingFirst() {
  return (
    <View className="flex-1 bg-[#111] p-5 pt-20">
      {/* Back button */}
      <TouchableOpacity
        className="absolute top-12 left-5 pt-10"
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <View className="flex-1 justify-center pt-10">
        {/* Illustration */}
        <View className="items-center mb-10">
          <Image
            source={require("../../../assets/images/placeholder.png")}
            className="w-64 h-80"
            resizeMode="contain"
          />
        </View>

        <Text className="text-white text-3xl font-bold mb-4 text-center px-5">
          Share music seamlessly
        </Text>
        <Text className="text-gray-400 text-lg mb-6 text-center px-5">
          Platnm lets you send songs and albums to friends, whether they use
          Spotify or Apple Music.
        </Text>
      </View>
    </View>
  );
}
