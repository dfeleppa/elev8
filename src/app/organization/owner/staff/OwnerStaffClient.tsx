"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { ownerButtonPrimaryClass, ownerButtonSecondaryClass, ownerIconButtonCompactClass } from "../../../../components/owner/buttonStyles";
import OwnerDataTable from "../../../../components/owner/OwnerDataTable";
import OwnerSectionCard from "../../../../components/owner/OwnerSectionCard";

type StaffRole = "coach" | "admin";

type PersonSummary = {
  id: string;
  fullName: string | null;
  email: string | null;
};

type StaffRow = {
  id: string;
  userId: string;
  role: "member" | "coach" | "admin" | "owner" | string;
  coachingPayrate: number | null;
  officePayrate: number | null;
  user: PersonSummary | null;
};

type PromotableMember = {
  email: string;
  fullName: string;
  membership: string | null;
  role: string;
};

type StaffApiResponse = {
  organizationId: string;
  staff: StaffRow[];
  promotableMembers: PromotableMember[];
};

type EditState = {
  role: StaffRole;
  coachingPayrate: string;
  officePayrate: string;
};

const ROLE_OPTIONS: Array<{ value: StaffRole; label: string }> = [
  { value: "coach", label: "Coach" },
  { value: "admin", label: "Admin" },
];

const fieldClass = "w-full rounded-2xl border border-slate-400/70 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-300 focus:border-cyan-300 focus:outline-none";
const tableSelectClass = "w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none";
const tableInputClass = "w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none";

const externalIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M8 8h8v8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 17L16 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 5h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M5 5v14h14v-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const phoneIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path
      d="M7 4h3l1.4 3.3L9.8 9a13 13 0 0 0 5.2 5.2l1.7-1.6L20 14v3a2 2 0 0 1-2.2 2A15.8 15.8 0 0 1 5 6.2 2 2 0 0 1 7 4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const messageIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const mailIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M4 6h16v12H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="m5 7 7 6 7-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function formatRole(role: string) {
  return role.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function asPayrate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function OwnerStaffClient() {
  const [organizationId, setOrganizationId] = useState<string>("");
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [promotableMembers, setPromotableMembers] = useState<PromotableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedMemberEmail, setSelectedMemberEmail] = useState("");
  const [promoteRole, setPromoteRole] = useState<StaffRole>("coach");
  const [promoteCoachingPayrate, setPromoteCoachingPayrate] = useState("");
  const [promoteOfficePayrate, setPromoteOfficePayrate] = useState("");

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<StaffRole>("coach");
  const [createCoachingPayrate, setCreateCoachingPayrate] = useState("");
  const [createOfficePayrate, setCreateOfficePayrate] = useState("");
  const [promoteCardOpen, setPromoteCardOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);

  const [editing, setEditing] = useState<Record<string, EditState>>({});

  const promotableOptions = useMemo(() => {
    return promotableMembers.map((row) => ({
      email: row.email,
      label: row.fullName,
      membership: row.membership,
    }));
  }, [promotableMembers]);

  const loadStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/owner/staff", { cache: "no-store" });
      const payload = (await response.json()) as StaffApiResponse | { error?: string };
      if (!response.ok || !("staff" in payload)) {
        setError((payload as { error?: string }).error ?? "Failed to load staff.");
        return;
      }

      setOrganizationId(payload.organizationId);
      setStaff(payload.staff);
      setPromotableMembers(payload.promotableMembers);
      setSelectedMemberEmail((prev) => prev || payload.promotableMembers[0]?.email || "");

      const nextEditing: Record<string, EditState> = {};
      for (const row of payload.staff) {
        if (row.role !== "coach" && row.role !== "admin") {
          continue;
        }

        nextEditing[row.id] = {
          role: row.role,
          coachingPayrate: row.coachingPayrate?.toString() ?? "",
          officePayrate: row.officePayrate?.toString() ?? "",
        };
      }
      setEditing(nextEditing);
    } catch {
      setError("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const promoteMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMemberEmail) {
      setError("Choose a member to promote.");
      return;
    }

    const selectedMember = promotableMembers.find((member) => member.email === selectedMemberEmail) ?? null;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/owner/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          existingMemberEmail: selectedMemberEmail,
          existingMemberName: selectedMember?.fullName,
          role: promoteRole,
          coachingPayrate: asPayrate(promoteCoachingPayrate),
          officePayrate: asPayrate(promoteOfficePayrate),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to promote member.");
        return;
      }

      setMessage("Member promoted to staff.");
      setPromoteCoachingPayrate("");
      setPromoteOfficePayrate("");
      await loadStaff();
    } catch {
      setError("Failed to promote member.");
    } finally {
      setSaving(false);
    }
  };

  const createStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (!createEmail.trim()) {
      setError("Email is required to create staff.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/owner/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          fullName: createName,
          email: createEmail,
          role: createRole,
          coachingPayrate: asPayrate(createCoachingPayrate),
          officePayrate: asPayrate(createOfficePayrate),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to create staff.");
        return;
      }

      setMessage("Staff member created.");
      setCreateName("");
      setCreateEmail("");
      setCreateCoachingPayrate("");
      setCreateOfficePayrate("");
      await loadStaff();
    } catch {
      setError("Failed to create staff.");
    } finally {
      setSaving(false);
    }
  };

  const saveStaffRow = async (membershipId: string) => {
    const draft = editing[membershipId];
    if (!draft) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/owner/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          membershipId,
          role: draft.role,
          coachingPayrate: asPayrate(draft.coachingPayrate),
          officePayrate: asPayrate(draft.officePayrate),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to update staff member.");
        return;
      }

      setMessage("Staff member updated.");
      await loadStaff();
    } catch {
      setError("Failed to update staff member.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">Staff</h1>
        <p className="mt-3 text-sm text-slate-200">
          Promote members to staff or add non-member staff. Staff access is managed through member roles.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-[28px] border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(9,18,29,0.08)]">
          <button
            type="button"
            onClick={() => setPromoteCardOpen((current) => !current)}
            aria-expanded={promoteCardOpen}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Promote Existing Member</h2>
              <p className="mt-1 text-sm text-slate-600">Select an existing member and assign staff role + pay rates.</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700" aria-hidden="true">
              {promoteCardOpen ? "^" : "v"}
            </span>
          </button>

          {promoteCardOpen ? (
            <form onSubmit={promoteMember} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="promote-member">
                Current Member
              </label>
              <select
                id="promote-member"
                value={selectedMemberEmail}
                onChange={(event) => setSelectedMemberEmail(event.target.value)}
                className={fieldClass}
                disabled={saving || loading}
              >
                {promotableOptions.length === 0 ? <option value="">No promotable members</option> : null}
                {promotableOptions.map((option) => (
                  <option key={option.email} value={option.email}>
                    {option.label}
                    {option.membership ? ` • ${option.membership}` : ""}
                  </option>
                ))}
              </select>

              <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="promote-role">
                Staff Role
              </label>
              <select
                id="promote-role"
                value={promoteRole}
                onChange={(event) => setPromoteRole(event.target.value as StaffRole)}
                className={fieldClass}
                disabled={saving || loading}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="promote-coaching-rate">
                    Coaching Payrate
                  </label>
                  <input
                    id="promote-coaching-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={promoteCoachingPayrate}
                    onChange={(event) => setPromoteCoachingPayrate(event.target.value)}
                    className={`mt-1 ${fieldClass}`}
                    disabled={saving || loading}
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="promote-office-rate">
                    Office Payrate
                  </label>
                  <input
                    id="promote-office-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={promoteOfficePayrate}
                    onChange={(event) => setPromoteOfficePayrate(event.target.value)}
                    className={`mt-1 ${fieldClass}`}
                    disabled={saving || loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || loading || promotableOptions.length === 0}
                className={ownerButtonPrimaryClass}
              >
                {saving ? "Saving..." : "Promote to Staff"}
              </button>
            </form>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(9,18,29,0.08)]">
          <button
            type="button"
            onClick={() => setAddCardOpen((current) => !current)}
            aria-expanded={addCardOpen}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add New Staff (Non-Member)</h2>
              <p className="mt-1 text-sm text-slate-600">
                Create a person in the system and assign staff role in one step.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700" aria-hidden="true">
              {addCardOpen ? "^" : "v"}
            </span>
          </button>

          {addCardOpen ? (
            <form onSubmit={createStaff} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="create-name">
                  Full Name
                </label>
                <input
                  id="create-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  className={`mt-1 ${fieldClass}`}
                  disabled={saving || loading}
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="create-email">
                  Email
                </label>
                <input
                  id="create-email"
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  className={`mt-1 ${fieldClass}`}
                  disabled={saving || loading}
                  required
                />
              </div>

              <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="create-role">
                Staff Role
              </label>
              <select
                id="create-role"
                value={createRole}
                onChange={(event) => setCreateRole(event.target.value as StaffRole)}
                className={fieldClass}
                disabled={saving || loading}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="create-coaching-rate">
                    Coaching Payrate
                  </label>
                  <input
                    id="create-coaching-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createCoachingPayrate}
                    onChange={(event) => setCreateCoachingPayrate(event.target.value)}
                    className={`mt-1 ${fieldClass}`}
                    disabled={saving || loading}
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-slate-600" htmlFor="create-office-rate">
                    Office Payrate
                  </label>
                  <input
                    id="create-office-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createOfficePayrate}
                    onChange={(event) => setCreateOfficePayrate(event.target.value)}
                    className={`mt-1 ${fieldClass}`}
                    disabled={saving || loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || loading}
                className={ownerButtonPrimaryClass}
              >
                {saving ? "Saving..." : "Add Staff"}
              </button>
            </form>
          ) : null}
        </article>
      </section>

      <OwnerSectionCard title="Current Staff" meta={loading ? "Loading..." : `${staff.length} staff`}>
        <OwnerDataTable minWidthClassName="min-w-[1160px]">
            <thead>
              <tr>
                <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Member</th>
                <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Status</th>
                <th className="border-b border-slate-300/80 px-3 py-3 font-semibold w-[180px]">Role</th>
                <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Coaching Payrate</th>
                <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Office Payrate</th>
                <th className="border-b border-slate-300/80 px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-sm text-slate-500"
                  >
                    No staff yet.
                  </td>
                </tr>
              ) : (
                staff.map((row) => {
                  const isOwner = row.role === "owner";
                  const draft =
                    editing[row.id] ??
                    ({
                      role: (row.role === "admin" ? "admin" : "coach") as StaffRole,
                      coachingPayrate: row.coachingPayrate?.toString() ?? "",
                      officePayrate: row.officePayrate?.toString() ?? "",
                    } satisfies EditState);

                  return (
                    <tr key={row.id}>
                      <td className="border-b border-slate-300/60 px-3 py-3 align-top">
                        <div className="flex items-start gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-400/50 bg-emerald-500/12 text-xs font-semibold text-emerald-700">
                            {getInitials(row.user?.fullName || row.user?.email || "?")}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-tight text-slate-900">
                              {row.user?.fullName || row.user?.email || "Unknown user"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{row.user?.email || "-"}</p>
                            <div className="mt-2 flex items-center gap-2 text-slate-500">
                              <button type="button" className={ownerIconButtonCompactClass}>{externalIcon}</button>
                              <button type="button" className={ownerIconButtonCompactClass}>{phoneIcon}</button>
                              <button type="button" className={ownerIconButtonCompactClass}>{messageIcon}</button>
                              <a
                                href={row.user?.email ? `mailto:${row.user.email}` : "#"}
                                className={ownerIconButtonCompactClass}
                                aria-label="Email staff member"
                              >
                                {mailIcon}
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-300/60 px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-emerald-600/35 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                            Active
                          </span>
                          <span className="rounded-full border border-slate-400/40 bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                            {formatRole(row.role)}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-slate-300/60 px-3 py-3 align-top text-xs text-slate-700 min-w-[180px]">
                        {isOwner ? (
                          <span>{formatRole(row.role)}</span>
                        ) : (
                          <select
                            value={draft.role}
                            onChange={(event) =>
                              setEditing((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...draft,
                                  role: event.target.value as StaffRole,
                                },
                              }))
                            }
                            className={tableSelectClass}
                            disabled={saving}
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="border-b border-slate-300/60 px-3 py-3 align-top text-xs text-slate-700">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.coachingPayrate}
                          onChange={(event) =>
                            setEditing((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...draft,
                                coachingPayrate: event.target.value,
                              },
                            }))
                          }
                          className={tableInputClass}
                          disabled={saving || isOwner}
                        />
                      </td>
                      <td className="border-b border-slate-300/60 px-3 py-3 align-top text-xs text-slate-700">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.officePayrate}
                          onChange={(event) =>
                            setEditing((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...draft,
                                officePayrate: event.target.value,
                              },
                            }))
                          }
                          className={tableInputClass}
                          disabled={saving || isOwner}
                        />
                      </td>
                      <td className="border-b border-slate-300/60 px-3 py-3 text-right">
                        {isOwner ? (
                          <span className="text-xs text-slate-500">Locked</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => saveStaffRow(row.id)}
                            disabled={saving}
                            className={ownerButtonSecondaryClass}
                          >
                            Save
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
        </OwnerDataTable>
      </OwnerSectionCard>
    </section>
  );
}
