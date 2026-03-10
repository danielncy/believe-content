// BELIEVE System — Database Types
// Auto-aligned with supabase/migrations/20260309_001_initial_schema.sql

export type WatchlistPageStatus = 'active' | 'paused' | 'archived';
export type ScrapedPostStatus = 'new' | 'processing' | 'used' | 'rejected';
export type GeneratedContentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'revision_requested';
export type ApprovedPostStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'awaiting_2fa';
export type WhatsAppMessageStatus = 'received' | 'drafts_generated' | 'reply_approved' | 'sent' | 'failed';
export type VoiceSampleStatus = 'active' | 'archived';
export type FeedbackLogStatus = 'logged' | 'processed' | 'applied';

export type ContentType = 'facebook_post' | 'whatsapp_reply';
export type Direction = 'inbound' | 'outbound';
export type SourceType = 'facebook_post' | 'whatsapp_message' | 'manual_input' | 'video_transcript';
export type FeedbackType = 'content_approval' | 'content_rejection' | 'draft_selection' | 'voice_correction' | 'general';
export type FeedbackAction = 'approved' | 'rejected' | 'edited' | 'selected_draft';
export type Language = 'zh' | 'en' | 'mixed';
export type Region = 'SG' | 'MY';

// ============================================================
// Table Row Types
// ============================================================

export interface WatchlistPage {
  id: string;
  created_at: string;
  updated_at: string;
  status: WatchlistPageStatus;
  page_name: string;
  page_url: string;
  platform: string;
  category: string | null;
  region: Region | null;
  last_scraped_at: string | null;
  scrape_frequency_hours: number;
  notes: string | null;
}

export interface ScrapedPost {
  id: string;
  created_at: string;
  updated_at: string;
  status: ScrapedPostStatus;
  watchlist_page_id: string;
  source_url: string | null;
  original_text: string;
  original_media_urls: string[] | null;
  post_date: string | null;
  engagement_score: number;
  language: string | null;
  topic_tags: string[] | null;
}

export interface GeneratedContent {
  id: string;
  created_at: string;
  updated_at: string;
  status: GeneratedContentStatus;
  scraped_post_id: string | null;
  content_type: ContentType;
  generated_text: string;
  generated_image_url: string | null;
  image_prompt: string | null;
  voice_style: string | null;
  language_mix: string;
  iris_model: string;
  revision_notes: string | null;
  version: number;
}

export interface ApprovedPost {
  id: string;
  created_at: string;
  updated_at: string;
  status: ApprovedPostStatus;
  generated_content_id: string;
  platform: string;
  scheduled_for: string | null;
  published_at: string | null;
  published_url: string | null;
  phantom_session_id: string | null;
  error_message: string | null;
}

export interface WhatsAppMessage {
  id: string;
  created_at: string;
  updated_at: string;
  status: WhatsAppMessageStatus;
  direction: Direction;
  twilio_message_sid: string | null;
  from_number: string;
  to_number: string;
  body: string | null;
  media_url: string | null;
  contact_name: string | null;
  thread_id: string | null;
  parent_message_id: string | null;
  draft_options: DraftOption[] | null;
  selected_draft_index: 1 | 2 | 3 | null;
}

export interface DraftOption {
  index: number;
  text: string;
  tone: string;
}

export interface VoiceSample {
  id: string;
  created_at: string;
  updated_at: string;
  status: VoiceSampleStatus;
  source_type: SourceType;
  content: string;
  language: Language | null;
  tone: string | null;
  context_notes: string | null;
  word_count: number | null;
  quality_rating: number;
  tags: string[];
}

export interface FeedbackLog {
  id: string;
  created_at: string;
  updated_at: string;
  status: FeedbackLogStatus;
  feedback_type: FeedbackType;
  reference_table: string | null;
  reference_id: string | null;
  action_taken: FeedbackAction | null;
  original_content: string | null;
  edited_content: string | null;
  feedback_notes: string | null;
  applied_to_voice: boolean;
}

// ============================================================
// Insert types (omit auto-generated fields)
// ============================================================

export type WatchlistPageInsert = Omit<WatchlistPage, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ScrapedPostInsert = Omit<ScrapedPost, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type GeneratedContentInsert = Omit<GeneratedContent, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ApprovedPostInsert = Omit<ApprovedPost, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type WhatsAppMessageInsert = Omit<WhatsAppMessage, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type VoiceSampleInsert = Omit<VoiceSample, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type FeedbackLogInsert = Omit<FeedbackLog, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
