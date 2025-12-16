import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";

interface SlideThreeProps {
  currentIndex: number;
}

export default function SlideThree({ currentIndex }: SlideThreeProps) {
  const [completing, setCompleting] = useState(false);
  const { completeOnboarding } = useAuth();

  const handleGetStarted = async () => {
    setCompleting(true);
    const result = await completeOnboarding();
    setCompleting(false);

    if (result?.error) {
      console.error("Failed to complete onboarding:", result.error);
      // Still navigate even if there's an error saving onboarding status
    }

    // Navigate to video onboarding first
    router.replace("/(app)/(onboarding)/video");
  };

  const isCurrentSlide = currentIndex === 2; // Third slide (index 2)

  return (
    <View className="flex-1 bg-[#111] p-5 pt-20">
      {/* Back button */}
      <TouchableOpacity
        className="absolute top-12 left-5 pt-10"
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <View className="flex-1 justify-between pt-10">
        <View className="flex-1 justify-center">
          {/* Illustration */}
          <View className="items-center mb-10">
            <Image
              source={require("../../../assets/images/placeholder.png")}
              className="w-64 h-80"
              resizeMode="contain"
            />
          </View>

          <Text className="text-white text-3xl font-bold mb-4 text-center px-5">
            Hit your friends without interrupting your listening!
          </Text>
          <Text className="text-gray-400 text-lg mb-6 text-center px-5">
            Recommending music on Platnm is as simple as sending songs via text
            message, only now you can keep track of all your recs in one place!
          </Text>
        </View>

        {/* Get Started button - only show on third slide */}
        {isCurrentSlide && (
          <TouchableOpacity
            className="bg-white py-4 rounded-xl mx-5 mb-16"
            onPress={handleGetStarted}
            disabled={completing}
          >
            {completing ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text className="text-black text-center font-bold text-lg">
                Get Started
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
