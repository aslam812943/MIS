import { Router } from 'express';
import multer from 'multer';
import { SocialMediaPostController } from '../controllers/SocialMediaPostController.js';
import { SocialMediaPostService } from '../services/SocialMediaPostService.js';
import { SupabaseSocialMediaPostRepository } from '../repositories/SupabaseSocialMediaPostRepository.js';
import { SocialMediaAnalyticsController } from '../controllers/SocialMediaAnalyticsController.js';
import { SocialMediaAnalyticsService } from '../services/SocialMediaAnalyticsService.js';
import { SupabaseSocialMediaAnalyticsRepository } from '../repositories/SupabaseSocialMediaAnalyticsRepository.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const postRepository = new SupabaseSocialMediaPostRepository();
const postService = new SocialMediaPostService(postRepository);
const postController = new SocialMediaPostController(postService);

const analyticsRepository = new SupabaseSocialMediaAnalyticsRepository();
const analyticsService = new SocialMediaAnalyticsService(analyticsRepository);
const analyticsController = new SocialMediaAnalyticsController(analyticsService);

router.use(requireAuth);

// Post Management
router.get('/creators', postController.getCreators);
router.get('/posts', postController.getAllPosts);
router.get('/posts/scheduled', postController.getScheduled);
router.get('/posts/:id', postController.getPostById);
router.post('/posts', postController.createPost);
router.patch('/posts/:id', postController.updatePost);
router.delete('/posts/:id', postController.deletePost);
router.post('/upload-asset', upload.single('file'), postController.uploadAsset);

// Campaigns & Analytics
router.get('/analytics', analyticsController.getAnalytics);
router.get('/campaigns', analyticsController.getCampaigns);
router.post('/campaigns', analyticsController.createCampaign);

export default router;
