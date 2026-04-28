import Link from "next/link";
import {
  uiButtonGhostClass,
  uiCopyClass,
  uiKickerClass,
  uiPageClass,
  uiPageHeaderClass,
  uiPillInfoClass,
  uiSurfaceClass,
  uiTitleClass,
  uiTitleSmClass,
} from "@/components/ui";

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
    <section className={uiPageClass}>
      <header className={uiPageHeaderClass}>
        <p className={uiKickerClass}>{eyebrow}</p>
        <h1 className={uiTitleClass}>{title}</h1>
        <p className={uiCopyClass}>{description}</p>
      </header>

      <article className={`${uiSurfaceClass} p-6 md:p-8`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={uiKickerClass}>Roadmap</p>
            <h2 className={`mt-2 ${uiTitleSmClass}`}>Module polish in progress</h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
              This area now uses the unified LYFE shell and theme tokens. Next pass adds feature-depth UI
              and richer role-specific workflows.
            </p>
          </div>
          <span className={`${uiPillInfoClass} w-fit uppercase tracking-[0.14em]`}>
            Unified System
          </span>
        </div>

        {links.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${uiButtonGhostClass} justify-start rounded-2xl`}
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
