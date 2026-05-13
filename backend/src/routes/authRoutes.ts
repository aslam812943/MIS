import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { AuthService } from '../services/AuthService.js';
import { SupabaseUserRepository } from '../repositories/SupabaseUserRepository.js';

const router = Router();

// Dependency Injection
const userRepository = new SupabaseUserRepository();
const authService = new AuthService(userRepository);
const authController = new AuthController(authService);

router.post('/login', authController.login);

export default router;
