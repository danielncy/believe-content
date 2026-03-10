'use client';

import { useState, useRef, useEffect } from 'react';
import { timeAgo } from '@/lib/time';
import type { FacebookQueueItem } from '@/components/stage/FacebookCard';

interface FacebookReviewSheetProps {
  item: FacebookQueueItem;
  onApprove: (id: string, editedText?: string) => void;
  onReject: (id: string) => void;
  onClose: () => void;
}

export default function FacebookReviewSheet({
  item,
  onApprove,
  onReject,
  onClose,
}: FacebookReviewSheetProps) {
  const source = item.scraped_post?.watchlist_page;
  const score = item.scraped_post?.engagement_score ?? 0;

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.generated_text);
  const [showOriginal, setShowOriginal] = useState(false);
  const [acting, setActing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and auto-resize textarea on edit
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editing]);

  function handleLongPress() {
    setEditing(true);
  }

  async function handleApprove() {
    setActing(true);
    const edited = editing && editText !== item.generated_text ? editText : undefined;
    onApprove(item.id, edited);
  }

  async function handleReject() {
    setActing(true);
    onReject(item.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/60">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-neutral-400 active:bg-neutral-800"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
            {source?.page_name || 'Unknown'}
          </span>
          {score > 0 && (
            <span className="text-xs text-neutral-500">
              {score >= 100 ? '🔥' : ''} {score}
            </span>
          )}
        </div>
        <span className="text-xs text-neutral-600">{timeAgo(item.created_at)}</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Generated image */}
        {item.generated_image_url && (
          <div className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.generated_image_url}
              alt="Generated"
              className="w-full rounded-2xl object-cover"
            />
          </div>
        )}

        {/* Main generated text — the soul of the post */}
        <div className="mt-6" onTouchStart={() => {}} onContextMenu={(e) => { e.preventDefault(); handleLongPress(); }}>
          {editing ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-blue-400">Editing</span>
                <button
                  onClick={() => { setEditing(false); setEditText(item.generated_text); }}
                  className="text-xs text-neutral-500 active:text-neutral-300"
                >
                  Cancel
                </button>
              </div>
              <textarea
                ref={textareaRef}
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-[18px] leading-relaxed text-white focus:border-blue-500 focus:outline-none"
                rows={6}
              />
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[18px] leading-relaxed text-white">
              {item.generated_text}
            </p>
          )}
        </div>

        {/* Voice style + language pills */}
        <div className="mt-4 flex gap-2">
          {item.voice_style && (
            <span className="rounded-full bg-neutral-800/80 px-3 py-1 text-xs text-neutral-400">
              {item.voice_style}
            </span>
          )}
          <span className="rounded-full bg-neutral-800/80 px-3 py-1 text-xs text-neutral-400">
            {item.language_mix}
          </span>
        </div>

        {/* Original post (collapsible) */}
        {item.scraped_post?.original_text && (
          <div className="mt-6">
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="text-xs font-medium uppercase tracking-wider text-neutral-600 active:text-neutral-400"
            >
              Original {showOriginal ? '▲' : '▼'}
            </button>
            {showOriginal && (
              <p className="mt-2 rounded-xl bg-neutral-900/60 p-4 text-sm leading-relaxed text-neutral-500">
                {item.scraped_post.original_text}
              </p>
            )}
          </div>
        )}

        {/* Edit hint */}
        {!editing && (
          <p className="mt-6 text-center text-xs text-neutral-700">
            Long press text to edit
          </p>
        )}
      </div>

      {/* Bottom action bar — pinned, thumb-reachable */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-800/60 bg-neutral-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg gap-3 px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            onClick={handleReject}
            disabled={acting}
            className="min-h-[52px] flex-1 rounded-2xl bg-red-950/60 text-base font-semibold text-red-400 transition-colors active:bg-red-900 disabled:opacity-50"
          >
            Reject
          </button>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              disabled={acting}
              className="min-h-[52px] w-14 rounded-2xl bg-neutral-800 text-sm text-neutral-400 transition-colors active:bg-neutral-700 disabled:opacity-50"
            >
              ✏️
            </button>
          )}
          <button
            onClick={handleApprove}
            disabled={acting}
            className="min-h-[52px] flex-[2] rounded-2xl bg-green-950/60 text-base font-semibold text-green-400 transition-colors active:bg-green-900 disabled:opacity-50"
          >
            {editing ? 'Save & Approve' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
