import { router } from "expo-router";
import "nativewind";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Image, Pressable, Text, View } from "react-native";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import { useAuth } from "../context/AuthContext";

// SVG files will be loaded dynamically
// For now, using Image component as fallback until SVG files are added

const windowWidth = Dimensions.get("window").width;

// Intro Screen 1 - Light theme
function IntroOne() {
  return (
    <View className="flex-1 bg-white justify-center items-center px-6">
      <Image
        source={require("../../assets/images/dark-logo.png")}
        style={{ width: 128, height: 137, marginBottom: 24 }}
        resizeMode="contain"
      />
      <Text className="text-black text-4xl font-bold mb-2">platnm</Text>
      <Text className="text-gray-600 text-lg">Put People On</Text>
    </View>
  );
}

// Intro Screen 2 - Dark theme with sign up options (Figma design)
function IntroTwo() {
  const { signInWithApple, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleAppleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithApple();
      if (result?.error) {
        console.error("Apple sign in error:", result.error);
        // You can show an alert here if needed
      }
    } catch (error) {
      console.error("Error during Apple sign in:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <View className="flex-1 bg-[#0e0e0e] relative">
      {/* Logo Section - centered horizontally at top */}
      <View className="absolute top-[129px] left-0 right-0 items-center">
        <View className="items-center mb-1">
          <Image
            source={require("../../assets/images/dark-logo.png")}
            style={{ width: 128, height: 137 }}
            resizeMode="contain"
          />
        </View>
        <Text className="text-white text-[48px] font-extrabold mb-0 leading-[48px]">
          platnm
        </Text>
        <Text className="text-[#b4b4b4] text-[20px] text-center">
          Put People On
        </Text>
      </View>

      {/* Sign up CTAs - positioned at bottom */}
      <View className="absolute left-0 top-[480px] w-full px-4">
        {/* Sign Up Button - 370px width as per Figma */}
        <Pressable
          className="bg-white rounded-[30px] py-4 mb-6 active:opacity-90 self-center"
          style={{ width: 370 }}
          onPress={() => router.push("/(auth)/(register)/signup")}
        >
          <Text className="text-black text-center text-base font-medium tracking-[-0.48px]">
            Sign Up
          </Text>
        </Pressable>

        {/* OR Divider */}
        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-px bg-[#dddddd]" />
          <Text className="text-[#bbbbbb] text-[13px] mx-3">OR</Text>
          <View className="flex-1 h-px bg-[#dddddd]" />
        </View>

        {/* Continue with Google Button */}
        <Pressable
          className="border border-[#c4c4c4] rounded-[30px] py-4 mb-3 active:opacity-70 flex-row items-center justify-center"
          onPress={() => {
            // TODO: Implement Google sign in
            console.log("Google sign in");
          }}
        >
          {/* Google Logo - 19px as per Figma */}
          <View style={{ marginRight: 15 }}>
            <Image
              source={require("../../assets/images/google-logo.png")}
              style={{ width: 19, height: 19 }}
              resizeMode="contain"
            />
          </View>
          <Text className="text-white text-base text-center">
            Continue with Google
          </Text>
        </Pressable>

        {/* Continue with Apple Button */}
        <Pressable
          className="border border-[#c4c4c4] rounded-[30px] py-4 mb-6 active:opacity-70 flex-row items-center justify-center"
          onPress={handleAppleSignIn}
          disabled={isSigningIn || isLoading}
        >
          {/* Apple Logo - 19px as per Figma */}
          <View style={{ marginRight: 19 }}>
            {isSigningIn || isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Image
                source={require("../../assets/images/apple-logo.png")}
                style={{ width: 19, height: 19 }}
                resizeMode="contain"
              />
            )}
          </View>
          <Text className="text-white text-base text-center">
            {isSigningIn || isLoading ? "Signing in..." : "Continue with Apple"}
          </Text>
        </Pressable>

        {/* Log in Link */}
        <Pressable
          className="py-4 active:opacity-70"
          onPress={() => router.push("/(auth)/signin")}
        >
          <Text className="text-white text-base text-center">Log in</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function IntroScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<ICarouselInstance>(null);

  const carouselData = [
    { key: "intro1", component: <IntroOne /> },
    { key: "intro2", component: <IntroTwo /> },
  ];

  // Auto-advance from screen 1 to screen 2 after 2 seconds
  useEffect(() => {
    if (currentIndex === 0 && carouselRef.current) {
      const timer = setTimeout(() => {
        carouselRef.current?.next();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex]);

  return (
    <View className="flex-1 bg-white">
      <Carousel
        ref={carouselRef}
        loop={false}
        width={windowWidth}
        autoPlay={false}
        data={carouselData}
        onSnapToItem={(index) => setCurrentIndex(index)}
        renderItem={({ item }) => (
          <View className="flex-1">{item.component}</View>
        )}
      />

      {/* Page indicators */}
      <View className="absolute bottom-8 left-0 right-0 flex-row justify-center">
        {carouselData.map((_, index) => (
          <View
            key={index}
            className={`mx-1 ${
              index === currentIndex
                ? "w-6 h-2 bg-white rounded-full"
                : "w-2 h-2 bg-gray-500 rounded-full"
            }`}
          />
        ))}
      </View>
    </View>
  );
}

