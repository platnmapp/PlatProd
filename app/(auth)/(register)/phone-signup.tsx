import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import "nativewind";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { supabase } from "../../../lib/supabase";

export default function PhoneSignUp() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsFocused(false);
  };

  const handlePhoneNumberChange = (value: string) => {
    const input = value.replace(/\D/g, "").substring(0, 10);
    const size = input.length;
    let formattedInput = "";
    if (size > 0) {
      formattedInput = "(" + input.substring(0, 3);
    }
    if (size > 3) {
      formattedInput += ") " + input.substring(3, 6);
    }
    if (size > 6) {
      formattedInput += "-" + input.substring(6, 10);
    }
    setPhoneNumber(formattedInput);
  };

  const handleContinue = async () => {
    const rawPhoneNumber = phoneNumber.replace(/[^\d]/g, "");

    if (rawPhoneNumber.length === 10) {
      setLoading(true);
      dismissKeyboard();
      const e164PhoneNumber = `+1${rawPhoneNumber}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone: e164PhoneNumber,
      });

      if (error) {
        Alert.alert("Error sending code", error.message);
        setLoading(false);
        return;
      }
      setLoading(false);
      router.push({
        pathname: "confirmationcode",
        params: { phone: e164PhoneNumber },
      } as any);
    } else {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid 10-digit US phone number."
      );
    }
  };

  const isButtonActive =
    phoneNumber.replace(/[^\d]/g, "").length === 10 && !loading;

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <Animatable.View
        animation="fadeIn"
        duration={500}
        className="flex-1 bg-[#111] p-5 pt-20"
      >
        <Pressable
          className="absolute top-12 left-5 pt-1 active:bg-neutral-800"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <View className="flex-1 justify-start pt-10">
          <Text className="text-white text-2xl font-bold mb-2">
            What&apos;s your phone number?
          </Text>
          <Text className="text-gray-400 text-lg mb-6">
            Enter your 10-digit US phone number to continue
          </Text>

          <TextInput
            className={
              `bg-[#222] text-white rounded-lg px-4 py-4 mb-5 border text-lg ` +
              (isFocused ? "border-white" : "border-transparent")
            }
            placeholder="(555) 555-5555"
            placeholderTextColor="#b0b0b0"
            value={phoneNumber}
            onChangeText={handlePhoneNumberChange}
            keyboardType="phone-pad"
            autoCapitalize="none"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            maxLength={14}
          />

          <Pressable
            onPress={handleContinue}
            className={`rounded-full py-3 items-center mb-4 active:bg-neutral-800 ${
              isButtonActive ? "bg-white" : "bg-gray-600"
            }`}
            disabled={!isButtonActive}
          >
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text
                className={` font-medium ${isButtonActive ? "text-black" : "text-gray-400"}`}
              >
                Continue
              </Text>
            )}
          </Pressable>

          <Pressable
            className="border border-white rounded-full py-3 items-center active:bg-neutral-800 py-3"
            onPress={() => router.push("signup" as any)}
          >
            <Text className="text-white text-lg">
              Sign up with email address
            </Text>
          </Pressable>
        </View>
      </Animatable.View>
    </TouchableWithoutFeedback>
  );
}
