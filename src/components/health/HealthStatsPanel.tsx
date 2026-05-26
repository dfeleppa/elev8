"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import {
  ActionButton,
  GlassCard,
  MetricRow,
} from "@/components/member-dashboard/PremiumDashboard";
import type { StatGroup } from "./health-stats-config";

type StatValue = {
  value: string;
  unit: string;
  entryDate: string | null;
};

type StatsPayloadEntry = {
  value?: string | number | null;
  unit?: string | null;
  entryDate?: string | null;
};

type HealthStatsResponse = {
  stats?: Record<string, StatsPayloadEntry>;
  error?: string;
};

type AthleteProfile = {
  sex: string | null;
  birthDate: string | null;
  age: number | null;
};

type AthleteProfileResponse = {
  sex: string | null;
  birthDate: string | null;
  age: number | null;
  error?: string;
};

type HealthStatsPanelProps = {
  title: string;
  description: string;
  groups: StatGroup[];
  hideHeader?: boolean;
  onLogLift?: () => void;
};

export default function HealthStatsPanel({ title, description, groups, hideHeader, onLogLift }: HealthStatsPanelProps) {
  const initialValues = useMemo(() => {
    return Object.fromEntries(
      groups.flatMap((group) =>
        group.stats.map((stat) => [stat.key, { value: "", unit: stat.unit, entryDate: null }])
      )
    ) as Record<string, StatValue>;
  }, [groups]);

  const [values, setValues] = useState<Record<string, StatValue>>(initialValues);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile>({ sex: null, birthDate: null, age: null });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSex, setProfileSex] = useState<string>("");
  const [profileBirthDate, setProfileBirthDate] = useState<string>("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [logBodyWeight, setLogBodyWeight] = useState("");
  const [logBodyFat, setLogBodyFat] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [statsRes, profileRes] = await Promise.all([
          fetch("/api/health-stats", { cache: "no-store" }),
          fetch("/api/athlete/profile", { cache: "no-store" }),
        ]);

        const statsPayload = (await statsRes.json()) as HealthStatsResponse;
        const profilePayload = (await profileRes.json()) as AthleteProfileResponse;

        if (statsRes.ok && isMounted) {
          setValues((prev) => {
            const next = { ...prev };
            Object.entries(statsPayload?.stats ?? {}).forEach(([key, entry]) => {
              if (next[key]) {
                next[key] = {
                  value: entry?.value?.toString?.() ?? "",
                  unit: entry?.unit ?? next[key].unit,
                  entryDate: entry?.entryDate ?? null,
                };
              }
            });
            return next;
          });
        }

        if (profileRes.ok && isMounted) {
          setAthleteProfile({
            sex: profilePayload.sex ?? null,
            birthDate: profilePayload.birthDate ?? null,
            age: profilePayload.age ?? null,
          });
          setProfileSex(profilePayload.sex ?? "");
          setProfileBirthDate(profilePayload.birthDate ?? "");
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Unable to load data.";
          setErrorMessage(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const cancelProfileEdit = () => {
    setIsEditingProfile(false);
    setProfileSex("");
    setProfileBirthDate("");
  };

  const saveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/athlete/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sex: profileSex || null,
          birthDate: profileBirthDate || null,
        }),
      });

      const payload = (await response.json()) as AthleteProfileResponse;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save profile.");
      }

      setAthleteProfile({
        sex: payload.sex ?? null,
        birthDate: payload.birthDate ?? null,
        age: payload.age ?? null,
      });
      setIsEditingProfile(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save profile.";
      setErrorMessage(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogBodyComp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logBodyWeight.trim()) return;

    setIsLogging(true);
    setLogSuccess(false);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/health-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_body_comp",
          bodyWeight: Number(logBodyWeight),
          bodyFatPercent: logBodyFat.trim() ? Number(logBodyFat) : null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to log body comp.");
      }

      setValues((prev) => {
        const next = { ...prev };
        Object.entries(payload?.entries ?? {}).forEach(([key, entry]) => {
          if (next[key] && entry) {
            next[key] = {
              value: (entry as { value: string }).value,
              unit: (entry as { unit: string }).unit,
              entryDate: (entry as { entryDate: string | null }).entryDate,
            };
          }
        });
        return next;
      });

      setLogBodyWeight("");
      setLogBodyFat("");
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log body comp.";
      setErrorMessage(message);
    } finally {
      setIsLogging(false);
    }
  };

  const statDisplayValue = (statKey: string) => {
    if (isLoading) return "...";
    const v = values[statKey];
    if (!v || !v.value) return "-";
    return v.value;
  };

  const statDisplayUnit = (statKey: string) => {
    return values[statKey]?.unit ?? "";
  };

  return (
    <section>
      {!hideHeader && (
        <header>
          <h1 className="text-3xl font-semibold text-[var(--text)]">{title}</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">{description}</p>
          {errorMessage ? <p className="mt-3 text-sm text-rose-400">{errorMessage}</p> : null}
        </header>
      )}
      {hideHeader && errorMessage && <p className="mb-4 text-sm text-rose-400">{errorMessage}</p>}

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        {groups.map((group) => (
          <GlassCard
            key={group.title}
            className="flex min-h-full flex-col"
          >
            <div>
              <h2 className="text-xl font-bold text-[#17141F]">{group.title}</h2>
              <p className="mt-1 text-sm font-medium leading-5 text-[#667085]">{group.description}</p>
            </div>

            {group.slug === "body-comp" ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/66 px-4 py-3">
                    <span className="text-sm font-bold text-[#17141F]">Sex</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold capitalize text-[#17141F]">
                        {isLoading ? "..." : athleteProfile.sex ?? "--"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileSex(athleteProfile.sex ?? "");
                          setProfileBirthDate(athleteProfile.birthDate ?? "");
                          setIsEditingProfile(true);
                        }}
                        className="rounded-full border border-[rgba(16,24,40,0.08)] bg-white/70 px-3 py-1 text-[11px] font-bold text-[#667085] transition hover:text-[#17141F]"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-[18px] border border-[rgba(16,24,40,0.08)] bg-white/66 px-4 py-3">
                    <span className="text-sm font-bold text-[#17141F]">Age</span>
                    <span className="text-sm font-bold text-[#17141F]">
                      {isLoading ? "..." : athleteProfile.age ?? "--"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {group.stats.map((stat) => (
                    <MetricRow
                      key={stat.key}
                      label={stat.label}
                      value={statDisplayValue(stat.key)}
                      unit={statDisplayUnit(stat.key)}
                    />
                  ))}
                </div>

                <div className="mt-4 rounded-[22px] border border-[rgba(20,210,220,0.16)] bg-[rgba(20,210,220,0.06)] px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#667085]">Log Today&apos;s Weight</p>
                  <form onSubmit={handleLogBodyComp} className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      max="999.9"
                      placeholder="lb"
                      value={logBodyWeight}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = parseFloat(v);
                        if (v === "" || (Number.isFinite(num) && num >= 0 && num <= 999.9)) {
                          setLogBodyWeight(v);
                        } else if (v === "") {
                          setLogBodyWeight("");
                        }
                      }}
                      className="h-11 w-24 min-w-0 rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 text-sm font-bold text-[#17141F] placeholder:text-[#98A2B3] outline-none focus:border-[rgba(20,210,220,0.55)]"
                      required
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="1"
                      max="99"
                      placeholder="bf%"
                      value={logBodyFat}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = parseFloat(v);
                        if (v === "" || (Number.isFinite(num) && num >= 1 && num <= 99)) {
                          setLogBodyFat(v);
                        } else if (v === "") {
                          setLogBodyFat("");
                        }
                      }}
                      className="h-11 w-24 min-w-0 rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 text-sm font-bold text-[#17141F] placeholder:text-[#98A2B3] outline-none focus:border-[rgba(20,210,220,0.55)]"
                    />
                    <ActionButton
                      type="submit"
                      disabled={isLogging || !logBodyWeight.trim()}
                      className="h-11 shrink-0 px-5 text-xs"
                    >
                      {isLogging ? "..." : "Add"}
                    </ActionButton>
                    {logSuccess && (
                      <span className="shrink-0 text-xs font-bold text-[#0D98A1]">Saved!</span>
                    )}
                  </form>
                </div>
              </>
            ) : (
              <div className="mt-4 grid gap-3">
                {group.stats.map((stat) => (
                  <MetricRow
                    key={stat.key}
                    label={stat.label}
                    value={isLoading ? "..." : values[stat.key]?.value ? values[stat.key].value : "-"}
                    unit={stat.unit}
                  />
                ))}
                {group.slug !== "conditioning" && (
                  <ActionButton
                    type="button"
                    onClick={onLogLift}
                    variant="secondary"
                    className="mt-2 w-full"
                  >
                    Log Lift
                  </ActionButton>
                )}
                {group.slug === "conditioning" && (
                  <ActionButton
                    type="button"
                    variant="secondary"
                    className="mt-2 w-full"
                  >
                    Log Benchmark
                  </ActionButton>
                )}
              </div>
            )}
          </GlassCard>
        ))}
      </section>

      {isEditingProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <GlassCard className="w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">Edit Athlete Info</h3>
              <button
                type="button"
                onClick={cancelProfileEdit}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(16,24,40,0.08)] bg-white/70 text-[#667085] transition hover:text-[#17141F]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">Sex</label>
                <select
                  value={profileSex}
                  onChange={(e) => setProfileSex(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 text-sm font-bold text-[#17141F]"
                >
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">Birth Date</label>
                <input
                  type="date"
                  value={profileBirthDate}
                  onChange={(e) => setProfileBirthDate(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 text-sm font-bold text-[#17141F]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <ActionButton
                  type="button"
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                  className="flex-1"
                >
                  {isSavingProfile ? "Saving..." : "Save"}
                </ActionButton>
                <ActionButton
                  type="button"
                  onClick={cancelProfileEdit}
                  variant="secondary"
                >
                  Cancel
                </ActionButton>
              </div>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </section>
  );
}
