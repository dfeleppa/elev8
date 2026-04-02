## UI Overhaul Input

<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>LYFE | Business Management Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Manrope:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              colors: {
                "on-secondary-container": "#006c71",
                "on-tertiary-container": "#34007f",
                "outline-variant": "#5c3f46",
                "on-primary-fixed-variant": "#8f0044",
                "secondary-fixed": "#63f7ff",
                "primary": "#ffb1c4",
                "primary-container": "#ff4a8d",
                "on-surface-variant": "#e5bcc5",
                "surface-bright": "#37393d",
                "on-background": "#e1e2e7",
                "background": "#111417",
                "primary-fixed-dim": "#ffb1c4",
                "surface-container-high": "#272a2e",
                "inverse-primary": "#ba005b",
                "surface-variant": "#323538",
                "inverse-on-surface": "#2e3134",
                "tertiary-container": "#a178ff",
                "on-primary-fixed": "#3f001a",
                "surface": "#111417",
                "primary-fixed": "#ffd9e1",
                "surface-container-lowest": "#0b0e12",
                "surface-tint": "#ffb1c4",
                "secondary": "#e6feff",
                "tertiary-fixed": "#e9ddff",
                "tertiary-fixed-dim": "#d1bcff",
                "on-secondary": "#003739",
                "surface-dim": "#111417",
                "on-tertiary": "#3c0090",
                "on-error": "#690005",
                "secondary-fixed-dim": "#00dce5",
                "outline": "#ac878f",
                "surface-container": "#1d2023",
                "surface-container-low": "#191c1f",
                "on-surface": "#e1e2e7",
                "surface-container-highest": "#323538",
                "on-error-container": "#ffdad6",
                "on-secondary-fixed": "#002021",
                "on-primary": "#65002e",
                "tertiary": "#d1bcff",
                "error-container": "#93000a",
                "on-primary-container": "#590028",
                "inverse-surface": "#e1e2e7",
                "error": "#ffb4ab",
                "secondary-container": "#00f4fe",
                "on-secondary-fixed-variant": "#004f53",
                "on-tertiary-fixed-variant": "#5700c9",
                "on-tertiary-fixed": "#23005b"
              },
              fontFamily: {
                "headline": ["Space Grotesk"],
                "body": ["Manrope"],
                "label": ["Manrope"]
              },
              borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
            },
          },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #111417; /* surface-dim */
            color: #e1e2e7; /* on-surface */
            font-family: 'Manrope', sans-serif;
        }
        .neon-glow-pink {
            box-shadow: 0 0 20px rgba(255, 177, 196, 0.1);
        }
        .glass-panel {
            background: rgba(25, 28, 31, 0.6);
            backdrop-filter: blur(24px);
        }
    </style>
</head>
<body class="flex min-h-screen">
<!-- SideNavBar (Execution from JSON) -->
<aside class="hidden md:flex flex-col h-screen w-64 left-0 top-0 fixed bg-[#12171d] border-r border-white/5 py-8 z-50">
<div class="px-6 mb-8">
<h1 class="text-3xl font-black text-[#ffb1c4] font-headline tracking-tighter uppercase">LYFE</h1>
<p class="font-headline font-bold uppercase tracking-widest text-[10px] text-slate-500 mt-1">Elite Member</p>
</div>
<nav class="flex-1 flex flex-col gap-1">
<a class="bg-gradient-to-r from-[#ffb1c4]/10 to-transparent text-[#ffb1c4] border-r-4 border-[#ffb1c4] py-3 px-6 flex items-center gap-4 transition-transform hover:translate-x-1" href="#">
<span class="material-symbols-outlined" data-icon="grid_view">grid_view</span>
<span class="font-headline font-bold uppercase tracking-widest text-xs">Dashboard</span>
</a>
<a class="text-slate-500 py-3 px-6 flex items-center gap-4 hover:text-slate-200 hover:bg-white/5 transition-all duration-200" href="#">
<span class="material-symbols-outlined" data-icon="fitness_center">fitness_center</span>
<span class="font-headline font-bold uppercase tracking-widest text-xs">Workouts</span>
</a>
<a class="text-slate-500 py-3 px-6 flex items-center gap-4 hover:text-slate-200 hover:bg-white/5 transition-all duration-200" href="#">
<span class="material-symbols-outlined" data-icon="restaurant">restaurant</span>
<span class="font-headline font-bold uppercase tracking-widest text-xs">Nutrition</span>
</a>
<a class="text-slate-500 py-3 px-6 flex items-center gap-4 hover:text-slate-200 hover:bg-white/5 transition-all duration-200" href="#">
<span class="material-symbols-outlined" data-icon="group">group</span>
<span class="font-headline font-bold uppercase tracking-widest text-xs">Community</span>
</a>
<a class="text-slate-500 py-3 px-6 flex items-center gap-4 hover:text-slate-200 hover:bg-white/5 transition-all duration-200" href="#">
<span class="material-symbols-outlined" data-icon="person">person</span>
<span class="font-headline font-bold uppercase tracking-widest text-xs">Profile</span>
</a>
</nav>
<div class="px-6 mt-auto">
<button class="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold uppercase tracking-widest text-xs rounded-xl active:scale-95 transition-transform shadow-[0_4px_20px_rgba(255,177,196,0.2)]">
                Start Session
            </button>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="flex-1 md:ml-64 flex flex-col min-h-screen bg-[#111417]">
<!-- TopAppBar (Execution from JSON) -->
<header class="sticky top-0 z-40 bg-[#12171d] border-b border-white/5 shadow-[0_4px_20px_rgba(255,177,196,0.05)]">
<div class="flex justify-between items-center w-full px-6 py-4">
<div class="flex items-center gap-8">
<span class="md:hidden text-2xl font-black tracking-tighter text-[#ffb1c4] uppercase font-headline">LYFE</span>
<nav class="hidden lg:flex items-center gap-6">
<a class="text-[#ffb1c4] border-b-2 border-[#ffb1c4] pb-1 font-headline font-bold tracking-tighter" href="#">Overview</a>
<a class="text-slate-400 hover:text-white transition-colors font-headline font-bold tracking-tighter" href="#">Analytics</a>
<a class="text-slate-400 hover:text-white transition-colors font-headline font-bold tracking-tighter" href="#">Staff</a>
<a class="text-slate-400 hover:text-white transition-colors font-headline font-bold tracking-tighter" href="#">Revenue</a>
</nav>
</div>
<div class="flex items-center gap-4">
<div class="hidden sm:flex items-center bg-surface-container-lowest px-4 py-2 rounded-full border border-white/5">
<span class="material-symbols-outlined text-slate-500 text-sm" data-icon="search">search</span>
<input class="bg-transparent border-none text-xs focus:ring-0 text-on-surface w-40" placeholder="Search data..." type="text"/>
</div>
<div class="flex items-center gap-2">
<button class="p-2 text-slate-400 hover:bg-white/5 rounded-full transition-all duration-300">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="p-2 text-slate-400 hover:bg-white/5 rounded-full transition-all duration-300">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
</button>
</div>
</div>
</div>
</header>
<!-- Dashboard Canvas -->
<div class="p-6 lg:p-10 max-w-7xl mx-auto w-full">
<!-- Page Header -->
<div class="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
<div>
<h2 class="text-4xl lg:text-5xl font-headline font-bold text-on-surface tracking-tighter leading-none mb-2">Executive <span class="text-primary">Dashboard</span></h2>
<p class="text-on-surface-variant max-w-md">Real-time performance metrics for your Miami boutique fitness studio.</p>
</div>
<div class="flex gap-3">
<button class="px-6 py-3 rounded-xl border border-outline-variant/20 font-headline font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/5 transition-all">
<span class="material-symbols-outlined text-sm" data-icon="calendar_today">calendar_today</span>
                        Last 30 Days
                    </button>
<button class="px-6 py-3 rounded-xl bg-secondary-container text-on-secondary-container font-headline font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all">
<span class="material-symbols-outlined text-sm" data-icon="download">download</span>
                        Export
                    </button>
</div>
</div>
<!-- Bento Grid Layout -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
<!-- Priority Metric: MRR -->
<div class="lg:col-span-2 bg-[#171c22] border-t border-l border-white/5 p-8 rounded-xl relative overflow-hidden flex flex-col justify-between group">
<div class="absolute top-0 right-0 p-8">
<span class="material-symbols-outlined text-[#ffb1c4]/20 text-6xl group-hover:scale-110 transition-transform duration-700" data-icon="payments">payments</span>
</div>
<div>
<p class="font-headline font-bold text-on-surface-variant text-xs uppercase tracking-[0.2em] mb-4">Monthly Recurring Revenue</p>
<h3 class="text-5xl font-headline font-bold text-on-surface tracking-tighter">$142,850</h3>
<div class="mt-4 flex items-center gap-2 text-secondary-container">
<span class="material-symbols-outlined text-sm" data-icon="trending_up">trending_up</span>
<span class="text-xs font-bold tracking-widest">+12.4% vs last month</span>
</div>
</div>
<div class="mt-8 h-24 w-full flex items-end gap-1">
<div class="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[40%] rounded-t-sm"></div>
<div class="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[60%] rounded-t-sm"></div>
<div class="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[55%] rounded-t-sm"></div>
<div class="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[80%] rounded-t-sm"></div>
<div class="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[70%] rounded-t-sm"></div>
<div class="flex-1 bg-primary/20 hover:bg-primary transition-colors h-[90%] rounded-t-sm"></div>
<div class="flex-1 bg-primary-container h-full rounded-t-sm"></div>
</div>
</div>
<!-- Priority Metric: Active Members -->
<div class="bg-[#171c22] border-t border-l border-white/5 p-8 rounded-xl flex flex-col justify-between">
<div>
<p class="font-headline font-bold text-on-surface-variant text-xs uppercase tracking-[0.2em] mb-4">Active Members</p>
<h3 class="text-4xl font-headline font-bold text-on-surface tracking-tighter">2,482</h3>
</div>
<div class="mt-6 flex flex-col gap-4">
<div class="flex justify-between items-center text-xs">
<span class="text-slate-500">Capacity</span>
<span class="text-white">82%</span>
</div>
<div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
<div class="h-full bg-secondary-container w-[82%]"></div>
</div>
<p class="text-[10px] text-slate-500 italic">214 new signups this week</p>
</div>
</div>
<!-- Priority Metric: Churn Risk -->
<div class="bg-[#171c22] border-t border-l border-white/5 p-8 rounded-xl flex flex-col justify-between border-primary/10">
<div>
<div class="flex justify-between items-start mb-4">
<p class="font-headline font-bold text-on-surface-variant text-xs uppercase tracking-[0.2em]">Churn Risk</p>
<span class="material-symbols-outlined text-primary" data-icon="warning">warning</span>
</div>
<h3 class="text-4xl font-headline font-bold text-primary tracking-tighter">4.2%</h3>
</div>
<div class="mt-4 flex flex-col gap-2">
<div class="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
<div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">JD</div>
<div>
<p class="text-[10px] font-bold">John Doe</p>
<p class="text-[9px] text-slate-500">Last seen 14 days ago</p>
</div>
</div>
<button class="text-[10px] font-bold text-primary text-left uppercase tracking-widest mt-2 hover:underline">View All Risks</button>
</div>
</div>
<!-- Section: Staff Performance -->
<div class="md:col-span-2 lg:col-span-3 bg-[#171c22] border-t border-l border-white/5 rounded-xl overflow-hidden">
<div class="p-6 border-b border-white/5 flex justify-between items-center">
<h4 class="font-headline font-bold uppercase tracking-widest text-xs">Elite Trainer Performance</h4>
<button class="text-xs text-on-surface-variant hover:text-primary transition-colors">Full Report</button>
</div>
<div class="overflow-x-auto">
<table class="w-full text-left">
<thead>
<tr class="text-[10px] uppercase tracking-widest text-slate-500 bg-surface-container-lowest/50">
<th class="px-6 py-4">Trainer</th>
<th class="px-6 py-4">Sessions</th>
<th class="px-6 py-4">Retention</th>
<th class="px-6 py-4 text-right">Revenue</th>
</tr>
</thead>
<tbody class="text-sm">
<tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
<td class="px-6 py-4 flex items-center gap-3">
<img class="w-10 h-10 rounded-full object-cover border border-primary/20" data-alt="Professional fitness trainer smiling" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhgrE1pGitrszbTVig-_S1ozlstm7vwa6iWHA9QgUa1X5gRTVK50P5AQqihg1KQKplKSBPxtyTSD0WhPJezdR5PJip8MOsgqlpyL7JOItj6Ut6ChiPRQZmMo0iYLUfRrb8_BxmCccj63eoI0kr1F5eEOXMG2B5ioW-KkA3BWik_sJu3YVHhH_KuFH9kfLj89MT5-bCZj33zsirSPbjW6KnFQN1TIi1GpH468uJwTat4TOXOSmJ5KMbSO8U3fvIdru77T23ZiMzTQ"/>
<div>
<p class="font-bold">Marco Valenti</p>
<p class="text-[10px] text-slate-500">HIIT Specialist</p>
</div>
</td>
<td class="px-6 py-4 font-headline">142</td>
<td class="px-6 py-4">
<span class="px-2 py-1 rounded-full bg-secondary-container/10 text-secondary-container text-[10px] font-bold tracking-tighter">98% Retention</span>
</td>
<td class="px-6 py-4 text-right font-headline font-bold text-primary">$12,400</td>
</tr>
<tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
<td class="px-6 py-4 flex items-center gap-3">
<img class="w-10 h-10 rounded-full object-cover border border-primary/20" data-alt="Athletic woman posing for fitness portrait" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMpfmMZYh1nGMlrOA11YLoNr9Y94M8wVXHs8kfL4q7SX3LZoo1IDtzVQyNvmuBC3zX6HV5v-5S46etiY1CHkn5pN_IW_oSGKuSrO-517FCIUIMpWkNbiy7oyiLI-Ajq5fNjcTlPbl9dk0ikm4Vgrfcd5H4DFfPpv9tDgm2TRpT3Msx1v_Qg-KhSJwNGkF2TffxV2XQCvvY7SphGpvrIZ42NyirssfZwFJswW8dEPVQ02_m5EQmIx8ve03yGl2x0piahZsc0uT41Q"/>
<div>
<p class="font-bold">Sofia Chen</p>
<p class="text-[10px] text-slate-500">Pilates Lead</p>
</div>
</td>
<td class="px-6 py-4 font-headline">118</td>
<td class="px-6 py-4">
<span class="px-2 py-1 rounded-full bg-secondary-container/10 text-secondary-container text-[10px] font-bold tracking-tighter">94% Retention</span>
</td>
<td class="px-6 py-4 text-right font-headline font-bold text-primary">$9,850</td>
</tr>
<tr class="hover:bg-white/5 transition-colors">
<td class="px-6 py-4 flex items-center gap-3">
<img class="w-10 h-10 rounded-full object-cover border border-primary/20" data-alt="Yoga instructor in meditation pose" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZ3reT7NEFp5-dQ_zgMAvbpPoo-VM-hhdRTsuI8cT3yB92G9m4sgQWXxQCNcpZMEukCe-46kDB85YpL1K-Vb8pN4zcZAf-iKTQ3SBbweOE8Pv1RC2m2LnLjwD1lf-5nu88h4hrFBT3KREBk9mEGyYYUEBg4-ODTmaPz6RiSRMFJXlbebHZcilPbFG73aZLxG_wGAulfKXTjL5MSf3xnsUkBvq7Nis4AWNWHaUVLE1GebAUu2xAwQ3ptsbzD9bXVI15kU1LotUTSQ"/>
<div>
<p class="font-bold">Elena Rodriguez</p>
<p class="text-[10px] text-slate-500">Yoga Director</p>
</div>
</td>
<td class="px-6 py-4 font-headline">96</td>
<td class="px-6 py-4">
<span class="px-2 py-1 rounded-full bg-tertiary-container/10 text-tertiary-container text-[10px] font-bold tracking-tighter">89% Retention</span>
</td>
<td class="px-6 py-4 text-right font-headline font-bold text-primary">$7,200</td>
</tr>
</tbody>
</table>
</div>
</div>
<!-- Section: Live Studio View -->
<div class="bg-[#171c22] border-t border-l border-white/5 rounded-xl p-6 flex flex-col justify-between">
<div>
<div class="flex items-center gap-2 mb-6">
<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
<h4 class="font-headline font-bold uppercase tracking-widest text-xs">Live Studio Status</h4>
</div>
<div class="aspect-video w-full bg-surface-container-lowest rounded-lg overflow-hidden relative group">
<img class="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2000ms]" data-alt="High-end gym interior with neon lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAlOSpUkLx3ZyVMddzBWvxJkdk-wHiRGDW0htvnOIwjSw5BVpn5sVGMUoLqF6uMAZHUKqu55CEPWfdAHfPmbIQy0YdatkSuv403Y0Y-fKD0IRydXy7eyWcaVaJY-6JgPIcXRj_tojEVt6d9ThaoHvR7IV9dePzKp1WT7Ir1pnmYotG0y0VhZGFlk7ckMmmfAn2ePTLcpfY9PoILZ3l9kgf1U-pwPzzbLqLFuGsIN3VefqZgzFmWMPK_FHSSV419znWpAFrSoSUZ_A"/>
<div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
<div>
<p class="text-xs font-bold">Studio A: Strength HIIT</p>
<p class="text-[10px] text-slate-400">22 / 25 Enrolled</p>
</div>
</div>
</div>
</div>
<div class="mt-6">
<p class="text-[11px] text-slate-500 mb-2">Upcoming Session</p>
<div class="flex justify-between items-center">
<span class="font-bold text-sm tracking-tight text-white">Power Yoga Flow</span>
<span class="text-xs text-primary font-bold">18:00</span>
</div>
</div>
</div>
</div>
<!-- Promotion / Action Section -->
<div class="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
<div class="p-10 rounded-2xl bg-gradient-to-br from-[#12171d] to-[#090c0f] border border-white/5 flex items-center justify-between relative overflow-hidden">
<div class="relative z-10">
<h4 class="text-2xl font-headline font-bold tracking-tight text-white mb-2">Expand Your Empire</h4>
<p class="text-on-surface-variant text-sm mb-6 max-w-xs">New boutique equipment leasing options available for Q3. Upgrade Studio B now.</p>
<button class="px-8 py-3 bg-white text-black font-headline font-bold text-xs uppercase tracking-widest rounded-full hover:bg-primary transition-colors">Inquire Now</button>
</div>
<div class="absolute -right-10 top-0 h-full opacity-20 transform -rotate-12">
<span class="material-symbols-outlined text-[160px] text-white" data-icon="rocket_launch">rocket_launch</span>
</div>
</div>
<div class="p-10 rounded-2xl bg-[#ffb1c4]/5 border border-[#ffb1c4]/20 flex items-center justify-between relative overflow-hidden group">
<div class="relative z-10">
<h4 class="text-2xl font-headline font-bold tracking-tight text-primary mb-2">Member Feedback</h4>
<p class="text-on-surface-variant text-sm mb-6 max-w-xs">Recent NPS scores have increased to 78. View the detailed qualitative report.</p>
<button class="px-8 py-3 border border-primary text-primary font-headline font-bold text-xs uppercase tracking-widest rounded-full hover:bg-primary hover:text-on-primary transition-all">Read Reviews</button>
</div>
<div class="absolute -right-4 bottom-4 opacity-10 transform scale-150">
<span class="material-symbols-outlined text-[120px] text-primary" data-icon="forum">forum</span>
</div>
</div>
</div>
</div>
</main>
<!-- Floating Action Button - Only for Owners on Mobile -->
<button class="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center z-50">
<span class="material-symbols-outlined" data-icon="add">add</span>
</button>
</body></html>

### 1) Design source
- Figma link:
- Access notes (if any):
- Key frames/pages to implement first:

### 2) Scope
- Target platform: web / mobile / both
- Priority screens (ordered):
- Components to redesign first:

### 3) Brand and visual direction
- Fonts:
- Primary colors:
- Secondary colors:
- Spacing style (tight / balanced / roomy):
- Visual references (links):

### 4) UX requirements
- Navigation behavior:
- Must-keep interactions:
- Accessibility requirements:
- Responsive breakpoints or device targets:

### 5) Assets
- Icons source:
- Image source:
- Logo files:
- Any downloadable asset links:

### 6) Implementation constraints
- Existing design system to follow:
- Libraries to avoid:
- Deadline or milestones:

### 7) Success criteria
- What should feel different after overhaul:
- What should remain unchanged:
- How you want the result validated:
