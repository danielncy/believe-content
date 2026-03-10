import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('generated_content')
    .select(`
      *,
      scraped_post:scraped_posts (
        id,
        original_text,
        original_media_urls,
        post_date,
        engagement_score,
        watchlist_page:watchlist_pages (
          page_name,
          page_url
        )
      )
    `)
    .eq('status', 'pending_review')
    .eq('content_type', 'facebook_post')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
