import type { SocialMediaCampaign, SocialMediaAnalyticsRecord } from '../../models/socialMediaCampaign.model.js';

export interface ISocialMediaAnalyticsRepository {
  findAnalyticsInRange(start: string, end: string): Promise<SocialMediaAnalyticsRecord[]>;
  findCampaigns(): Promise<SocialMediaCampaign[]>;
  createCampaign(campaign: Partial<SocialMediaCampaign>): Promise<SocialMediaCampaign>;
}
