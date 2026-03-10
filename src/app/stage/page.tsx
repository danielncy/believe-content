'use client';

import { useState, useEffect, useCallback } from 'react';
import TwoFABanner from '@/components/stage/TwoFABanner';
import FacebookQueueCard from '@/components/stage/FacebookQueueCard';
import FacebookReviewSheet from '@/components/stage/FacebookReviewSheet';
import EmptyQueue from '@/components/stage/EmptyQueue';
import type { FacebookQueueItem } from '@/components/stage/FacebookCard';

export default function StagePage() {
  const [items, setItems] = useState<FacebookQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewItem, setReviewItem] = useState<FacebookQueueItem | null>(null);
  const [flash, setFlash] = useState<'green' | 'red' | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stage/facebook');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function showFlash(color: 'green' | 'red') {
    setFlash(color);
    setTimeout(() => setFlash(null), 400);
  }

  async function handleAction(id: string, action: string, payload?: Record<string, string>) {
    setItems((prev) => prev.filter((item) => item.id !== id));

    if (reviewItem?.id === id) {
      const remaining = items.filter((item) => item.id !== id);
      if (remaining.length > 0) {
        const currentIndex = items.findIndex((item) => item.id === id);
        const nextIndex = Math.min(currentIndex, remaining.length - 1);
        setReviewItem(remaining[nextIndex]);
      } else {
        setReviewItem(null);
      }
    }

    try {
      const res = await fetch(`/api/stage/facebook/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!res.ok) {
        await fetchItems();
      }
    } catch {
      await fetchItems();
    }
  }

  function handleApprove(id: string, editedText?: string) {
    showFlash('green');
    if (editedText) {
      handleAction(id, 'edit', { edited_text: editedText });
    } else {
      handleAction(id, 'approve');
    }
  }

  function handleReject(id: string) {
    showFlash('red');
    handleAction(id, 'reject');
  }

  return (
    <>
      {/* Flash overlay */}
      {flash && (
        <div
          className={`pointer-events-none fixed inset-0 z-[100] transition-opacity duration-300 ${
            flash === 'green'
              ? 'bg-green-500/10'
              : 'bg-red-500/10'
          }`}
        />
      )}

      {/* Review sheet (full screen) */}
      {reviewItem && (
        <FacebookReviewSheet
          item={reviewItem}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setReviewItem(null)}
        />
      )}

      {/* Queue header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Posts</h1>
          {items.length > 0 && (
            <span className="rounded-full bg-green-950/60 px-3 py-1 text-sm font-semibold text-green-400">
              {items.length} ready
            </span>
          )}
        </div>
        <button
          onClick={fetchItems}
          disabled={loading}
          className="rounded-xl bg-neutral-800/60 px-3 py-2 text-sm text-neutral-400 transition-colors active:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? '...' : '↻'}
        </button>
      </div>

      <TwoFABanner />

      {/* Loading skeleton */}
      {loading && items.length === 0 && (
        <div className="space-y-3 px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-neutral-900" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && <EmptyQueue />}

      {/* Queue list */}
      {items.map((item) => (
        <FacebookQueueCard
          key={item.id}
          item={item}
          onTap={(it) => setReviewItem(it)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      ))}
    </>
  );
}
