import { Redirect } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { DeepLinkHandler } from "../lib/deepLinkHandler"; // Adjust path as needed
import { useAuth } from "./context/AuthContext";

export default function RootIndex() {
  const { user, isLoading, hasCompletedOnboarding, isCheckingOnboarding } =
    useAuth();

  // Tell DeepLinkHandler when user auth state changes
  useEffect(() => {
    const userReady =
      user && hasCompletedOnboarding && !isLoading && !isCheckingOnboarding;
    DeepLinkHandler.setUserReady(userReady);

    console.log("User ready state:", userReady);
  }, [user, hasCompletedOnboarding, isLoading, isCheckingOnboarding]);

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log("Received deep link:", url);
      DeepLinkHandler.handleAppUrl(url);
    };

    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    // Check for initial URL when app starts
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  console.log("=== ROOT INDEX DEBUG ===");
  console.log(
    "RootIndex - user:",
    user ? `${user.email} (AUTHENTICATED)` : "null"
  );
  console.log("isLoading:", isLoading);
  console.log("isCheckingOnboarding:", isCheckingOnboarding);
  console.log("hasCompletedOnboarding:", hasCompletedOnboarding);

  // Show loading screen while auth is working
  if (isLoading || isCheckingOnboarding) {
    console.log("ROOT INDEX: Still loading or checking onboarding");
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Normal auth flow
  if (user) {
    if (!hasCompletedOnboarding) {
      console.log(
        "ROOT INDEX: User authenticated but not onboarded, redirecting to onboarding"
      );
      return <Redirect href="/(app)/(onboarding)/carousel" />;
    } else {
      console.log(
        "ROOT INDEX: User authenticated and onboarded, redirecting to profile"
      );
      return <Redirect href="/(app)/profile" />;
    }
  }

  console.log("ROOT INDEX: No user, redirecting to intro");
  return <Redirect href="/(auth)/intro" />;
}
