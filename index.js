// Startup logging
console.log("🚀 APP STARTING - index.js loaded");

require("./polyfills/worklets");
console.log("✅ Polyfills loaded");

require("expo-router/entry");
console.log("✅ Expo Router entry loaded");


