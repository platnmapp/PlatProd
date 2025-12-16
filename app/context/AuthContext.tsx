import React, { createContext, useContext, useEffect, useState } from "react";
import { NativeModules } from "react-native";
import { CacheService } from "../../lib/cacheService";
import { supabase } from "../../lib/supabase";

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
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error };
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
      // Get the session token for the edge function
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setIsLoading(false);
        return { error: { message: "No active session" } };
      }

      // Call the edge function to delete the account
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Error deleting account:", result);
        setIsLoading(false);
        return { error: result.error || { message: "Failed to delete account" } };
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
