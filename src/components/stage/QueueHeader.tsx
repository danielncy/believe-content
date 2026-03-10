'use client';

interface QueueHeaderProps {
  title: string;
  count: number;
  onRefresh: () => void;
  loading: boolean;
}

export default function QueueHeader({ title, count, onRefresh, loading }: QueueHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-sm font-medium text-neutral-300">
          {count}
        </span>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 active:bg-neutral-600 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Refresh'}
      </button>
    </div>
  );
}
