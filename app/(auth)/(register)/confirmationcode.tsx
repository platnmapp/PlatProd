import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { supabase } from "../../../lib/supabase";
import { UserProfileService } from "../../../lib/userProfile";
import { useAuth } from "../../context/AuthContext";

export default function ConfirmationCodeScreen() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]);
  const { email, phone, shouldSendOtp } = useLocalSearchParams<{
    email?: string;
    phone?: string;
    shouldSendOtp?: string;
  }>();
  const { verifyOtp, signInWithEmail } = useAuth();

  console.log("ConfirmationCodeScreen rendered with email:", email);
  console.log("ConfirmationCodeScreen rendered with phone:", phone);
  console.log("Should send OTP:", shouldSendOtp);

  if (!email && !phone) {
    return (
      <View className="flex-1 justify-center items-center bg-[#111]">
        <Text className="text-red-500">
          No email or phone number provided. Please go back and try again.
        </Text>
      </View>
    );
  }

  // Send OTP when screen loads for email
  useEffect(() => {
    const sendOtpOnLoad = async () => {
      if (shouldSendOtp === "true" && !otpSent && email) {
        console.log("Sending OTP to:", email);
        setSending(true);
        setOtpSent(true);
        try {
          const result = await signInWithEmail(email);
          const { error } = result || {};
          setSending(false);
          if (error) {
            console.error("Failed to send OTP:", error);
            // Create detailed error message for debugging
            const errorDetails = JSON.stringify({
              message: error.message,
              name: error.name,
              status: error.status,
              fullError: error,
            }, null, 2);
            console.error("Full error details:", errorDetails);
            setError(
              error.message || "Failed to send OTP. Check console for details."
            );
          } else {
            console.log("OTP sent successfully");
          }
        } catch (err: any) {
          setSending(false);
          const errorDetails = JSON.stringify({
            message: err?.message,
            name: err?.name,
            stack: err?.stack,
          }, null, 2);
          console.error("Exception in sendOtpOnLoad:", errorDetails);
          setError(
            `Error: ${err?.message || "Unknown error"}. Check console for full details.`
          );
        }
      }
    };
    sendOtpOnLoad();
  }, [shouldSendOtp, otpSent, email, signInWithEmail]);

  const handleChange = (text: string, idx: number) => {
    if (/^[0-9]?$/.test(text)) {
      const newCode = [...code];
      newCode[idx] = text;
      setCode(newCode);

      if (text && idx < 5) {
        inputs.current[idx + 1]?.focus();
        setActiveIdx(idx + 1);
      }
    }
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
      setActiveIdx(idx - 1);
    }
  };

  const checkUserProfileAndRedirect = async (userId: string) => {
    try {
      const { profile, error } =
        await UserProfileService.getUserProfile(userId);

      if (error) {
        console.log(
          "Error fetching profile, continuing with account setup:",
          error
        );
        router.replace("/name");
        return;
      }

      // Check if user has completed their profile setup
      const hasCompleteName = profile?.first_name && profile?.last_name;
      const hasUsername = profile?.username;

      if (hasCompleteName && hasUsername) {
        console.log("User has complete profile, redirecting to main app");
        // User has a complete profile, go to main app
        router.replace("/(app)");
      } else {
        console.log("User profile incomplete, continuing with account setup");
        // User needs to complete their profile
        if (!hasCompleteName) {
          router.replace("/name");
        } else if (!hasUsername) {
          router.replace("/username");
        } else {
          router.replace("/linkaccount");
        }
      }
    } catch (error) {
      console.error("Error checking user profile:", error);
      // On error, default to account setup
      router.replace("/name");
    }
  };

  const handleVerify = async () => {
    const otp = code.join("");
    if (otp.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setVerifying(true);
    setError(null);

    let verificationError = null;

    if (phone) {
      const {
        data: { session },
        error,
      } = await supabase.auth.verifyOtp({
        phone: phone,
        token: otp,
        type: "sms",
      });
      verificationError = error;
    } else if (email) {
      const result = await verifyOtp(email, otp);
      verificationError = result?.error;
    }

    setVerifying(false);

    if (verificationError) {
      setError(verificationError.message || "Invalid code. Please try again.");
      // Clear the code so user can re-enter
      setCode(["", "", "", "", "", ""]);
      setActiveIdx(0);
      inputs.current[0]?.focus();
    } else {
      // Authentication successful
      setTimeout(async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user?.id) {
            await checkUserProfileAndRedirect(session.user.id);
          } else {
            console.log("No user session found, redirecting to account setup");
            router.replace("/name");
          }
        } catch (error) {
          console.error("Error getting session:", error);
          router.replace("/name");
        }
      }, 100);
    }
  };

  const handleResendCode = async () => {
    setSending(true);
    setError(null);

    let resendError = null;

    if (phone) {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      resendError = error;
    } else if (email) {
      const result = await signInWithEmail(email);
      resendError = result?.error;
    }

    setSending(false);

    if (resendError) {
      setError(resendError.message || "Failed to resend code.");
    } else {
      Alert.alert("Code sent", "A new confirmation code has been sent.");
      setCode(["", "", "", "", "", ""]);
      setActiveIdx(0);
      inputs.current[0]?.focus();
    }
  };

  const isCodeComplete = code.every((digit) => digit.length === 1);

  return (
    <Animatable.View
      animation="fadeIn"
      duration={500}
      className="flex-1 bg-[#111] px-6 pt-20"
    >
      {/* Back button */}
      <Pressable
        className="absolute top-12 left-5 pt-10 active:bg-neutral-800"
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </Pressable>

      <View className="flex-1 justify-start pt-16">
        <Text className="text-white text-2xl font-bold mb-2">
          Enter the 6-digit confirmation code
        </Text>
        <Text className="text-gray-400 text-sm mb-8">
          To confirm your account, enter the 6-digit code we sent to{" "}
          {email || phone}
        </Text>

        {/* Hidden TextInput for OTP autofill */}
        <TextInput
          style={{ position: "absolute", left: -9999 }}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          onChangeText={(text) => {
            if (text.length === 6) {
              const digits = text.split("");
              setCode(digits);
              // Focus the last input to show completion
              inputs.current[5]?.focus();
            }
          }}
          keyboardType="number-pad"
          maxLength={6}
        />

        {sending && (
          <Animatable.View
            animation="fadeIn"
            duration={500}
            className="flex-row items-center mb-4"
          >
            <ActivityIndicator color="#fff" size="small" />
            <Text className="text-white ml-2">Sending OTP...</Text>
          </Animatable.View>
        )}

        <View className="flex-row justify-between mt-4">
          {code.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={(ref) => {
                inputs.current[idx] = ref;
              }}
              className={`
                w-12 h-20 rounded-xl text-white text-2xl font-bold text-center bg-[#222]
                border-2
                ${activeIdx === idx || digit ? "border-white" : "border-transparent"}
              `}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleChange(text, idx)}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              onFocus={() => setActiveIdx(idx)}
              selectionColor="#fff"
              autoFocus={idx === 0}
              editable={!verifying && !sending}
            />
          ))}
        </View>

        {error && (
          <View className="mt-4">
            <Text className="text-red-500 mb-2">{error}</Text>
            <Pressable
              onPress={() => {
                // Log full error details to console for easy copying
                console.log("=== FULL ERROR DETAILS FOR DEBUGGING ===");
                console.log("Error message:", error);
                console.log("Email:", email);
                console.log("Supabase URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
                Alert.alert(
                  "Error Details",
                  "Full error details have been logged to the console. Please check your terminal/console and copy the error logs starting from '=== FULL ERROR DETAILS FOR DEBUGGING ==='"
                );
              }}
              className="mt-2"
            >
              <Text className="text-blue-400 text-xs underline">
                Tap to log full error details to console
              </Text>
            </Pressable>
          </View>
        )}

        {/* Verify button */}
        <Pressable
          className={`
            mt-8 py-4 rounded-xl active:bg-neutral-800
            ${
              isCodeComplete && !verifying && !sending
                ? "bg-white"
                : "bg-gray-600"
            }
          `}
          onPress={handleVerify}
          disabled={!isCodeComplete || verifying || sending}
        >
          {verifying ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text
              className={`
              text-center font-bold text-lg
              ${isCodeComplete ? "text-black" : "text-gray-400"}
            `}
            >
              Verify Code
            </Text>
          )}
        </Pressable>

        {/* Resend code button */}
        <Pressable
          className="mt-4 py-2 active:bg-neutral-800"
          onPress={handleResendCode}
          disabled={sending || verifying}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-gray-400 text-center">
              Didn't receive the code? Resend
            </Text>
          )}
        </Pressable>
      </View>
    </Animatable.View>
  );
}
