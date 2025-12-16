import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import "nativewind";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function UsernameSetup() {
  const [username, setUsername] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  // Debounced username checking
  useEffect(() => {
    if (username.length < 3) {
      setIsAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      await checkUsernameAvailability(username);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", usernameToCheck.toLowerCase())
        .single();

      if (error && error.code === "PGRST116") {
        // No rows returned, username is available
        setIsAvailable(true);
      } else if (data) {
        // Username exists
        setIsAvailable(false);
      } else {
        // Other error
        console.error("Error checking username:", error);
        setIsAvailable(null);
      }
    } catch (error) {
      console.error("Error checking username:", error);
      setIsAvailable(null);
    } finally {
      setIsChecking(false);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsFocused(false);
  };

  const handleContinue = async () => {
    if (!username || !isAvailable) return;
    if (!user) {
      Alert.alert("Error", "You must be logged in to continue");
      return;
    }

    setSaving(true);

    try {
      // Save username to database
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        username: username.toLowerCase().trim(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error saving username:", error);
        if (error.code === "23505") {
          // Unique constraint violation
          Alert.alert(
            "Error",
            "This username is already taken. Please choose another."
          );
          setIsAvailable(false);
        } else {
          Alert.alert(
            "Error",
            "Failed to save your username. Please try again."
          );
        }
        return;
      }

      console.log("Username saved successfully:", username);
      dismissKeyboard();
      router.push({
        pathname: "/(accountsetup)/linkaccount",
        params: { context: "onboarding" },
      });
    } catch (error) {
      console.error("Error saving username:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isButtonActive =
    username.length >= 3 && isAvailable === true && !saving && !isChecking;

  const getStatusText = () => {
    if (username.length < 3) return "Username must be at least 3 characters";
    if (isChecking) return "Checking availability...";
    if (isAvailable === true) return "This username is available";
    if (isAvailable === false) return "This username is unavailable";
    return "";
  };

  const getStatusColor = () => {
    if (username.length < 3 || isChecking) return "text-gray-400";
    if (isAvailable === true) return "text-green-500";
    if (isAvailable === false) return "text-red-500";
    return "text-gray-400";
  };

  const getBorderColor = () => {
    if (!isFocused) return "border-transparent";
    if (username.length < 3 || isChecking) return "border-white";
    if (isAvailable === true) return "border-green-500";
    if (isAvailable === false) return "border-red-500";
    return "border-white";
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <Animatable.View
        animation="fadeIn"
        duration={500}
        className="flex-1 bg-[#111] p-5 pt-20"
      >
        <Pressable
          className="absolute top-12 left-5 pt-10 active:bg-neutral-800"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <View className="flex-1 justify-start pt-16">
          <Text className="text-white text-2xl font-bold mb-2">
            Create a username
          </Text>
          <Text className="text-gray-400 text-sm mb-6">
            This will be your public appearance on Platnm. You can change this
            at any time.
          </Text>

          <TextInput
            className={`bg-[#222] text-white rounded-lg px-4 py-3  mb-1 border ${getBorderColor()}`}
            placeholder="Username"
            placeholderTextColor="#b0b0b0"
            value={username}
            onChangeText={(text) =>
              setUsername(text.replace(/[^a-zA-Z0-9_]/g, ""))
            }
            keyboardType="default"
            autoCapitalize="none"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={!saving}
            maxLength={20}
          />
          <Text className={`text-xs mt-1 mb-4 ${getStatusColor()}`}>
            {getStatusText()}
          </Text>

          <Pressable
            onPress={handleContinue}
            className={`rounded-full py-3 items-center mb-4 active:bg-neutral-800 ${isButtonActive ? "bg-white" : "bg-gray-600"}`}
            disabled={!isButtonActive}
          >
            <Text
              className={` font-medium ${isButtonActive ? "text-black" : "text-gray-400"}`}
            >
              {saving ? "Saving..." : "Continue"}
            </Text>
          </Pressable>
        </View>
      </Animatable.View>
    </TouchableWithoutFeedback>
  );
}
