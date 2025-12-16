# Apple Music JWT Server

This server generates JWT tokens for Apple Music API access.

## Quick Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create `.env` file:**

   ```bash
   APPLE_MUSIC_KEY_ID=your_key_id
   APPLE_MUSIC_TEAM_ID=your_team_id
   APPLE_MUSIC_PRIVATE_KEY_PATH=/path/to/your/AuthKey_KEYID.p8
   PORT=3001
   ```

3. **Start server:**
   ```bash
   npm start
   ```

## Endpoints

- `GET /health` - Health check
- `GET /apple-music-token` - Generate JWT token
- `POST /search` - Search Apple Music catalog
- `GET /search-by-isrc/:isrc` - Search Apple Music by ISRC (for cross-platform mapping)

## Environment Variables

| Variable                       | Description          | Example                       |
| ------------------------------ | -------------------- | ----------------------------- |
| `APPLE_MUSIC_KEY_ID`           | Your MusicKit Key ID | `AB12CD34EF`                  |
| `APPLE_MUSIC_TEAM_ID`          | Your Apple Team ID   | `1234567890`                  |
| `APPLE_MUSIC_PRIVATE_KEY_PATH` | Path to .p8 file     | `/keys/AuthKey_AB12CD34EF.p8` |
| `PORT`                         | Server port          | `3001`                        |

## Testing

```bash
# Test server is running
curl http://localhost:3001/health

# Get a JWT token
curl http://localhost:3001/apple-music-token

# Search Apple Music by text
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Shape of You Ed Sheeran", "limit": 5}'

# Search Apple Music by ISRC (for cross-platform mapping)
curl http://localhost:3001/search-by-isrc/GBARL1700423
```

For detailed setup instructions, see the main `APPLE_MUSIC_SETUP.md` file.
