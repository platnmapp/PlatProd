package com.platnm.app
import expo.modules.splashscreen.SplashScreenManager

import android.content.Intent
import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreenManager.registerOnActivity(this)
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)

    // Handle initial share intent
    handleShareIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    android.util.Log.d("platnm", "onNewIntent called with action: ${intent.action}")
    
    // Update intent for React Native
    setIntent(intent)
    
    // Handle the new share intent
    handleShareIntent(intent)
  }

  private fun handleShareIntent(intent: Intent?) {
    if (intent?.action == Intent.ACTION_SEND) {
      val sharedText = when {
        intent.type?.startsWith("text/") == true -> {
          intent.getStringExtra(Intent.EXTRA_TEXT)
        }
        else -> {
          intent.getStringExtra(Intent.EXTRA_TEXT) ?: intent.getStringExtra(Intent.EXTRA_SUBJECT)
        }
      }
      
      if (sharedText != null && sharedText.isNotEmpty()) {
        android.util.Log.d("platnm", "Processing share: $sharedText")
        
        // Create deep link URL
        val encodedText = java.net.URLEncoder.encode(sharedText, "UTF-8")
        val deepLinkUrl = "platnm://shared-music?url=$encodedText"
        
        android.util.Log.d("platnm", "Created deep link: $deepLinkUrl")
        
        // Check if this is a new share intent (from external app) or existing app
        val isNewShare = intent != this.intent
        
        if (isNewShare) {
          android.util.Log.d("platnm", "New share from external app, processing within current instance")
          
          // Instead of starting a new activity and finishing, just update the current intent
          // This prevents the app rebundling issue
          val linkingIntent = Intent(this.intent)
          linkingIntent.data = android.net.Uri.parse(deepLinkUrl)
          linkingIntent.action = Intent.ACTION_VIEW
          setIntent(linkingIntent)
          
          // Notify React Native about the new intent (same as existing app logic)
          onNewIntent(linkingIntent)
        } else {
          android.util.Log.d("platnm", "App already running, sending deep link directly")
          
          // Store the deep link in the intent for React Native to pick up
          val linkingIntent = Intent(this.intent)
          linkingIntent.data = android.net.Uri.parse(deepLinkUrl)
          linkingIntent.action = Intent.ACTION_VIEW
          setIntent(linkingIntent)
          
          // Notify React Native about the new intent
          onNewIntent(linkingIntent)
        }
      } else {
        android.util.Log.w("platnm", "No shared text found in intent")
        // If no valid shared content, finish anyway to close the share intent
        finish()
      }
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
}
