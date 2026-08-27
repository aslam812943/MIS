export interface SocialMediaCampaign {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  created_at?: string;
}

export interface SocialMediaAnalyticsRecord {
  id: string;
  date: string;
  platform: 'Instagram' | 'YouTube' | 'TikTok' | 'Facebook' | 'LinkedIn' | 'X';
  followers_gained: number;
  followers_lost: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  impressions_count: number;
  created_at?: string;
}
