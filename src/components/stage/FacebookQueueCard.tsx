'use client';

import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { timeAgo } from '@/lib/time';
import type { FacebookQueueItem } from '@/components/stage/FacebookCard';

interface FacebookQueueCardProps {
  item: FacebookQueueItem;
  onTap: (item: FacebookQueueItem) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function FacebookQueueCard({
  item,
  onTap,
  onApprove,
  onReject,
}: FacebookQueueCardProps) {
  const source = item.scraped_post?.watchlist_page;
  const preview = item.generated_text.slice(0, 80) + (item.generated_text.length > 80 ? '…' : '');
  const score = item.scraped_post?.engagement_score ?? 0;

  const { ref, handlers } = useSwipeGesture({
    onSwipeRight: () => onApprove(item.id),
    onSwipeLeft: () => onReject(item.id),
    onTap: () => onTap(item),
  });

  return (
    <div
      ref={ref}
      {...handlers}
      className="mx-4 mb-3 cursor-pointer select-none overflow-hidden rounded-2xl border border-neutral-800/60 bg-neutral-900 active:bg-neutral-800/80"
    >
      <div className="px-4 py-4">
        {/* Top row: source + time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
              {source?.page_name || 'Unknown'}
            </span>
            {score > 0 && (
              <span className="text-xs text-neutral-500">
                {score >= 100 ? '🔥' : '·'} {score}
              </span>
            )}
          </div>
          <span className="text-xs text-neutral-600">{timeAgo(item.created_at)}</span>
        </div>

        {/* Preview text — large, readable */}
        <p className="mt-3 text-[17px] leading-relaxed text-neutral-200">
          {preview}
        </p>

        {/* Bottom row: image indicator + voice style */}
        <div className="mt-3 flex items-center gap-2">
          {item.generated_image_url && (
            <span className="text-xs text-neutral-500">🖼 image</span>
          )}
          {item.voice_style && (
            <span className="text-xs text-neutral-600">{item.voice_style}</span>
          )}
        </div>
      </div>

      {/* Swipe hint — subtle */}
      <div className="flex items-center justify-between border-t border-neutral-800/40 px-4 py-1.5 text-[10px] text-neutral-700">
        <span>← reject</span>
        <span>approve →</span>
      </div>
    </div>
  );
}
