-- BELIEVE System — Initial Schema
-- Sprint 1 / ROOTS
-- 7 tables powering Module A (Facebook Pipeline) and Module B (WhatsApp Assistant)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. watchlist_pages
-- SCOUT's target list — Facebook pages to monitor for 美业 content
-- ============================================================
create table watchlist_pages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  page_name text not null,
  page_url text not null,
  platform text not null default 'facebook',
  category text,
  region text check (region in ('SG', 'MY')),
  last_scraped_at timestamptz,
  scrape_frequency_hours int not null default 24,
  notes text
);

-- ============================================================
-- 2. scraped_posts
-- Raw content SCOUT pulls from watched pages
-- ============================================================
create table scraped_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'processing', 'used', 'rejected')),
  watchlist_page_id uuid not null references watchlist_pages(id) on delete cascade,
  source_url text,
  original_text text not null,
  original_media_urls text[],
  post_date timestamptz,
  engagement_score int default 0,
  language text,
  topic_tags text[]
);

-- ============================================================
-- 3. generated_content
-- IRIS rewrites in Daniel's voice, Gemini generates images
-- ============================================================
create table generated_content (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'revision_requested')),
  scraped_post_id uuid references scraped_posts(id) on delete set null,
  content_type text not null check (content_type in ('facebook_post', 'whatsapp_reply')),
  generated_text text not null,
  generated_image_url text,
  image_prompt text,
  voice_style text,
  language_mix text not null default '70zh_30en',
  iris_model text not null default 'claude-opus-4-6',
  revision_notes text,
  version int not null default 1
);

-- ============================================================
-- 4. approved_posts
-- Content that passed STAGE review — ready for PHANTOM to publish
-- ============================================================
create table approved_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('scheduled', 'publishing', 'published', 'failed')),
  generated_content_id uuid not null references generated_content(id) on delete cascade,
  platform text not null default 'facebook',
  scheduled_for timestamptz,
  published_at timestamptz,
  published_url text,
  phantom_session_id text,
  error_message text
);

-- ============================================================
-- 5. whatsapp_messages
-- Module B — every inbound/outbound WhatsApp message
-- ============================================================
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'received' check (status in ('received', 'drafts_generated', 'reply_approved', 'sent', 'failed')),
  direction text not null check (direction in ('inbound', 'outbound')),
  twilio_message_sid text,
  from_number text not null,
  to_number text not null,
  body text,
  media_url text,
  contact_name text,
  thread_id text,
  parent_message_id uuid references whatsapp_messages(id) on delete set null,
  draft_options jsonb,
  selected_draft_index int check (selected_draft_index in (1, 2, 3))
);

-- ============================================================
-- 6. voice_samples
-- IRIS's training data — examples of Daniel's writing/speaking style
-- ============================================================
create table voice_samples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'archived')),
  source_type text not null check (source_type in ('facebook_post', 'whatsapp_message', 'manual_input', 'video_transcript')),
  content text not null,
  language text check (language in ('zh', 'en', 'mixed')),
  tone text,
  context_notes text,
  word_count int
);

-- ============================================================
-- 7. feedback_log
-- Every decision Daniel makes — trains the system to improve
-- ============================================================
create table feedback_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'logged' check (status in ('logged', 'processed', 'applied')),
  feedback_type text not null check (feedback_type in ('content_approval', 'content_rejection', 'draft_selection', 'voice_correction', 'general')),
  reference_table text,
  reference_id uuid,
  action_taken text check (action_taken in ('approved', 'rejected', 'edited', 'selected_draft')),
  original_content text,
  edited_content text,
  feedback_notes text,
  applied_to_voice boolean not null default false
);

-- ============================================================
-- Indexes for performance
-- ============================================================
create index idx_scraped_posts_watchlist on scraped_posts(watchlist_page_id);
create index idx_scraped_posts_status on scraped_posts(status);
create index idx_generated_content_status on generated_content(status);
create index idx_generated_content_scraped on generated_content(scraped_post_id);
create index idx_approved_posts_status on approved_posts(status);
create index idx_approved_posts_scheduled on approved_posts(scheduled_for);
create index idx_whatsapp_messages_thread on whatsapp_messages(thread_id);
create index idx_whatsapp_messages_status on whatsapp_messages(status);
create index idx_whatsapp_messages_direction on whatsapp_messages(direction);
create index idx_feedback_log_reference on feedback_log(reference_table, reference_id);
create index idx_voice_samples_status on voice_samples(status);
create index idx_watchlist_pages_status on watchlist_pages(status);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_watchlist_pages_updated before update on watchlist_pages for each row execute function update_updated_at();
create trigger trg_scraped_posts_updated before update on scraped_posts for each row execute function update_updated_at();
create trigger trg_generated_content_updated before update on generated_content for each row execute function update_updated_at();
create trigger trg_approved_posts_updated before update on approved_posts for each row execute function update_updated_at();
create trigger trg_whatsapp_messages_updated before update on whatsapp_messages for each row execute function update_updated_at();
create trigger trg_voice_samples_updated before update on voice_samples for each row execute function update_updated_at();
create trigger trg_feedback_log_updated before update on feedback_log for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security (enable, policies added when auth is set up)
-- ============================================================
alter table watchlist_pages enable row level security;
alter table scraped_posts enable row level security;
alter table generated_content enable row level security;
alter table approved_posts enable row level security;
alter table whatsapp_messages enable row level security;
alter table voice_samples enable row level security;
alter table feedback_log enable row level security;
