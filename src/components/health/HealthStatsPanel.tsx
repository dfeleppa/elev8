"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";

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
};

export default function HealthStatsPanel({ title, description, groups }: HealthStatsPanelProps) {
  const initialValues = useMemo(() => {
    return Object.fromEntries(
      groups.flatMap((group) =>
        group.stats.map((stat) => [stat.key, { value: "", unit: stat.unit, entryDate: null }])
      )
    ) as Record<string, StatValue>;
  }, [groups]);

  const [values, setValues] = useState<Record<string, StatValue>>(initialValues);
  const [editingStat, setEditingStat] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
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

  const bodyCompKeys = new Set(["body_weight", "body_fat", "lean_body_mass"]);

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

  const startEdit = (statKey: string) => {
    setEditingStat(statKey);
    setDraftValue(values[statKey]?.value ?? "");
    setErrorMessage(null);
  };

  const cancelEdit = () => {
    setEditingStat(null);
    setDraftValue("");
  };

  const saveEdit = async () => {
    if (!editingStat || draftValue.trim() === "") {
      return;
    }

    try {
      const response = await fetch("/api/health-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statKey: editingStat,
          value: Number(draftValue),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save stat.");
      }

      setValues((prev) => ({
        ...prev,
        [editingStat]: {
          value: payload?.entry?.value?.toString?.() ?? draftValue.trim(),
          unit: payload?.entry?.unit ?? prev[editingStat].unit,
          entryDate: payload?.entry?.entryDate ?? prev[editingStat].entryDate,
        },
      }));
      setEditingStat(null);
      setDraftValue("");
      setErrorMessage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save stat.";
      setErrorMessage(message);
    }
  };

  const openProfileEdit = () => {
    setProfileSex(athleteProfile.sex ?? "");
    setProfileBirthDate(athleteProfile.birthDate ?? "");
    setIsEditingProfile(true);
  };

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
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-3 text-sm text-slate-400">{description}</p>
        {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.title}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>

            {group.slug === "body-comp" ? (
              <>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Athlete</p>
                    <button
                      type="button"
                      onClick={openProfileEdit}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                      aria-label="Edit athlete info"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sex</p>
                      <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
                        {isLoading ? "..." : athleteProfile.sex ?? "--"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Age</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {isLoading ? "..." : athleteProfile.age ?? "--"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {group.stats.map((stat) => (
                    <div
                      key={stat.key}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <span className="text-sm font-semibold text-slate-900">{stat.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{statDisplayValue(stat.key)}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{statDisplayUnit(stat.key)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Log Today&apos;s Weight</p>
                  <form onSubmit={handleLogBodyComp} className="mt-3 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="Body weight (lb)"
                        value={logBodyWeight}
                        onChange={(e) => setLogBodyWeight(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400/60"
                        required
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="Body fat % (optional)"
                        value={logBodyFat}
                        onChange={(e) => setLogBodyFat(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400/60"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isLogging || !logBodyWeight.trim()}
                        className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_8px_20px_rgba(2,132,199,0.35)] transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-6"
                      >
                        {isLogging ? "Logging..." : "Submit"}
                      </button>
                      {logSuccess && (
                        <span className="text-xs text-emerald-600 font-medium">Saved!</span>
                      )}
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="mt-4 grid gap-3">
                {group.stats.map((stat) => (
                  <div
                    key={stat.key}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="text-sm font-semibold text-slate-900">{stat.label}</span>
                    {editingStat === stat.key ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveEdit();
                            if (event.key === "Escape") cancelEdit();
                          }}
                          className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400/60"
                          aria-label={`Enter ${stat.label} value`}
                        />
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 transition hover:border-emerald-300"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">
                          {isLoading ? "..." : values[stat.key]?.value ? values[stat.key].value : "-"}
                        </span>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{stat.unit}</span>
                        <button
                          type="button"
                          onClick={() => startEdit(stat.key)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                          aria-label={`Add ${stat.label} value`}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {isEditingProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Edit Athlete Info</h3>
              <button
                type="button"
                onClick={cancelProfileEdit}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">Sex</label>
                <select
                  value={profileSex}
                  onChange={(e) => setProfileSex(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">Birth Date</label>
                <input
                  type="date"
                  value={profileBirthDate}
                  onChange={(e) => setProfileBirthDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                  className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_8px_20px_rgba(2,132,199,0.35)] transition hover:from-sky-400 hover:to-blue-500 disabled:opacity-60"
                >
                  {isSavingProfile ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelProfileEdit}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
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
