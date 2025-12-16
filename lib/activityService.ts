import { supabase } from "./supabase";

export interface Activity {
  id: string;
  user_id: string; // Who receives this notification
  actor_id: string; // Who performed the action
  type:
    | "friend_request"
    | "friend_accepted"
    | "song_liked"
    | "song_disliked"
    | "song_sent";
  song_title?: string;
  song_artist?: string;
  song_artwork?: string;
  is_actionable: boolean;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  actor: {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

export interface ActivityGrouped {
  new: Activity[];
  earlierToday: Activity[];
  yesterday: Activity[];
  older: Activity[];
}

export class ActivityService {
  // Create a friend request activity
  static async createFriendRequestActivity(
    senderId: string,
    recipientId: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase.from("activities").insert({
        user_id: recipientId,
        actor_id: senderId,
        type: "friend_request",
        is_actionable: true,
        is_completed: false,
      });

      return { success: !error, error };
    } catch (error) {
      console.error("Error creating friend request activity:", error);
      return { success: false, error };
    }
  }

  // Create a friend accepted activity
  static async createFriendAcceptedActivity(
    accepterId: string,
    originalSenderId: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase.from("activities").insert({
        user_id: originalSenderId,
        actor_id: accepterId,
        type: "friend_accepted",
        is_actionable: false,
        is_completed: true,
      });

      return { success: !error, error };
    } catch (error) {
      console.error("Error creating friend accepted activity:", error);
      return { success: false, error };
    }
  }

  // Create a song liked activity
  static async createSongLikedActivity(
    likerId: string,
    songOwnerId: string,
    songTitle: string,
    songArtist: string,
    songArtwork?: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      console.log('Creating song liked activity:', {
        likerId,
        songOwnerId,
        songTitle,
        songArtist
      });

      // Check current auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log('Current auth user:', authUser?.id);
      console.log('Liker ID:', likerId);
      
      if (!authUser) {
        console.error('No authenticated user found');
        return { success: false, error: 'User not authenticated' };
      }
      
      if (authUser.id !== likerId) {
        console.error('Auth user ID does not match liker ID', {
          authUserId: authUser.id,
          likerId
        });
        return { success: false, error: 'Authentication mismatch' };
      }

      const { data, error } = await supabase.from("activities").insert({
        user_id: songOwnerId,
        actor_id: likerId,
        type: "song_liked",
        song_title: songTitle,
        song_artist: songArtist,
        song_artwork: songArtwork,
        is_actionable: false,
        is_completed: false,
      }).select();

      console.log('Activity insert result:', { data, error });

      return { success: !error, error };
    } catch (error) {
      console.error("Error creating song liked activity:", error);
      return { success: false, error };
    }
  }

  // Create a song disliked activity
  static async createSongDislikedActivity(
    dislikerId: string,
    songOwnerId: string,
    songTitle: string,
    songArtist: string,
    songArtwork?: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      console.log('Creating song disliked activity:', {
        dislikerId,
        songOwnerId,
        songTitle,
        songArtist
      });

      const { data, error } = await supabase.from("activities").insert({
        user_id: songOwnerId,
        actor_id: dislikerId,
        type: "song_disliked",
        song_title: songTitle,
        song_artist: songArtist,
        song_artwork: songArtwork,
        is_actionable: false,
        is_completed: false,
      }).select();

      console.log('Activity insert result:', { data, error });

      return { success: !error, error };
    } catch (error) {
      console.error("Error creating song disliked activity:", error);
      return { success: false, error };
    }
  }

  // Mark activity as completed (for friend requests)
  static async markActivityCompleted(
    activityId: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from("activities")
        .update({ is_completed: true })
        .eq("id", activityId);

      return { success: !error, error };
    } catch (error) {
      console.error("Error marking activity as completed:", error);
      return { success: false, error };
    }
  }

  // Fetch activities for a user with pagination
  static async getUserActivities(
    userId: string, 
    cursor?: string
  ): Promise<{ activities: Activity[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const PAGE_SIZE = 10;
      
      let query = supabase
        .from("activities")
        .select(
          `
          id,
          user_id,
          actor_id,
          type,
          song_title,
          song_artist,
          song_artwork,
          is_actionable,
          is_completed,
          created_at,
          updated_at
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1); // Fetch one extra to check if there are more

      // Apply cursor if provided
      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      const { data: activityData, error } = await query;

      console.log('Activities query result:', { 
        activityData, 
        error, 
        userId,
        cursor 
      });

      if (error) {
        console.error("Error fetching activities:", error);
        return { activities: [], hasMore: false };
      }

      if (!activityData || activityData.length === 0) {
        console.log('No activities found for user:', userId);
        return { activities: [], hasMore: false };
      }

      // Check if there are more results
      const hasMore = activityData.length > PAGE_SIZE;
      const activities = activityData.slice(0, PAGE_SIZE);

      // Fetch actor profiles separately
      const actorIds = [
        ...new Set(activities.map((activity) => activity.actor_id)),
      ];
      const { data: actors, error: actorsError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, avatar_url")
        .in("id", actorIds);

      if (actorsError) {
        console.error("Error fetching actors:", actorsError);
        return { activities: [], hasMore: false };
      }

      // Combine the data
      const transformedActivities: Activity[] = activities.map((activity) => {
        const actor = actors?.find((a) => a.id === activity.actor_id);
        return {
          id: activity.id,
          user_id: activity.user_id,
          actor_id: activity.actor_id,
          type: activity.type,
          song_title: activity.song_title,
          song_artist: activity.song_artist,
          song_artwork: activity.song_artwork,
          is_actionable: activity.is_actionable,
          is_completed: activity.is_completed,
          created_at: activity.created_at,
          updated_at: activity.updated_at,
          actor: {
            id: actor?.id || "",
            first_name: actor?.first_name,
            last_name: actor?.last_name,
            username: actor?.username,
            avatar_url: actor?.avatar_url,
          },
        };
      });

      // Get the cursor for the next page
      const nextCursor = hasMore && activities.length > 0 
        ? activities[activities.length - 1].created_at 
        : undefined;

      return { 
        activities: transformedActivities, 
        nextCursor, 
        hasMore 
      };
    } catch (error) {
      console.error("Error fetching user activities:", error);
      return { activities: [], hasMore: false };
    }
  }

  // Group activities by time periods
  static groupActivitiesByTime(activities: Activity[]): ActivityGrouped {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const grouped: ActivityGrouped = {
      new: [],
      earlierToday: [],
      yesterday: [],
      older: [],
    };

    activities.forEach((activity) => {
      const activityDate = new Date(activity.created_at);

      if (activityDate > oneHourAgo) {
        grouped.new.push(activity);
      } else if (activityDate >= today) {
        grouped.earlierToday.push(activity);
      } else if (activityDate >= yesterday) {
        grouped.yesterday.push(activity);
      } else {
        grouped.older.push(activity);
      }
    });

    return grouped;
  }

  // Get display name for an actor
  static getActorDisplayName(actor: Activity["actor"]): string {
    if (actor.first_name && actor.last_name) {
      return `${actor.first_name} ${actor.last_name}`;
    }
    if (actor.first_name) {
      return actor.first_name;
    }
    if (actor.username) {
      return actor.username;
    }
    return "User";
  }

  // Format timestamp for display
  static formatTimestamp(timestamp: string): string {
    const now = new Date();
    const activityDate = new Date(timestamp);
    const diffInMinutes = Math.floor(
      (now.getTime() - activityDate.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInMinutes < 24 * 60) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h`;
    } else {
      const days = Math.floor(diffInMinutes / (24 * 60));
      return `${days}d`;
    }
  }
}
