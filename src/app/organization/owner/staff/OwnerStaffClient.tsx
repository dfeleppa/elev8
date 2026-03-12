"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

type StaffApiResponse = {
  organizationId: string;
  staff: StaffRow[];
  promotableMembers: StaffRow[];
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

export default function OwnerStaffClient() {
  const [organizationId, setOrganizationId] = useState<string>("");
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [promotableMembers, setPromotableMembers] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedMemberUserId, setSelectedMemberUserId] = useState("");
  const [promoteRole, setPromoteRole] = useState<StaffRole>("coach");
  const [promoteCoachingPayrate, setPromoteCoachingPayrate] = useState("");
  const [promoteOfficePayrate, setPromoteOfficePayrate] = useState("");

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<StaffRole>("coach");
  const [createCoachingPayrate, setCreateCoachingPayrate] = useState("");
  const [createOfficePayrate, setCreateOfficePayrate] = useState("");

  const [editing, setEditing] = useState<Record<string, EditState>>({});

  const promotableOptions = useMemo(() => {
    return promotableMembers.map((row) => ({
      userId: row.userId,
      label: row.user?.fullName || row.user?.email || "Unknown user",
      email: row.user?.email || "",
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
      setSelectedMemberUserId((prev) => prev || payload.promotableMembers[0]?.userId || "");

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
    if (!selectedMemberUserId) {
      setError("Choose a member to promote.");
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
          existingUserId: selectedMemberUserId,
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
        <p className="mt-3 text-sm text-slate-400">
          Promote members to staff or add non-member staff. Staff access is managed through member roles.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={promoteMember} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Promote Existing Member</h2>
          <p className="mt-1 text-sm text-slate-400">Select an existing member and assign staff role + pay rates.</p>

          <div className="mt-4 space-y-3">
            <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="promote-member">
              Current Member
            </label>
            <select
              id="promote-member"
              value={selectedMemberUserId}
              onChange={(event) => setSelectedMemberUserId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              disabled={saving || loading}
            >
              {promotableOptions.length === 0 ? <option value="">No promotable members</option> : null}
              {promotableOptions.map((option) => (
                <option key={option.userId} value={option.userId}>
                  {option.label}
                  {option.email ? ` (${option.email})` : ""}
                </option>
              ))}
            </select>

            <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="promote-role">
              Staff Role
            </label>
            <select
              id="promote-role"
              value={promoteRole}
              onChange={(event) => setPromoteRole(event.target.value as StaffRole)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
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
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="promote-coaching-rate">
                  Coaching Payrate
                </label>
                <input
                  id="promote-coaching-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={promoteCoachingPayrate}
                  onChange={(event) => setPromoteCoachingPayrate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                  disabled={saving || loading}
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="promote-office-rate">
                  Office Payrate
                </label>
                <input
                  id="promote-office-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={promoteOfficePayrate}
                  onChange={(event) => setPromoteOfficePayrate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                  disabled={saving || loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || loading || promotableOptions.length === 0}
              className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Promote to Staff"}
            </button>
          </div>
        </form>

        <form onSubmit={createStaff} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Add New Staff (Non-Member)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Create a person in the system and assign staff role in one step.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="create-name">
                Full Name
              </label>
              <input
                id="create-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                disabled={saving || loading}
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="create-email">
                Email
              </label>
              <input
                id="create-email"
                type="email"
                value={createEmail}
                onChange={(event) => setCreateEmail(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                disabled={saving || loading}
                required
              />
            </div>

            <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="create-role">
              Staff Role
            </label>
            <select
              id="create-role"
              value={createRole}
              onChange={(event) => setCreateRole(event.target.value as StaffRole)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
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
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="create-coaching-rate">
                  Coaching Payrate
                </label>
                <input
                  id="create-coaching-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={createCoachingPayrate}
                  onChange={(event) => setCreateCoachingPayrate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                  disabled={saving || loading}
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="create-office-rate">
                  Office Payrate
                </label>
                <input
                  id="create-office-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={createOfficePayrate}
                  onChange={(event) => setCreateOfficePayrate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                  disabled={saving || loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Add Staff"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Current Staff</h2>
          <span className="text-xs text-slate-400">{loading ? "Loading..." : `${staff.length} staff`}</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <th className="px-3">Name</th>
                <th className="px-3">Email</th>
                <th className="px-3">Role</th>
                <th className="px-3">Coaching Payrate</th>
                <th className="px-3">Office Payrate</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {!loading && staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-slate-400"
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
                      <td className="rounded-l-2xl border-y border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100">
                        {row.user?.fullName || row.user?.email || "Unknown user"}
                      </td>
                      <td className="border-y border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
                        {row.user?.email || "-"}
                      </td>
                      <td className="border-y border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
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
                            className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-2 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
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
                      <td className="border-y border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
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
                          className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-2 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                          disabled={saving || isOwner}
                        />
                      </td>
                      <td className="border-y border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
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
                          className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-2 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                          disabled={saving || isOwner}
                        />
                      </td>
                      <td className="rounded-r-2xl border-y border-white/10 bg-white/5 px-3 py-3 text-right">
                        {isOwner ? (
                          <span className="text-xs text-slate-500">Locked</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => saveStaffRow(row.id)}
                            disabled={saving}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-slate-400"
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
          </table>
        </div>
      </section>
    </section>
  );
}
