import { createClient } from "@supabase/supabase-js";
import { create, getNumericDate } from "djwt";
import { corsHeaders } from "../_shared/cors.ts";

// Spotify API credentials from environment variables
const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET");

// Function to get a new access token from Spotify
async function getNewSpotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify credentials are not set in environment variables.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET),
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify token: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

// --- Apple Music ---
// Credentials from environment variables
const APPLE_TEAM_ID = Deno.env.get("APPLE_TEAM_ID");
const APPLE_KEY_ID = Deno.env.get("APPLE_KEY_ID");
const APPLE_PRIVATE_KEY = Deno.env.get("APPLE_PRIVATE_KEY");

// Helper to convert PEM format to ArrayBuffer for Web Crypto API
function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binary_string = atob(b64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getAppleMusicToken() {
  if (!APPLE_PRIVATE_KEY || !APPLE_KEY_ID || !APPLE_TEAM_ID) {
    throw new Error("Apple Music credentials are not set in environment variables.");
  }

  const keyBuffer = pemToArrayBuffer(APPLE_PRIVATE_KEY);

  const ecKey = await crypto.subtle.importKey("pkcs8", keyBuffer, {
    name: "ECDSA",
    namedCurve: "P-256"
  }, true, [
    "sign"
  ]);

  const jwt = await create({
    alg: "ES256",
    typ: "JWT",
    kid: APPLE_KEY_ID
  }, {
    iss: APPLE_TEAM_ID,
    iat: getNumericDate(0),
    exp: getNumericDate(60 * 60)
  }, ecKey);

  return jwt;
}

// Main function to handle requests
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { link } = await req.json();
    if (!link) {
      return new Response(JSON.stringify({ error: "Missing 'link' parameter" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Create a Supabase client with the service role key to access the database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check for a valid token in the database
    let { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("spotify_config")
      .select("access_token, expires_at")
      .eq("id", 1)
      .single();

    if (tokenError || !tokenData || new Date(tokenData.expires_at) < new Date()) {
      // Token is invalid or expired, get a new one
      console.log("Spotify token expired or not found, fetching a new one.");
      const new_token = await getNewSpotifyToken();
      const newExpiresAt = new Date(new Date().getTime() + new_token.expiresIn * 1000).toISOString();

      // Update the database with the new token
      const { data, error } = await supabaseAdmin
        .from("spotify_config")
        .update({ access_token: new_token.accessToken, expires_at: newExpiresAt })
        .eq("id", 1)
        .select()
        .single();
      
      if (error) throw error;
      tokenData = data;
    }
    
    const accessToken = tokenData.access_token;

    // --- Process the music link using the valid token ---
    if (link.includes("open.spotify.com")) {
      const trackIdMatch = link.match(/track\/(\w+)/);
      if (!trackIdMatch) throw new Error("Invalid Spotify URL");

      const trackId = trackIdMatch[1];
      const trackUrl = `https://api.spotify.com/v1/tracks/${trackId}`;
      
      const trackResponse = await fetch(trackUrl, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      if (!trackResponse.ok) throw new Error("Failed to fetch track from Spotify.");

      const trackData = await trackResponse.json();

      const responsePayload = {
        title: trackData.name,
        artist: trackData.artists.map((a: { name: string }) => a.name).join(', '),
        artworkURL: trackData.album.images[0]?.url || '',
        spotifyURL: link,
        appleMusicURL: null,
      };

      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else if (link.includes("music.apple.com")) {
      const appleToken = await getAppleMusicToken();
      const url = new URL(link);
      const storefront = url.pathname.split("/")[1];
      const songId = url.searchParams.get("i");

      if (!storefront || !songId) {
        throw new Error("Invalid Apple Music URL. It must be a song link, not an album.");
      }

      const appleApiUrl = `https://api.music.apple.com/v1/catalog/${storefront}/songs/${songId}`;
      const trackResponse = await fetch(appleApiUrl, {
        headers: {
          Authorization: `Bearer ${appleToken}`
        }
      });

      if (!trackResponse.ok) {
        const errorBody = await trackResponse.text();
        throw new Error(`Failed to fetch track from Apple Music: ${trackResponse.statusText}, ${errorBody}`);
      }

      const trackData = await trackResponse.json();
      const song = trackData.data[0];

      // Format artwork URL
      const artworkUrl = song.attributes.artwork.url.replace("{w}", "500").replace("{h}", "500");

      const responsePayload = {
        title: song.attributes.name,
        artist: song.attributes.artistName,
        artworkURL: artworkUrl,
        spotifyURL: null,
        appleMusicURL: link
      };

      return new Response(JSON.stringify(responsePayload), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    } else {
      // Handle other links (e.g., Apple Music) if needed
      throw new Error("Unsupported link type");
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
