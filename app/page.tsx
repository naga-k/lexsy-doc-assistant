import Link from "next/link";

const screens = [
  {
    title: "Upload",
    description: "Send a .docx to Lexsy and we extract placeholders in seconds.",
    href: "/upload",
    badge: "Step 1",
    locked: false,
  },
  {
    title: "Fill",
    description: "Chat through missing fields while comparing the live template.",
    href: "/fill",
    badge: "Step 2",
    locked: true,
  },
  {
    title: "Preview & export",
    description: "Generate the filled copy and download the latest .docx.",
    href: "/preview",
    badge: "Step 3",
    locked: true,
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="flex w-full items-center justify-between px-4 py-4 sm:px-8 lg:px-16">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.4em] text-indigo-200"
        >
          Lexsy
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/upload"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Upload
          </Link>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-16">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">Lexsy workflow</p>
            <h1 className="text-4xl font-semibold leading-tight text-white">Pick the screen you need.</h1>
            <p className="text-base text-slate-300">
              Each surface is now a focused page: upload with zero distractions, fill templates alongside
              chat, then review and export when you are ready. Use the links below to jump directly into the
              real flow.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {screens.map((screen) => {
              const baseClasses = "rounded-2xl border border-white/15 bg-white/5 p-5 transition";
              const stateClasses = screen.locked
                ? "cursor-not-allowed border-white/10 opacity-70"
                : "hover:border-white/40";
              const content = (
                <>
                  <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">{screen.badge}</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{screen.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{screen.description}</p>
                  {screen.locked ? (
                    <span className="mt-6 inline-flex text-sm font-semibold text-white/60">
                      Complete Step 1 first
                    </span>
                  ) : (
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
                      Enter {screen.title}
                      <span aria-hidden="true">→</span>
                    </span>
                  )}
                </>
              );

              return screen.locked ? (
                <div
                  key={screen.href}
                  role="link"
                  aria-disabled
                  className={`${baseClasses} ${stateClasses}`}
                >
                  {content}
                </div>
              ) : (
                <Link key={screen.href} href={screen.href} className={`${baseClasses} ${stateClasses}`}>
                  {content}
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
