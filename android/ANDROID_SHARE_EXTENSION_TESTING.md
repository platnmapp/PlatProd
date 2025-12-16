# Android Share Extension Testing Guide

## Overview

The Android app now supports receiving shared content (text/URLs) from other applications, similar to the iOS share extension functionality.

## How It Works

1. When another app shares text or a URL to platnm, Android sends an `ACTION_SEND` intent
2. The MainActivity intercepts this intent and extracts the shared content
3. A deep link is created (`platnm://shared-music?url=<encoded_content>`)
4. The app navigates to the shared-music screen which processes the content
5. If the content is a music link, the share extension UI is displayed

## Testing Steps

### Prerequisites

- Build and install the Android app: `npm run android`
- Ensure the app is installed on your device/emulator

### Test Cases

#### 1. Test Spotify Link Sharing

1. Open Spotify mobile app
2. Find any song/playlist/album
3. Tap the "Share" button
4. Select "platnm" from the share menu
5. The app should open and show the share extension UI with the music content

#### 2. Test Apple Music Link Sharing

1. Open Apple Music (if available) or Safari with an Apple Music link
2. Share the link to platnm
3. The app should process the Apple Music link

#### 3. Test Text Sharing

1. Open any text app (Messages, Notes, etc.)
2. Copy a Spotify or Apple Music URL
3. Share the text containing the URL to platnm
4. The app should extract and process the music link

#### 4. Test from Browser

1. Open a web browser
2. Navigate to a Spotify/Apple Music web player URL
3. Use browser's share function to share with platnm
4. The app should handle the URL

### Expected Behavior

- App opens automatically when shared to
- Navigate to the share extension UI
- Music content is parsed and displayed
- Friends list is loaded for sharing
- User can select friends and share the music

### Debug Information

- Check logs with: `adb logcat | grep platnm`
- MainActivity logs will show share intent processing
- React Native logs will show deep link handling

### Troubleshooting

- If app doesn't appear in share menu: Check AndroidManifest.xml intent filters
- If app opens but doesn't navigate: Check deep link URL encoding
- If music content isn't parsed: Check MusicLinkParser and MusicContentService

## Intent Filters Configured

The app registers for these Android intents:

- `android.intent.action.SEND` with `text/plain` MIME type
- `android.intent.action.SEND` with `text/*` MIME type
- `android.intent.action.SEND` with `*/*` MIME type (fallback)

## Files Modified

- `android/app/src/main/AndroidManifest.xml` - Added intent filters
- `android/app/src/main/java/com/platnm/app/MainActivity.kt` - Added share intent handling
