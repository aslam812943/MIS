import { supabase, supabaseAdmin } from '../config/supabase.js';
import type { SocialMediaPost } from '../models/socialMedia.model.js';
import type { ISocialMediaPostRepository, CreatorProfile } from './interfaces/ISocialMediaPostRepository.js';

export class SupabaseSocialMediaPostRepository implements ISocialMediaPostRepository {
  private get client() {
    return supabaseAdmin || supabase;
  }

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
    const { data, error } = await this.client
      .from('social_media_posts')
      .select('*, profiles(full_name)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapRow(data);
  }

  async findAll(): Promise<SocialMediaPost[]> {
    const { data, error } = await this.client
      .from('social_media_posts')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => this.mapRow(row));
  }

  async findByCreatorId(creatorId: string): Promise<SocialMediaPost[]> {
    const { data, error } = await this.client
      .from('social_media_posts')
      .select('*, profiles(full_name)')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => this.mapRow(row));
  }

  async create(post: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    const { data, error } = await this.client
      .from('social_media_posts')
      .insert([post])
      .select('*, profiles(full_name)')
      .single();

    if (error) throw new Error(error.message);
    return this.mapRow(data);
  }

  async update(id: string, post: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    const { data, error } = await this.client
      .from('social_media_posts')
      .update(post)
      .eq('id', id)
      .select('*, profiles(full_name)')
      .single();

    if (error) throw new Error(error.message);
    return this.mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('social_media_posts')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async findScheduledInRange(start: string, end: string, creatorId?: string): Promise<SocialMediaPost[]> {
    let query = this.client
      .from('social_media_posts')
      .select('*, profiles(full_name)')
      .gte('scheduled_at', start)
      .lte('scheduled_at', end);

    if (creatorId && creatorId !== 'all') {
      query = query.eq('creator_id', creatorId);
    }

    const { data, error } = await query.order('scheduled_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => this.mapRow(row));
  }

  async findCreators(): Promise<CreatorProfile[]> {
    const { data: dept } = await this.client
      .from('departments')
      .select('id')
      .ilike('name', 'Content Creation')
      .maybeSingle();

    let query = this.client
      .from('profiles')
      .select('id, full_name, email, avatar_url, role')
      .eq('status', 'active');

    if (dept && dept.id) {
      query = query.or('role.eq.content_creator,department_id.eq.' + dept.id);
    } else {
      query = query.eq('role', 'content_creator');
    }

    const { data, error } = await query.order('full_name', { ascending: true });
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      full_name: row.full_name || row.email,
      email: row.email,
      avatar_url: row.avatar_url,
      role: row.role,
    }));
  }
}
