# Apple Music Native MusicKit Setup

This guide will help you set up **real Apple Music authentication** using native MusicKit on iOS.

## 🚨 **Important**: You need a Custom Development Client

Since Apple Music requires native MusicKit implementation, you **cannot use Expo Go**. You need to create a **custom development client**.

## Quick Setup Steps

### 1. Create Custom Development Client

```bash
# Install EAS CLI if you haven't
npm install -g eas-cli

# Login to your Expo account
eas login

# Create development build
eas build --profile development --platform ios
```

### 2. Add MusicKit Entitlement

Add this to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.developer.applemusickit": true
      },
      "infoPlist": {
        "NSAppleMusicUsageDescription": "This app uses Apple Music to let you select and share your favorite songs with friends."
      }
    },
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "15.0"
          }
        }
      ]
    ]
  }
}
```

### 3. Add MusicKit Files to Your Project

The following files have been created for you:

- `ios/MusicKitModule.swift` - Native MusicKit implementation
- `ios/MusicKitModule.m` - React Native bridge
- `lib/musicKitNative.ts` - TypeScript interface

### 4. Add MusicKit Framework

Create `ios/Podfile` modifications:

```ruby
# Add this to your Podfile
target 'YourAppName' do
  # ... existing pods

  # Add MusicKit framework
  pod 'MusicKit', '~> 1.0'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
    end
  end
end
```

### 5. Configure EAS Build

Create `eas.json`:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "buildConfiguration": "Debug"
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

## Building and Testing

### 1. Build Development Client

```bash
# Build for iOS device (will take 10-15 minutes)
eas build --profile development --platform ios

# Or build for simulator (faster)
eas build --profile development --platform ios --local
```

### 2. Install on Your iPhone

After the build completes:

1. **Download the `.ipa` file** from the EAS build page
2. **Install on your iPhone** using TestFlight or direct installation
3. **Run your development server**:
   ```bash
   npx expo start --dev-client
   ```

### 3. Test Apple Music Integration

1. **Open the custom development client** on your iPhone
2. **Connect to your development server** (scan QR code)
3. **Go to Link Account** → **Sync Apple Music**
4. **You should see real MusicKit authorization dialog**

## What This Enables

### ✅ **Real Apple Music Features**

- **Native MusicKit Authorization** - Real Apple Music permission dialog
- **User Token Generation** - Valid tokens for Apple Music API
- **Subscription Check** - Verify if user has Apple Music subscription
- **Library Access** - Access user's actual Apple Music library
- **Search Functionality** - Search Apple Music catalog with real permissions

### 🔄 **Development vs Production**

**Development Mode (Expo Go)**:

- ❌ Cannot use native MusicKit
- ✅ Uses simulation for testing basic flow
- ✅ Good for UI development

**Custom Development Client**:

- ✅ Real MusicKit authorization
- ✅ Real API calls work
- ✅ Full Apple Music integration
- ✅ Test on actual device

## Apple Developer Console Setup

### 1. Enable MusicKit

1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. Select your **App ID**
4. **Edit** → **App Services** → **Enable MusicKit**
5. **Save**

### 2. MusicKit Key (Already Done)

You already have:

- ✅ MusicKit Key ID: `GKBV592446`
- ✅ Team ID: `R6N8B58A4N`
- ✅ Private Key: configured in server

## Troubleshooting

### Build Errors

```bash
# Clear caches and rebuild
eas build --clear-cache --profile development --platform ios
```

### MusicKit Not Found

```bash
# Update pods
cd ios && pod install && cd ..
```

### Authorization Failed

1. **Check entitlements** in app.json
2. **Verify App ID** has MusicKit enabled
3. **Check device** has Apple Music app installed
4. **Verify user** has Apple Music subscription

### Development Client Issues

```bash
# Rebuild development client
eas build --profile development --platform ios --clear-cache
```

## Testing Checklist

- [ ] Custom development client builds successfully
- [ ] MusicKit authorization dialog appears
- [ ] User can grant Apple Music permission
- [ ] Apple Music API calls work (no 403 errors)
- [ ] Song picker shows real Apple Music tracks
- [ ] Favorite songs can be selected and saved

## Production Deployment

For production:

1. **App Store Review** - Apple will review MusicKit usage
2. **Privacy Policy** - Must mention Apple Music data usage
3. **App Store Guidelines** - Follow Apple Music integration guidelines

## Next Steps

1. **Run the build command** above
2. **Install on your iPhone**
3. **Test Apple Music integration**
4. **Database update** (run the SQL query if you haven't)

After this setup, your Apple Music integration will work with real user authentication! 🍎🎵
