import type { Request, Response } from 'express';
import { SocialMediaAnalyticsService } from '../services/SocialMediaAnalyticsService.js';
import { HttpStatus } from '../utils/httpStatus.js';

export class SocialMediaAnalyticsController {
  constructor(private analyticsService: SocialMediaAnalyticsService) {}

  getAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { start, end } = req.query;
      if (!start || !end) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Start and end date range is required' });
        return;
      }
      const data = await this.analyticsService.getAnalytics(start as string, end as string);
      res.status(HttpStatus.OK).json(data);
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  };

  getCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
      const campaigns = await this.analyticsService.getCampaigns();
      res.status(HttpStatus.OK).json(campaigns);
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  };

  createCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const campaignData = {
        ...req.body,
        created_by: user.id
      };
      const campaign = await this.analyticsService.createCampaign(campaignData);
      res.status(HttpStatus.CREATED).json(campaign);
    } catch (error: any) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
    }
  };
}
