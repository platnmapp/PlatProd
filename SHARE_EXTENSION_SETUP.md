# Platnm Share Extension Setup

This guide explains how to set up the Spotify to Platnm share extension functionality.

## What's Implemented

✅ **Complete Features:**

- Share Extension UI Component matching the design
- Friend selection with search functionality
- Spotify URL parsing and track information extraction
- Database schema for song sharing and activity tracking
- Shared authentication service for extensions
- Demo mode for testing within the main app

🚧 **In Progress:**

- iOS Share Extension native integration
- Android Intent Handler
- Complete Xcode project configuration

## Testing the Functionality

### 1. Demo Mode (Available Now)

You can test the share extension UI and functionality immediately using the demo mode:

1. Open the Platnm app
2. Navigate to Settings
3. Tap "Share Extension Demo"
4. Enter a Spotify track URL (default one provided)
5. Tap "Test Share Extension"
6. Select friends and test the sharing flow

### 2. Example Spotify URLs for Testing

```
https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123
https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P?si=def456
https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp?si=ghi789
```

## Database Schema

The following tables support the share extension functionality:

### `shared_songs` Table

Tracks all song shares between users with interaction data:

- `sender_id` / `receiver_id`: User relationships
- Song metadata (title, artist, album, artwork)
- Service information (Spotify/Apple Music)
- Interaction tracking (viewed, liked, timestamps)

### `activities` Table (Enhanced)

Extended to support song sharing activities:

- Added song metadata fields
- Service and external URL tracking
- Rich activity notifications

## iOS Setup (Manual Configuration Required)

### 1. Xcode Project Configuration

Add a Share Extension target to your iOS project:

```bash
# In Xcode:
# File → New → Target → Share Extension
# Name: ShareExtension
# Bundle Identifier: com.platnm.app.ShareExtension
```

### 2. Share Extension Files

The following files are ready for integration:

- `ios/ShareExtension/Info.plist` - Extension configuration
- `ios/ShareExtension/ShareViewController.swift` - Native entry point
- `shareExtension/index.tsx` - React Native entry point
- `components/ShareExtension.tsx` - Main UI component

### 3. Build Configuration

Update your `app.json` (already configured):

```json
{
  "ios": {
    "bundleIdentifier": "com.platnm.app"
  },
  "android": {
    "package": "com.platnm.app",
    "intentFilters": [...]
  }
}
```

## Android Setup (Intent Filters)

### 1. Intent Filters (Already Configured)

The app.json includes intent filters for handling shared content:

```json
"intentFilters": [
  {
    "action": "android.intent.action.SEND",
    "data": [{ "mimeType": "text/plain" }],
    "category": ["android.intent.category.DEFAULT"]
  }
]
```

### 2. Native Android Implementation

Create `android/app/src/main/java/.../ShareActivity.java`:

```java
public class ShareActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(type)) {
            handleSharedText(intent);
        }
    }

    private void handleSharedText(Intent intent) {
        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (sharedText != null && sharedText.contains("open.spotify.com")) {
            // Launch React Native share extension
            // Implementation needed
        }
    }
}
```

## API Integration

### Spotify API Requirements

Ensure your Spotify app has the necessary scopes for track information:

```typescript
const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  // ... other scopes
];
```

### Supabase Configuration

The share extension uses a separate Supabase client with specific configuration:

```typescript
// Configured in lib/shareExtensionService.ts
const shareExtensionSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false, // Disabled for extensions
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

## Security Considerations

### 1. Authentication in Extensions

- Share extensions have limited access to app data
- Authentication state is shared via AsyncStorage
- Session validation is performed on each request

### 2. Data Privacy

- Only essential song metadata is stored
- User interactions are tracked with consent
- External URLs are validated before processing

## Testing Workflow

### 1. Main App Testing

1. Navigate to Settings → Share Extension Demo
2. Test with various Spotify URLs
3. Verify friend selection and sharing flow
4. Check activity creation in the Activity tab

### 2. Share Extension Testing (When Configured)

1. Open Spotify app
2. Navigate to any song
3. Tap Share button
4. Select "Platnm" from share options
5. Verify the extension opens with correct song data
6. Test friend selection and sharing

## Troubleshooting

### Common Issues

1. **Friends not loading**: Check authentication state
2. **Song data not fetching**: Verify Spotify token validity
3. **Sharing fails**: Check database permissions and RLS policies
4. **Extension not appearing**: Verify iOS/Android configuration

### Debug Mode

Enable debug logging in the share extension service:

```typescript
// In lib/shareExtensionService.ts
console.log("Share extension debug info:", {
  user: currentUser?.id,
  song: parsedSong,
  friends: friends.length,
});
```

## Next Steps

1. **Complete iOS Native Integration**
   - Set up Xcode share extension target
   - Implement React Native bridge for extensions
   - Test on physical device

2. **Complete Android Integration**
   - Implement ShareActivity
   - Create intent handling logic
   - Test share flow from Spotify

3. **Enhanced Features**
   - Song preview in share extension
   - Group sharing functionality
   - Share history and analytics

## Support

For issues with the share extension functionality:

1. Check the demo mode first
2. Verify database schema is up to date
3. Ensure authentication is working
4. Test with simple Spotify URLs

The core functionality is ready and testable - the remaining work is primarily native iOS/Android integration.
