export default function PayLinkNotFound() {
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
        <div className="w-full max-w-md text-center">
          <h1 className="font-serif text-3xl tracking-tight">This link isn&apos;t active.</h1>
          <p className="text-muted-foreground mt-3 text-balance">
            It may have expired, been revoked, or never existed. If you&apos;re expecting an
            invoice, get in touch with the person who sent it.
          </p>
        </div>
      </main>
    </div>
  );
}
