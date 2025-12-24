-- Create friendship table (skip if already exists)
CREATE TABLE IF NOT EXISTS friendships (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Enable RLS for friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Create policies for friendships (drop first if they exist)
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships 
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can create friend requests" ON friendships;
CREATE POLICY "Users can create friend requests" ON friendships 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update received friend requests" ON friendships;
CREATE POLICY "Users can update received friend requests" ON friendships
  FOR UPDATE USING (auth.uid() = friend_id);

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
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

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activities" ON activities;
CREATE POLICY "Users can view own activities" ON activities 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own activities" ON activities;
CREATE POLICY "Users can update own activities" ON activities 
  FOR UPDATE USING (auth.uid() = user_id);

-- Create shared_songs table
CREATE TABLE IF NOT EXISTS shared_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  song_id TEXT NOT NULL,
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  song_album TEXT,
  song_artwork TEXT,
  service TEXT CHECK (service IN ('spotify', 'apple')) NOT NULL,
  liked BOOLEAN DEFAULT FALSE,
  disliked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE shared_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shared songs" ON shared_songs;
CREATE POLICY "Users can view own shared songs" ON shared_songs 
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can create shared songs" ON shared_songs;
CREATE POLICY "Users can create shared songs" ON shared_songs 
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update received songs" ON shared_songs;
CREATE POLICY "Users can update received songs" ON shared_songs 
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Create favorite_songs table
CREATE TABLE IF NOT EXISTS favorite_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  position INTEGER CHECK (position >= 1 AND position <= 3),
  song_id TEXT NOT NULL,
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  song_album TEXT,
  song_artwork TEXT,
  service TEXT CHECK (service IN ('spotify', 'apple')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, position)
);

ALTER TABLE favorite_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorite songs" ON favorite_songs;
CREATE POLICY "Users can view own favorite songs" ON favorite_songs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own favorite songs" ON favorite_songs;
CREATE POLICY "Users can manage own favorite songs" ON favorite_songs
  FOR ALL USING (auth.uid() = user_id);

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, onboarding_completed)
  VALUES (new.id, new.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
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
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create function to delete user account
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to delete account';
  END IF;
  
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

