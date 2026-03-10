export const metadata = {
  title: 'STAGE — BELIEVE Content',
};

export default function StageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-lg">
        <main className="pb-[max(32px,env(safe-area-inset-bottom))]">{children}</main>
      </div>
    </div>
  );
}
