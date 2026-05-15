import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController.js';
import { AuthService } from '../services/AuthService.js';
import { SupabaseUserRepository } from '../repositories/SupabaseUserRepository.js';
import { ProfileController } from '../controllers/ProfileController.js';
import { ProfileService } from '../services/ProfileService.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { loginRateLimiter } from '../middlewares/rateLimiter.js';

// Strict rate limit for sensitive profile actions
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 attempts per window
  message: { message: 'Too many profile update attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Dependency Injection
const userRepository = new SupabaseUserRepository();
const authService = new AuthService(userRepository);
const authController = new AuthController(authService);

const profileService = new ProfileService(userRepository);
const profileController = new ProfileController(profileService);

// Public Routes
router.post('/login', loginRateLimiter, authController.login);
router.post('/logout', authController.logout);

// Protected Profile Routes
router.get('/me', requireAuth, profileController.getMe);
router.patch('/profile', requireAuth, profileUpdateLimiter, upload.single('avatar'), profileController.updateProfile);
router.patch('/change-password', requireAuth, profileUpdateLimiter, profileController.changePassword);

export default router;
