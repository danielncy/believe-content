-- Add 'awaiting_2fa' status to approved_posts for PHANTOM 2FA flow
ALTER TABLE approved_posts DROP CONSTRAINT approved_posts_status_check;
ALTER TABLE approved_posts ADD CONSTRAINT approved_posts_status_check
  CHECK (status IN ('scheduled', 'publishing', 'published', 'failed', 'awaiting_2fa'));
