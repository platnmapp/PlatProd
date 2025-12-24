import React, { createContext, useContext, useEffect, useState } from "react";
import { NativeModules } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { CacheService } from "../../lib/cacheService";
import { supabase } from "../../lib/supabase";

// Complete the OAuth session when the browser is closed
WebBrowser.maybeCompleteAuthSession();

const { SharedUserDefaults } = NativeModules;

// Helper function to store complete session data
const storeSessionData = (session: any) => {
  try {
    // Check if SharedUserDefaults is available (may not be on all platforms)
    if (!SharedUserDefaults) {
      console.log("⚠️ SharedUserDefaults not available, skipping session storage");
      return;
    }

    if (session?.access_token) {
      const sessionData = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user_id: session.user?.id,
        expires_in: session.expires_in,
      };
      console.log("📱 STORING SESSION DATA:", {
        hasAccessToken: !!sessionData.access_token,
        userId: sessionData.user_id,
        expiresAt: sessionData.expires_at,
      });
      SharedUserDefaults.setSessionData(JSON.stringify(sessionData));
      console.log("✅ Session data stored successfully");
    } else {
      console.log("🗑️ CLEARING SESSION DATA");
      SharedUserDefaults.clearSessionData();
    }
  } catch (error) {
    console.error("❌ Failed to store session data:", error);
  }
};

// Define the shape of the context data
interface AuthContextData {
  signInWithEmail: (email: string) => Promise<{ error: any } | void>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any } | void>;
  signInWithApple: () => Promise<{ error: any } | void>;
  verifyOtp: (email: string, token: string) => Promise<{ error: any } | void>;
  signOut: () => Promise<void>;
  forceSignOut: () => Promise<void>;
  completeOnboarding: () => Promise<{ error: any } | void>;
  user: any | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  isCheckingOnboarding: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Custom hook to use the AuthContext
export const useAuth = () => {
  return useContext(AuthContext);
};

// The provider component that wraps your app
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);

  // Check onboarding status for a user
  const checkOnboardingStatus = async (userId: string) => {
    setIsCheckingOnboarding(true);

    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Onboarding check timeout")), 5000)
    );

    try {
      const queryPromise = supabase
        .from("profiles")
        .select("onboarding_completed, first_name, last_name, username")
        .eq("id", userId)
        .single();

      const { data, error } = (await Promise.race([
        queryPromise,
        timeoutPromise,
      ])) as any;

      if (error && error.code === "PGRST116") {
        // No profile exists, create one
        console.log("No profile found, creating new profile");
        const { error: insertError } = await supabase.from("profiles").insert({
          id: userId,
          onboarding_completed: false,
        });

        if (insertError) {
          console.error("Error creating profile:", insertError);
          // If table doesn't exist, default to not completed
          console.log(
            "Defaulting to onboarding not completed due to table creation error"
          );
        }
        setHasCompletedOnboarding(false);
      } else if (error) {
        console.error("Error checking onboarding:", error);
        // If there's any other error (like table doesn't exist), default to not completed
        console.log(
          "Defaulting to onboarding not completed due to query error"
        );
        setHasCompletedOnboarding(false);
      } else {
        // Check if onboarding is explicitly completed OR if user has complete profile
        const hasExplicitOnboarding = data?.onboarding_completed || false;
        const hasCompleteName = data?.first_name && data?.last_name;
        const hasUsername = data?.username;
        const hasCompleteProfile = hasCompleteName && hasUsername;

        console.log("Onboarding check:", {
          hasExplicitOnboarding,
          hasCompleteName,
          hasUsername,
          hasCompleteProfile,
        });

        // Consider onboarding complete if either:
        // 1. Explicitly marked as completed, OR
        // 2. User has a complete profile (returning user)
        const shouldConsiderOnboardingComplete =
          hasExplicitOnboarding || hasCompleteProfile;

        setHasCompletedOnboarding(shouldConsiderOnboardingComplete);

        // If user has complete profile but onboarding isn't marked as complete,
        // update the database to mark onboarding as complete for future checks
        if (hasCompleteProfile && !hasExplicitOnboarding) {
          console.log(
            "Updating onboarding status for user with complete profile"
          );
          supabase
            .from("profiles")
            .upsert({
              id: userId,
              onboarding_completed: true,
              updated_at: new Date().toISOString(),
            })
            .then(({ error }) => {
              if (error) {
                console.error("Error updating onboarding status:", error);
              } else {
                console.log(
                  "Successfully marked onboarding as complete for returning user"
                );
                // Invalidate cache to force fresh data on next fetch
                CacheService.invalidateUserProfile(userId);
              }
            });
        }
      }
    } catch (error) {
      console.log("Info: checkOnboardingStatus encountered an issue:", error);
      if (
        error instanceof Error &&
        error.message === "Onboarding check timeout"
      ) {
        console.log("Onboarding check timeout, defaulting to not completed");
      }
      // Always default to not completed if there's any error
      setHasCompletedOnboarding(false);
    }

    setIsCheckingOnboarding(false);
  };

  useEffect(() => {
    let loadingTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    // Add a timeout to prevent infinite loading
    loadingTimeout = setTimeout(() => {
      if (isMounted) {
        console.error("⚠️ Auth initialization timeout - forcing loading to false");
        setIsLoading(false);
      }
    }, 8000); // 8 second timeout

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        try {
          setIsLoading(true);
          console.log("=== AUTH STATE CHANGE ===");
          console.log("Event:", event);
          console.log("Session exists:", !!session);
          console.log("User exists:", !!session?.user);

          // Only store session data for actual auth events, not initial session checks
          if (event !== "INITIAL_SESSION") {
            storeSessionData(session);
          }

          if (session?.user) {
            console.log("Setting user:", session.user.email);
            setUser(session.user);
            // Check onboarding status when user is set
            await checkOnboardingStatus(session.user.id);
          } else {
            console.log("Clearing user");
            setUser(null);
            setHasCompletedOnboarding(false);
          }
        } catch (error) {
          console.error("❌ Error in auth state change handler:", error);
          // Even on error, stop loading to prevent black screen
          setUser(null);
          setHasCompletedOnboarding(false);
        } finally {
          if (isMounted) {
            setIsLoading(false);
            if (loadingTimeout) {
              clearTimeout(loadingTimeout);
              loadingTimeout = null;
            }
          }
        }
      }
    );

    return () => {
      isMounted = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string) => {
    // Don't set global loading state for OTP sending
    // This prevents navigation resets during auth flows
    try {
      console.log("📧 Attempting to send OTP to:", email);
      console.log("🔗 Supabase URL:", process.env.EXPO_PUBLIC_SUPABASE_URL || "not found in process.env");
      
      const { error, data } = await supabase.auth.signInWithOtp({ 
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: undefined, // Don't use magic link, use OTP code
        }
      });
      
      if (error) {
        console.error("❌ OTP send error:", {
          message: error.message,
          name: error.name,
          status: error.status,
        });
        
        // Provide more helpful error messages
        if (error.message?.includes("Network request failed") || 
            error.message?.includes("fetch") ||
            error.name === "AuthRetryableFetchError") {
          return { 
            error: { 
              ...error, 
              message: "Network error. Please check your internet connection and ensure the Supabase service is accessible. If the problem persists, try restarting the app." 
            } 
          };
        }
        
        // Check for specific Supabase errors
        if (error.message?.includes("Invalid API key")) {
          return {
            error: {
              ...error,
              message: "Configuration error. Please check your Supabase credentials.",
            }
          };
        }
      } else {
        console.log("✅ OTP sent successfully:", data);
      }
      
      return { error };
    } catch (err: any) {
      console.error("❌ Exception in signInWithEmail:", {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      });
      
      // Handle network errors more gracefully
      if (err?.message?.includes("Network request failed") || 
          err?.name === "AuthRetryableFetchError" ||
          err?.message?.includes("fetch")) {
        return { 
          error: { 
            message: "Network error. Please check your internet connection and ensure the Supabase service is accessible. If the problem persists, try restarting the app.",
            name: err.name,
          } 
        };
      }
      
      return { error: err };
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setIsLoading(false);
      return { error };
    } catch (error) {
      setIsLoading(false);
      return { error };
    }
  };

  const signInWithApple = async () => {
    setIsLoading(true);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const redirectUrl = `${supabaseUrl}/auth/v1/callback`;
      
      console.log("🍎 Starting Apple sign in...");
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        console.error("❌ Apple sign in error:", error);
        setIsLoading(false);
        return { error };
      }

      if (data?.url) {
        // Open the OAuth URL in the browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success') {
          // Extract the access token from the URL
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');

          if (accessToken && refreshToken) {
            // Set the session with the tokens
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error("❌ Error setting session:", sessionError);
              setIsLoading(false);
              return { error: sessionError };
            }
          }
        } else if (result.type === 'cancel') {
          console.log("🍎 Apple sign in cancelled");
          setIsLoading(false);
          return { error: { message: "Sign in cancelled" } };
        } else {
          console.error("❌ Apple sign in failed:", result);
          setIsLoading(false);
          return { error: { message: "Sign in failed" } };
        }
      }

      setIsLoading(false);
      return { error: null };
    } catch (error) {
      console.error("❌ Exception in signInWithApple:", error);
      setIsLoading(false);
      return { 
        error: error instanceof Error ? error : { message: "Failed to sign in with Apple" }
      };
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    setIsLoading(true);
    // Expecting a 6-digit OTP code
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setIsLoading(false);
    return { error };
  };

  const completeOnboarding = async () => {
    if (!user) return { error: { message: "No user logged in" } };

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        onboarding_completed: true,
      });

      if (error) {
        console.error("Error completing onboarding:", error);
        // If there's an error (like table doesn't exist), still mark as completed locally
        console.log(
          "Database error, but marking onboarding as completed locally"
        );
        setHasCompletedOnboarding(true);
        return { error };
      }

      setHasCompletedOnboarding(true);
      return;
    } catch (error) {
      console.error("Error in completeOnboarding:", error);
      // If there's an error, still mark as completed locally
      console.log(
        "Exception caught, but marking onboarding as completed locally"
      );
      setHasCompletedOnboarding(true);
      return { error };
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setHasCompletedOnboarding(false);
    storeSessionData(null); // Clear session data on explicit sign out
    setIsLoading(false);
  };

  const forceSignOut = async () => {
    console.log("=== FORCE SIGN OUT ===");
    setIsLoading(true);
    try {
      // Force sign out from Supabase
      await supabase.auth.signOut();
      // Clear all local state
      setUser(null);
      setHasCompletedOnboarding(false);
      setIsCheckingOnboarding(false);
      storeSessionData(null); // Clear session data on force sign out
      console.log("Force sign out completed - all auth state cleared");
    } catch (error) {
      console.error("Error during force sign out:", error);
    }
    setIsLoading(false);
  };

  const deleteAccount = async () => {
    if (!user) return { error: { message: "No user logged in" } };

    setIsLoading(true);
    try {
      // Call the database function to delete the account
      const { error } = await supabase.rpc("delete_user_account");

      if (error) {
        console.error("Error deleting account:", error);
        setIsLoading(false);
        return { error: { message: error.message || "Failed to delete account" } };
      }

      // Sign out after successful deletion
      await supabase.auth.signOut();
      setUser(null);
      setHasCompletedOnboarding(false);
      setIsCheckingOnboarding(false);
      storeSessionData(null);

      setIsLoading(false);
      return;
    } catch (error) {
      console.error("Error in deleteAccount:", error);
      setIsLoading(false);
      return {
        error: error instanceof Error ? error : { message: "Failed to delete account" },
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        signInWithEmail,
        signInWithPassword,
        signInWithApple,
        verifyOtp,
        signOut,
        forceSignOut,
        deleteAccount,
        completeOnboarding,
        user,
        isLoading,
        hasCompletedOnboarding,
        isCheckingOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Add a default export to satisfy the route requirement
export default AuthProvider;
