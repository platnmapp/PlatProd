-- Update favorite_songs RLS policy to allow friends to view each other's favorite songs

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own favorite songs" ON favorite_songs;

-- Create a new policy that allows:
-- 1. Users to view their own favorite songs
-- 2. Users to view favorite songs of their accepted friends
CREATE POLICY "Users can view favorite songs of self and friends" ON favorite_songs
  FOR SELECT USING (
    -- Allow viewing own favorite songs
    auth.uid() = user_id
    OR
    -- Allow viewing favorite songs of accepted friends
    EXISTS (
      SELECT 1 FROM friendships
      WHERE 
        (
          (friendships.user_id = auth.uid() AND friendships.friend_id = favorite_songs.user_id)
          OR
          (friendships.friend_id = auth.uid() AND friendships.user_id = favorite_songs.user_id)
        )
        AND friendships.status = 'accepted'
    )
  ); 