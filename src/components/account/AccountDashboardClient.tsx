"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, Calendar, Edit2, Save, Shield, User, X } from "lucide-react";

type UserProfile = {
  fullName: string;
  email: string;
  role: string;
  memberSince: string | null;
};

type OrgMembership = {
  organizationName: string;
  membershipRole: string;
  joinedAt: string | null;
};

type AccountData = {
  profile: UserProfile;
  membership: OrgMembership;
  totalWorkouts: number;
  latestWorkoutDate: string | null;
  calorieTarget: number | null;
  proteinTarget: number | null;
};

export default function AccountDashboardClient({ userId }: { userId: string }) {
  const [data, setData] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchAccountData = useCallback(async () => {
    try {
      const [profileRes, workoutsRes] = await Promise.all([
        fetch("/api/me"),
        fetch(`/api/programming/results?memberId=${userId}&limit=1`),
      ]);

      const profileData = profileRes.ok ? await profileRes.json() : {};
      const workoutsData = workoutsRes.ok ? await workoutsRes.json() : {};

      setData({
        profile: {
          fullName: profileData.userName ?? "",
          email: profileData.email ?? "",
          role: profileData.role ?? "member",
          memberSince: profileData.createdAt ?? null,
        },
        membership: {
          organizationName: profileData.organizationName ?? "",
          membershipRole: profileData.role ?? "member",
          joinedAt: profileData.joinedAt ?? null,
        },
        totalWorkouts: workoutsData.results?.length ?? 0,
        latestWorkoutDate:
          workoutsData.results?.[0]?.day_date ?? null,
        calorieTarget: profileData.calorieTarget ?? null,
        proteinTarget: profileData.proteinTarget ?? null,
      });
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  async function handleSaveName() {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: editName.trim() }),
      });
      if (res.ok) {
        setData((prev) =>
          prev ? { ...prev, profile: { ...prev.profile, fullName: editName.trim() } } : prev
        );
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4a8d]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-slate-400">Unable to load account data.</p>
      </div>
    );
  }

  const roleLabel = data.profile.role
    ? data.profile.role.charAt(0).toUpperCase() + data.profile.role.slice(1)
    : "Member";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">Account Dashboard</h1>
        <p className="mt-3 text-sm text-slate-400">
          Your profile, membership, and training summary — all in one place.
        </p>
      </header>

      {saveSuccess && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          Name updated successfully.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-3xl border border-white/10 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                <User className="h-5 w-5 text-slate-300" strokeWidth={1.8} />
              </div>
              <h2 className="text-lg font-semibold text-slate-100">Profile</h2>
            </div>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => {
                  setEditName(data!.profile.fullName);
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-100"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : null}
          </div>

          <div className="space-y-5">
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Full Name
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#ff4a8d]/60 focus:outline-none"
                      placeholder="Your full name"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={isSaving}
                      className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-[#ff4a8d]/40 bg-[#ff4a8d]/15 px-4 text-sm font-semibold text-[#ffb1c4] transition hover:bg-[#ff4a8d]/25 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Full Name</p>
                  <p className="text-sm font-medium text-slate-100">
                    {data.profile.fullName || "Not set"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Email</p>
                  <p className="text-sm text-slate-300 truncate">{data.profile.email}</p>
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Role</p>
                  <p className="text-sm font-medium capitalize text-slate-100">{roleLabel}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Member Since</p>
                  <p className="text-sm text-slate-300">
                    {data.profile.memberSince
                      ? new Date(data.profile.memberSince).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-3xl border border-white/10 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <Shield className="h-5 w-5 text-slate-300" strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Organization</h2>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Organization
                </p>
                <p className="text-sm font-medium text-slate-100">
                  {data.membership.organizationName || "—"}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Membership Role
                </p>
                <p className="text-sm font-medium capitalize text-slate-100">
                  {data.membership.membershipRole || "—"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Joined</p>
                <p className="text-sm text-slate-300">
                  {data.membership.joinedAt
                    ? new Date(data.membership.joinedAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl border border-white/10 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <Award className="h-5 w-5 text-slate-300" strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Training</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Total Workouts
              </p>
              <p className="text-2xl font-semibold text-slate-100">{data.totalWorkouts}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Last Workout
              </p>
              <p className="text-sm text-slate-300">
                {data.latestWorkoutDate
                  ? new Date(data.latestWorkoutDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "No workouts logged"}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl border border-white/10 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <Calendar className="h-5 w-5 text-slate-300" strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Nutrition Targets</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Daily Calories
              </p>
              <p className="text-2xl font-semibold text-slate-100">
                {data.calorieTarget ? data.calorieTarget.toLocaleString() : "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Protein Target
              </p>
              <p className="text-2xl font-semibold text-slate-100">
                {data.proteinTarget ? `${data.proteinTarget}g` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
