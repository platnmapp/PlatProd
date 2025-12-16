declare module "react-native-apple-music-user-token" {
  export default class AppleMusicUserToken {
    static requestAuthorization(): Promise<void>;
    static requestUserTokenForDeveloperToken(
      developerToken: string
    ): Promise<string>;
  }
}
