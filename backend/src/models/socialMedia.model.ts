export interface SocialMediaPost {
  id: string;
  creator_id: string;
  creator_name?: string;
  title: string;
  caption?: string;
  platform: 'Instagram' | 'YouTube' | 'TikTok' | 'Facebook' | 'LinkedIn' | 'X';
  content_type: 'Reel' | 'Short' | 'Post' | 'Story' | 'Video';
  status: 'Idea' | 'Scripting' | 'Filming' | 'Editing' | 'Scheduled' | 'Published' | 'Needs Review';
  scheduled_at?: string;
  media_url?: string;
  script?: string;
  created_at?: string;
  updated_at?: string;
}
