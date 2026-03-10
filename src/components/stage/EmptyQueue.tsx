'use client';

export default function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-24">
      {/* Pulsing radar animation */}
      <div className="relative mb-8 h-20 w-20">
        <div className="absolute inset-0 animate-ping rounded-full bg-neutral-800/40" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-neutral-800/60" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl">📡</span>
        </div>
      </div>

      <p className="text-center text-lg font-medium text-neutral-400">
        你的队列是空的
      </p>
      <p className="mt-2 text-center text-sm text-neutral-600">
        SCOUT 正在工作。新内容很快就会到达。
      </p>
    </div>
  );
}
