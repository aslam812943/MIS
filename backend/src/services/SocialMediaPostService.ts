import type { ISocialMediaPostRepository } from '../repositories/interfaces/ISocialMediaPostRepository.js';
import type { SocialMediaPost } from '../models/socialMedia.model.js';
import { supabase } from '../config/supabase.js';

export class SocialMediaPostService {
  constructor(private postRepository: ISocialMediaPostRepository) {}

  async getPostById(id: string): Promise<SocialMediaPost | null> {
    return this.postRepository.findById(id);
  }

  async getAllPosts(): Promise<SocialMediaPost[]> {
    return this.postRepository.findAll();
  }

  async getPostsByCreator(creatorId: string): Promise<SocialMediaPost[]> {
    return this.postRepository.findByCreatorId(creatorId);
  }

  async createPost(post: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    if (!post.title) {
      throw new Error('Post title is required');
    }
    if (!post.platform) {
      throw new Error('Target platform is required');
    }
    if (!post.content_type) {
      throw new Error('Content type is required');
    }
    return this.postRepository.create(post);
  }

  async updatePost(id: string, post: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    const existing = await this.postRepository.findById(id);
    if (!existing) {
      throw new Error('Post not found');
    }
    return this.postRepository.update(id, post);
  }

  async deletePost(id: string): Promise<void> {
    const existing = await this.postRepository.findById(id);
    if (!existing) {
      throw new Error('Post not found');
    }
    return this.postRepository.delete(id);
  }

  async getScheduledPosts(start: string, end: string): Promise<SocialMediaPost[]> {
    return this.postRepository.findScheduledInRange(start, end);
  }

  /**
   * Upload asset media file to content-assets bucket
   * @param fileName Name of the destination file
   * @param fileBuffer Buffer containing the file data
   * @param mimeType Mime type of the file
   */
  async uploadAsset(fileName: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    const uniqueName = `${Date.now()}-${fileName}`;
    const { data, error } = await supabase.storage
      .from('content-assets')
      .upload(uniqueName, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('content-assets')
      .getPublicUrl(uniqueName);

    return urlData.publicUrl;
  }
}
