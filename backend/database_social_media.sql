-- DATABASE SCHEMA FOR SOCIAL MEDIA & CONTENT CREATION MODULE
-- Run these queries in your Supabase SQL Editor.

-- 1. UPDATE PROFILE ROLE CHECK CONSTRAINT
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'ceo', 'managing_director', 'director', 'executive', 'hod', 'regional_manager', 'employee', 'hr', 'content_creator', 'social_media_manager'));

-- 2. CREATE SOCIAL MEDIA POSTS TABLE
CREATE TABLE IF NOT EXISTS social_media_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    caption TEXT,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('Instagram', 'YouTube', 'TikTok', 'Facebook', 'LinkedIn', 'X')),
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('Reel', 'Short', 'Post', 'Story', 'Video')),
    status VARCHAR(50) NOT NULL DEFAULT 'Idea' CHECK (status IN ('Idea', 'Scripting', 'Filming', 'Editing', 'Scheduled', 'Published', 'Needs Review')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    media_url TEXT,
    script TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_social_posts_creator_id ON social_media_posts(creator_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_media_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_at ON social_media_posts(scheduled_at);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES
DROP POLICY IF EXISTS "Service role full access social_media_posts" ON social_media_posts;
CREATE POLICY "Service role full access social_media_posts" ON social_media_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users policies for visual safety
DROP POLICY IF EXISTS "Authenticated users can view social_media_posts" ON social_media_posts;
CREATE POLICY "Authenticated users can view social_media_posts" ON social_media_posts 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Creators can modify their own posts" ON social_media_posts;
CREATE POLICY "Creators can modify their own posts" ON social_media_posts 
    FOR ALL TO authenticated USING (auth.uid() = creator_id OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'social_media_manager'))));

-- 6. CREATE SOCIAL MEDIA ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS social_media_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('Instagram', 'YouTube', 'TikTok', 'Facebook', 'LinkedIn', 'X')),
    followers_gained INTEGER DEFAULT 0 NOT NULL,
    followers_lost INTEGER DEFAULT 0 NOT NULL,
    likes_count INTEGER DEFAULT 0 NOT NULL,
    comments_count INTEGER DEFAULT 0 NOT NULL,
    shares_count INTEGER DEFAULT 0 NOT NULL,
    impressions_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(date, platform)
);

-- 7. CREATE CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS social_media_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add campaign_id link to social_media_posts table
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES social_media_campaigns(id) ON DELETE SET NULL;

-- 8. ENABLE ROW LEVEL SECURITY FOR NEW TABLES
ALTER TABLE social_media_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_campaigns ENABLE ROW LEVEL SECURITY;

-- 9. RLS POLICIES FOR NEW TABLES
DROP POLICY IF EXISTS "Service role full access analytics" ON social_media_analytics;
CREATE POLICY "Service role full access analytics" ON social_media_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users view analytics" ON social_media_analytics;
CREATE POLICY "Authenticated users view analytics" ON social_media_analytics FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role full access campaigns" ON social_media_campaigns;
CREATE POLICY "Service role full access campaigns" ON social_media_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users view campaigns" ON social_media_campaigns;
CREATE POLICY "Authenticated users view campaigns" ON social_media_campaigns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Managers can modify campaigns" ON social_media_campaigns;
CREATE POLICY "Managers can modify campaigns" ON social_media_campaigns FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'social_media_manager')));
