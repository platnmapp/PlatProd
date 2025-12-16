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
import { useAuth } from "../context/AuthContext";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithPassword, isLoading } = useAuth();

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsEmailFocused(false);
    setIsPasswordFocused(false);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setError(null);
    const result = await signInWithPassword(email, password);

    if (result?.error) {
      setError(result.error.message || "Invalid email or password. Please try again.");
    }
    // If successful, the auth state change will handle navigation
  };

  const isButtonActive = email.length > 0 && password.length > 0 && !isLoading;

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
            Sign In
          </Text>
          <Text className="text-gray-400 text-lg mb-6">
            Enter your email and password to continue
          </Text>

          {/* Email Input */}
          <TextInput
            style={{
              lineHeight: 20,
            }}
            className={
              `bg-[#222] text-white rounded-lg px-4 py-4 mb-4 border text-lg` +
              (isEmailFocused ? " border-white" : " border-transparent")
            }
            placeholder="Email address"
            placeholderTextColor="#b0b0b0"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            textAlignVertical="center"
            onFocus={() => setIsEmailFocused(true)}
            onBlur={() => setIsEmailFocused(false)}
          />

          {/* Password Input */}
          <View className="relative mb-5">
            <TextInput
              style={{
                lineHeight: 20,
              }}
              className={
                `bg-[#222] text-white rounded-lg px-4 py-4 pr-12 border text-lg` +
                (isPasswordFocused ? " border-white" : " border-transparent")
              }
              placeholder="Password"
              placeholderTextColor="#b0b0b0"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              textAlignVertical="center"
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
            />
            <Pressable
              className="absolute right-4 top-4"
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={24}
                color="#b0b0b0"
              />
            </Pressable>
          </View>

          {error && (
            <Text className="text-red-500 mb-4 text-base">{error}</Text>
          )}

          <Pressable
            onPress={handleSignIn}
            className={`rounded-full py-5 items-center mb-4 active:opacity-90 ${
              isButtonActive ? "bg-white" : "bg-gray-600"
            }`}
            disabled={!isButtonActive}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Animatable.Text
                animation="fadeIn"
                duration={500}
                className={`text-lg ${
                  isButtonActive ? "text-black" : "text-gray-400"
                }`}
              >
                Sign In
              </Animatable.Text>
            )}
          </Pressable>

          <Pressable
            className="py-3 active:opacity-70"
            onPress={() => {
              // TODO: Implement forgot password flow
              console.log("Forgot password");
            }}
          >
            <Text className="text-gray-400 text-center text-base">
              Forgot password?
            </Text>
          </Pressable>
        </View>
      </Animatable.View>
    </TouchableWithoutFeedback>
  );
}
