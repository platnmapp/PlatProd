-- Create profiles table to track user onboarding status
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  
  -- User profile information
  first_name TEXT,
  last_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  -- Spotify Integration fields
  spotify_user_id TEXT,
  spotify_display_name TEXT,
  spotify_email TEXT,
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  spotify_token_expires_at TIMESTAMP WITH TIME ZONE,
  spotify_connected_at TIMESTAMP WITH TIME ZONE,
  
  -- Apple Music Integration fields
  apple_music_user_token TEXT,
  apple_music_connected BOOLEAN DEFAULT FALSE,
  apple_music_connected_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profile access
-- Allow authenticated users to view all profiles (own and others)
CREATE POLICY "Users can view profiles" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create friendship table
CREATE TABLE friendships (
  
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique friendship pairs (prevent duplicates)
  UNIQUE(user_id, friend_id),
  -- Prevent self-friendship
  CHECK (user_id != friend_id)
);

-- Enable RLS for friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Create policies for friendships
-- Users can view friendships they are part of
CREATE POLICY "Users can view own friendships" ON friendships 
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can create friend requests
CREATE POLICY "Users can create friend requests" ON friendships 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update friend requests sent to them (accept/decline)
-- Simplified policy that allows updates to requests where user is the recipient
CREATE POLICY "Users can update received friend requests" ON friendships
  FOR UPDATE USING (auth.uid() = friend_id);

-- Create activities table to track user activities
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('song_liked', 'song_shared', 'friend_request', 'friend_accepted')),
  related_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  song_title TEXT,
  song_artist TEXT,
  song_artwork TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Enable RLS for activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Create policies for activities
-- Users can view their own activities
CREATE POLICY "Users can view own activities" ON activities 
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own activities (mark as read)
CREATE POLICY "Users can update own activities" ON activities 
  FOR UPDATE USING (auth.uid() = user_id);

-- Create shared_songs table
CREATE TABLE shared_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Song information
  song_id TEXT NOT NULL, -- Spotify/Apple Music track ID
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  song_album TEXT,
  song_artwork TEXT,
  service TEXT CHECK (service IN ('spotify', 'apple')) NOT NULL,
  
  -- Reaction information
  liked BOOLEAN DEFAULT FALSE,
  disliked BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for shared_songs
ALTER TABLE shared_songs ENABLE ROW LEVEL SECURITY;

-- Create policies for shared_songs
-- Users can view songs they sent or received
CREATE POLICY "Users can view own shared songs" ON shared_songs 
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create songs they send
CREATE POLICY "Users can create shared songs" ON shared_songs 
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update songs they received (like/dislike)
CREATE POLICY "Users can update received songs" ON shared_songs 
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Create favorite_songs table to store user's favorite songs
CREATE TABLE favorite_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  position INTEGER CHECK (position >= 1 AND position <= 3), -- 1, 2, or 3 for the three slots

  -- Song information
  song_id TEXT NOT NULL, -- Spotify/Apple Music track ID
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  song_album TEXT,
  song_artwork TEXT,
  service TEXT CHECK (service IN ('spotify', 'apple')) NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure each user can only have one song per position
  UNIQUE(user_id, position)
);

-- Enable RLS for favorite_songs
ALTER TABLE favorite_songs ENABLE ROW LEVEL SECURITY;

-- Create policies for favorite_songs
-- Users can view their own favorite songs
CREATE POLICY "Users can view own favorite songs" ON favorite_songs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can manage their own favorite songs
CREATE POLICY "Users can manage own favorite songs" ON favorite_songs
  FOR ALL USING (auth.uid() = user_id);

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, onboarding_completed)
  VALUES (new.id, new.email, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at on profiles
CREATE OR REPLACE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create function to delete user account
-- This function deletes the user from auth.users, which will cascade delete all related data
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user's ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to delete account';
  END IF;
  
  -- Delete the user from auth.users
  -- This will cascade delete all related data due to ON DELETE CASCADE
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
