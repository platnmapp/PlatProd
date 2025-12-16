// Apple Music JWT Token Generation Server
// Run this on your backend server (Node.js)

// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const cors = require("cors");

// Ensure fetch is available
const getFetch = async () => {
  if (typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch;
  }
  const nodeFetch = await import("node-fetch");
  return nodeFetch.default;
};

const app = express();
app.use(cors());
app.use(express.json());

// Configuration - Replace with your values
const APPLE_MUSIC_KEY_ID = process.env.APPLE_MUSIC_KEY_ID;
const APPLE_MUSIC_TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID;
const APPLE_MUSIC_PRIVATE_KEY_PATH = process.env.APPLE_MUSIC_PRIVATE_KEY_PATH;
const APPLE_MUSIC_PRIVATE_KEY = process.env.APPLE_MUSIC_PRIVATE_KEY;

// Load the private key
let privateKey;
try {
  if (APPLE_MUSIC_PRIVATE_KEY) {
    console.log("🔑 Using private key from environment variable");
    privateKey = APPLE_MUSIC_PRIVATE_KEY;
  } else if (APPLE_MUSIC_PRIVATE_KEY_PATH) {
    console.log(
      "🔑 Loading private key from file:",
      APPLE_MUSIC_PRIVATE_KEY_PATH
    );
    privateKey = fs.readFileSync(APPLE_MUSIC_PRIVATE_KEY_PATH, "utf8");
  } else {
    throw new Error(
      "No private key provided. Set either APPLE_MUSIC_PRIVATE_KEY or APPLE_MUSIC_PRIVATE_KEY_PATH"
    );
  }

  console.log("✅ Private key loaded successfully");
} catch (error) {
  console.error("❌ Error loading Apple Music private key:", error.message);
  console.log("\n📝 Please set one of these environment variables:");
  console.log(
    '   APPLE_MUSIC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"'
  );
  console.log(
    '   APPLE_MUSIC_PRIVATE_KEY_PATH="/path/to/your/AuthKey_KEYID.p8"'
  );
  process.exit(1);
}

// Generate Apple Music Developer Token
function generateAppleMusicToken() {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: APPLE_MUSIC_TEAM_ID, // Your team ID
    iat: now, // Issued at time
    exp: now + 6 * 30 * 24 * 60 * 60, // 6 months in seconds
    aud: "appstoreconnect-v1", // Required audience field
  };

  console.log("🔧 JWT Payload:", payload); // Debug log

  return jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header: {
      alg: "ES256",
      kid: APPLE_MUSIC_KEY_ID,
    },
  });
}

// Endpoint to get Apple Music developer token
app.get("/apple-music-token", (req, res) => {
  try {
    console.log("🍎 Generating new Apple Music JWT token...");
    console.log("Using Team ID:", APPLE_MUSIC_TEAM_ID);
    console.log("Using Key ID:", APPLE_MUSIC_KEY_ID);

    const token = generateAppleMusicToken();
    console.log("✅ Token generated successfully");
    console.log("Token preview:", token.substring(0, 50) + "...");

    res.json({
      success: true,
      token: token,
      expiresAt: Date.now() + 6 * 30 * 24 * 60 * 60 * 1000,
    });
  } catch (error) {
    console.error("❌ Error generating Apple Music token:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate token: " + error.message,
    });
  }
});

// Apple Music search endpoint
app.post("/search", async (req, res) => {
  try {
    const { query, limit = 20, storefront = "us" } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Missing query parameter",
      });
    }

    console.log(`🔍 Apple Music search request: "${query}" in ${storefront}`);

    // Generate fresh token for this request
    const token = generateAppleMusicToken();

    // Search Apple Music catalog
    const searchUrl = `https://api.music.apple.com/v1/catalog/${storefront}/search`;
    const params = new URLSearchParams({
      term: query,
      types: "songs",
      limit: limit.toString(),
    });

    const fetch = await getFetch();
    const response = await fetch(`${searchUrl}?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Apple Music API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    const tracks = data.results?.songs?.data || [];

    console.log(`✅ Found ${tracks.length} Apple Music results`);

    res.json({
      success: true,
      tracks: tracks.slice(0, limit),
      total: data.results?.songs?.meta?.total || tracks.length,
    });
  } catch (error) {
    console.error("❌ Apple Music search error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Apple Music ISRC search endpoint (for cross-platform mapping)
app.get("/search-by-isrc/:isrc", async (req, res) => {
  try {
    const { isrc } = req.params;
    const { storefront = "us" } = req.query;

    if (!isrc) {
      return res.status(400).json({
        success: false,
        error: "Missing ISRC parameter",
      });
    }

    console.log(`🔍 Apple Music ISRC search: "${isrc}" in ${storefront}`);

    // Generate fresh token for this request
    const token = generateAppleMusicToken();

    // Search Apple Music catalog by ISRC
    const searchUrl = `https://api.music.apple.com/v1/catalog/${storefront}/songs?filter[isrc]=${isrc}`;

    const fetch = await getFetch();
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Apple Music API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    const tracks = data.data || [];

    console.log(
      `✅ Found ${tracks.length} Apple Music results for ISRC ${isrc}`
    );

    if (tracks.length > 0) {
      const track = tracks[0];
      res.json({
        success: true,
        track: track,
        url: track.attributes?.url || null,
      });
    } else {
      res.json({
        success: false,
        error: "No track found with this ISRC",
      });
    }
  } catch (error) {
    console.error("❌ Apple Music ISRC search error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    keyId: APPLE_MUSIC_KEY_ID,
    teamId: APPLE_MUSIC_TEAM_ID,
    hasPrivateKey: !!privateKey,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🍎 Apple Music JWT server running on port ${PORT}`);
  console.log(`📍 Health check: https://platnm-token-gen.onrender.com/health`);
  console.log(
    `🔗 Token endpoint: https://platnm-token-gen.onrender.com/apple-music-token`
  );
  console.log(`\n🔧 Configuration:`);
  console.log(`   Key ID: ${APPLE_MUSIC_KEY_ID}`);
  console.log(`   Team ID: ${APPLE_MUSIC_TEAM_ID}`);
  console.log(`   Private Key: ${privateKey ? "✅ Loaded" : "❌ Missing"}`);
});

module.exports = app;
