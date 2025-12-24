import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState } from "react-native";
import "react-native-url-polyfill/auto";

// Get environment variables from process.env or Constants
const supabaseUrl = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  Constants.expoConfig?.extra?.supabaseUrl ||
  "";

const supabaseAnonKey = 
  process.env.EXPO_PUBLIC_SUPABASE_KEY || 
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  "";

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = 
    "Missing Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in your .env file or app.json.";
  console.error("❌ Supabase Configuration Error:", errorMessage);
  console.error("Current values:", {
    url: supabaseUrl || "undefined",
    key: supabaseAnonKey ? "***" : "undefined",
  });
  throw new Error(errorMessage);
}

console.log("✅ Supabase client initialized with URL:", supabaseUrl);
console.log("✅ Supabase key present:", !!supabaseAnonKey);
console.log("✅ Environment check:", {
  hasProcessEnv: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
  hasConstants: !!Constants.expoConfig?.extra?.supabaseUrl,
  urlLength: supabaseUrl.length,
  keyLength: supabaseAnonKey.length,
});

// Test Supabase connectivity on initialization (non-blocking diagnostic)
const testSupabaseConnectivity = async () => {
  try {
    const healthCheckUrl = `${supabaseUrl}/rest/v1/`;
    console.log("🔍 Testing Supabase connectivity to:", healthCheckUrl);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(healthCheckUrl, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log("✅ Supabase connectivity test:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
      });
      
      if (!response.ok && response.status !== 404) {
        console.warn("⚠️ Supabase endpoint returned non-OK status:", response.status);
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error: any) {
    // Don't log as error - this is just a diagnostic test
    // The Supabase client may still work even if this test fails
    console.warn("⚠️ Supabase connectivity test failed (this may not affect functionality):", {
      message: error?.message,
      name: error?.name,
    });
    
    // More specific error messages
    if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
      console.warn("⏱️ Request timed out - network may be slow");
    } else if (error?.message?.includes('Network request failed')) {
      console.warn("🌐 Network request failed - this is common on Android emulators");
      console.warn("   The Supabase client may still work for actual API calls");
      console.warn("   If OTP sending fails, try:");
      console.warn("   1. Restart the Android emulator");
      console.warn("   2. Check emulator internet connection");
      console.warn("   3. Test on a physical device");
    }
  }
};

// Run connectivity test (non-blocking, won't affect app startup)
testSupabaseConnectivity().catch(() => {
  // Silently fail - this is just for diagnostics
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
