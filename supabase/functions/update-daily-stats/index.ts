// ===================================================================
// DAILY STATS UPDATE EDGE FUNCTION
// ===================================================================
// This function runs as a scheduled job to update daily statistics
// Schedule: Daily at 1 AM UTC
// Usage: Called by Supabase cron or external scheduler

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the target date from query params, default to yesterday
    const url = new URL(req.url)
    const targetDateParam = url.searchParams.get('date')
    const targetDate = targetDateParam || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`Starting daily stats update for date: ${targetDate}`)

    // Call the database function to update stats for all users
    const { data, error } = await supabase.rpc('update_daily_stats_all_users', {
      target_date: targetDate
    })

    if (error) {
      console.error('Error updating daily stats:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          date: targetDate 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get count of updated stats to verify the operation
    const { data: statsCount, error: countError } = await supabase
      .from('daily_stats')
      .select('user_id', { count: 'exact' })
      .eq('stat_date', targetDate)

    if (countError) {
      console.warn('Could not verify stats count:', countError)
    }

    const updateCount = statsCount?.length || 0

    console.log(`Successfully updated daily stats for ${updateCount} users on ${targetDate}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily stats updated successfully`,
        date: targetDate,
        usersUpdated: updateCount,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error in daily stats update:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/* 
To set up the scheduled job in Supabase:

1. Deploy this function:
   supabase functions deploy update-daily-stats

2. Create a cron job in Supabase dashboard or via SQL:
   
   SELECT cron.schedule(
     'daily-stats-update',
     '0 1 * * *',  -- Daily at 1 AM UTC
     $$
     SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/update-daily-stats',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || 'your-anon-key' || '"}'::jsonb,
       body := '{}'::jsonb
     ) as request_id;
     $$
   );

3. To manually trigger for testing:
   curl -X POST "https://your-project.supabase.co/functions/v1/update-daily-stats" \
     -H "Authorization: Bearer your-anon-key" \
     -H "Content-Type: application/json"

4. To update stats for a specific date:
   curl -X POST "https://your-project.supabase.co/functions/v1/update-daily-stats?date=2024-01-15" \
     -H "Authorization: Bearer your-anon-key" \
     -H "Content-Type: application/json"
*/