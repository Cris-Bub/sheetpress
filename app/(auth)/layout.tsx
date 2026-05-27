export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-8 py-6">
        <div className="inline-flex items-baseline gap-1">
          <span className="font-serif text-2xl leading-none tracking-tight">sheet</span>
          <span className="font-serif text-2xl leading-none tracking-tight italic text-muted-foreground">
            press
          </span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-8 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
