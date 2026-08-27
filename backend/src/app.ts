import express from 'express';
import type { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loginRateLimiter, apiRateLimiter } from './middlewares/rateLimiter.js';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import protectedRoutes from './routes/protectedRoutes.js';
import externalRoutes from './routes/externalRoutes.js';
import socialMediaRoutes from './routes/socialMediaRoutes.js';

dotenv.config();

const app: Application = express();

// Middlewares
app.use(apiRateLimiter); // Apply general rate limit to all requests
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', protectedRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/social-media', socialMediaRoutes);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'MIS Backend is running' });
});

// Basic Error Handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
  const errorStack = err instanceof Error ? err.stack : undefined;
  
  console.error(errorStack);
  res.status(500).json({
    status: 'Error',
    message: errorMessage
  });
});

export default app;
