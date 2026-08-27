import type { Request, Response } from 'express';
import { SocialMediaPostService } from '../services/SocialMediaPostService.js';
import { HttpStatus } from '../utils/httpStatus.js';

export class SocialMediaPostController {
  constructor(private postService: SocialMediaPostService) {}

  getAllPosts = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      let posts;
      if (user.role === 'admin' || user.role === 'social_media_manager') {
        posts = await this.postService.getAllPosts();
      } else {
        posts = await this.postService.getPostsByCreator(user.id);
      }
      res.status(HttpStatus.OK).json(posts);
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
      if (user.role !== 'admin' && user.role !== 'social_media_manager' && post.creator_id !== user.id) {
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
      const postData = {
        ...req.body,
        creator_id: user.id
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
      if (user.role !== 'admin' && user.role !== 'social_media_manager' && existing.creator_id !== user.id) {
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
      if (user.role !== 'admin' && user.role !== 'social_media_manager' && existing.creator_id !== user.id) {
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
      const { start, end } = req.query;
      if (!start || !end) {
        res.status(HttpStatus.BAD_REQUEST).json({ message: 'Start and end date range is required' });
        return;
      }
      const posts = await this.postService.getScheduledPosts(start as string, end as string);
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
