import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

export default function VideoOnboarding() {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleSkip = () => {
    // Navigate to home screen after skipping
    router.replace("/(app)");
  };

  const handleVideoEnd = () => {
    // Navigate to home screen after video ends
    router.replace("/(app)");
  };

  const handleVideoLoad = () => {
    setIsLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 bg-black">
        {/* Skip Button */}
        <TouchableOpacity
          className="absolute right-5 z-10 px-1 py-1 rounded-lg items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onPress={handleSkip}
        >
          <Text className="text-white font-semibold text-center">Skip</Text>
        </TouchableOpacity>

        {/* Loading indicator */}
        {isLoading && (
          <View className="absolute inset-0 justify-center items-center z-5">
            <Text className="text-white text-lg">Loading video...</Text>
          </View>
        )}

        {/* Video */}
        <View className="flex-1 px-4 py-8">
          <Video
            ref={videoRef}
            source={require("../../../assets/videos/spotifydemo.mp4")}
            style={{
              flex: 1,
              borderRadius: 12,
            }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={true}
            isLooping={false}
            onLoad={handleVideoLoad}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (status.isLoaded && status.didJustFinish) {
                handleVideoEnd();
              }
            }}
          />
        </View>

        {/* Bottom Text */}
        <View className="absolute bottom-0 left-0 right-0 items-center z-10">
          <Text className="text-white text-xl font-bold text-center">
            THIS IS HOW IT WORKS!
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
