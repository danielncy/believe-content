export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();
  const { id } = params;
  const body = await request.json();
  const { action, notes, edited_text } = body as {
    action: 'approve' | 'reject' | 'regenerate' | 'edit';
    notes?: string;
    edited_text?: string;
  };

  // Fetch the current content for feedback logging
  const { data: content, error: fetchError } = await supabase
    .from('generated_content')
    .select('generated_text')
    .eq('id', id)
    .single();

  if (fetchError || !content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }

  if (action === 'approve') {
    const { error: updateError } = await supabase
      .from('generated_content')
      .update({ status: 'approved' })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Create approved_posts record
    await supabase.from('approved_posts').insert({
      generated_content_id: id,
      platform: 'facebook',
      status: 'scheduled',
    });

    // Log feedback
    await supabase.from('feedback_log').insert({
      feedback_type: 'content_approval',
      reference_table: 'generated_content',
      reference_id: id,
      action_taken: 'approved',
      status: 'logged',
      original_content: content.generated_text,
      applied_to_voice: false,
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'reject') {
    const { error: updateError } = await supabase
      .from('generated_content')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from('feedback_log').insert({
      feedback_type: 'content_rejection',
      reference_table: 'generated_content',
      reference_id: id,
      action_taken: 'rejected',
      status: 'logged',
      original_content: content.generated_text,
      feedback_notes: notes || null,
      applied_to_voice: false,
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'regenerate') {
    const { error: updateError } = await supabase
      .from('generated_content')
      .update({ status: 'revision_requested' })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from('feedback_log').insert({
      feedback_type: 'content_rejection',
      reference_table: 'generated_content',
      reference_id: id,
      action_taken: 'rejected',
      status: 'logged',
      original_content: content.generated_text,
      feedback_notes: notes || 'Regeneration requested',
      applied_to_voice: false,
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'edit') {
    if (!edited_text) {
      return NextResponse.json({ error: 'edited_text required' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('generated_content')
      .update({ generated_text: edited_text, status: 'approved' })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from('approved_posts').insert({
      generated_content_id: id,
      platform: 'facebook',
      status: 'scheduled',
    });

    await supabase.from('feedback_log').insert({
      feedback_type: 'content_approval',
      reference_table: 'generated_content',
      reference_id: id,
      action_taken: 'edited',
      status: 'logged',
      original_content: content.generated_text,
      edited_content: edited_text,
      applied_to_voice: false,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
