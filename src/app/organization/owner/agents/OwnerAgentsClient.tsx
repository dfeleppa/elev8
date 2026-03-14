"use client";

import { useMemo, useState } from "react";

type PermissionRow = {
  key: string;
  label: string;
  description: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
};

type OwnerAgentsClientProps = {
  configuredMemberId: string;
};

const starterPermissionRows: PermissionRow[] = [
  {
    key: "member_profile",
    label: "Member Profile",
    description: "Basic profile details and member identity",
    create: false,
    read: true,
    update: false,
    delete: false,
  },
  {
    key: "nutrition_entries",
    label: "Nutrition Entries",
    description: "Meal and macro entry records",
    create: true,
    read: true,
    update: true,
    delete: false,
  },
  {
    key: "nutrition_custom_foods",
    label: "Custom Foods",
    description: "User-created food library items",
    create: true,
    read: true,
    update: true,
    delete: false,
  },
  {
    key: "workout_results",
    label: "Workout Results",
    description: "Workout score/result history",
    create: true,
    read: true,
    update: false,
    delete: false,
  },
  {
    key: "health_stats",
    label: "Health Stats",
    description: "Body composition and performance metrics",
    create: false,
    read: true,
    update: false,
    delete: false,
  },
];

type AgentTestPayload = {
  dayDate: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  quantity: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function toApiNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function generateToken(length = 48) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const random = new Uint8Array(length);
  crypto.getRandomValues(random);

  let token = "";
  for (let i = 0; i < random.length; i += 1) {
    token += alphabet[random[i] % alphabet.length];
  }
  return token;
}

export default function OwnerAgentsClient({ configuredMemberId }: OwnerAgentsClientProps) {
  const [permissionRows, setPermissionRows] = useState<PermissionRow[]>(starterPermissionRows);
  const [generatedToken, setGeneratedToken] = useState("");
  const [copied, setCopied] = useState(false);

  const [tokenForTest, setTokenForTest] = useState("");
  const [entryIdForTest, setEntryIdForTest] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [testResult, setTestResult] = useState<string>("");

  const [payload, setPayload] = useState<AgentTestPayload>({
    dayDate: todayIso(),
    mealType: "lunch",
    name: "Agent test entry",
    quantity: "1",
    calories: "300",
    protein: "25",
    carbs: "30",
    fat: "10",
  });

  const selectedPermissionCount = useMemo(() => {
    return permissionRows.reduce((acc, row) => {
      return (
        acc +
        Number(row.create) +
        Number(row.read) +
        Number(row.update) +
        Number(row.delete)
      );
    }, 0);
  }, [permissionRows]);

  const togglePermission = (
    key: PermissionRow["key"],
    action: "create" | "read" | "update" | "delete"
  ) => {
    setPermissionRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              [action]: !row[action],
            }
          : row
      )
    );
  };

  const handleGenerateToken = () => {
    const next = generateToken();
    setGeneratedToken(next);
    setCopied(false);
  };

  const handleCopyToken = async () => {
    if (!generatedToken) {
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const buildRequestBody = () => ({
    dayDate: payload.dayDate,
    mealType: payload.mealType,
    name: payload.name,
    quantity: toApiNumberOrNull(payload.quantity) ?? 1,
    calories: toApiNumberOrNull(payload.calories),
    protein: toApiNumberOrNull(payload.protein),
    carbs: toApiNumberOrNull(payload.carbs),
    fat: toApiNumberOrNull(payload.fat),
  });

  const runCreateTest = async () => {
    if (!tokenForTest.trim()) {
      setTestResult("Add a token in the test field first.");
      return;
    }

    setIsCreating(true);
    setTestResult("");
    try {
      const response = await fetch("/api/agent/nutrition-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AGENT-TOKEN": tokenForTest.trim(),
        },
        body: JSON.stringify(buildRequestBody()),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.entry?.id) {
        setEntryIdForTest(data.entry.id);
      }

      setTestResult(
        JSON.stringify(
          {
            status: response.status,
            ok: response.ok,
            data,
          },
          null,
          2
        )
      );
    } catch (error) {
      setTestResult(
        JSON.stringify(
          {
            status: "network_error",
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2
        )
      );
    } finally {
      setIsCreating(false);
    }
  };

  const runUpdateTest = async () => {
    if (!tokenForTest.trim()) {
      setTestResult("Add a token in the test field first.");
      return;
    }

    if (!entryIdForTest.trim()) {
      setTestResult("Create a test entry first or paste an entry id to update.");
      return;
    }

    setIsUpdating(true);
    setTestResult("");
    try {
      const response = await fetch(`/api/agent/nutrition-entries/${entryIdForTest.trim()}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-AGENT-TOKEN": tokenForTest.trim(),
        },
        body: JSON.stringify({
          name: `${payload.name} (updated)`,
          quantity: toApiNumberOrNull(payload.quantity) ?? 1,
        }),
      });

      const data = await response.json().catch(() => ({}));
      setTestResult(
        JSON.stringify(
          {
            status: response.status,
            ok: response.ok,
            data,
          },
          null,
          2
        )
      );
    } catch (error) {
      setTestResult(
        JSON.stringify(
          {
            status: "network_error",
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2
        )
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">Agents</h1>
        <p className="mt-3 text-sm text-slate-300">
          Configure automation access for app agents with scoped permissions.
        </p>
      </header>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent Access</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Owner Agent Permissions</h2>
          </div>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Draft
          </span>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Permission
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Create
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Read
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Update
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody>
              {permissionRows.map((row) => (
                <tr key={row.key} className="border-t border-slate-200">
                  <td className="px-4 py-3 align-top">
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.description}</p>
                  </td>
                  {(["create", "read", "update", "delete"] as const).map((action) => (
                    <td key={`${row.key}-${action}`} className="px-4 py-3 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={row[action]}
                        onChange={() => togglePermission(row.key, action)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0b3da8] focus:ring-[#0b3da8]"
                        aria-label={`${action} ${row.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">
            Selected permission switches: <span className="font-semibold text-slate-900">{selectedPermissionCount}</span>
          </p>
          <button
            type="button"
            disabled
            className="rounded-full bg-gradient-to-r from-[#2fa8e8] to-[#0b3da8] px-4 py-2 text-sm font-semibold text-white opacity-70"
          >
            Save Permissions (Coming Soon)
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Token Rotation</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Generate New Agent Token</h3>
          <p className="mt-2 text-sm text-slate-600">
            This generates a new token value locally. After generating, set it in Vercel and `.env.local` as `AGENT_NUTRITION_TOKEN`.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateToken}
              className="rounded-full bg-gradient-to-r from-[#2fa8e8] to-[#0b3da8] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Generate Token
            </button>
            <button
              type="button"
              onClick={handleCopyToken}
              disabled={!generatedToken}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Generated Token</span>
            <input
              value={generatedToken}
              readOnly
              placeholder="Click Generate Token"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500"
            />
          </label>

          <label className="mt-3 block space-y-1">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Configured Agent Member ID</span>
            <input
              value={configuredMemberId || "Not set"}
              readOnly
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-700"
            />
          </label>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Endpoint Test</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Test Agent Nutrition API</h3>

          <div className="mt-4 grid gap-3">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Token For Test</span>
              <input
                value={tokenForTest}
                onChange={(event) => setTokenForTest(event.target.value)}
                placeholder="Paste AGENT_NUTRITION_TOKEN"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Day Date</span>
                <input
                  type="date"
                  value={payload.dayDate}
                  onChange={(event) => setPayload((prev) => ({ ...prev, dayDate: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Meal Type</span>
                <select
                  value={payload.mealType}
                  onChange={(event) =>
                    setPayload((prev) => ({
                      ...prev,
                      mealType: event.target.value as AgentTestPayload["mealType"],
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Entry Name</span>
              <input
                value={payload.name}
                onChange={(event) => setPayload((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Qty</span>
                <input
                  value={payload.quantity}
                  onChange={(event) => setPayload((prev) => ({ ...prev, quantity: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Cal</span>
                <input
                  value={payload.calories}
                  onChange={(event) => setPayload((prev) => ({ ...prev, calories: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Protein</span>
                <input
                  value={payload.protein}
                  onChange={(event) => setPayload((prev) => ({ ...prev, protein: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Carbs</span>
                <input
                  value={payload.carbs}
                  onChange={(event) => setPayload((prev) => ({ ...prev, carbs: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Fat</span>
              <input
                value={payload.fat}
                onChange={(event) => setPayload((prev) => ({ ...prev, fat: event.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Entry ID For PATCH Test</span>
              <input
                value={entryIdForTest}
                onChange={(event) => setEntryIdForTest(event.target.value)}
                placeholder="Auto-filled after create"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runCreateTest()}
                disabled={isCreating}
                className="rounded-full bg-gradient-to-r from-[#2fa8e8] to-[#0b3da8] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {isCreating ? "Testing Create..." : "Test Create (POST)"}
              </button>
              <button
                type="button"
                onClick={() => void runUpdateTest()}
                disabled={isUpdating}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-60"
              >
                {isUpdating ? "Testing Update..." : "Test Update (PATCH)"}
              </button>
            </div>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Response</span>
              <pre className="max-h-48 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {testResult || "No request sent yet."}
              </pre>
            </label>
          </div>
        </article>
      </section>
    </section>
  );
}
