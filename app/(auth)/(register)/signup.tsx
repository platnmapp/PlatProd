import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import "nativewind";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useAuth } from "../../context/AuthContext";

export default function EmailSignUp() {
  const [email, setEmail] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithEmail, isLoading } = useAuth();

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsFocused(false);
  };

  const handleContinue = async () => {
    if (email) {
      setError(null);

      // Navigate FIRST, then send OTP from the confirmation screen
      console.log("=== NAVIGATION DEBUG ===");
      console.log("About to navigate to confirmationcode");
      console.log("Email to pass:", email);

      try {
        router.push({
          pathname: "/confirmationcode",
          params: { email, shouldSendOtp: "true" },
        });
        console.log("Navigation call completed successfully");
      } catch (error) {
        console.error("Navigation failed:", error);
      }
    }
  };

  const isButtonActive = email.length > 0 && !isLoading;

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <Animatable.View
        animation="fadeIn"
        duration={500}
        className="flex-1 bg-[#111] p-5 pt-20"
      >
        <Pressable
          className="absolute top-12 left-5 pt-1 active:bg-neutral-800"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(auth)/intro");
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <View className="flex-1 justify-start pt-10">
          <Text className="text-white text-2xl font-bold mb-2">
            What&apos;s your email?
          </Text>
          <Text className="text-gray-400 text-lg mb-6">
            Enter the email address where you can be contacted
          </Text>

          <TextInput
            style={{
              lineHeight: 20,
            }}
            className={
              `bg-[#222] text-white rounded-lg px-4 py-4 mb-5 border text-lg` +
              (isFocused ? " border-white" : " border-transparent")
            }
            placeholder="Email address"
            placeholderTextColor="#b0b0b0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlignVertical="center"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {error && <Text className="text-red-500 mb-2">{error}</Text>}

          <Pressable
            onPress={handleContinue}
            className={`rounded-full py-5 items-center mb-4 active:bg-neutral-800 ${isButtonActive ? "bg-white" : "bg-gray-600"}`}
            disabled={!isButtonActive}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Animatable.Text
                animation="fadeIn"
                duration={500}
                className={` text-lg ${isButtonActive ? "text-black" : "text-gray-400"}`}
              >
                Continue
              </Animatable.Text>
            )}
          </Pressable>

          <Pressable
            className="border border-white rounded-full py-5 items-center active:bg-neutral-800 py-3"
            onPress={() => router.push("/phone-signup")}
          >
            <Text className="text-white text-lg">
              Sign up with mobile number
            </Text>
          </Pressable>
        </View>
      </Animatable.View>
    </TouchableWithoutFeedback>
  );
}
