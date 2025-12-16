# Profile Picture Upload Setup

This guide explains how to set up profile picture upload functionality using Supabase Storage.

## Supabase Dashboard Setup

### 1. Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"Create a new bucket"**
4. Set the following values:
   - **Bucket name**: `profile-pictures`
   - **Public bucket**: ✅ **Enabled** (checked)
   - **File size limit**: 50 MB (default)
   - **Allowed MIME types**: `image/*` (optional)

### 2. Set Storage Policies

Go to **Storage** → **Policies** and create the following policies for the `profile-pictures` bucket:

#### Policy 1: Allow users to upload their own profile pictures

```sql
CREATE POLICY "Users can upload their own profile pictures" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-pictures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

#### Policy 2: Allow users to update their own profile pictures

```sql
CREATE POLICY "Users can update their own profile pictures" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profile-pictures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

#### Policy 3: Allow users to delete their own profile pictures

```sql
CREATE POLICY "Users can delete their own profile pictures" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'profile-pictures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

#### Policy 4: Allow public access to view profile pictures

```sql
CREATE POLICY "Public can view profile pictures" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-pictures');
```

## How It Works

### File Structure

Profile pictures are stored with this structure:

```
profile-pictures/
  └── {user-id}/
      └── profile-{timestamp}.{extension}
```

### Upload Process

1. User taps the edit icon on their profile picture
2. App requests gallery permissions
3. Image picker opens with 1:1 aspect ratio cropping
4. Selected image is compressed and converted to base64
5. Image is uploaded to Supabase Storage
6. User's `avatar_url` is updated in the profiles table
7. UI immediately reflects the new profile picture

### Security

- Users can only upload to their own folder (enforced by user ID)
- Images are publicly readable but only editable by the owner
- Square aspect ratio ensures consistent profile picture appearance
- Image compression reduces storage costs and improves performance

## Features Included

✅ **Image Selection**: Gallery picker with crop functionality
✅ **Upload Progress**: Loading indicator during upload
✅ **Error Handling**: User-friendly error messages
✅ **Security**: User-specific folder structure
✅ **Optimization**: Image compression and proper file types
✅ **Real-time Updates**: Immediate UI refresh after upload

## Permissions Required

The app will automatically request the following permissions:

- **Gallery Access**: To select profile pictures from photo library

## Testing

1. Go to **Profile** → **Edit Profile**
2. Tap the pencil icon on the profile picture
3. Grant gallery permissions if prompted
4. Select and crop an image
5. Wait for upload to complete
6. Verify the new profile picture appears immediately

## Troubleshooting

### "Permission denied" error

- Check that storage policies are correctly set up
- Ensure the bucket is marked as public
- Verify user authentication is working

### Images not displaying

- Check that the public URL is being generated correctly
- Ensure the bucket name matches exactly: `profile-pictures`
- Verify the image was uploaded successfully in Storage dashboard

### Upload failures

- Check internet connection
- Verify Supabase project configuration
- Check browser/app console for detailed error messages
