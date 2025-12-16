import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

export default function OnboardingSecond() {
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
          Add Platnm to your favourites
        </Text>
        <Text className="text-gray-400 text-lg mb-6 text-center px-5">
          This is a one-time step that will allow you to share music faster and
          easier.
        </Text>
      </View>
    </View>
  );
}
