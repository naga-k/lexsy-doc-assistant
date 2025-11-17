import Link from "next/link";

const screens = [
  {
    title: "Upload",
    description: "Send a .docx to Lexsy and we extract placeholders in seconds.",
    href: "/upload",
    badge: "Screen 1",
  },
  {
    title: "Fill",
    description: "Chat through missing fields while comparing the live template.",
    href: "/fill",
    badge: "Screen 2",
  },
  {
    title: "Preview & export",
    description: "Generate the filled copy and download the latest .docx.",
    href: "/preview",
    badge: "Screen 3",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
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
          {screens.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              className="rounded-2xl border border-white/15 bg-white/5 p-5 transition hover:border-white/40"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">{screen.badge}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{screen.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{screen.description}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
                Enter {screen.title}
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
