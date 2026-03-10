import { createClient } from '@supabase/supabase-js';

// Server-side client with service role key (for API routes / server actions)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
