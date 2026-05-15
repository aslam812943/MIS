import rateLimit from 'express-rate-limit';
import { HttpStatus } from '../utils/httpStatus.js';

/**
 * Rate limiter to prevent brute-force attacks on sensitive endpoints.
 * Limits users to 50 attempts per 5 minutes.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    status: 'Error',
    message: 'Too many login attempts. Please try again after 5 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  statusCode: HttpStatus.TOO_MANY_REQUESTS || 429
});

/**
 * General purpose rate limiter for standard API routes.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    status: 'Error',
    message: 'Too many requests from this IP, please try again later.'
  }
});
