-- ===================================================================
-- DATABASE PERFORMANCE OPTIMIZATIONS
-- ===================================================================
-- This file contains indexes and optimizations for slow queries
-- Apply these after the main database_setup.sql

-- ===================================================================
-- INDEXES FOR FREQUENTLY QUERIED COLUMNS
-- ===================================================================

-- Activities table indexes
-- Used for: ORDER BY created_at DESC, WHERE user_id = ?, WHERE actor_id = ?
CREATE INDEX IF NOT EXISTS idx_activities_user_id_created_at ON activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_actor_id_created_at ON activities(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_song_id ON activities(song_id);
CREATE INDEX IF NOT EXISTS idx_activities_type_user_id ON activities(type, user_id);

-- Shared_songs table indexes
-- Used for: WHERE receiver_id = ? ORDER BY created_at DESC, WHERE sender_id = ?, WHERE liked = true
CREATE INDEX IF NOT EXISTS idx_shared_songs_receiver_id_created_at ON shared_songs(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_songs_sender_id_created_at ON shared_songs(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_songs_song_id ON shared_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_shared_songs_liked_receiver ON shared_songs(liked, receiver_id) WHERE liked IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shared_songs_sender_liked ON shared_songs(sender_id, liked) WHERE liked IS NOT NULL;

-- Composite index for inbox queries (receiver_id + liked + is_queued + created_at)
CREATE INDEX IF NOT EXISTS idx_shared_songs_inbox ON shared_songs(receiver_id, liked, is_queued, created_at DESC);

-- Favorite_songs table indexes
-- Used for: WHERE user_id = ? ORDER BY position, lookups by song_id
CREATE INDEX IF NOT EXISTS idx_favorite_songs_user_id_position ON favorite_songs(user_id, position);
CREATE INDEX IF NOT EXISTS idx_favorite_songs_song_id ON favorite_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_favorite_songs_created_at ON favorite_songs(created_at DESC);

-- Friendships table indexes (already has UNIQUE constraint but may need optimization)
CREATE INDEX IF NOT EXISTS idx_friendships_user_id_status ON friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id_status ON friendships(friend_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- ===================================================================
-- DAILY STATS SNAPSHOT TABLE
-- ===================================================================

-- Create table to store daily aggregated statistics
-- This prevents expensive COUNT queries on large tables
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  
  -- Core metrics
  songs_sent_count INTEGER DEFAULT 0,
  songs_received_count INTEGER DEFAULT 0,
  likes_given_count INTEGER DEFAULT 0,
  likes_received_count INTEGER DEFAULT 0,
  
  -- Calculated metrics
  hit_rate_percentage DECIMAL(5,2) DEFAULT 0.00, -- Percentage of sent songs that got liked
  
  -- Activity metrics
  activities_count INTEGER DEFAULT 0,
  friend_requests_sent INTEGER DEFAULT 0,
  friend_requests_received INTEGER DEFAULT 0,
  
  -- Streak calculation helpers
  had_activity BOOLEAN DEFAULT FALSE, -- Whether user had any activity this day
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per day
  UNIQUE(user_id, stat_date)
);

-- Enable RLS for daily_stats
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_stats
-- Users can view their own daily stats
CREATE POLICY "Users can view own daily stats" ON daily_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all daily stats (for the scheduled job)
CREATE POLICY "Service role can manage daily stats" ON daily_stats
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create indexes for daily_stats
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_id_date ON daily_stats(user_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_activity ON daily_stats(user_id, had_activity, stat_date DESC);

-- Add updated_at trigger for daily_stats
CREATE OR REPLACE TRIGGER daily_stats_updated_at
    BEFORE UPDATE ON daily_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ===================================================================
-- FUNCTIONS FOR STATS CALCULATION
-- ===================================================================

-- Function to calculate daily stats for a specific user and date
CREATE OR REPLACE FUNCTION calculate_daily_stats_for_user(
  target_user_id UUID,
  target_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
  songs_sent INTEGER;
  songs_received INTEGER;
  likes_given INTEGER;
  likes_received INTEGER;
  hit_rate DECIMAL(5,2);
  activities INTEGER;
  friend_reqs_sent INTEGER;
  friend_reqs_received INTEGER;
  had_any_activity BOOLEAN;
BEGIN
  -- Calculate songs sent (excluding self-sends)
  SELECT COUNT(*) INTO songs_sent
  FROM shared_songs
  WHERE sender_id = target_user_id
    AND receiver_id != target_user_id
    AND DATE(created_at) = target_date;

  -- Calculate songs received (excluding self-sends)
  SELECT COUNT(*) INTO songs_received
  FROM shared_songs
  WHERE receiver_id = target_user_id
    AND sender_id != target_user_id
    AND DATE(created_at) = target_date;

  -- Calculate likes given
  SELECT COUNT(*) INTO likes_given
  FROM shared_songs
  WHERE receiver_id = target_user_id
    AND liked = true
    AND DATE(rated_at) = target_date;

  -- Calculate likes received on songs sent by this user
  SELECT COUNT(*) INTO likes_received
  FROM shared_songs
  WHERE sender_id = target_user_id
    AND receiver_id != target_user_id
    AND liked = true
    AND DATE(rated_at) = target_date;

  -- Calculate hit rate
  IF songs_sent > 0 THEN
    hit_rate := (likes_received::DECIMAL / songs_sent::DECIMAL) * 100.0;
  ELSE
    hit_rate := 0.00;
  END IF;

  -- Calculate activities count
  SELECT COUNT(*) INTO activities
  FROM activities
  WHERE user_id = target_user_id
    AND DATE(created_at) = target_date;

  -- Calculate friend requests sent
  SELECT COUNT(*) INTO friend_reqs_sent
  FROM friendships
  WHERE user_id = target_user_id
    AND DATE(created_at) = target_date;

  -- Calculate friend requests received
  SELECT COUNT(*) INTO friend_reqs_received
  FROM friendships
  WHERE friend_id = target_user_id
    AND DATE(created_at) = target_date;

  -- Determine if user had any activity
  had_any_activity := (songs_sent > 0 OR songs_received > 0 OR likes_given > 0 OR activities > 0);

  -- Insert or update the daily stats
  INSERT INTO daily_stats (
    user_id,
    stat_date,
    songs_sent_count,
    songs_received_count,
    likes_given_count,
    likes_received_count,
    hit_rate_percentage,
    activities_count,
    friend_requests_sent,
    friend_requests_received,
    had_activity
  )
  VALUES (
    target_user_id,
    target_date,
    songs_sent,
    songs_received,
    likes_given,
    likes_received,
    hit_rate,
    activities,
    friend_reqs_sent,
    friend_reqs_received,
    had_any_activity
  )
  ON CONFLICT (user_id, stat_date)
  DO UPDATE SET
    songs_sent_count = EXCLUDED.songs_sent_count,
    songs_received_count = EXCLUDED.songs_received_count,
    likes_given_count = EXCLUDED.likes_given_count,
    likes_received_count = EXCLUDED.likes_received_count,
    hit_rate_percentage = EXCLUDED.hit_rate_percentage,
    activities_count = EXCLUDED.activities_count,
    friend_requests_sent = EXCLUDED.friend_requests_sent,
    friend_requests_received = EXCLUDED.friend_requests_received,
    had_activity = EXCLUDED.had_activity,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update daily stats for all active users
CREATE OR REPLACE FUNCTION update_daily_stats_all_users(
  target_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Get all users who had activity on the target date
  FOR user_record IN
    SELECT DISTINCT p.id
    FROM profiles p
    WHERE EXISTS (
      -- Users who sent songs
      SELECT 1 FROM shared_songs ss WHERE ss.sender_id = p.id AND DATE(ss.created_at) = target_date
      UNION
      -- Users who received songs
      SELECT 1 FROM shared_songs ss WHERE ss.receiver_id = p.id AND DATE(ss.created_at) = target_date
      UNION
      -- Users who rated songs
      SELECT 1 FROM shared_songs ss WHERE ss.receiver_id = p.id AND DATE(ss.rated_at) = target_date
      UNION
      -- Users who had activities
      SELECT 1 FROM activities a WHERE a.user_id = p.id AND DATE(a.created_at) = target_date
      UNION
      -- Users who sent/received friend requests
      SELECT 1 FROM friendships f WHERE (f.user_id = p.id OR f.friend_id = p.id) AND DATE(f.created_at) = target_date
    )
  LOOP
    PERFORM calculate_daily_stats_for_user(user_record.id, target_date);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get optimized user stats (latest snapshot + today's activities)
CREATE OR REPLACE FUNCTION get_optimized_user_stats(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  latest_snapshot RECORD;
  today_stats RECORD;
  total_friends INTEGER;
  current_streak INTEGER;
  result JSON;
BEGIN
  -- Get the latest daily stats snapshot (excluding today)
  SELECT * INTO latest_snapshot
  FROM daily_stats
  WHERE user_id = target_user_id
    AND stat_date < CURRENT_DATE
  ORDER BY stat_date DESC
  LIMIT 1;

  -- Get today's stats (calculate in real-time)
  PERFORM calculate_daily_stats_for_user(target_user_id, CURRENT_DATE);
  
  SELECT * INTO today_stats
  FROM daily_stats
  WHERE user_id = target_user_id
    AND stat_date = CURRENT_DATE;

  -- Get current friend count (real-time)
  SELECT COUNT(*) INTO total_friends
  FROM friendships
  WHERE (user_id = target_user_id OR friend_id = target_user_id)
    AND status = 'accepted';

  -- Calculate current streak
  SELECT COALESCE(calculate_activity_streak(target_user_id), 0) INTO current_streak;

  -- Combine results
  result := json_build_object(
    'friends_count', total_friends,
    'songs_sent_count', COALESCE(
      (SELECT SUM(songs_sent_count) FROM daily_stats WHERE user_id = target_user_id), 
      0
    ) + COALESCE(today_stats.songs_sent_count, 0),
    'likes_received_count', COALESCE(
      (SELECT SUM(likes_received_count) FROM daily_stats WHERE user_id = target_user_id), 
      0
    ) + COALESCE(today_stats.likes_received_count, 0),
    'hit_rate_percentage', CASE 
      WHEN (SELECT SUM(songs_sent_count) FROM daily_stats WHERE user_id = target_user_id) > 0 
      THEN (
        (SELECT SUM(likes_received_count) FROM daily_stats WHERE user_id = target_user_id)::DECIMAL 
        / (SELECT SUM(songs_sent_count) FROM daily_stats WHERE user_id = target_user_id)::DECIMAL 
        * 100.0
      )
      ELSE 0.00
    END,
    'streak_days', current_streak,
    'last_snapshot_date', COALESCE(latest_snapshot.stat_date, NULL),
    'today_stats', row_to_json(today_stats)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to calculate activity streak
CREATE OR REPLACE FUNCTION calculate_activity_streak(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  streak_count INTEGER := 0;
  check_date DATE := CURRENT_DATE;
  had_activity BOOLEAN;
BEGIN
  LOOP
    -- Check if user had activity on this date
    SELECT 
      CASE 
        WHEN COUNT(*) > 0 THEN TRUE 
        ELSE FALSE 
      END INTO had_activity
    FROM daily_stats
    WHERE user_id = target_user_id
      AND stat_date = check_date
      AND had_activity = true;

    -- If no activity record exists for this date, check real-time
    IF NOT FOUND OR had_activity IS NULL THEN
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN TRUE 
          ELSE FALSE 
        END INTO had_activity
      FROM (
        SELECT 1 FROM shared_songs WHERE (sender_id = target_user_id OR receiver_id = target_user_id) AND DATE(created_at) = check_date
        UNION
        SELECT 1 FROM activities WHERE user_id = target_user_id AND DATE(created_at) = check_date
        UNION  
        SELECT 1 FROM friendships WHERE (user_id = target_user_id OR friend_id = target_user_id) AND DATE(created_at) = check_date
      ) activity_check;
    END IF;

    -- If no activity on this date, break the streak
    IF NOT had_activity THEN
      EXIT;
    END IF;

    -- Increment streak and check previous day
    streak_count := streak_count + 1;
    check_date := check_date - INTERVAL '1 day';
    
    -- Prevent infinite loops
    IF streak_count > 365 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN streak_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;