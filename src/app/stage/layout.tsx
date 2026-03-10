export const metadata = {
  title: 'STAGE — BELIEVE Content',
};

export default function StageLayout({ children }: { children: React.ReactNode }) {
  const chatUrl = process.env.NEXT_PUBLIC_CHAT_URL;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-lg">
        <div className="sticky top-0 z-10 bg-neutral-950 border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold tracking-wide">BELIEVE Content</span>
            {chatUrl && (
              <a
                href={chatUrl}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                WhatsApp &rarr;
              </a>
            )}
          </div>
        </div>
        <main className="pb-8">{children}</main>
      </div>
    </div>
  );
}
