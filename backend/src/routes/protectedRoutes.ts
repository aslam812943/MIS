import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { HttpStatus } from '../utils/httpStatus.js';

const router = Router();

/**
 * A protected endpoint that requires a valid JWT token.
 */
router.get('/dashboard-data', requireAuth, (req, res) => {
  res.status(HttpStatus.OK).json({
    message: 'Access granted to protected dashboard data!',
    data: {
      stats: { users: 10, reports: 42 },
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
