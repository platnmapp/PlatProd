# Apple Music Integration Setup

This guide will help you set up Apple Music integration for your app.

## 🚨 **For Real Apple Music Authentication**

**If you want real Apple Music API access (no 403 errors)**, you need native MusicKit implementation:

👉 **See [APPLE_MUSICKIT_NATIVE_SETUP.md](./APPLE_MUSICKIT_NATIVE_SETUP.md)** for complete native setup

This current guide covers the **JWT server setup** (required for both development and production).

## Prerequisites

- Apple Developer Program membership (required for Apple Music API access)
- A MusicKit identifier and private key from Apple
- Node.js (for the JWT server)

## Quick Start

1. **Get Apple Music credentials** (see detailed steps below)
2. **Set up environment variables**
3. **Run the JWT server**
4. **Test the integration**

For **real Apple Music authentication** on device, also follow the native setup guide above.

## Environment Variables

Add these environment variables to your `.env` file or app configuration:

```bash
# Apple Music Configuration (for your React Native app)
EXPO_PUBLIC_APPLE_MUSIC_KEY_ID=your_music_kit_key_id
EXPO_PUBLIC_APPLE_MUSIC_TEAM_ID=your_apple_team_id
EXPO_PUBLIC_APPLE_MUSIC_JWT_SERVER_URL=http://localhost:3001

# Server Environment Variables (for the JWT server)
APPLE_MUSIC_KEY_ID=your_music_kit_key_id
APPLE_MUSIC_TEAM_ID=your_apple_team_id
APPLE_MUSIC_PRIVATE_KEY_PATH=/path/to/your/AuthKey_KEYID.p8
```

## JWT Server Setup

Since JWT signing with ES256 requires your private key, we've created a server to handle this securely.

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Configure Server Environment

Create a `.env` file in the `server` directory:

```bash
# Server .env file
APPLE_MUSIC_KEY_ID=your_music_kit_key_id
APPLE_MUSIC_TEAM_ID=your_apple_team_id
APPLE_MUSIC_PRIVATE_KEY_PATH=/path/to/your/AuthKey_KEYID.p8
PORT=3001
```

### 3. Start the Server

```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

The server will run on `http://localhost:3001` and provide the endpoint:

- `GET /apple-music-token` - Generates JWT tokens
- `GET /health` - Health check

## Getting Apple Music Credentials

### 1. Create a MusicKit Identifier

1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (Add button)
4. Select **MusicKit Identifier** and click **Continue**
5. Enter a description and identifier (reverse domain format)
6. Click **Register**

### 2. Create a MusicKit Private Key

1. In the Apple Developer Console, go to **Keys**
2. Click **+** (Add button)
3. Enter a key name
4. Check **MusicKit** under services
5. Click **Continue** → **Register**
6. **Download the `.p8` private key file** (you can only download this once!)
7. Save it securely and note the file path

### 3. Get Your Team ID

1. In the Apple Developer Console, your Team ID is shown in the top right
2. Or go to **Membership** to find your Team ID

## Testing the Setup

### 1. Test the JWT Server

```bash
curl http://localhost:3001/health
curl http://localhost:3001/apple-music-token
```

You should get a JWT token response.

### 2. Test in Your App

1. Make sure the server is running
2. Launch your React Native app
3. Go to **Link Account** screen
4. Tap **"Sync Apple Music"**
5. Should work without simulation

## Database Schema Updates

The following fields are used in your `profiles` table:

```sql
-- Add these columns to your profiles table if not already added
ALTER TABLE profiles ADD COLUMN apple_music_user_id VARCHAR;
ALTER TABLE profiles ADD COLUMN apple_music_user_name VARCHAR;
ALTER TABLE profiles ADD COLUMN apple_music_user_token TEXT;
ALTER TABLE profiles ADD COLUMN apple_music_developer_token TEXT;
ALTER TABLE profiles ADD COLUMN apple_music_token_expires_at TIMESTAMP;
```

## Fixing Spotify 403 Error

The Spotify 403 error means your app is in **Development Mode**. To fix:

### Option 1: Add Users to Development App (Recommended)

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Click your app
3. Go to **Settings**
4. Scroll to **User Management**
5. Add the Spotify email addresses that need access
6. Click **Add**

### Option 2: Request Quota Extension (For Production)

1. In your Spotify app dashboard
2. Go to **Quota Extension**
3. Fill out the form explaining your use case
4. Wait for approval (can take several days)

**Note**: Option 1 is faster for development and testing.

## Current Implementation Status

✅ **Implemented:**

- Apple Music authentication flow with real JWT generation
- JWT server for secure token generation
- Apple Music API wrapper with all major endpoints
- Integration with link account screen
- Database schema for Apple Music data
- Content fetching for tracks, albums, and playlists

✅ **Working:**

- JWT server generates real Apple Music developer tokens
- Authentication flow (simulated user authorization for development)
- API calls to Apple Music work with real tokens

⚠️ **Still Needs Implementation for Production:**

- Real MusicKit user authorization (requires native iOS implementation)
- Token refresh logic for user tokens

## Development vs Production

### Development Mode

- ✅ Real JWT generation via server
- ✅ Simulated user authorization (since MusicKit requires native code)
- ✅ Real Apple Music API calls

### Production Mode

For production, you'll additionally need to:

1. ✅ JWT server (already implemented)
2. ❌ Native MusicKit user authorization
3. ❌ Custom development client or eject from Expo

## Troubleshooting

### Common Issues

1. **"Apple Music JWT Server not available"**
   - Make sure the server is running: `cd server && npm start`
   - Check the server URL in your environment variables

2. **"Error loading Apple Music private key"**
   - Verify the path to your `.p8` file is correct
   - Make sure the file has proper read permissions

3. **Server fails to start**
   - Check all environment variables are set
   - Verify Node.js is installed
   - Run `npm install` in the server directory

4. **Spotify 403 Error**
   - Add your Spotify account to the app's user management section

### JWT Server Logs

The server provides helpful logs:

```
🍎 Apple Music JWT server running on port 3001
Token endpoint: http://localhost:3001/apple-music-token
```

### Testing the Server

```bash
# Test health
curl http://localhost:3001/health

# Test token generation
curl http://localhost:3001/apple-music-token
```

## Security Notes

- ✅ Private key stays on server (never sent to client)
- ✅ JWT tokens are generated server-side
- ✅ Client only receives the signed token
- ⚠️ For production, host the server securely (HTTPS, proper authentication)

## Next Steps

1. **Set up the JWT server** (follow Quick Start above)
2. **Add Spotify users** to fix the 403 error
3. **Test both integrations**
4. **Deploy the JWT server** for production use

## Getting Help

- Check [Apple MusicKit Documentation](https://developer.apple.com/documentation/musickit)
- Review [Apple Music API Reference](https://developer.apple.com/documentation/applemusicapi)
- Check [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
