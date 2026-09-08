import type { Request, Response } from 'express';
import { SocialMediaPostService } from '../services/SocialMediaPostService.js';
import { HttpStatus } from '../utils/httpStatus.js';

const isManagerOrAdmin = (role: string): boolean => {
  return [
    'admin',
    'ceo',
    'managing_director',
    'director',
    'executive',
    'social_media_manager',
    'hod',
    'regional_manager'
  ].includes(role);
};

export class SocialMediaPostController {
  constructor(private postService: SocialMediaPostService) {}

  getAllPosts = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const isManager = isManagerOrAdmin(user?.role || '');
      const creatorIdQuery = req.query.creator_id as string | undefined;

      let posts;
      if (isManager) {
        if (creatorIdQuery && creatorIdQuery !== 'all') {
          posts = await this.postService.getPostsByCreator(creatorIdQuery);
        } else {
          posts = await this.postService.getAllPosts();
        }
      } else {
        posts = await this.postService.getPostsByCreator(user.id);
      }
      res.status(HttpStatus.OK).json(posts);
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  };

  getCreators = async (_req: Request, res: Response): Promise<void> => {
    try {
      const creators = await this.postService.getCreators();
      res.status(HttpStatus.OK).json(creators);
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  };

  getPostById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const post = await this.postService.getPostById(id as string);
      if (!post) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Post not found' });
        return;
      }
      const user = (req as any).user;
      const isManager = isManagerOrAdmin(user?.role || '');
      if (!isManager && post.creator_id !== user.id) {
        res.status(HttpStatus.FORBIDDEN).json({ message: 'Access denied' });
        return;
      }
      res.status(HttpStatus.OK).json(post);
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  };

  createPost = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const isManager = isManagerOrAdmin(user?.role || '');
      const postData = {
        ...req.body,
        creator_id: (isManager && req.body.creator_id) ? req.body.creator_id : user.id
      };
      const post = await this.postService.createPost(postData);
      res.status(HttpStatus.CREATED).json(post);
    } catch (error: any) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
    }
  };

  updatePost = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const existing = await this.postService.getPostById(id as string);
      if (!existing) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Post not found' });
        return;
      }
      const user = (req as any).user;
      const isManager = isManagerOrAdmin(user?.role || '');
      if (!isManager && existing.creator_id !== user.id) {
        res.status(HttpStatus.FORBIDDEN).json({ message: 'Access denied' });
        return;
      }
      const post = await this.postService.updatePost(id as string, req.body);
      res.status(HttpStatus.OK).json(post);
    } catch (error: any) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
    }
  };

  deletePost = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const existing = await this.postService.getPostById(id as string);
      if (!existing) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Post not found' });
        return;
      }
      const user = (req as any).user;
      const isManager = isManagerOrAdmin(user?.role || '');
      if (!isManager && existing.creator_id !== user.id) {
        res.status(HttpStatus.FORBIDDEN).json({ message: 'Access denied' });
        return;
      }
      await this.postService.deletePost(id as string);
      res.status(HttpStatus.OK).json({ message: 'Post deleted successfully' });
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  };

  getScheduled = async (req: Request, res: Response): Promise<void> => {
    try {
      const { start, end, creator_id } = req.query;
      if (!start || !end) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Start and end date range is required' });
        return;
      }
      const user = (req as any).user;
      const isManager = isManagerOrAdmin(user?.role || '');
      const targetCreatorId = isManager
        ? (creator_id && creator_id !== 'all' ? (creator_id as string) : undefined)
        : user.id;

      const posts = await this.postService.getScheduledPosts(start as string, end as string, targetCreatorId);
      res.status(HttpStatus.OK).json(posts);
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  };

  uploadAsset = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'No file uploaded' });
        return;
      }
      const url = await this.postService.uploadAsset(
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype
      );
      res.status(HttpStatus.OK).json({ url });
    } catch (error: any) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  };
}
