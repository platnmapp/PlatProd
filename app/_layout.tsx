import { Slot, useRouter, useSegments } from "expo-router";
import "nativewind";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import "../global.css";
import "../polyfills/worklets";
import { ErrorBoundary } from "./ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";

const InitialLayout = () => {
  const { user, isLoading, hasCompletedOnboarding, isCheckingOnboarding } =
    useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationTimeoutRef = useRef<number | null>(null);
  const lastPathRef = useRef<string>("");
  const wasOnConfirmationCodeRef = useRef<boolean>(false);

  // Add a timeout fallback - if we're stuck loading for too long, show an error
  // MUST be called before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.error("⚠️ App stuck in loading state for >10 seconds");
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Deep link handling moved to app/index.tsx to avoid conflicts with DeepLinkHandler
  // useEffect(() => {
  //   // Handle incoming URLs from Share Extension
  //   const handleDeepLink = (url: string) => {
  //     console.log("=== DEEP LINK HANDLER ===");
  //     console.log("Received deep link in layout:", url);
  //     console.log(
  //       "Current user:",
  //       user ? "authenticated" : "not authenticated"
  //     );
  //     console.log("Current segments:", segments);

  //     // Parse the URL to extract the shared content
  //     if (url.startsWith("platnm://shared-music")) {
  //       const urlParams = new URLSearchParams(url.split("?")[1]);
  //       const sharedUrl = urlParams.get("url");

  //       console.log("Extracted shared URL:", sharedUrl);

  //       if (sharedUrl) {
  //         console.log("Navigating to shared-music with URL:", sharedUrl);
  //         // Navigate to the shared-music screen with the URL
  //         // Don't require user authentication here - let the shared-music screen handle auth
  //         router.push({
  //           pathname: "/(app)/shared-music",
  //           params: { url: sharedUrl },
  //         });
  //       } else {
  //         console.log("No shared URL found in deep link");
  //       }
  //     } else {
  //       console.log("Deep link is not for shared-music:", url);
  //     }
  //   };

  //   // Listen for incoming links when app is already running
  //   const subscription = Linking.addEventListener("url", (event) => {
  //     console.log("Linking.addEventListener triggered with URL:", event.url);
  //     handleDeepLink(event.url);
  //   });

  //   // Handle links that opened the app
  //   Linking.getInitialURL().then((url) => {
  //     if (url) {
  //       console.log("Linking.getInitialURL returned:", url);
  //       handleDeepLink(url);
  //     } else {
  //       console.log("Linking.getInitialURL returned null");
  //     }
  //   });

  //   return () => {
  //     subscription?.remove();
  //   };
  // }, [user, router, segments]);

  console.log("=== MAIN LAYOUT DEBUG ===");
  console.log(
    "InitialLayout - user:",
    user ? `${user.email} (AUTHENTICATED)` : "null"
  );
  console.log("isLoading:", isLoading);
  console.log("isCheckingOnboarding:", isCheckingOnboarding);
  console.log("hasCompletedOnboarding:", hasCompletedOnboarding);
  console.log("segments:", segments);
  console.log("current route segments:", segments.join("/"));

  useEffect(() => {
    // Clear any pending navigation timeouts
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }

    if (isLoading || isCheckingOnboarding) {
      console.log("Still loading or checking onboarding, skipping redirect");
      return; // Don't redirect until loading is complete
    }

    // Don't redirect if segments is empty - this can happen during navigation
    if ((segments as any).length === 0) {
      console.log("Empty segments, skipping redirect (navigation in progress)");
      return;
    }

    const currentPath = segments.join("/");
    const inAuthGroup = segments[0] === "(auth)";
    const inAccountSetupGroup = segments[0] === "(accountsetup)";
    const inOnboardingGroup =
      segments[0] === "(app)" && segments[1] === "(onboarding)";
    const isOnConfirmationCode = (segments as any).includes("confirmationcode");
    const isOnAccountSetup =
      inAccountSetupGroup ||
      (segments as any).includes("name") ||
      (segments as any).includes("username") ||
      (segments as any).includes("linkaccount");

    // Enhanced auth flow detection
    const isOnAuthFlow =
      inAuthGroup ||
      inAccountSetupGroup ||
      inOnboardingGroup ||
      (segments as any).includes("signup") ||
      isOnConfirmationCode ||
      isOnAccountSetup ||
      (segments as any).includes("signin");

    // Track when we're on confirmation code
    if (isOnConfirmationCode) {
      wasOnConfirmationCodeRef.current = true;
      lastPathRef.current = "confirmationcode";
    }

    // Additional check: if we were just on confirmationcode and now on profile,
    // it's likely a navigation glitch during auth flow
    const isUnexpectedProfileRedirect =
      currentPath === "(app)/profile" &&
      !user &&
      wasOnConfirmationCodeRef.current &&
      lastPathRef.current === "confirmationcode";

    console.log("inAuthGroup:", inAuthGroup);
    console.log("inAccountSetupGroup:", inAccountSetupGroup);
    console.log("inOnboardingGroup:", inOnboardingGroup);
    console.log("isOnConfirmationCode:", isOnConfirmationCode);
    console.log("isOnAccountSetup:", isOnAccountSetup);
    console.log("isOnAuthFlow:", isOnAuthFlow);
    console.log("wasOnConfirmationCodeRef:", wasOnConfirmationCodeRef.current);
    console.log("lastPathRef:", lastPathRef.current);
    console.log("isUnexpectedProfileRedirect:", isUnexpectedProfileRedirect);
    console.log("User exists:", !!user);
    console.log("Should redirect?");

    // COMPLETELY DISABLE redirects during auth flow to prevent interference
    if (isOnAuthFlow || isUnexpectedProfileRedirect) {
      console.log(
        "NO REDIRECT: User is in auth flow or unexpected redirect detected, letting them complete it"
      );

      // If this is an unexpected redirect back to profile during auth,
      // navigate back to the confirmation code screen
      if (isUnexpectedProfileRedirect) {
        console.log(
          "FIXING UNEXPECTED REDIRECT: Going back to confirmationcode"
        );
        // Reset the tracking flags
        wasOnConfirmationCodeRef.current = false;
        lastPathRef.current = "";
        // Use a small delay to ensure auth state is stable
        navigationTimeoutRef.current = setTimeout(() => {
          router.replace("/(auth)/(register)/confirmationcode");
        }, 100);
      }
      return;
    }

    // Reset confirmation code tracking when not in auth flow
    if (!isOnAuthFlow && !isUnexpectedProfileRedirect) {
      wasOnConfirmationCodeRef.current = false;
      lastPathRef.current = "";
    }

    // Add a small delay before navigation to ensure state is stable
    navigationTimeoutRef.current = setTimeout(() => {
      // If the user is signed in
      if (user) {
        // Check if user has completed onboarding
        if (!hasCompletedOnboarding && !inOnboardingGroup) {
          console.log(
            "REDIRECT: User authenticated but not onboarded, redirecting to onboarding"
          );
          router.replace("/(app)/(onboarding)/carousel");
        } else if (
          hasCompletedOnboarding &&
          !inAuthGroup &&
          !inAccountSetupGroup &&
          !inOnboardingGroup &&
          (currentPath === "index" || currentPath === "")
        ) {
          console.log(
            "REDIRECT: User authenticated and onboarded on root index, redirecting to main app"
          );
          router.replace("/(app)");
        } else {
          console.log("NO REDIRECT: User is already in correct flow");
        }
      }
      // If the user is not signed in and not in auth/setup groups, redirect to signup
      else if (!user && !inAuthGroup && !inAccountSetupGroup) {
        console.log("REDIRECT: No user, redirecting to signup");
        router.replace("/(auth)/(register)/signup");
      } else {
        console.log("NO REDIRECT: Staying on current route");
      }
    }, 50); // Small delay to ensure navigation stability
  }, [
    user,
    isLoading,
    isCheckingOnboarding,
    hasCompletedOnboarding,
    segments,
    router,
  ]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // While checking for the token, show a loading spinner.
  if (isLoading) {
    console.log("Showing loading spinner");
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#111",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "#888", marginTop: 10, fontSize: 12 }}>
          Loading...
        </Text>
      </SafeAreaView>
    );
  }

  console.log("Rendering Slot");
  // Slot renders the current child route (either from the (app) or (auth) group)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <Slot />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export default function RootLayout() {
  console.log("🚀 ROOT LAYOUT RENDERING - App is starting!");
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <InitialLayout />
      </AuthProvider>
    </ErrorBoundary>
  );
}
