import type { Request, Response } from 'express';
import { raService } from '../services/RAService.js';

export class RAController {
  // ── Package Endpoints ─────────────────────────
  async getPackages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const activeOnly = req.query.active === 'true';
      const packages = await raService.getPackages(userId, activeOnly);
      res.json(packages);
    } catch (error: any) {
      console.error('Error fetching RA packages:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch packages' });
    }
  }

  async createPackage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const pkg = await raService.createPackage(req.body, userId);
      res.status(201).json({
        message: 'Package created successfully',
        package: pkg
      });
    } catch (error: any) {
      console.error('Error creating RA package:', error);
      res.status(400).json({ error: error.message || 'Failed to create package' });
    }
  }

  async updatePackage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const id = String(req.params.id || '');
      const updated = await raService.updatePackage(id, req.body, userId);
      res.json({
        message: 'Package updated successfully',
        package: updated
      });
    } catch (error: any) {
      console.error('Error updating RA package:', error);
      res.status(400).json({ error: error.message || 'Failed to update package' });
    }
  }

  async deletePackage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const id = String(req.params.id || '');
      await raService.deletePackage(id, userId);
      res.json({ message: 'Package deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting RA package:', error);
      res.status(400).json({ error: error.message || 'Failed to delete package' });
    }
  }

  // ── Dashboard & Client Endpoints ───────────────
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const stats = await raService.getDashboardStats(userId, branchId);
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching RA dashboard stats:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch dashboard stats' });
    }
  }

  async getClients(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const search = req.query.search ? String(req.query.search) : undefined;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const pkg = req.query.package ? String(req.query.package) : undefined;
      const kraStatus = req.query.kraStatus ? String(req.query.kraStatus) : undefined;

      const clients = await raService.getClients(userId, {
        search,
        branchId,
        package: pkg,
        kraStatus
      });
      res.json(clients);
    } catch (error: any) {
      console.error('Error fetching RA clients:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch clients' });
    }
  }

  async getClientById(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const id = String(req.params.id || '');
      const client = await raService.getClientById(id, userId);
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      res.json(client);
    } catch (error: any) {
      console.error('Error fetching RA client details:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch client details' });
    }
  }

  async createClient(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const client = await raService.createClient(req.body, userId);
      res.status(201).json({
        message: 'Client created successfully',
        client
      });
    } catch (error: any) {
      console.error('Error creating RA client:', error);
      res.status(400).json({ error: error.message || 'Failed to create client' });
    }
  }

  async updateClient(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const id = String(req.params.id || '');
      const updated = await raService.updateClient(id, req.body, userId);
      res.json({
        message: 'Client updated successfully',
        client: updated
      });
    } catch (error: any) {
      console.error('Error updating RA client:', error);
      res.status(400).json({ error: error.message || 'Failed to update client' });
    }
  }

  async deleteClient(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const id = String(req.params.id || '');
      await raService.deleteClient(id, userId);
      res.json({ message: 'Client deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting RA client:', error);
      res.status(400).json({ error: error.message || 'Failed to delete client' });
    }
  }

  async getPackageReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const report = await raService.getPackageReport(userId, branchId);
      res.json(report);
    } catch (error: any) {
      console.error('Error fetching package report:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch package report' });
    }
  }

  async getPayments(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const search = req.query.search ? String(req.query.search) : undefined;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const payments = await raService.getPayments(userId, search, branchId);
      res.json(payments);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch payments' });
    }
  }

  async getRenewals(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const days = Number(req.query.days) || 30;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const renewals = await raService.getRenewals(days, userId, branchId);
      res.json(renewals);
    } catch (error: any) {
      console.error('Error fetching renewals:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch renewals' });
    }
  }

  async getExpired(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const expired = await raService.getExpired(userId, branchId);
      res.json(expired);
    } catch (error: any) {
      console.error('Error fetching expired subscriptions:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch expired subscriptions' });
    }
  }

  async getKycReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const report = await raService.getKycReport(userId, branchId);
      res.json(report);
    } catch (error: any) {
      console.error('Error fetching KYC report:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch KYC report' });
    }
  }

  async getTestimonials(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const search = req.query.search ? String(req.query.search) : undefined;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
      const featuredOnly = req.query.featured === 'true';

      const testimonials = await raService.getTestimonials(userId, {
        search,
        branchId,
        clientId,
        featuredOnly
      });
      res.json(testimonials);
    } catch (error: any) {
      console.error('Error fetching testimonials:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch testimonials' });
    }
  }

  async createTestimonial(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const testimonial = await raService.createTestimonial(req.body, userId);
      res.status(201).json({
        message: 'Testimonial added successfully',
        testimonial
      });
    } catch (error: any) {
      console.error('Error creating testimonial:', error);
      res.status(400).json({ error: error.message || 'Failed to create testimonial' });
    }
  }

  async updateTestimonial(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const id = String(req.params.id || '');
      const updated = await raService.updateTestimonial(id, req.body, userId);
      res.json({
        message: 'Testimonial updated successfully',
        testimonial: updated
      });
    } catch (error: any) {
      console.error('Error updating testimonial:', error);
      res.status(400).json({ error: error.message || 'Failed to update testimonial' });
    }
  }

  async deleteTestimonial(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const id = String(req.params.id || '');
      await raService.deleteTestimonial(id, userId);
      res.json({ message: 'Testimonial deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting testimonial:', error);
      res.status(400).json({ error: error.message || 'Failed to delete testimonial' });
    }
  }

  async getPeriodicReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const periodType = (req.query.periodType === 'weekly' || req.query.periodType === 'custom') ? req.query.periodType : 'monthly';
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] || '';
      const todayStr = now.toISOString().split('T')[0] || '';
      const startDate = req.query.startDate ? String(req.query.startDate) : firstDay;
      const endDate = req.query.endDate ? String(req.query.endDate) : todayStr;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;

      const report = await raService.getPeriodicReport(userId, {
        periodType,
        startDate,
        endDate,
        branchId
      });
      res.json(report);
    } catch (error: any) {
      console.error('Error generating periodic report:', error);
      res.status(500).json({ error: error.message || 'Failed to generate periodic report' });
    }
  }
}

export const raController = new RAController();
