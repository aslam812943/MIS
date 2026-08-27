import { supabase } from '../config/supabase.js';
import type { SocialMediaCampaign, SocialMediaAnalyticsRecord } from '../models/socialMediaCampaign.model.js';
import type { ISocialMediaAnalyticsRepository } from './interfaces/ISocialMediaAnalyticsRepository.js';

export class SupabaseSocialMediaAnalyticsRepository implements ISocialMediaAnalyticsRepository {
  async findAnalyticsInRange(start: string, end: string): Promise<SocialMediaAnalyticsRecord[]> {
    const { data, error } = await supabase
      .from('social_media_analytics')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async findCampaigns(): Promise<SocialMediaCampaign[]> {
    const { data, error } = await supabase
      .from('social_media_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async createCampaign(campaign: Partial<SocialMediaCampaign>): Promise<SocialMediaCampaign> {
    const { data, error } = await supabase
      .from('social_media_campaigns')
      .insert([campaign])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
