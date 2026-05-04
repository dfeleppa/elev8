import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Clock3,
  GraduationCap,
  HeartHandshake,
  Home,
  MessageCircleHeart,
  Scissors,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { authOptions } from "@/lib/auth";
import { hasRole, requireUserContext } from "@/lib/member";

const displaySerif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-planet-pooch-display",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Planet Pooch Pet Resort",
  description:
    "Luxury daycare, boarding, training, and grooming designed for busy professionals who want exceptional care for their dogs.",
};

const navigationItems: ReadonlyArray<{
  label: string;
  href: string;
  primary?: boolean;
}> = [
  { label: "About", href: "#about" },
  { label: "Daycare", href: "#daycare" },
  { label: "Boarding", href: "#boarding" },
  { label: "Training", href: "#training" },
  { label: "Grooming", href: "#grooming" },
  { label: "Contact Us", href: "#contact" },
  { label: "Book Now", href: "#contact", primary: true },
] as const;

const services = [
  {
    id: "daycare",
    title: "Daycare",
    icon: Sparkles,
    summary:
      "Structured play, attentive supervision, and enrichment that keeps your dog active, social, and fulfilled while you work.",
  },
  {
    id: "boarding",
    title: "Boarding",
    icon: Home,
    summary:
      "Boutique overnight stays with cozy suites, calming routines, and the kind of care that lets you travel with total peace of mind.",
  },
  {
    id: "training",
    title: "Training",
    icon: GraduationCap,
    summary:
      "Thoughtful training sessions that reinforce confidence, improve manners, and support the relationship you want at home.",
  },
  {
    id: "grooming",
    title: "Grooming",
    icon: Scissors,
    summary:
      "Polished grooming appointments tailored to your dog, from freshen-ups to full spa-style care with a gentle touch.",
  },
] as const;

const carePoints = [
  {
    title: "Concierge-Level Care",
    icon: HeartHandshake,
    copy: "A hospitality-minded team that knows your routine, preferences, and what helps your dog feel most at ease.",
  },
  {
    title: "Thoughtful Daily Rhythm",
    icon: Clock3,
    copy: "Play, rest, movement, and calm are balanced intentionally so every dog enjoys a day that feels enriching, not chaotic.",
  },
  {
    title: "Safety With Warmth",
    icon: ShieldCheck,
    copy: "Careful supervision, clean spaces, and dependable communication for owners who expect excellence.",
  },
] as const;

const pageTheme = {
  "--pp-main": "#4e6b75",
  "--pp-main-deep": "#324953",
  "--pp-main-soft": "#6f8891",
  "--pp-cream": "#f7f0e8",
  "--pp-sand": "#e9dccd",
  "--pp-clay": "#d0baa3",
  "--pp-ink": "#2f2a27",
} as CSSProperties;

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.email) {
    const { error, role } = await requireUserContext();

    if (error) {
      redirect("/login");
    }

    if (hasRole("admin", role)) {
      redirect("/gym-dashboard");
    }

    redirect("/member/athlete-dashboard");
  }

  return (
    <main
      className={`${displaySerif.variable} bg-[var(--pp-cream)] text-[var(--pp-ink)]`}
      style={pageTheme}
    >
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(78,107,117,0.2),transparent_70%)]" />
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-8 lg:px-10 lg:pb-24">
          <header className="rounded-full border border-[rgba(78,107,117,0.14)] bg-white/72 px-4 py-3 shadow-[0_18px_60px_rgba(50,73,83,0.09)] backdrop-blur md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <a className="flex items-center gap-3" href="#top">
                <Image
                  src="/planet-pooch-logo.png"
                  alt="Planet Pooch Pet Resort"
                  width={220}
                  height={74}
                  className="h-auto w-[180px] sm:w-[220px]"
                  priority
                />
              </a>
              <nav aria-label="Primary" className="flex flex-wrap items-center gap-2 text-sm">
                {navigationItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className={
                      item.primary
                        ? "rounded-full bg-[var(--pp-main)] px-5 py-2.5 font-semibold text-white transition hover:bg-[var(--pp-main-deep)]"
                        : "rounded-full px-4 py-2 text-[var(--pp-main-deep)] transition hover:bg-[rgba(78,107,117,0.08)]"
                    }
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </header>

          <div
            id="top"
            className="grid items-center gap-10 pb-10 pt-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-14 lg:pb-16 lg:pt-16"
          >
            <div className="max-w-2xl">
              <p className="mb-5 text-sm uppercase tracking-[0.28em] text-[var(--pp-main)]/75">
                Enriching the life of pets
              </p>
              <h1 className="font-[var(--font-planet-pooch-display)] text-5xl leading-[0.94] text-[var(--pp-ink)] sm:text-6xl lg:text-7xl">
                Luxury daycare, boarding, training, and grooming for dogs who deserve more.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[rgba(47,42,39,0.74)]">
                Planet Pooch Pet Resort gives busy professionals a place they can trust for
                beautiful care, structured days, and a resort experience tailored to every dog.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--pp-main)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(50,73,83,0.16)] transition hover:bg-[var(--pp-main-deep)]"
                >
                  Book Now
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#about"
                  className="inline-flex items-center rounded-full border border-[rgba(78,107,117,0.18)] px-6 py-3 text-sm font-semibold text-[var(--pp-main-deep)] transition hover:border-[rgba(78,107,117,0.35)] hover:bg-white/60"
                >
                  Discover The Resort
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-10 top-10 hidden h-36 w-36 rounded-full bg-[rgba(208,186,163,0.35)] blur-2xl lg:block" />
              <div className="absolute -right-8 bottom-0 hidden h-48 w-48 rounded-full bg-[rgba(78,107,117,0.18)] blur-3xl lg:block" />
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-[#d9c7b8] p-3 shadow-[0_30px_90px_rgba(50,73,83,0.16)]">
                <div className="relative overflow-hidden rounded-[2rem]">
                  <Image
                    src="https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80"
                    alt="A well-groomed dog lounging in a refined interior"
                    width={1200}
                    height={1400}
                    sizes="(min-width: 1024px) 42vw, 100vw"
                    className="h-[420px] w-full object-cover object-center sm:h-[520px]"
                  />
                </div>
                <div className="absolute bottom-8 left-8 right-8 max-w-sm rounded-[1.75rem] border border-white/70 bg-[rgba(247,240,232,0.9)] px-5 py-4 shadow-[0_12px_40px_rgba(47,42,39,0.1)] backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--pp-main)]/70">
                    Designed For Peace Of Mind
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[rgba(47,42,39,0.8)]">
                    Spacious care, calm routines, and updates that help you feel connected even on
                    your busiest days.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_20px_60px_rgba(50,73,83,0.08)] backdrop-blur sm:grid-cols-3 sm:p-8">
            {carePoints.map((point) => {
              const Icon = point.icon;
              return (
                <article key={point.title} className="rounded-[1.5rem] bg-[rgba(255,255,255,0.68)] p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(78,107,117,0.1)] text-[var(--pp-main)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 font-[var(--font-planet-pooch-display)] text-3xl leading-tight text-[var(--pp-ink)]">
                    {point.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[rgba(47,42,39,0.72)]">
                    {point.copy}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-28 bg-white/55 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
          <div className="rounded-[2rem] border border-[rgba(78,107,117,0.12)] bg-[rgba(255,255,255,0.74)] p-8 shadow-[0_18px_50px_rgba(50,73,83,0.08)]">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--pp-main)]/75">
              About Planet Pooch
            </p>
            <h2 className="mt-4 font-[var(--font-planet-pooch-display)] text-5xl leading-none text-[var(--pp-ink)]">
              A boutique resort experience made for modern dog families.
            </h2>
            <p className="mt-6 text-base leading-8 text-[rgba(47,42,39,0.74)]">
              We created Planet Pooch for owners who want more than a drop-off. Every service is
              designed to feel attentive, calm, and personal, from tailored play groups to restful
              overnight stays and polished grooming care.
            </p>
            <p className="mt-5 text-base leading-8 text-[rgba(47,42,39,0.74)]">
              The result is a pet resort that feels elevated for you and enriching for your dog.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="overflow-hidden rounded-[2rem] bg-[var(--pp-sand)] shadow-[0_18px_50px_rgba(50,73,83,0.1)] sm:translate-y-8">
              <Image
                src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80"
                alt="A happy dog being held by a caretaker"
                width={900}
                height={1200}
                sizes="(min-width: 640px) 24vw, 100vw"
                className="h-full min-h-[280px] w-full object-cover"
              />
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.74)] p-6 shadow-[0_18px_50px_rgba(50,73,83,0.08)]">
              <MessageCircleHeart className="h-10 w-10 text-[var(--pp-main)]" />
              <h3 className="mt-6 font-[var(--font-planet-pooch-display)] text-3xl text-[var(--pp-ink)]">
                Communication you can count on.
              </h3>
              <p className="mt-4 text-sm leading-7 text-[rgba(47,42,39,0.72)]">
                Clear updates, thoughtful check-ins, and a team that understands how valuable peace
                of mind is when your schedule is already full.
              </p>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-[rgba(78,107,117,0.12)] bg-[rgba(255,255,255,0.74)] p-6 shadow-[0_18px_50px_rgba(50,73,83,0.08)]">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--pp-main)]/72">
                Our Promise
              </p>
              <p className="mt-5 font-[var(--font-planet-pooch-display)] text-3xl leading-tight text-[var(--pp-ink)]">
                Thoughtful care. Refined spaces. Happy dogs.
              </p>
            </div>
            <div className="overflow-hidden rounded-[2rem] bg-[var(--pp-main-deep)] shadow-[0_18px_50px_rgba(50,73,83,0.16)]">
              <Image
                src="https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=900&q=80"
                alt="A dog relaxing in a quiet lounge setting"
                width={900}
                height={1200}
                sizes="(min-width: 640px) 24vw, 100vw"
                className="h-full min-h-[250px] w-full object-cover opacity-92"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--pp-main)]/75">
              Premium Services
            </p>
            <h2 className="mt-4 font-[var(--font-planet-pooch-display)] text-5xl leading-none text-[var(--pp-ink)]">
              Four ways we care for your dog beautifully.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.id}
                  id={service.id}
                  className="scroll-mt-28 rounded-[2rem] border border-[rgba(78,107,117,0.12)] bg-white/75 p-7 shadow-[0_18px_60px_rgba(50,73,83,0.08)] backdrop-blur"
                >
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(78,107,117,0.1)] text-[var(--pp-main)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-5 font-[var(--font-planet-pooch-display)] text-4xl text-[var(--pp-ink)]">
                        {service.title}
                      </h3>
                    </div>
                    <a
                      href="#contact"
                      className="rounded-full border border-[rgba(78,107,117,0.16)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pp-main-deep)] transition hover:bg-[rgba(78,107,117,0.08)]"
                    >
                      Book Now
                    </a>
                  </div>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-[rgba(47,42,39,0.72)]">
                    {service.summary}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,rgba(78,107,117,0.12),rgba(78,107,117,0.18))] py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-10">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--pp-main-deep)]/75">
              The Experience
            </p>
            <h2 className="mt-4 font-[var(--font-planet-pooch-display)] text-5xl leading-none text-[var(--pp-ink)]">
              Resort-level care with a calmer, more personal rhythm.
            </h2>
            <div className="mt-8 grid gap-5">
              {[
                "Morning arrivals begin with a warm welcome and a smooth transition into play or rest.",
                "The day balances enrichment, movement, social time, and quiet recovery based on each dog’s needs.",
                "Evenings and overnight stays prioritize comfort, routine, and a soothing environment.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-white/60 bg-white/70 px-5 py-4 text-sm leading-7 text-[rgba(47,42,39,0.75)] shadow-[0_12px_30px_rgba(50,73,83,0.08)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/65 p-3 shadow-[0_26px_70px_rgba(50,73,83,0.1)]">
            <Image
              src="https://images.unsplash.com/photo-1525253086316-d0c936c814f8?auto=format&fit=crop&w=1200&q=80"
              alt="Dogs relaxing and playing together in a polished resort environment"
              width={1200}
              height={1400}
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="h-[520px] w-full rounded-[2rem] object-cover"
            />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="overflow-hidden rounded-[2rem] bg-[var(--pp-clay)] shadow-[0_22px_60px_rgba(50,73,83,0.12)]">
              <Image
                src="https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=1000&q=80"
                alt="A dog owner hugging a happy dog"
                width={1000}
                height={1200}
                sizes="(min-width: 1024px) 28vw, 100vw"
                className="h-full min-h-[320px] w-full object-cover"
              />
            </div>
            <div className="rounded-[2rem] border border-[rgba(78,107,117,0.12)] bg-white/80 p-8 shadow-[0_18px_60px_rgba(50,73,83,0.08)]">
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--pp-main)]/75">
                Client Love
              </p>
              <blockquote className="mt-4 font-[var(--font-planet-pooch-display)] text-4xl leading-tight text-[var(--pp-ink)] sm:text-5xl">
                “Planet Pooch feels like the kind of place you hope exists when you love your dog
                and live a very full life.”
              </blockquote>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[rgba(47,42,39,0.74)]">
                Owners come to us for convenience, but they stay because the care feels truly
                elevated. Every service is built to help your dog come home settled, happy, and
                beautifully cared for.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-28 pb-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 rounded-[2.5rem] bg-[var(--pp-main-deep)] p-8 text-white shadow-[0_28px_80px_rgba(50,73,83,0.2)] lg:grid-cols-[1fr_0.9fr] lg:p-12">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-white/60">Contact Us</p>
              <h2 className="mt-4 font-[var(--font-planet-pooch-display)] text-5xl leading-none text-white">
                Ready to give your dog a more beautiful day?
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/78">
                Book now, ask about services, or schedule a tour and we’ll help you find the best
                fit for your dog’s routine.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="mailto:hello@planetpoochpetresort.com"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--pp-main-deep)] transition hover:bg-[var(--pp-cream)]"
                >
                  Book Now
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#top"
                  className="inline-flex items-center rounded-full border border-white/24 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Back To Top
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/12 bg-white/8 p-6 backdrop-blur">
              <p className="text-sm uppercase tracking-[0.24em] text-white/60">Booking Notes</p>
              <div className="mt-6 space-y-4 text-sm leading-7 text-white/78">
                <p>Daycare, boarding, training, and grooming services can be tailored to your dog’s needs.</p>
                <p>Tour requests and new-client inquiries are welcome.</p>
                <p>
                  Email us at{" "}
                  <a className="font-semibold text-white" href="mailto:hello@planetpoochpetresort.com">
                    hello@planetpoochpetresort.com
                  </a>{" "}
                  to begin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
