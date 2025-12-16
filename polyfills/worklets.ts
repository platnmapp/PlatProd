// Provides the globals that react-native-worklets expects when the native
// module is not linked (we only need the Babel plugin for css-interop).
if (typeof globalThis._toString !== "function") {
  globalThis._toString = (value: unknown) =>
    Object.prototype.toString.call(value);
}


