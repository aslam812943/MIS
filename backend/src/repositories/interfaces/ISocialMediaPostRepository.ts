import type { SocialMediaPost } from "../../models/socialMedia.model.js";
 
export interface CreatorProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: string;
}
 
export interface ISocialMediaPostRepository {
  findById(id: string): Promise<SocialMediaPost | null>;
  findAll(): Promise<SocialMediaPost[]>;
  findByCreatorId(creatorId: string): Promise<SocialMediaPost[]>;
  create(post: Partial<SocialMediaPost>): Promise<SocialMediaPost>;
  update(id: string, post: Partial<SocialMediaPost>): Promise<SocialMediaPost>;
  delete(id: string): Promise<void>;
  findScheduledInRange(start: string, end: string, creatorId?: string): Promise<SocialMediaPost[]>;
  findCreators(): Promise<CreatorProfile[]>;
}