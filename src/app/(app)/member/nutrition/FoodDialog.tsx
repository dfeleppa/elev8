"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";

import { useModalBehavior } from "@/hooks/useModalBehavior";
import {
  DEFAULT_SERVING_UNIT,
  FOOD_LIBRARY_TTL_MS,
  SERVING_UNIT_OPTIONS,
  formatGrams,
  formatServing,
  formatServingSize,
  formatTotalAmount,
  meals,
  normalizeServingUnit,
  roundToWhole,
  toDraftNumber,
  toEntryQuantity,
  toNumber,
  type FoodSearchResult,
  type LabelScanResult,
  type LibraryFood,
  type MealKey,
  type NutritionEntry,
} from "./lib";

type FoodDialogProps = {
  open: boolean;
  /** Meal the dialog adds entries to. */
  mealKey: MealKey | null;
  selectedDate: string;
  onClose: () => void;
  onEntryAdded: (entry: NutritionEntry) => void;
  onError: (message: string | null) => void;
};

const EMPTY_FOOD_DRAFT = {
  name: "",
  servingSize: "1",
  servingUnit: DEFAULT_SERVING_UNIT as string,
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  sugar: "",
  fiber: "",
  saturatedFat: "",
};

export default function FoodDialog({
  open,
  mealKey,
  selectedDate,
  onClose,
  onEntryAdded,
  onError,
}: FoodDialogProps) {
  const searchMeal: MealKey = "lunch";
  const [dialogTab, setDialogTab] = useState<"recent" | "mine" | "scan" | "create" | "usda">("recent");
  const [dialogSearch, setDialogSearch] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [addingFoodKey, setAddingFoodKey] = useState<string | null>(null);
  const [addedFlashKey, setAddedFlashKey] = useState<string | null>(null);
  const [recentFoods, setRecentFoods] = useState<LibraryFood[]>([]);
  const [myFoods, setMyFoods] = useState<LibraryFood[]>([]);
  const recentFoodsFetchedAtRef = useRef(0);
  const myFoodsFetchedAtRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [createFoodDraft, setCreateFoodDraft] = useState({ ...EMPTY_FOOD_DRAFT });
  const [creatingFood, setCreatingFood] = useState(false);
  const [labelScanLoading, setLabelScanLoading] = useState(false);
  const [labelScanError, setLabelScanError] = useState<string | null>(null);
  const [labelScanResult, setLabelScanResult] = useState<LabelScanResult | null>(null);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [editFoodDraft, setEditFoodDraft] = useState({ ...EMPTY_FOOD_DRAFT });
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useModalBehavior(open, onClose, overlayRef);

  async function loadFoodLibraries(options?: {
    includeRecent?: boolean;
    includeMine?: boolean;
    force?: boolean;
  }) {
    const includeRecent = options?.includeRecent ?? true;
    const includeMine = options?.includeMine ?? true;
    const force = options?.force ?? false;
    const now = Date.now();

    const shouldFetchRecent =
      includeRecent && (force || recentFoods.length === 0 || now - recentFoodsFetchedAtRef.current > FOOD_LIBRARY_TTL_MS);
    const shouldFetchMine =
      includeMine && (force || myFoods.length === 0 || now - myFoodsFetchedAtRef.current > FOOD_LIBRARY_TTL_MS);

    let nextRecent = recentFoods;
    let nextMine = myFoods;

    if (!shouldFetchRecent && !shouldFetchMine) {
      return { recent: nextRecent, mine: nextMine };
    }

    const requests: Array<Promise<Response>> = [];
    if (shouldFetchRecent) {
      requests.push(fetch("/api/foods/recent?limit=40"));
    }
    if (shouldFetchMine) {
      requests.push(fetch("/api/foods"));
    }

    const responses = await Promise.all(requests);
    let cursor = 0;

    if (shouldFetchRecent) {
      const recentResponse = responses[cursor++];
      const recentPayload = await recentResponse.json().catch(() => ({ items: [] }));
      if (recentResponse.ok) {
        nextRecent = recentPayload.items ?? [];
        setRecentFoods(nextRecent);
        recentFoodsFetchedAtRef.current = now;
      }
    }

    if (shouldFetchMine) {
      const mineResponse = responses[cursor++];
      const minePayload = await mineResponse.json().catch(() => ({ foods: [] }));
      if (mineResponse.ok) {
        nextMine = minePayload.foods ?? [];
        setMyFoods(nextMine);
        myFoodsFetchedAtRef.current = now;
      }
    }

    return { recent: nextRecent, mine: nextMine };
  }

  // Reset the view and (re)load food libraries each time the dialog opens;
  // clear any in-progress food edit when it closes.
  useEffect(() => {
    if (!open) {
      setEditingFoodId(null);
      return;
    }

    setDialogTab("recent");
    setDialogSearch("");
    let cancelled = false;
    setDialogLoading(true);
    loadFoodLibraries({ includeRecent: true, includeMine: true }).finally(() => {
      if (!cancelled) {
        setDialogLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // loadFoodLibraries reads the cached lists; re-running on their change
    // would reset the tab mid-session, so only `open` should re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dialogFoods = useMemo(() => {
    const source = dialogTab === "recent" ? recentFoods : myFoods;
    const query = dialogSearch.trim().toLowerCase();
    if (!query) {
      return source;
    }
    return source.filter((food) => food.name.toLowerCase().includes(query));
  }, [dialogTab, recentFoods, myFoods, dialogSearch]);

  async function handleFoodSearch() {
    await runFoodSearch(searchQuery);
  }

  async function runFoodSearch(queryInput: string) {
    const query = queryInput.trim();
    if (query.length < 2) {
      setSearchError("Search needs at least 2 characters.");
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSearchPerformed(true);
    try {
      const response = await fetch(`/api/foods/search?query=${encodeURIComponent(query)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Food search failed.");
      }
      setSearchQuery(query);
      setSearchResults(payload.results ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Food search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function scanNutritionLabel(file: File | null | undefined) {
    if (!file) {
      return;
    }

    setLabelScanLoading(true);
    setLabelScanError(null);
    setLabelScanResult(null);
    onError(null);

    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/foods/label-scan", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Label scan failed.");
      }

      const result = payload.result as LabelScanResult;
      setLabelScanResult(result);
      setCreateFoodDraft({
        name: result.name ?? "",
        servingSize: toDraftNumber(result.servingSize) || "1",
        servingUnit: normalizeServingUnit(result.servingUnit),
        calories: toDraftNumber(result.calories),
        protein: toDraftNumber(result.protein),
        carbs: toDraftNumber(result.carbs),
        fat: toDraftNumber(result.fat),
        sugar: toDraftNumber(result.sugar),
        fiber: toDraftNumber(result.fiber),
        saturatedFat: toDraftNumber(result.saturatedFat),
      });
      setDialogTab("create");
    } catch (err) {
      setLabelScanError(err instanceof Error ? err.message : "Label scan failed.");
    } finally {
      setLabelScanLoading(false);
    }
  }

  async function addFoodResult(result: FoodSearchResult) {
    const targetMeal = mealKey ?? searchMeal;
    onError(null);
    const response = await fetch("/api/nutrition-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayDate: selectedDate,
        mealType: targetMeal,
        name: result.brandOwner ? `${result.description} (${result.brandOwner})` : result.description,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        sugar: result.sugar,
        fiber: result.fiber,
        saturatedFat: result.saturatedFat,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      onError(payload?.error ?? "Failed to add entry.");
      return;
    }

    onEntryAdded(payload.entry);
  }

  async function addLibraryFood(food: LibraryFood, targetMeal: MealKey, quantityOverride?: number) {
    onError(null);
    const rowKey = `${dialogTab}-${food.id}`;
    const quantity = toEntryQuantity(
      quantityOverride !== undefined ? quantityOverride : food.quantity,
    );
    setAddingFoodKey(rowKey);
    try {
      const response = await fetch("/api/nutrition-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayDate: selectedDate,
          mealType: targetMeal,
          name: food.name,
          quantity,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          sugar: food.sugar,
          fiber: food.fiber,
          saturatedFat: food.saturated_fat,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onError(payload?.error ?? "Failed to add entry.");
        return;
      }

      onEntryAdded(payload.entry);
      setAddedFlashKey(rowKey);
      setTimeout(() => {
        setAddedFlashKey((current) => (current === rowKey ? null : current));
      }, 1200);
    } finally {
      setAddingFoodKey((current) => (current === rowKey ? null : current));
    }
  }

  async function createCustomFood() {
    const name = createFoodDraft.name.trim();
    if (!name) {
      onError("Food name is required.");
      return;
    }

    setCreatingFood(true);
    onError(null);
    try {
      const response = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          servingSize: createFoodDraft.servingSize,
          servingUnit: createFoodDraft.servingUnit,
          calories: createFoodDraft.calories,
          protein: createFoodDraft.protein,
          carbs: createFoodDraft.carbs,
          fat: createFoodDraft.fat,
          sugar: createFoodDraft.sugar,
          fiber: createFoodDraft.fiber,
          saturatedFat: createFoodDraft.saturatedFat,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onError(payload?.error ?? "Failed to create custom food.");
        return;
      }

      setMyFoods((prev) => [payload.food, ...prev]);
      myFoodsFetchedAtRef.current = Date.now();
      setDialogTab("mine");
      setCreateFoodDraft({ ...EMPTY_FOOD_DRAFT });
    } finally {
      setCreatingFood(false);
    }
  }

  function beginEditFood(food: LibraryFood) {
    setEditingFoodId(food.id);
    setEditFoodDraft({
      name: food.name,
      servingSize: food.serving_size?.toString() ?? "1",
      servingUnit: food.serving_unit ?? DEFAULT_SERVING_UNIT,
      calories: food.calories?.toString() ?? "",
      protein: food.protein?.toString() ?? "",
      carbs: food.carbs?.toString() ?? "",
      fat: food.fat?.toString() ?? "",
      sugar: food.sugar?.toString() ?? "",
      fiber: food.fiber?.toString() ?? "",
      saturatedFat: food.saturated_fat?.toString() ?? "",
    });
  }

  async function beginEditRecentFood(food: LibraryFood) {
    const match = myFoods.find((item) => item.name.toLowerCase() === food.name.toLowerCase());
    if (match) {
      beginEditFood(match);
      return;
    }
    setDialogSaving(true);
    onError(null);
    try {
      const response = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: food.name,
          servingSize: food.serving_size?.toString() ?? "1",
          servingUnit: food.serving_unit ?? DEFAULT_SERVING_UNIT,
          calories: food.calories?.toString() ?? "",
          protein: food.protein?.toString() ?? "",
          carbs: food.carbs?.toString() ?? "",
          fat: food.fat?.toString() ?? "",
          sugar: food.sugar?.toString() ?? "",
          fiber: food.fiber?.toString() ?? "",
          saturatedFat: food.saturated_fat?.toString() ?? "",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.food) {
        onError(payload?.error ?? "Failed to load food for editing.");
        return;
      }
      setMyFoods((prev) => [payload.food, ...prev]);
      myFoodsFetchedAtRef.current = Date.now();
      beginEditFood(payload.food);
    } finally {
      setDialogSaving(false);
    }
  }

  async function saveEditedFood(foodId: string) {
    setDialogSaving(true);
    onError(null);
    try {
      const response = await fetch(`/api/foods/${foodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFoodDraft),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onError(payload?.error ?? "Failed to update food.");
        return;
      }
      setMyFoods((prev) => prev.map((food) => (food.id === foodId ? payload.food : food)));
      myFoodsFetchedAtRef.current = Date.now();
      setEditingFoodId(null);
    } finally {
      setDialogSaving(false);
    }
  }

  async function deleteFood(foodId: string) {
    setDialogSaving(true);
    onError(null);
    try {
      const response = await fetch(`/api/foods/${foodId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onError(payload?.error ?? "Failed to delete food.");
        return;
      }
      setMyFoods((prev) => prev.filter((food) => food.id !== foodId));
      myFoodsFetchedAtRef.current = Date.now();
    } finally {
      setDialogSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Search foods"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-4 outline-none sm:items-center sm:py-6"
    >
      <div className="panel my-auto w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--text-muted)]">
              {mealKey ? `Add To ${meals.find((meal) => meal.key === mealKey)?.label}` : "Manage Foods"}
            </p>
            <h3 className="mt-1 text-3xl font-semibold leading-tight text-[var(--text)]">Search foods</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDialogTab("scan")}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-extrabold shadow-[0_12px_24px_rgba(20,210,220,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 ${
                dialogTab === "scan"
                  ? "border-[var(--nutrition-accent-teal)]/60 bg-[var(--nutrition-accent-teal)] text-[var(--nutrition-accent-teal-ink)]"
                  : "border-[var(--nutrition-accent-teal)]/40 bg-[linear-gradient(135deg,rgba(20,210,220,0.24),rgba(255,92,168,0.22))] text-[var(--nutrition-teal-text)]"
              }`}
              aria-pressed={dialogTab === "scan"}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span className="hidden min-[380px]:inline">Scan label</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-lg text-[var(--text-muted)] transition hover:text-[var(--text)]"
              aria-label="Close food dialog"
            >
              ×
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {(
            mealKey
              ? (["recent", "mine", "usda", "create"] as const)
              : (["recent", "mine", "create"] as const)
          ).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setDialogTab(tab)}
              className={`rounded-full border px-4 py-1 text-sm font-semibold transition ${
                dialogTab === tab
                  ? "border-[var(--pink)]/50 bg-[var(--pink)]/12 text-[var(--pink)]"
                  : "border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab === "recent" ? "Recents" : tab === "mine" ? "My foods" : tab === "usda" ? "USDA" : "Create food"}
            </button>
          ))}
        </div>

        {dialogTab === "scan" ? (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--pink)]/40 bg-[var(--pink)]/12 text-[var(--pink)]">
                <Camera className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">Upload a Nutrition Facts photo</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  Capture the full label straight-on when possible. You can review and edit every value before saving.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-black/10 px-4 py-6 text-center transition hover:border-[var(--pink)]/50">
                <Camera className="h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
                <span className="mt-3 text-sm font-semibold text-[var(--text)]">
                  {labelScanLoading ? "Scanning label..." : "Take photo"}
                </span>
                <span className="mt-1 text-xs text-[var(--text-soft)]">Open the camera</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  disabled={labelScanLoading}
                  onChange={(event) => {
                    void scanNutritionLabel(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                  className="sr-only"
                />
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-black/10 px-4 py-6 text-center transition hover:border-[var(--pink)]/50">
                <Upload className="h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
                <span className="mt-3 text-sm font-semibold text-[var(--text)]">
                  {labelScanLoading ? "Scanning label..." : "Upload photo"}
                </span>
                <span className="mt-1 text-xs text-[var(--text-soft)]">Choose from your library</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={labelScanLoading}
                  onChange={(event) => {
                    void scanNutritionLabel(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="mt-2 text-center text-xs text-[var(--text-soft)]">JPG, PNG, or WebP up to 8 MB</p>
            {labelScanError ? (
              <div className="nutrition-error-banner mt-4 rounded-2xl border border-rose-300/70 bg-rose-50/90 p-4 text-sm font-semibold text-rose-700">
                {labelScanError}
              </div>
            ) : null}
            {labelScanResult ? (
              <div className="mt-4 rounded-2xl border border-[var(--success-line)] bg-[var(--success-bg)] p-4 text-sm font-semibold text-[var(--success-text)]">
                Label scanned with {labelScanResult.confidence} confidence. Review the filled fields in Create food.
              </div>
            ) : null}
          </div>
        ) : dialogTab === "create" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {labelScanResult ? (
              <div className="rounded-2xl border border-[var(--pink)]/25 bg-[var(--pink)]/10 p-3 text-xs leading-5 text-[var(--text-muted)] sm:col-span-2">
                Scanned label filled these values with {labelScanResult.confidence} confidence.
                {labelScanResult.notes ? ` ${labelScanResult.notes}` : ""}
              </div>
            ) : null}
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Food Name</span>
              <input
                value={createFoodDraft.name}
                onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Food name"
                className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Amount per Serving</span>
              <input
                value={createFoodDraft.servingSize}
                onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, servingSize: event.target.value }))}
                placeholder="e.g. 84"
                inputMode="decimal"
                className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
              />
              <span className="block text-[10px] text-[var(--text-soft)]">How much is in one serving (e.g. 84 grams).</span>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Unit</span>
              <select
                value={createFoodDraft.servingUnit}
                onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, servingUnit: event.target.value }))}
                className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] focus:border-[var(--line-focus)] focus:outline-none"
              >
                {SERVING_UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            {([
              { key: "calories", label: "Calories", placeholder: "Calories" },
              { key: "protein", label: "Protein", placeholder: "Protein" },
              { key: "carbs", label: "Carbs", placeholder: "Carbs" },
              { key: "fat", label: "Fat", placeholder: "Fat" },
              { key: "sugar", label: "Sugar", placeholder: "Sugar" },
              { key: "fiber", label: "Fiber", placeholder: "Fiber" },
            ] as const).map((field) => (
              <label key={field.key} className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{field.label}</span>
                <input
                  value={createFoodDraft[field.key]}
                  onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  placeholder={field.placeholder}
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
                />
              </label>
            ))}
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Saturated Fat</span>
              <input
                value={createFoodDraft.saturatedFat}
                onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, saturatedFat: event.target.value }))}
                placeholder="Saturated fat"
                inputMode="decimal"
                className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={createCustomFood}
              disabled={creatingFood}
              className="accent-violet rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60 sm:col-span-2"
            >
              {creatingFood ? "Saving" : "Save Food"}
            </button>
          </div>
        ) : dialogTab === "usda" ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                id="food-search"
                name="foodSearch"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") handleFoodSearch(); }}
                className="min-w-[220px] flex-1 rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
                placeholder="Search foods"
              />
              <button
                type="button"
                onClick={handleFoodSearch}
                className="accent-violet rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110"
              >
                {searchLoading ? "Searching" : "Search"}
              </button>
            </div>

            {searchError ? (
              <div className="nutrition-error-banner mt-4 rounded-2xl border border-rose-300/70 bg-rose-50/90 p-4 text-sm font-semibold text-rose-700">
                {searchError}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {searchResults.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  {searchPerformed ? `No results for "${searchQuery.trim()}".` : "Search for foods to add."}
                </p>
              ) : (
                searchResults.map((result) => (
                  <div
                    key={result.fdcId}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{result.description}</p>
                      {result.brandOwner ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{result.brandOwner}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {roundToWhole(result.calories)} cal · {formatGrams(result.protein)}p · {formatGrams(result.carbs)}c · {formatGrams(result.fat)}f
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addFoodResult(result)}
                      className="accent-violet rounded-xl px-3 py-2 text-xs font-semibold transition hover:brightness-110"
                    >
                      Add to {meals.find((meal) => meal.key === (mealKey ?? searchMeal))?.label}
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mt-4">
              <input
                value={dialogSearch}
                onChange={(event) => setDialogSearch(event.target.value)}
                placeholder={dialogTab === "recent" ? "Search recent foods" : "Search my foods"}
                className="w-full rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
              />
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {dialogLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Loading foods...</p>
              ) : dialogFoods.length === 0 ? (
                <p className="rounded-lg border border-[var(--line)] px-4 py-4 text-sm text-[var(--text-muted)]">No foods found. Try a different search.</p>
              ) : (
                dialogFoods.map((food) => {
                  const rowKey = `${dialogTab}-${food.id}`;
                  const defaultQty = formatServingSize(toEntryQuantity(food.quantity));
                  const draftValue = quantityDrafts[rowKey] ?? defaultQty;
                  const draftServings = Number(draftValue);
                  const fallbackServings = toEntryQuantity(food.quantity);
                  const effectiveServings = Number.isFinite(draftServings) && draftServings > 0 ? draftServings : fallbackServings;
                  const totalAmount = formatTotalAmount(effectiveServings, food.serving_size, food.serving_unit);
                  const caloriesTotal = roundToWhole(toNumber(food.calories) * effectiveServings);
                  const proteinTotal = formatGrams(toNumber(food.protein) * effectiveServings);
                  const carbsTotal = formatGrams(toNumber(food.carbs) * effectiveServings);
                  const fatTotal = formatGrams(toNumber(food.fat) * effectiveServings);
                  const isAdding = addingFoodKey === rowKey;
                  const justAdded = addedFlashKey === rowKey;
                  return (
                  <div
                    key={rowKey}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug text-[var(--text)]">{food.name}</span>
                      {food.serving_size != null || (food.serving_unit ?? "").trim() ? (
                        <span className="mt-0.5 block text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                          {formatServing(food.serving_size, food.serving_unit)}
                          {totalAmount && draftServings !== 1 ? (
                            <span className="ml-1.5 text-[var(--text-muted)]">· total {totalAmount}</span>
                          ) : null}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">
                        {caloriesTotal} cal · {proteinTotal}p · {carbsTotal}c · {fatTotal}f
                        {totalAmount ? <span className="ml-1.5">· {totalAmount}</span> : null}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)]/70 pt-3">
                      {mealKey ? (
                        <>
                          <div className="mr-auto flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Decrease servings"
                              onClick={() =>
                                setQuantityDrafts((prev) => {
                                  const current = Number(prev[rowKey] ?? defaultQty);
                                  const base = Number.isFinite(current) ? current : Number(defaultQty);
                                  const next = Math.max(1, Math.round(base) - 1);
                                  return { ...prev, [rowKey]: formatServingSize(next) };
                                })
                              }
                              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
                            >
                              −
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={draftValue}
                              onChange={(event) =>
                                setQuantityDrafts((prev) => ({ ...prev, [rowKey]: event.target.value }))
                              }
                              onFocus={(event) => event.currentTarget.select()}
                              aria-label="Servings"
                              className="w-14 rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-2 py-1 text-center text-xs text-[var(--text)] focus:border-[var(--line-focus)] focus:outline-none"
                            />
                            <button
                              type="button"
                              aria-label="Increase servings"
                              onClick={() =>
                                setQuantityDrafts((prev) => {
                                  const current = Number(prev[rowKey] ?? defaultQty);
                                  const base = Number.isFinite(current) ? current : Number(defaultQty);
                                  const next = Math.max(1, Math.round(base) + 1);
                                  return { ...prev, [rowKey]: formatServingSize(next) };
                                })
                              }
                              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            {totalAmount ? totalAmount : "srv"}
                          </span>
                          <button
                            type="button"
                            disabled={isAdding}
                            onClick={() => {
                              const parsed = Number(draftValue);
                              const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : toEntryQuantity(food.quantity);
                              addLibraryFood(food, mealKey, qty);
                            }}
                            className="accent-violet rounded-full px-3 py-1 text-xs font-semibold transition hover:brightness-110 disabled:opacity-60"
                          >
                            {justAdded ? "Added ✓" : isAdding ? "Adding…" : "Add"}
                          </button>
                        </>
                      ) : null}
                      {dialogTab === "mine" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEditFood(food)}
                            className="rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={dialogSaving}
                            onClick={() => deleteFood(food.id)}
                            className="rounded-full border border-rose-300/70 bg-rose-50/70 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400/70 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                      {dialogTab === "recent" ? (
                        <button
                          type="button"
                          disabled={dialogSaving}
                          onClick={() => beginEditRecentFood(food)}
                          className="rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-60"
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {editingFoodId ? (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Edit Food</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Food Name</span>
                <input
                  value={editFoodDraft.name}
                  onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Food name"
                  className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Amount per Serving</span>
                <input
                  value={editFoodDraft.servingSize}
                  onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, servingSize: event.target.value }))}
                  placeholder="e.g. 84"
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
                />
                <span className="block text-[10px] text-[var(--text-soft)]">How much is in one serving (e.g. 84 grams).</span>
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Unit</span>
                <select
                  value={editFoodDraft.servingUnit}
                  onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, servingUnit: event.target.value }))}
                  className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] focus:border-[var(--line-focus)] focus:outline-none"
                >
                  {SERVING_UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
              {([
                { key: "calories", label: "Calories", placeholder: "Calories" },
                { key: "protein", label: "Protein", placeholder: "Protein" },
                { key: "carbs", label: "Carbs", placeholder: "Carbs" },
                { key: "fat", label: "Fat", placeholder: "Fat" },
                { key: "sugar", label: "Sugar", placeholder: "Sugar" },
                { key: "fiber", label: "Fiber", placeholder: "Fiber" },
              ] as const).map((field) => (
                <label key={field.key} className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{field.label}</span>
                  <input
                    value={editFoodDraft[field.key]}
                    onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
                  />
                </label>
              ))}
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Saturated Fat</span>
                <input
                  value={editFoodDraft.saturatedFat}
                  onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, saturatedFat: event.target.value }))}
                  placeholder="Saturated fat"
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
                />
              </label>
              <div className="sm:col-span-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={dialogSaving}
                  onClick={() => saveEditedFood(editingFoodId)}
                  className="accent-violet rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingFoodId(null)}
                  className="rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
