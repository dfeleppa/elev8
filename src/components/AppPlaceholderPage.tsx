import Link from "next/link";

type PlaceholderLink = {
  label: string;
  href: string;
};

type AppPlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  links?: PlaceholderLink[];
};

export default function AppPlaceholderPage({
  eyebrow,
  title,
  description,
  links = [],
}: AppPlaceholderPageProps) {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
        <h1 className="text-3xl font-semibold text-slate-100">{title}</h1>
        <p className="max-w-2xl text-sm text-slate-400">{description}</p>
      </header>

      <article className="glass-panel rounded-3xl border border-white/10 p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Roadmap</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Module polish in progress</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              This area now uses the unified LYFE shell and theme tokens. Next pass adds feature-depth UI
              and richer role-specific workflows.
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-[#ffb1c4]/35 bg-[#ffb1c4]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#ffd9e4]">
            Unified System
          </span>
        </div>

        {links.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
