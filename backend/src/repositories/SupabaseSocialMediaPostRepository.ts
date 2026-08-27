import { supabase } from '../config/supabase.js';
import type { SocialMediaPost } from '../models/socialMedia.model.js';
import type { ISocialMediaPostRepository } from './interfaces/ISocialMediaPostRepository.js';

export class SupabaseSocialMediaPostRepository implements ISocialMediaPostRepository {
  private mapRow(row: any): SocialMediaPost {
    return {
      id: row.id,
      creator_id: row.creator_id,
      creator_name: row.profiles?.full_name || 'Unknown',
      title: row.title,
      caption: row.caption,
      platform: row.platform,
      content_type: row.content_type,
      status: row.status,
      scheduled_at: row.scheduled_at,
      media_url: row.media_url,
      script: row.script,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async findById(id: string): Promise<SocialMediaPost | null> {
    const { data, error } = await supabase
      .from('social_media_posts')
      .select('*, profiles(full_name)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapRow(data);
  }

  async findAll(): Promise<SocialMediaPost[]> {
    const { data, error } = await supabase
      .from('social_media_posts')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(row => this.mapRow(row));
  }

  async findByCreatorId(creatorId: string): Promise<SocialMediaPost[]> {
    const { data, error } = await supabase
      .from('social_media_posts')
      .select('*, profiles(full_name)')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(row => this.mapRow(row));
  }

  async create(post: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    const { data, error } = await supabase
      .from('social_media_posts')
      .insert([post])
      .select('*, profiles(full_name)')
      .single();

    if (error) throw new Error(error.message);
    return this.mapRow(data);
  }

  async update(id: string, post: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    const { data, error } = await supabase
      .from('social_media_posts')
      .update(post)
      .eq('id', id)
      .select('*, profiles(full_name)')
      .single();

    if (error) throw new Error(error.message);
    return this.mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('social_media_posts')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async findScheduledInRange(start: string, end: string): Promise<SocialMediaPost[]> {
    const { data, error } = await supabase
      .from('social_media_posts')
      .select('*, profiles(full_name)')
      .gte('scheduled_at', start)
      .lte('scheduled_at', end)
      .order('scheduled_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(row => this.mapRow(row));
  }
}
