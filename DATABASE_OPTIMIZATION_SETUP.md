# Database Performance Optimization Setup

This guide explains how to implement the database optimizations for improved query performance and efficient stats calculation.

## Overview

The optimization includes:

1. **Database indexes** for frequently queried columns
2. **Daily stats snapshots** to avoid expensive COUNT queries
3. **Scheduled job** to update stats daily
4. **Optimized stats service** for fast stats retrieval

## 🚀 Implementation Steps

### 1. Apply Database Optimizations

Run the SQL optimizations on your Supabase database:

```bash
# Apply the performance optimizations
psql -h your-db-host -U postgres -d postgres -f database_performance_optimizations.sql
```

Or run it directly in the Supabase SQL editor:

```sql
-- Copy and paste the contents of database_performance_optimizations.sql
```

### 2. Deploy the Scheduled Function

```bash
# Deploy the daily stats update function
supabase functions deploy update-daily-stats

# Verify it works
curl -X POST "https://your-project.supabase.co/functions/v1/update-daily-stats" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json"
```

### 3. Set Up Automated Scheduling

#### Option A: Supabase Cron (Recommended)

Enable pg_cron extension and create the job:

```sql
-- Enable cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily stats update at 1 AM UTC
SELECT cron.schedule(
  'daily-stats-update',
  '0 1 * * *',  -- Daily at 1 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/update-daily-stats',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-anon-key"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

#### Option B: External Cron Service

Use GitHub Actions, Vercel Cron, or similar:

```yaml
# .github/workflows/daily-stats.yml
name: Update Daily Stats
on:
  schedule:
    - cron: "0 1 * * *" # Daily at 1 AM UTC
jobs:
  update-stats:
    runs-on: ubuntu-latest
    steps:
      - name: Update Stats
        run: |
          curl -X POST "${{ secrets.SUPABASE_FUNCTION_URL }}/update-daily-stats" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

### 4. Update Your Application Code

Replace the existing stats service with the optimized version:

```typescript
// Before (slow)
import { UserProfileService } from "./lib/userProfile";
const stats = await UserProfileService.getUserStats(userId);

// After (fast)
import { OptimizedStatsService } from "./lib/optimizedStatsService";
const stats = await OptimizedStatsService.getUserStats(userId);
```

## 📊 Performance Impact

### Before Optimization

- **Friend count**: `SELECT COUNT(*) FROM friendships WHERE ...`
- **Songs sent**: `SELECT COUNT(*) FROM shared_songs WHERE ...`
- **Likes received**: `SELECT COUNT(*) FROM shared_songs WHERE ...`
- **Total queries**: 3+ COUNT queries per stats request
- **Response time**: 500ms - 2s+ (scales with data)

### After Optimization

- **Stats retrieval**: Single function call using pre-calculated snapshots
- **Daily updates**: Batch processed once per day
- **Total queries**: 1 function call per stats request
- **Response time**: 50-100ms (constant time)

## 🔧 Monitoring & Maintenance

### Check Daily Stats Health

```sql
-- Verify daily stats are being updated
SELECT
  stat_date,
  COUNT(*) as users_with_stats,
  SUM(songs_sent_count) as total_songs_sent,
  AVG(hit_rate_percentage) as avg_hit_rate
FROM daily_stats
WHERE stat_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY stat_date
ORDER BY stat_date DESC;
```

### Manual Stats Update

```bash
# Update stats for a specific date
curl -X POST "https://your-project.supabase.co/functions/v1/update-daily-stats?date=2024-01-15" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json"

# Force real-time calculation for a user
const stats = await OptimizedStatsService.getUserStats(userId, true);
```

### Index Performance Check

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM shared_songs
WHERE receiver_id = 'user-id'
  AND liked IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Should show "Index Scan" instead of "Seq Scan"
```

## 🐛 Troubleshooting

### Stats Not Updating

1. Check if the scheduled function is running:

   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
   ```

2. Check function logs in Supabase dashboard

3. Manual trigger test:
   ```bash
   curl -X POST "your-function-url/update-daily-stats" -H "Authorization: Bearer key"
   ```

### Missing Indexes

```sql
-- Check if indexes exist
SELECT indexname, tablename FROM pg_indexes
WHERE tablename IN ('activities', 'shared_songs', 'favorite_songs');
```

### Performance Still Slow

1. Check if `get_optimized_user_stats` function exists
2. Verify daily_stats table has recent data
3. Fall back to real-time calculation temporarily

## 📋 Checklist

- [ ] Applied `database_performance_optimizations.sql`
- [ ] Deployed `update-daily-stats` function
- [ ] Set up daily cron job
- [ ] Updated application to use `OptimizedStatsService`
- [ ] Verified stats are updating daily
- [ ] Tested performance improvement
- [ ] Set up monitoring alerts

## 🔄 Migration Strategy

### Safe Rollout

1. Deploy optimizations to staging first
2. Run both old and new stats services in parallel
3. Compare results for consistency
4. Gradually switch users to optimized service
5. Monitor performance metrics

### Rollback Plan

If issues occur:

1. Switch back to `UserProfileService.getUserStats()`
2. Disable cron job temporarily
3. Investigate and fix issues
4. Re-enable optimizations

---

🎯 **Expected Results**: 5-10x faster stats queries, reduced database load, better user experience.
