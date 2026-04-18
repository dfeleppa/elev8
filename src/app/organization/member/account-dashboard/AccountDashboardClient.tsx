"use client";

import { useEffect, useState } from "react";
import { Pencil, X, Check, User } from "lucide-react";
import { Micro, Panel } from "@/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type Membership = {
  organizationName: string | null;
  role: string | null;
  memberSince: string | null;
};

type Profile = {
  fullName: string | null;
  email: string | null;
  sex: string | null;
  birthDate: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPercent: number | null;
  createdAt: string | null;
  memberships: Membership[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatBirthDate(ymd: string | null) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function cmToFtIn(cm: number | null): { ft: number; in: number } | null {
  if (!cm) return null;
  const totalIn = cm / 2.54;
  return { ft: Math.floor(totalIn / 12), in: Math.round(totalIn % 12) };
}

function ftInToCm(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
}

function kgToLbs(kg: number | null): number | null {
  if (!kg) return null;
  return Math.round(kg * 2.20462 * 10) / 10;
}

function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 100) / 100;
}

function displayHeight(cm: number | null) {
  const fi = cmToFtIn(cm);
  if (!fi) return "—";
  return `${fi.ft}'${fi.in}"`;
}

function displayWeight(kg: number | null) {
  const lbs = kgToLbs(kg);
  if (!lbs) return "—";
  return `${lbs} lbs`;
}

const roleBadgeClass: Record<string, string> = {
  owner: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  admin: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  coach: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  member: "border-[var(--pink-soft)]/40 bg-[var(--pink-soft)]/10 text-[var(--pink-soft)]",
};

function RoleBadge({ role }: { role: string | null }) {
  const cls = role ? (roleBadgeClass[role] ?? roleBadgeClass.member) : roleBadgeClass.member;
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${cls}`}>
      {role ?? "member"}
    </span>
  );
}

// ─── Inline edit card wrapper ─────────────────────────────────────────────────

function EditableCard({
  title,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  saving,
  saveError,
  children,
  form,
}: {
  title: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  children: React.ReactNode;
  form: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{title}</p>
        {isEditing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)] disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 transition hover:border-emerald-400/60 hover:text-emerald-300 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {saveError && (
        <p className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
          {saveError}
        </p>
      )}
      {isEditing ? form : children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3">
      <span className="text-sm font-medium text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] outline-none focus:border-[var(--pink)]/50"
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountDashboardClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Personal Info edit state
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalFullName, setPersonalFullName] = useState("");
  const [personalSex, setPersonalSex] = useState("");
  const [personalBirthDate, setPersonalBirthDate] = useState("");
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // Physical Profile edit state
  const [editingPhysical, setEditingPhysical] = useState(false);
  const [physicalFt, setPhysicalFt] = useState("");
  const [physicalIn, setPhysicalIn] = useState("");
  const [physicalLbs, setPhysicalLbs] = useState("");
  const [physicalBf, setPhysicalBf] = useState("");
  const [savingPhysical, setSavingPhysical] = useState(false);
  const [physicalError, setPhysicalError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/athlete/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setProfile(data as Profile);
      })
      .catch(() => setLoadError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  // ── Personal Info ──────────────────────────────────────────────────────────

  function openPersonalEdit() {
    if (!profile) return;
    setPersonalFullName(profile.fullName ?? "");
    setPersonalSex(profile.sex ?? "");
    setPersonalBirthDate(profile.birthDate ?? "");
    setPersonalError(null);
    setEditingPersonal(true);
  }

  function cancelPersonalEdit() {
    setEditingPersonal(false);
    setPersonalError(null);
  }

  async function savePersonal() {
    setSavingPersonal(true);
    setPersonalError(null);
    try {
      const res = await fetch("/api/athlete/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: personalFullName,
          sex: personalSex || null,
          birthDate: personalBirthDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save.");
      setProfile((prev) => prev ? { ...prev, ...data } : data);
      setEditingPersonal(false);
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingPersonal(false);
    }
  }

  // ── Physical Profile ───────────────────────────────────────────────────────

  function openPhysicalEdit() {
    if (!profile) return;
    const fi = cmToFtIn(profile.heightCm);
    setPhysicalFt(fi ? String(fi.ft) : "");
    setPhysicalIn(fi ? String(fi.in) : "");
    const lbs = kgToLbs(profile.weightKg);
    setPhysicalLbs(lbs !== null ? String(lbs) : "");
    setPhysicalBf(profile.bodyFatPercent !== null ? String(profile.bodyFatPercent) : "");
    setPhysicalError(null);
    setEditingPhysical(true);
  }

  function cancelPhysicalEdit() {
    setEditingPhysical(false);
    setPhysicalError(null);
  }

  async function savePhysical() {
    setSavingPhysical(true);
    setPhysicalError(null);
    try {
      const ftNum = physicalFt ? Number(physicalFt) : 0;
      const inNum = physicalIn ? Number(physicalIn) : 0;
      const heightCm = physicalFt || physicalIn ? ftInToCm(ftNum, inNum) : null;
      const weightKg = physicalLbs ? lbsToKg(Number(physicalLbs)) : null;
      const bodyFatPercent = physicalBf ? Number(physicalBf) : null;

      const res = await fetch("/api/athlete/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heightCm, weightKg, bodyFatPercent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save.");
      setProfile((prev) => prev ? { ...prev, ...data } : data);
      setEditingPhysical(false);
    } catch (err) {
      setPhysicalError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingPhysical(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]" />
        ))}
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto w-full max-w-4xl px-5 py-10">
        <p className="text-sm text-rose-300">{loadError ?? "Failed to load profile."}</p>
      </div>
    );
  }

  const topRole = profile.memberships.reduce<string | null>((best, m) => {
    const order: Record<string, number> = { owner: 4, admin: 3, coach: 2, member: 1 };
    if (!best) return m.role;
    return (order[m.role ?? ""] ?? 0) > (order[best] ?? 0) ? m.role : best;
  }, null);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-10">

      {/* ── Profile Header ── */}
      <Panel padding="lg" className="rounded-3xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--pink-soft)]/30 to-[var(--pink)]/20 text-2xl font-bold text-[var(--pink-soft)] ring-2 ring-[var(--pink-soft)]/20">
            {profile.fullName ? initials(profile.fullName) : <User className="h-8 w-8" />}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-[var(--text)]">
              {profile.fullName ?? "—"}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{profile.email ?? "—"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.memberships.length > 0 ? (
                profile.memberships.map((m, i) => (
                  <RoleBadge key={i} role={m.role} />
                ))
              ) : (
                <RoleBadge role={topRole} />
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Member Since</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">
              {profile.memberships[0]?.memberSince
                ? formatDate(profile.memberships[0].memberSince)
                : profile.createdAt
                ? formatDate(profile.createdAt)
                : "—"}
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Personal Info ── */}
        <EditableCard
          title="Personal Info"
          isEditing={editingPersonal}
          onEdit={openPersonalEdit}
          onCancel={cancelPersonalEdit}
          onSave={savePersonal}
          saving={savingPersonal}
          saveError={personalError}
          children={
            <div className="space-y-3">
              <StatRow label="Full Name" value={profile.fullName ?? "—"} />
              <StatRow label="Sex" value={profile.sex ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1) : "—"} />
              <StatRow label="Date of Birth" value={formatBirthDate(profile.birthDate)} />
              <StatRow label="Age" value={profile.age !== null ? `${profile.age} years` : "—"} />
            </div>
          }
          form={
            <div className="space-y-4">
              <InputField
                label="Full Name"
                value={personalFullName}
                onChange={setPersonalFullName}
                placeholder="Your full name"
              />
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Sex
                </label>
                <select
                  value={personalSex}
                  onChange={(e) => setPersonalSex(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--pink)]/50"
                >
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <InputField
                label="Date of Birth"
                value={personalBirthDate}
                onChange={setPersonalBirthDate}
                type="date"
              />
            </div>
          }
        />

        {/* ── Physical Profile ── */}
        <EditableCard
          title="Physical Profile"
          isEditing={editingPhysical}
          onEdit={openPhysicalEdit}
          onCancel={cancelPhysicalEdit}
          onSave={savePhysical}
          saving={savingPhysical}
          saveError={physicalError}
          children={
            <div className="space-y-3">
              <StatRow label="Height" value={displayHeight(profile.heightCm)} />
              <StatRow label="Weight" value={displayWeight(profile.weightKg)} />
              <StatRow
                label="Body Fat"
                value={profile.bodyFatPercent !== null ? `${profile.bodyFatPercent}%` : "—"}
              />
            </div>
          }
          form={
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Height
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="8"
                      placeholder="ft"
                      value={physicalFt}
                      onChange={(e) => setPhysicalFt(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] outline-none focus:border-[var(--pink)]/50"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="11"
                      placeholder="in"
                      value={physicalIn}
                      onChange={(e) => setPhysicalIn(e.target.value)}
                      className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] outline-none focus:border-[var(--pink)]/50"
                    />
                  </div>
                </div>
              </div>
              <InputField
                label="Weight (lbs)"
                value={physicalLbs}
                onChange={setPhysicalLbs}
                type="number"
                min="0"
                max="999"
                step="0.1"
                placeholder="lbs"
              />
              <InputField
                label="Body Fat %"
                value={physicalBf}
                onChange={setPhysicalBf}
                type="number"
                min="1"
                max="99"
                step="0.1"
                placeholder="%"
              />
            </div>
          }
        />
      </div>

      {/* ── Memberships ── */}
      {profile.memberships.length > 0 && (
        <Panel padding="lg" className="rounded-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Organization Memberships
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.memberships.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {m.organizationName ?? "Unknown Organization"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                    Since {m.memberSince ? formatDate(m.memberSince) : "—"}
                  </p>
                </div>
                <RoleBadge role={m.role} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Account Details ── */}
      <Panel padding="lg" className="rounded-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Account
        </p>
        <div className="space-y-3">
          <StatRow label="Email" value={profile.email ?? "—"} />
          <StatRow label="Account Created" value={profile.createdAt ? formatDate(profile.createdAt) : "—"} />
        </div>
      </Panel>

    </div>
  );
}
