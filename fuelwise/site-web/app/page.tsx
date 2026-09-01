'use client';

import { useEffect, useRef, useState } from 'react';

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

type WebMcpContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>;
};

const macroData = [
  { name: 'Protein', eaten: 138, target: 175, color: '#7c6df2' },
  { name: 'Carbs', eaten: 186, target: 245, color: '#e879a8' },
  { name: 'Fat', eaten: 48, target: 68, color: '#e7a946' },
];

const initialMeals = [
  { mealType: 'breakfast', name: 'Breakfast', detail: 'Greek yogurt, berries & granola', calories: 485, protein: 32, carbs: 58, fat: 14, saturatedFat: 4, sugar: 22, fiber: 7 },
  { mealType: 'lunch', name: 'Lunch', detail: 'Chicken rice bowl', calories: 612, protein: 51, carbs: 73, fat: 17, saturatedFat: 4, sugar: 8, fiber: 9 },
  { mealType: 'snacks', name: 'Snack', detail: 'Protein shake & banana', calories: 296, protein: 31, carbs: 36, fat: 4, saturatedFat: 1, sugar: 19, fiber: 4 },
];

type LibraryFood = { id: number; name: string; serving: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; saturated_fat_g: number; sugar_g: number; fiber_g: number; usage_count: number };

async function prepareScanImage(file: File) {
  if (file.size <= 850_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the image.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  if (!blob) throw new Error('This browser could not prepare the image.');
  return new File([blob], 'fuelwise-scan.jpg', { type: 'image/jpeg' });
}

export default function Home() {
  const [foodModal, setFoodModal] = useState(false);
  const [foodDraft, setFoodDraft] = useState({ mealType: 'snacks', name: '', detail: 'Custom serving', calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, sugar: 0, fiber: 0 });
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'ready' | 'error'>('idle');
  const [scanMessage, setScanMessage] = useState('');
  const [scanMeta, setScanMeta] = useState<{ confidence: string; source: string; notes: string } | null>(null);
  const scanInput = useRef<HTMLInputElement>(null);
  const [foodLibrary, setFoodLibrary] = useState<LibraryFood[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [addedMeals, setAddedMeals] = useState<typeof initialMeals>([]);
  const [metabolismModal, setMetabolismModal] = useState(false);
  const [nutritionExpanded, setNutritionExpanded] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [energyInputs, setEnergyInputs] = useState({ age: 35, sex: 'male', heightIn: 70, activity: 1.55 });
  const [checkIn, setCheckIn] = useState(false);
  const [goal, setGoal] = useState('Lose fat');
  const [weight, setWeight] = useState(186.4);
  const [bodyFat, setBodyFat] = useState(18.2);
  const [applied, setApplied] = useState(false);
  const [displayName, setDisplayName] = useState('Daniel');
  const [cloudStatus, setCloudStatus] = useState<'loading' | 'synced' | 'saving' | 'error'>('loading');
  const [webMcpReady, setWebMcpReady] = useState(false);
  const recommendation = goal === 'Increase performance' ? 2350 : goal === 'Reverse diet' ? 2300 : 2250;
  const addedTotals = addedMeals.reduce((sum, meal) => ({ calories: sum.calories + meal.calories, protein: sum.protein + meal.protein, carbs: sum.carbs + meal.carbs, fat: sum.fat + meal.fat, saturatedFat: sum.saturatedFat + meal.saturatedFat, sugar: sum.sugar + meal.sugar, fiber: sum.fiber + meal.fiber }), { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, sugar: 0, fiber: 0 });
  const consumedCalories = 1881 + addedTotals.calories;
  const displayMacros = macroData.map((macro) => ({ ...macro, eaten: macro.eaten + addedTotals[macro.name.toLowerCase() as 'protein' | 'carbs' | 'fat'] }));
  const weightKg = weight * 0.45359237;
  const heightCm = energyInputs.heightIn * 2.54;
  const estimatedRmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * energyInputs.age + (energyInputs.sex === 'male' ? 5 : -161));
  const estimatedMaintenance = Math.round(estimatedRmr * energyInputs.activity / 10) * 10;

  const today = new Date().toLocaleDateString('en-CA');
  const libraryMatches = foodLibrary.filter((food) => food.name.toLowerCase().includes(librarySearch.trim().toLowerCase())).slice(0, 8);

  function chooseLibraryFood(food: LibraryFood) {
    setFoodDraft({ mealType: foodDraft.mealType, name: food.name, detail: food.serving, calories: Number(food.calories), protein: Number(food.protein_g), carbs: Number(food.carbs_g), fat: Number(food.fat_g), saturatedFat: Number(food.saturated_fat_g), sugar: Number(food.sugar_g), fiber: Number(food.fiber_g) });
    setScanStatus('idle');
    setScanMeta(null);
    setLibrarySearch('');
  }

  async function scanFoodImage(file: File | undefined) {
    if (!file) return;
    setScanStatus('scanning');
    setScanMessage('Reading the image and estimating nutrition…');
    setScanMeta(null);
    try {
      const prepared = await prepareScanImage(file);
      const form = new FormData();
      form.set('image', prepared);
      const response = await fetch('/api/scan-food', { method: 'POST', body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.result) throw new Error(payload?.error ?? 'Unable to scan this image.');
      const result = payload.result;
      setFoodDraft({
        mealType: foodDraft.mealType,
        name: String(result.name ?? ''),
        detail: String(result.serving ?? 'Estimated serving'),
        calories: Number(result.calories ?? 0),
        protein: Number(result.protein ?? 0),
        carbs: Number(result.carbs ?? 0),
        fat: Number(result.fat ?? 0),
        saturatedFat: Number(result.saturatedFat ?? 0),
        sugar: Number(result.sugar ?? 0),
        fiber: Number(result.fiber ?? 0),
      });
      setScanMeta({ confidence: String(result.confidence ?? 'low'), source: String(result.source ?? 'food_estimate'), notes: String(result.notes ?? '') });
      setScanStatus('ready');
      setScanMessage('Scan complete. Review every value before adding it.');
    } catch (error) {
      setScanStatus('error');
      setScanMessage(error instanceof Error ? error.message : 'Unable to scan this image.');
    } finally {
      if (scanInput.current) scanInput.current.value = '';
    }
  }

  async function addFood() {
    if (!foodDraft.name.trim() || foodDraft.calories <= 0) return;
    setCloudStatus('saving');
    try {
      const response = await fetch('/api/data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add_food', date: today, ...foodDraft }) });
      if (!response.ok) throw new Error('Save failed');
      setAddedMeals((current) => [...current, { ...foodDraft, name: foodDraft.name.trim() }]);
      setFoodDraft({ mealType: 'snacks', name: '', detail: 'Custom serving', calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, sugar: 0, fiber: 0 });
      setFoodModal(false);
      setCloudStatus('synced');
    } catch {
      setCloudStatus('error');
    }
  }

  async function applyCheckIn() {
    setCloudStatus('saving');
    const carbs = goal === 'Lose fat' ? 245 : 270;
    const label = goal === 'Lose fat' ? 'Keep targets steady' : `Add ${goal === 'Reverse diet' ? 50 : 100} calories`;
    try {
      const response = await fetch('/api/data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save_checkin', date: today, goal, weightLb: weight, bodyFat, calories: recommendation, protein: 175, carbs, fat: 68, recommendation: label, calorieDelta: goal === 'Lose fat' ? 0 : goal === 'Reverse diet' ? 50 : 100 }) });
      if (!response.ok) throw new Error('Save failed');
      setApplied(true);
      setCheckIn(false);
      setCloudStatus('synced');
    } catch {
      setCloudStatus('error');
    }
  }

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/data?date=${encodeURIComponent(today)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Load failed');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setDisplayName(String(data.user?.displayName ?? 'Daniel').split('@')[0]);
        if (data.goal) setGoal(data.goal);
        if (data.latestWeighIn?.weightLb) setWeight(Number(data.latestWeighIn.weightLb));
        if (data.latestWeighIn?.bodyFat) setBodyFat(Number(data.latestWeighIn.bodyFat));
        setAddedMeals((data.foods ?? []).map((food: Record<string, unknown>) => ({ mealType: String(food.meal_type ?? 'snacks'), name: String(food.name), detail: String(food.detail), calories: Number(food.calories), protein: Number(food.protein_g), carbs: Number(food.carbs_g), fat: Number(food.fat_g), saturatedFat: Number(food.saturated_fat_g ?? 0), sugar: Number(food.sugar_g ?? 0), fiber: Number(food.fiber_g ?? 0) })));
        setFoodLibrary((data.library ?? []) as LibraryFood[]);
        setCloudStatus('synced');
      })
      .catch(() => active && setCloudStatus('error'));
    return () => { active = false; };
  }, [today]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const controller = new AbortController();
    const tools: WebMcpTool[] = [
      {
        name: 'get_nutrition_summary',
        title: 'Get today’s nutrition summary',
        description: 'Read the current Fuelwise goal, calorie and macro targets, consumption, remaining amounts, and latest progress signal.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: () => ({
          goal,
          calories: { consumed: consumedCalories, target: recommendation, remaining: Math.max(0, recommendation - consumedCalories) },
          macros: Object.fromEntries(displayMacros.map((macro) => [macro.name.toLowerCase(), { consumedGrams: macro.eaten, targetGrams: macro.target, remainingGrams: Math.max(0, macro.target - macro.eaten) }])),
          progress: { sevenDayWeightChangeLb: -0.6, calorieAdherencePercent: 94, proteinAdherencePercent: 91 },
          guidance: 'General nutrition guidance only; not medical care.',
        }),
      },
      {
        name: 'open_weekly_check_in',
        title: 'Open weekly check-in',
        description: 'Open the Fuelwise weekly coaching check-in so the user can review progress and approve any target change.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: () => { setCheckIn(true); return { opened: true, message: 'The weekly check-in is open for user review.' }; },
      },
      {
        name: 'prepare_goal_change',
        title: 'Prepare a nutrition goal change',
        description: 'Select a Fuelwise coaching goal and open the weekly check-in for the user to review before applying recommendations.',
        inputSchema: { type: 'object', properties: { goal: { type: 'string', enum: ['lose_fat', 'increase_performance', 'reverse_diet'], description: 'The coaching goal to prepare.' } }, required: ['goal'], additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: ({ goal: requestedGoal }) => {
          const labels: Record<string, string> = { lose_fat: 'Lose fat', increase_performance: 'Increase performance', reverse_diet: 'Reverse diet' };
          const selected = labels[String(requestedGoal)];
          if (!selected) throw new Error('Unsupported goal.');
          setGoal(selected);
          setCheckIn(true);
          return { prepared: true, goal: selected, requiresUserApproval: true, message: 'The check-in is open so the user can review and apply the recommendation.' };
        },
      },
      {
        name: 'prepare_food_entry',
        title: 'Prepare a food-log entry',
        description: 'Prefill a food entry and open it for the user to review before it changes today’s nutrition totals.',
        inputSchema: { type: 'object', properties: { meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] }, name: { type: 'string' }, serving: { type: 'string' }, calories: { type: 'number', minimum: 0 }, protein_g: { type: 'number', minimum: 0 }, carbs_g: { type: 'number', minimum: 0 }, fat_g: { type: 'number', minimum: 0 }, saturated_fat_g: { type: 'number', minimum: 0 }, sugar_g: { type: 'number', minimum: 0 }, fiber_g: { type: 'number', minimum: 0 } }, required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g'], additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: (input) => {
          setFoodDraft({ mealType: String(input.meal_type ?? 'snacks'), name: String(input.name), detail: input.serving ? String(input.serving) : 'Custom serving', calories: Number(input.calories), protein: Number(input.protein_g), carbs: Number(input.carbs_g), fat: Number(input.fat_g), saturatedFat: Number(input.saturated_fat_g ?? 0), sugar: Number(input.sugar_g ?? 0), fiber: Number(input.fiber_g ?? 0) });
          setFoodModal(true);
          return { prepared: true, requiresUserApproval: true, message: 'The food entry is open for review before it is added.' };
        },
      },
      {
        name: 'estimate_daily_energy_needs',
        title: 'Estimate resting and maintenance energy',
        description: 'Estimate adult resting energy with the Mifflin-St Jeor equation and maintenance energy with an activity multiplier. This is not a metabolism diagnosis.',
        inputSchema: { type: 'object', properties: { age: { type: 'number', minimum: 18, maximum: 100 }, sex: { type: 'string', enum: ['male', 'female'], description: 'Sex used by the prediction equation.' }, height_cm: { type: 'number', minimum: 120, maximum: 230 }, weight_kg: { type: 'number', minimum: 35, maximum: 350 }, activity_multiplier: { type: 'number', minimum: 1.2, maximum: 1.9 } }, required: ['age', 'sex', 'height_cm', 'weight_kg', 'activity_multiplier'], additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: (input) => {
          const rmr = Math.round(10 * Number(input.weight_kg) + 6.25 * Number(input.height_cm) - 5 * Number(input.age) + (input.sex === 'male' ? 5 : -161));
          return { estimatedRestingKcalPerDay: rmr, estimatedMaintenanceKcalPerDay: Math.round(rmr * Number(input.activity_multiplier) / 10) * 10, method: 'Mifflin-St Jeor predictive equation', limitations: 'Adult estimate only; not a diagnosis or substitute for indirect calorimetry or clinical care.' };
        },
      },
    ];
    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).then(() => setWebMcpReady(true)).catch(() => setWebMcpReady(false));
    return () => controller.abort();
  }, [goal, recommendation, addedMeals]);
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">F</span><span>Fuelwise</span></div>
        <nav aria-label="Main navigation">
          <a className="nav-item active" href="#today"><span>⌂</span>Today</a>
          <a className="nav-item" href="#progress"><span>↗</span>Progress</a>
          <button className="nav-item nav-button" type="button" onClick={() => setCheckIn(true)}><span>✓</span>Check-in</button>
          <a className="nav-item" href="#plan"><span>◎</span>Your plan</a>
        </nav>
        <div className="goal-card"><span className="eyebrow">CURRENT GOAL</span><strong>{goal}</strong><p>Week 4 of 12</p><div className="goal-track"><span /></div></div>
        <button className="profile" type="button"><span>{displayName.slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>{cloudStatus === 'synced' ? 'Cloud synced' : cloudStatus === 'saving' ? 'Saving…' : cloudStatus === 'error' ? 'Sync issue' : 'Connecting…'}</small></div><b>•••</b></button>
      </aside>
      <section className="content" id="today">
        <header className="topbar"><div><p>MONDAY, AUGUST 26</p><h1>Good morning, {displayName}</h1></div><button className="checkin-button" type="button" onClick={() => setCheckIn(true)}>Weekly check-in <span>→</span></button></header>
        <div className="coach-note"><span className="coach-icon">✦</span><div><strong>You’re right on track</strong><p>Your 7-day weight trend is down 0.6 lb. Keep targets steady this week.</p></div><button type="button" aria-label="Dismiss coaching note">×</button></div>
        <section className={`calorie-card ${nutritionExpanded ? 'expanded' : ''}`}>
          <div className="calorie-summary">
            <div className="calorie-copy"><span className="eyebrow">TODAY’S CALORIES</span><div><strong>{consumedCalories.toLocaleString()}</strong><span>/ {recommendation.toLocaleString()} kcal</span></div><p>{Math.max(0, recommendation - consumedCalories).toLocaleString()} calories remaining</p></div>
            <div className="calorie-visual" aria-label={`${Math.round(consumedCalories / recommendation * 100)}% of calorie target consumed`}><span>{Math.min(100, Math.round(consumedCalories / recommendation * 100))}%</span></div>
          </div>
          <div className="macro-strip" aria-label="Today’s macronutrients">
            {displayMacros.map((macro) => <div className="macro-summary" key={macro.name}><span className="macro-dot" style={{ background: macro.color }} /><div><small>{macro.name}</small><strong>{macro.eaten}<span> / {macro.target}g</span></strong></div></div>)}
            <button className="nutrition-toggle" type="button" aria-expanded={nutritionExpanded} aria-controls="macro-details" onClick={() => setNutritionExpanded((current) => !current)}><span>{nutritionExpanded ? 'Less' : 'Details'}</span><b aria-hidden="true">⌄</b></button>
          </div>
          {nutritionExpanded && <div className="macro-details" id="macro-details">
            {displayMacros.map((macro) => <div key={macro.name}><div><span>{macro.name}</span><strong>{Math.max(0, macro.target - macro.eaten)}g remaining</strong></div><div className="macro-progress"><span style={{ width: `${Math.min(100, Math.round(macro.eaten / macro.target * 100))}%`, background: macro.color }} /></div></div>)}
            <button className="energy-link" type="button" onClick={() => setMetabolismModal(true)}>Estimate energy needs →</button>
          </div>}
        </section>
        <section className="food-log"><div className="section-heading"><div><h2>Food log</h2><p>{initialMeals.length + addedMeals.length} meals logged today</p></div><button type="button" onClick={() => setFoodModal(true)}>+ Add food</button></div><div className="meal-list">{[...initialMeals, ...addedMeals].map((meal, index) => <div className="meal" key={`${meal.name}-${index}`}><span className="meal-icon">{['☀','◒','◇','+'][Math.min(index, 3)]}</span><div><strong>{meal.name}</strong><p>{meal.detail} · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g</p></div><b>{meal.calories} kcal</b><button type="button" aria-label={`More options for ${meal.name}`}>•••</button></div>)}</div></section>
      </section>
      {foodModal && <div className="modal-backdrop" role="presentation"><section className="checkin-panel compact-panel" role="dialog" aria-modal="true" aria-labelledby="food-title"><button className="modal-close" type="button" onClick={() => setFoodModal(false)} aria-label="Close food entry">×</button><span className="eyebrow">FOOD LOG</span><h2 id="food-title">Add food</h2><p className="panel-intro">Choose a saved favorite, scan an image, or enter the values yourself. Nothing is added until you review and confirm.</p><div className="library-picker"><label htmlFor="library-search">Search 50 imported favorites</label><input id="library-search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search rice, chicken, protein…" autoComplete="off"/><div className="library-results">{libraryMatches.map((food) => <button key={food.id} type="button" onClick={() => chooseLibraryFood(food)}><span><strong>{food.name}</strong><small>{food.serving} · used {food.usage_count}× in Elev8</small></span><b>{food.calories} kcal</b></button>)}{foodLibrary.length > 0 && libraryMatches.length === 0 && <p>No imported favorites match that search.</p>}</div></div><div className="manual-divider"><span>Or scan an image</span></div><div className="scan-card"><div className="scan-icon" aria-hidden="true">⌾</div><div><strong>Scan an image</strong><p>Take a clear photo of one meal or a flat, readable label.</p></div><button type="button" onClick={() => scanInput.current?.click()} disabled={scanStatus === 'scanning'}>{scanStatus === 'scanning' ? 'Scanning…' : 'Choose image'}</button><input ref={scanInput} className="scan-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => scanFoodImage(event.target.files?.[0])}/></div>{scanStatus !== 'idle' && <div className={`scan-feedback ${scanStatus}`} role="status"><strong>{scanStatus === 'ready' ? 'Review scan' : scanStatus === 'error' ? 'Scan issue' : 'Analyzing image'}</strong><span>{scanMessage}</span>{scanMeta && <small>{scanMeta.source === 'nutrition_label' ? 'Nutrition label' : 'Visual estimate'} · {scanMeta.confidence} confidence{scanMeta.notes ? ` · ${scanMeta.notes}` : ''}</small>}</div>}<div className="manual-divider"><span>Review nutrition</span></div><label>Food or meal name<input value={foodDraft.name} onChange={(event) => setFoodDraft({ ...foodDraft, name: event.target.value })} placeholder="e.g. Turkey sandwich" /></label><label className="serving-label">Serving description<input value={foodDraft.detail} onChange={(event) => setFoodDraft({ ...foodDraft, detail: event.target.value })} /></label><div className="nutrition-inputs">{(['calories','protein','carbs','fat','saturatedFat','sugar','fiber'] as const).map((field) => <label key={field}>{field === 'calories' ? 'Calories' : field === 'saturatedFat' ? 'Saturated fat (g)' : `${field[0].toUpperCase()}${field.slice(1)} (g)`}<input type="number" min="0" step="0.1" value={foodDraft[field]} onChange={(event) => setFoodDraft({ ...foodDraft, [field]: Math.max(0, Number(event.target.value)) })}/></label>)}</div><div className="macro-check">Calculated from macros: {Math.round(foodDraft.protein * 4 + foodDraft.carbs * 4 + foodDraft.fat * 9)} kcal</div><button className="apply-button" type="button" onClick={addFood} disabled={!foodDraft.name.trim() || foodDraft.calories <= 0 || scanStatus === 'scanning'}>Add to today</button></section></div>}
      {metabolismModal && <div className="modal-backdrop" role="presentation"><section className="checkin-panel" role="dialog" aria-modal="true" aria-labelledby="energy-title"><button className="modal-close" type="button" onClick={() => setMetabolismModal(false)} aria-label="Close energy estimator">×</button><span className="eyebrow">ENERGY NEEDS ESTIMATE</span><h2 id="energy-title">Your estimated daily burn</h2><p className="panel-intro">This estimates resting energy and maintenance calories from body size, age, sex, and activity. It cannot diagnose a fast or slow metabolism.</p><div className="input-row"><label>Age<input type="number" min="18" max="100" value={energyInputs.age} onChange={(event) => setEnergyInputs({ ...energyInputs, age: Number(event.target.value) })}/></label><label>Sex used by equation<select value={energyInputs.sex} onChange={(event) => setEnergyInputs({ ...energyInputs, sex: event.target.value })}><option value="male">Male</option><option value="female">Female</option></select></label></div><div className="input-row"><label>Height (inches)<input type="number" min="48" max="90" value={energyInputs.heightIn} onChange={(event) => setEnergyInputs({ ...energyInputs, heightIn: Number(event.target.value) })}/></label><label>Activity level<select value={energyInputs.activity} onChange={(event) => setEnergyInputs({ ...energyInputs, activity: Number(event.target.value) })}><option value="1.2">Mostly sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option><option value="1.9">Highly active</option></select></label></div><div className="energy-results"><div><span>Estimated resting energy</span><strong>{estimatedRmr.toLocaleString()}</strong><small>kcal/day</small></div><div><span>Estimated maintenance</span><strong>{estimatedMaintenance.toLocaleString()}</strong><small>kcal/day</small></div></div><div className="recommendation"><span className="coach-icon">i</span><div><strong>Treat this as a starting range</strong><p>Actual needs vary. Fuelwise should refine this estimate using several weeks of consistent intake and weight-trend data.</p></div></div><small className="safety-copy">For adults only. Not for pregnancy, breastfeeding, people under 18, or medical nutrition therapy. Speak with a qualified clinician for individualized care.</small></section></div>}
      {installHelp && <div className="modal-backdrop" role="presentation"><section className="checkin-panel install-panel" role="dialog" aria-modal="true" aria-labelledby="install-title"><button className="modal-close" type="button" onClick={() => setInstallHelp(false)} aria-label="Close installation guide">×</button><img src="/icon-1024.png" alt="Fuelwise app icon"/><span className="eyebrow">INSTALL ON IPHONE</span><h2 id="install-title">Put Fuelwise on your Home Screen</h2><div className="install-steps"><div><b>1</b><p>Open this page in <strong>Safari</strong>.</p></div><div><b>2</b><p>Tap the <strong>Share</strong> button in Safari.</p></div><div><b>3</b><p>Choose <strong>Add to Home Screen</strong>, then tap Add.</p></div></div><p className="install-note">Fuelwise will launch in its own full-screen window and keep its core interface available after it has been loaded.</p></section></div>}
      {checkIn && <div className="modal-backdrop" role="presentation"><section className="checkin-panel" role="dialog" aria-modal="true" aria-labelledby="checkin-title"><button className="modal-close" type="button" onClick={() => setCheckIn(false)} aria-label="Close check-in">×</button><span className="eyebrow">WEEKLY COACHING</span><h2 id="checkin-title">Let’s review your progress</h2><p className="panel-intro">Your plan uses trend weight and nutrition adherence—not a single weigh-in—to decide whether targets should change.</p><label>Primary goal<select value={goal} onChange={(event) => setGoal(event.target.value)}><option>Lose fat</option><option>Increase performance</option><option>Reverse diet</option></select></label><div className="input-row"><label>Body weight <div><input type="number" value={weight} step="0.1" onChange={(event) => setWeight(Number(event.target.value))}/><span>lb</span></div></label><label>Body fat <div><input type="number" value={bodyFat} step="0.1" onChange={(event) => setBodyFat(Number(event.target.value))}/><span>%</span></div></label></div><div className="trend-summary"><div><span>7-day trend</span><strong>−0.6 lb</strong></div><div><span>Calorie adherence</span><strong>94%</strong></div><div><span>Protein adherence</span><strong>91%</strong></div></div><div className="recommendation"><span className="coach-icon">✦</span><div><strong>{goal === 'Lose fat' ? 'Keep your targets steady' : `Add ${goal === 'Reverse diet' ? '50' : '100'} calories`}</strong><p>Recommended target: {recommendation.toLocaleString()} kcal · 175g protein · {goal === 'Lose fat' ? '245' : '270'}g carbs · 68g fat</p></div></div><button className="apply-button" type="button" onClick={applyCheckIn} disabled={cloudStatus === 'saving'}>{cloudStatus === 'saving' ? 'Saving…' : 'Apply recommendation'}</button><small className="safety-copy">Fuelwise offers general nutrition guidance and is not medical care. Consult a qualified professional for individualized health advice.</small></section></div>}
      {applied && <button className="success-toast" type="button" onClick={() => setApplied(false)}>Plan updated successfully <span>×</span></button>}
      <div className={`webmcp-status ${webMcpReady ? 'ready' : ''}`} aria-label={webMcpReady ? 'WebMCP tools available' : 'WebMCP unavailable in this browser'}><span />{webMcpReady ? 'WebMCP ready' : 'WebMCP compatible'}</div>
      <div className={`cloud-status ${cloudStatus}`} role="status"><span />{cloudStatus === 'synced' ? 'Cloud synced' : cloudStatus === 'saving' ? 'Saving to cloud…' : cloudStatus === 'error' ? 'Cloud sync needs attention' : 'Connecting to cloud…'}</div>
      <nav className="mobile-nav" aria-label="Mobile navigation"><a className="selected" href="#today"><span>⌂</span>Today</a><button type="button" onClick={() => setFoodModal(true)}><span>＋</span>Add food</button><button type="button" onClick={() => setCheckIn(true)}><span>✓</span>Check-in</button>{!installed && <button type="button" onClick={() => setInstallHelp(true)}><span>⇧</span>Install</button>}</nav>
    </main>
  );
}
