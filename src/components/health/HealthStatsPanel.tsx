"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

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
          <h1 className="text-3xl font-semibold text-slate-100">{title}</h1>
          <p className="mt-3 text-sm text-slate-400">{description}</p>
          {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}
        </header>
      )}
      {hideHeader && errorMessage && <p className="mb-4 text-sm text-rose-300">{errorMessage}</p>}

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.title}
            className="glass-panel rounded-3xl border border-white/10 p-6"
          >
            <h2 className="text-lg font-semibold text-slate-100">{group.title}</h2>

            {group.slug === "body-comp" ? (
              <>
                <div className="mt-4 flex gap-3">
                  <div className="flex flex-1 items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-200">Sex</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold capitalize text-slate-100">
                        {isLoading ? "..." : athleteProfile.sex ?? "--"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileSex(athleteProfile.sex ?? "");
                          setProfileBirthDate(athleteProfile.birthDate ?? "");
                          setIsEditingProfile(true);
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-white/20 hover:text-white"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-200">Age</span>
                    <span className="text-sm font-semibold text-slate-100">
                      {isLoading ? "..." : athleteProfile.age ?? "--"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {group.stats.map((stat) => (
                    <div
                      key={stat.key}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <span className="text-sm font-semibold text-slate-200">{stat.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-100">{statDisplayValue(stat.key)}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{statDisplayUnit(stat.key)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Log Today&apos;s Weight</p>
                  <form onSubmit={handleLogBodyComp} className="mt-3 flex items-center gap-2">
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
                      className="w-20 min-w-0 rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
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
                      className="w-16 min-w-0 rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
                    />
                    <button
                      type="submit"
                      disabled={isLogging || !logBodyWeight.trim()}
                      className="shrink-0 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white active:scale-95 transition-transform shadow-[0_4px_20px_rgba(255,177,196,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLogging ? "..." : "Add"}
                    </button>
                    {logSuccess && (
                      <span className="shrink-0 text-xs text-emerald-400 font-medium">Saved!</span>
                    )}
                  </form>
                </div>
              </>
            ) : (
              <div className="mt-4 grid gap-3">
                {group.stats.map((stat) => (
                  <div
                    key={stat.key}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-slate-200">{stat.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-100">
                        {isLoading ? "..." : values[stat.key]?.value ? values[stat.key].value : "-"}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.unit}</span>
                    </div>
                  </div>
                ))}
                {group.slug !== "conditioning" && (
                  <button
                    type="button"
                    onClick={onLogLift}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    Log Lift
                  </button>
                )}
                {group.slug === "conditioning" && (
                  <button
                    type="button"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    Log Benchmark
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </section>

      {isEditingProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55">
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Edit Athlete Info</h3>
              <button
                type="button"
                onClick={cancelProfileEdit}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/25 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Sex</label>
                <select
                  value={profileSex}
                  onChange={(e) => setProfileSex(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Birth Date</label>
                <input
                  type="date"
                  value={profileBirthDate}
                  onChange={(e) => setProfileBirthDate(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                  className="flex-1 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:brightness-110 active:scale-95 shadow-[0_4px_20px_rgba(255,177,196,0.2)] disabled:opacity-60"
                >
                  {isSavingProfile ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelProfileEdit}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
