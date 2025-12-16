import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import "nativewind";
import React, { useState } from "react";
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

export default function NameSetup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isFocusedFirstName, setIsFocusedFirstName] = useState(false);
  const [isFocusedLastName, setIsFocusedLastName] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsFocusedFirstName(false);
    setIsFocusedLastName(false);
  };

  const handleContinue = async () => {
    if (!firstName || !lastName) return;
    if (!user) {
      Alert.alert("Error", "You must be logged in to continue");
      return;
    }

    setSaving(true);

    try {
      // Save name to database
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error saving name:", error);
        Alert.alert("Error", "Failed to save your name. Please try again.");
        return;
      }

      console.log("Name saved successfully:", firstName, lastName);
      dismissKeyboard();
      router.push("/username");
    } catch (error) {
      console.error("Error saving name:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isButtonActive = firstName.length > 0 && lastName.length > 0 && !saving;

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
            What's your name?
          </Text>
          <Text className="text-gray-400 text-sm mb-6">
            Enter your first and last name to set up your profile
          </Text>

          <TextInput
            className={
              `bg-[#222] text-white rounded-lg px-4 py-3  mb-5 border ` +
              (isFocusedFirstName ? "border-white" : "border-transparent")
            }
            placeholder="First name"
            placeholderTextColor="#b0b0b0"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            onFocus={() => setIsFocusedFirstName(true)}
            onBlur={() => setIsFocusedFirstName(false)}
            editable={!saving}
          />
          <TextInput
            className={
              `bg-[#222] text-white rounded-lg px-4 py-3  mb-5 border ` +
              (isFocusedLastName ? "border-white" : "border-transparent")
            }
            placeholder="Last name"
            placeholderTextColor="#b0b0b0"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            onFocus={() => setIsFocusedLastName(true)}
            onBlur={() => setIsFocusedLastName(false)}
            editable={!saving}
          />

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
