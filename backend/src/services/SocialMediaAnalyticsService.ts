import type { ISocialMediaAnalyticsRepository } from '../repositories/interfaces/ISocialMediaAnalyticsRepository.js';
import type { SocialMediaCampaign, SocialMediaAnalyticsRecord } from '../models/socialMediaCampaign.model.js';

export class SocialMediaAnalyticsService {
  constructor(private analyticsRepository: ISocialMediaAnalyticsRepository) {}

  async getAnalytics(start: string, end: string): Promise<SocialMediaAnalyticsRecord[]> {
    return this.analyticsRepository.findAnalyticsInRange(start, end);
  }

  async getCampaigns(): Promise<SocialMediaCampaign[]> {
    return this.analyticsRepository.findCampaigns();
  }

  async createCampaign(campaign: Partial<SocialMediaCampaign>): Promise<SocialMediaCampaign> {
    if (!campaign.title) {
      throw new Error('Campaign title is required');
    }
    return this.analyticsRepository.createCampaign(campaign);
  }
}
