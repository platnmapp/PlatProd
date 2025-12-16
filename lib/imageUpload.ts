import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { CacheService } from "./cacheService";
import { supabase } from "./supabase";

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export class ImageUploadService {
  private static readonly BUCKET_NAME = "profile-pictures";

  // Request camera/gallery permissions
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === "granted";
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  }

  // Pick image from gallery
  static async pickImage(): Promise<ImagePicker.ImagePickerResult | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for profile pictures
        quality: 0.8,
        base64: true, // We need base64 for Supabase upload
      });

      return result;
    } catch (error) {
      console.error("Error picking image:", error);
      return null;
    }
  }

  // Upload image to Supabase Storage
  static async uploadProfilePicture(
    userId: string,
    imageUri: string,
    base64: string
  ): Promise<ImageUploadResult> {
    try {
      // Generate unique filename
      const fileExt = imageUri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${userId}/profile-${Date.now()}.${fileExt}`;

      // Convert base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true, // Replace if exists
        });

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        return {
          success: false,
          error: uploadError.message,
        };
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      return {
        success: true,
        url: publicUrlData.publicUrl,
      };
    } catch (error) {
      console.error("Error in uploadProfilePicture:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to upload image",
      };
    }
  }

  // Delete old profile picture
  static async deleteProfilePicture(avatarUrl: string): Promise<boolean> {
    try {
      // Extract filename from URL
      const urlParts = avatarUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const folder = urlParts[urlParts.length - 2];
      const fullPath = `${folder}/${fileName}`;

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([fullPath]);

      if (error) {
        console.error("Error deleting old image:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in deleteProfilePicture:", error);
      return false;
    }
  }

  // Complete profile picture update process
  static async updateProfilePicture(
    userId: string
  ): Promise<ImageUploadResult> {
    try {
      // Pick image
      const imageResult = await this.pickImage();

      if (!imageResult || imageResult.canceled || !imageResult.assets?.[0]) {
        return {
          success: false,
          error: "No image selected",
        };
      }

      const asset = imageResult.assets[0];

      if (!asset.base64) {
        return {
          success: false,
          error: "Failed to process image",
        };
      }

      // Upload image
      const uploadResult = await this.uploadProfilePicture(
        userId,
        asset.uri,
        asset.base64
      );

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Update user profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: uploadResult.url })
        .eq("id", userId);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        return {
          success: false,
          error: "Failed to update profile",
        };
      }

      // Invalidate cache to force fresh data on next fetch
      CacheService.invalidateUserProfile(userId);
      CacheService.invalidateAvatarUrl(userId);

      return {
        success: true,
        url: uploadResult.url,
      };
    } catch (error) {
      console.error("Error in updateProfilePicture:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update profile picture",
      };
    }
  }
}
