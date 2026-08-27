import api from './api';

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
  campaign_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SocialMediaCampaign {
  id: string;
  title: string;
  description?: string;
  created_by?: string;
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
}

export const socialMediaService = {
  async getPosts(): Promise<SocialMediaPost[]> {
    const response = await api.get<SocialMediaPost[]>('/social-media/posts');
    return response.data;
  },

  async getPostById(id: string): Promise<SocialMediaPost> {
    const response = await api.get<SocialMediaPost>(`/social-media/posts/${id}`);
    return response.data;
  },

  async createPost(post: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    const response = await api.post<SocialMediaPost>('/social-media/posts', post);
    return response.data;
  },

  async updatePost(id: string, post: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    const response = await api.patch<SocialMediaPost>(`/social-media/posts/${id}`, post);
    return response.data;
  },

  async deletePost(id: string): Promise<void> {
    await api.delete(`/social-media/posts/${id}`);
  },

  async getScheduledPosts(start: string, end: string): Promise<SocialMediaPost[]> {
    const response = await api.get<SocialMediaPost[]>('/social-media/posts/scheduled', {
      params: { start, end }
    });
    return response.data;
  },

  async uploadAsset(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<{ url: string }>('/social-media/upload-asset', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });

    return response.data.url;
  },

  // SMM Campaigns
  async getCampaigns(): Promise<SocialMediaCampaign[]> {
    const response = await api.get<SocialMediaCampaign[]>('/social-media/campaigns');
    return response.data;
  },

  async createCampaign(campaign: Partial<SocialMediaCampaign>): Promise<SocialMediaCampaign> {
    const response = await api.post<SocialMediaCampaign>('/social-media/campaigns', campaign);
    return response.data;
  },

  // SMM Analytics
  async getAnalytics(start: string, end: string): Promise<SocialMediaAnalyticsRecord[]> {
    const response = await api.get<SocialMediaAnalyticsRecord[]>('/social-media/analytics', {
      params: { start, end }
    });
    return response.data;
  }
};
