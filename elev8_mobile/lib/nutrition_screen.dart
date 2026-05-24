import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:go_router/go_router.dart';

import 'components/sidebar_shell.dart';
import 'components/bottom_nav_bar.dart';
import 'data/repositories/nutrition_repository.dart';
import 'services/coach_api_service.dart';
import 'theme/app_colors.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final nutritionViewModeProvider = NotifierProvider<ViewModeNotifier, ViewMode>(
  () => ViewModeNotifier(),
);

enum ViewMode { consumed, remaining }

class ViewModeNotifier extends Notifier<ViewMode> {
  @override
  ViewMode build() => ViewMode.remaining;
  void toggle() => state = state == ViewMode.consumed
      ? ViewMode.remaining
      : ViewMode.consumed;

  void set(ViewMode mode) => state = mode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _dateStr(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
String _dateDisplay(DateTime d) => DateFormat('MMMM d, yyyy').format(d);

double _num(dynamic v, [double def = 0]) {
  if (v == null) return def;
  if (v is double) return v;
  if (v is int) return v.toDouble();
  if (v is num) return v.toDouble();
  return def;
}

double _qty(dynamic v) {
  final n = _num(v);
  return n <= 0 ? 1.0 : n;
}

String _fmt(double v) => v.toStringAsFixed(v == v.roundToDouble() ? 0 : 2);

String _mealLabel(String k) {
  return {
        'breakfast': 'Breakfast',
        'lunch': 'Lunch',
        'dinner': 'Dinner',
        'snack': 'Snack',
      }[k] ??
      k;
}

const _mealKeys = ['breakfast', 'lunch', 'dinner', 'snack'];

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

class NutritionScreen extends ConsumerWidget {
  const NutritionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedDateProvider);
    final nutritionAsync = ref.watch(nutritionDayProvider(selectedDate));
    final viewMode = ref.watch(nutritionViewModeProvider);

    final isToday = _dateStr(selectedDate) == _dateStr(DateTime.now());

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: Column(
            children: [
              // ---- Date Header ----
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(
                        Icons.chevron_left,
                        color: Color(0xFF020617),
                      ),
                      onPressed: () {
                        ref
                            .read(selectedDateProvider.notifier)
                            .setDate(
                              selectedDate.subtract(const Duration(days: 1)),
                            );
                      },
                    ),
                    GestureDetector(
                      onTap: () => _openDatePicker(context, ref, selectedDate),
                      child: Column(
                        children: [
                          Text(
                            isToday ? 'Today' : _dateDisplay(selectedDate),
                            style: const TextStyle(
                              color: Color(0xFF020617),
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (!isToday)
                            Text(
                              'Tap to open calendar',
                              style: TextStyle(
                                color: AppColors.webCyan,
                                fontSize: 12,
                              ),
                            ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.chevron_right,
                        color: Color(0xFF020617),
                      ),
                      onPressed: () {
                        ref
                            .read(selectedDateProvider.notifier)
                            .setDate(selectedDate.add(const Duration(days: 1)));
                      },
                    ),
                  ],
                ),
              ),

              // ---- View Mode Toggle ----
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: Colors.black.withValues(alpha: 0.05),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          _ModeBtn(
                            title: 'Remaining',
                            isActive: viewMode == ViewMode.remaining,
                            onTap: () => ref
                                .read(nutritionViewModeProvider.notifier)
                                .set(ViewMode.remaining),
                          ),
                          _ModeBtn(
                            title: 'Consumed',
                            isActive: viewMode == ViewMode.consumed,
                            onTap: () => ref
                                .read(nutritionViewModeProvider.notifier)
                                .set(ViewMode.consumed),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              Expanded(
                child: nutritionAsync.when(
                  data: (data) =>
                      _Dashboard(data: data, selectedDate: selectedDate),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) {
                    debugPrint('[NutritionScreen] day load failed: $e');
                    return const Center(
                      child: Text(
                        "Couldn't load nutrition. Pull to retry.",
                        style: TextStyle(color: Colors.redAccent),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 3),
      ),
    );
  }

  Future<void> _openDatePicker(
    BuildContext context,
    WidgetRef ref,
    DateTime current,
  ) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF0EA5E9),
              onPrimary: Colors.white,
              surface: Color(0xFF1E293B),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      ref.read(selectedDateProvider.notifier).setDate(picked);
    }
  }
}

class _ModeBtn extends StatelessWidget {
  final String title;
  final bool isActive;
  final VoidCallback onTap;
  const _ModeBtn({
    required this.title,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF0EA5E9) : Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          title,
          style: TextStyle(
            color: isActive ? Colors.white : Colors.black45,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

class _Dashboard extends ConsumerWidget {
  final Map<String, dynamic>? data;
  final DateTime selectedDate;

  const _Dashboard({required this.data, required this.selectedDate});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewMode = ref.watch(nutritionViewModeProvider);

    final targets = (
      calories: _num(data?['calorie_target'], 2500),
      protein: _num(data?['protein_target'], 180),
      carbs: _num(data?['carbs_target'], 250),
      fat: _num(data?['fat_target'], 80),
      fiber: _num(data?['fiber_target'], 30),
    );

    final entries = (data?['nutrition_entries'] as List<dynamic>?) ?? [];

    // Single pass over entries — previously this was four separate
    // `.fold()` calls, scanning the list four times per build. With ~50
    // entries that's 200 iterations on every viewMode toggle.
    double cal = 0, pro = 0, carb = 0, fat = 0, fib = 0;
    for (final e in entries) {
      final q = _qty(e['quantity']);
      cal += _num(e['calories']) * q;
      pro += _num(e['protein']) * q;
      carb += _num(e['carbs']) * q;
      fat += _num(e['fat']) * q;
      fib += _num(e['fiber']) * q;
    }

    final consumed = (
      calories: cal,
      protein: pro,
      carbs: carb,
      fat: fat,
      fiber: fib,
    );
    final remaining = (
      calories: targets.calories - consumed.calories,
      protein: targets.protein - consumed.protein,
      carbs: targets.carbs - consumed.carbs,
      fat: targets.fat - consumed.fat,
    );

    final displayCal = viewMode == ViewMode.remaining
        ? remaining.calories
        : consumed.calories;

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(nutritionDayProvider(selectedDate)),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ---- Macro Rings ----
            _MacroRings(
              displayCal: displayCal,
              targetCal: targets.calories,
              consumedCalories: consumed.calories,
              consumedProtein: consumed.protein,
              targetProtein: targets.protein,
              consumedCarbs: consumed.carbs,
              targetCarbs: targets.carbs,
              consumedFat: consumed.fat,
              targetFat: targets.fat,
              consumedFiber: consumed.fiber,
              targetFiber: targets.fiber,
              viewMode: viewMode,
              remainingProtein: remaining.protein,
              remainingCarbs: remaining.carbs,
              remainingFat: remaining.fat,
            ),

            const SizedBox(height: 16),

            // ---- Coach Card ----
            const _CoachCard(),

            const SizedBox(height: 16),

            // ---- Meals Card ----
            _MealsCard(
              entries: entries,
              selectedDate: selectedDate,
              consumed: consumed,
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Macro Rings
// ---------------------------------------------------------------------------

class _MacroRings extends StatelessWidget {
  final double displayCal, targetCal, consumedCalories;
  final double consumedProtein, targetProtein;
  final double consumedCarbs, targetCarbs;
  final double consumedFat, targetFat;
  final double consumedFiber, targetFiber;
  final ViewMode viewMode;
  final double remainingProtein, remainingCarbs, remainingFat;

  const _MacroRings({
    required this.displayCal,
    required this.targetCal,
    required this.consumedCalories,
    required this.consumedProtein,
    required this.targetProtein,
    required this.consumedCarbs,
    required this.targetCarbs,
    required this.consumedFat,
    required this.targetFat,
    required this.consumedFiber,
    required this.targetFiber,
    required this.viewMode,
    required this.remainingProtein,
    required this.remainingCarbs,
    required this.remainingFat,
  });

  @override
  Widget build(BuildContext context) {
    final calProgress = targetCal <= 0
        ? 0.0
        : (consumedCalories / targetCal).clamp(0.0, 1.0);
    final calToGo = (targetCal - consumedCalories)
        .clamp(0, double.infinity)
        .toInt();

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 22),
      decoration: BoxDecoration(
        color: AppColors.webPink,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.webPink.withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                viewMode == ViewMode.remaining
                    ? 'CALORIES LEFT'
                    : 'CALORIES CONSUMED',
                style: TextStyle(
                  color: AppColors.webPinkInk.withValues(alpha: 0.7),
                  fontSize: 11,
                  letterSpacing: 1.8,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$calToGo kcal to go',
                  style: TextStyle(
                    color: AppColors.webPinkInk,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                height: 132,
                width: 132,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      height: 132,
                      width: 132,
                      child: CircularProgressIndicator(
                        value: 1.0,
                        strokeWidth: 11,
                        backgroundColor: Colors.transparent,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          Colors.black.withValues(alpha: 0.14),
                        ),
                      ),
                    ),
                    SizedBox(
                      height: 132,
                      width: 132,
                      child: CircularProgressIndicator(
                        value: calProgress,
                        strokeWidth: 11,
                        backgroundColor: Colors.transparent,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.webPinkInk,
                        ),
                        strokeCap: StrokeCap.round,
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          displayCal.toInt().toString(),
                          style: TextStyle(
                            color: AppColors.webPinkInk,
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                            height: 1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'of ${targetCal.toInt()}',
                          style: TextStyle(
                            color: AppColors.webPinkInk.withValues(alpha: 0.6),
                            fontSize: 10,
                            letterSpacing: 1.4,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${(calProgress * 100).round()}%',
                          style: TextStyle(
                            color: AppColors.webPinkInk,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _MacroBar(
                      label: 'Protein',
                      value: consumedProtein,
                      target: targetProtein,
                    ),
                    const SizedBox(height: 10),
                    _MacroBar(
                      label: 'Carbs',
                      value: consumedCarbs,
                      target: targetCarbs,
                    ),
                    const SizedBox(height: 10),
                    _MacroBar(
                      label: 'Fat',
                      value: consumedFat,
                      target: targetFat,
                    ),
                    const SizedBox(height: 10),
                    _MacroBar(
                      label: 'Fiber',
                      value: consumedFiber,
                      target: targetFiber,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MacroBar extends StatelessWidget {
  final String label;
  final double value;
  final double target;

  const _MacroBar({
    required this.label,
    required this.value,
    required this.target,
  });

  @override
  Widget build(BuildContext context) {
    final progress = target <= 0 ? 0.0 : (value / target).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                color: AppColors.webPinkInk,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              '${value.toInt()}/${target.toInt()}g',
              style: TextStyle(
                color: AppColors.webPinkInk,
                fontSize: 13,
                fontWeight: FontWeight.w700,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 4,
            backgroundColor: Colors.black.withValues(alpha: 0.15),
            valueColor: AlwaysStoppedAnimation<Color>(
              AppColors.webPinkInk.withValues(alpha: 0.85),
            ),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          '${(progress * 100).round()}%',
          style: TextStyle(
            color: AppColors.webPinkInk.withValues(alpha: 0.6),
            fontSize: 10,
            fontWeight: FontWeight.w600,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Coach Card
// ---------------------------------------------------------------------------

class _CoachCard extends ConsumerStatefulWidget {
  const _CoachCard();

  @override
  ConsumerState<_CoachCard> createState() => _CoachCardState();
}

class _CoachCardState extends ConsumerState<_CoachCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final coachAsync = ref.watch(coachPlanStatusProvider);

    return coachAsync.when(
      data: (plan) {
        if (plan == null || !plan.hasPlan) {
          return _NoCoachCard();
        }
        return _RealCoachCard(
          plan: plan,
          expanded: _expanded,
          onToggle: () => setState(() => _expanded = !_expanded),
        );
      },
      loading: () => Container(
        padding: const EdgeInsets.all(24),
        decoration: _coachDecoration(),
        child: const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Colors.white54,
            ),
          ),
        ),
      ),
      error: (_, _) => _NoCoachCard(),
    );
  }

  BoxDecoration _coachDecoration() {
    return BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
      ),
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: Colors.white10),
    );
  }
}

class _NoCoachCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          const Text(
            'COACH',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 12,
              letterSpacing: 2,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'No nutrition coach plan yet.',
            style: TextStyle(color: Colors.white, fontSize: 14),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => context.push('/coach-setup'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.webVioletInk,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            child: const Text(
              'Set Up Plan',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

class _RealCoachCard extends StatelessWidget {
  final CoachPlanStatus plan;
  final bool expanded;
  final VoidCallback onToggle;

  const _RealCoachCard({
    required this.plan,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          // Header (always visible)
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'COACH',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          letterSpacing: 2,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        plan.goalLabel,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                // Settings button
                IconButton(
                  icon: const Icon(
                    Icons.settings,
                    color: Colors.white54,
                    size: 20,
                  ),
                  onPressed: () => _showCoachSettings(context),
                ),
                // Expand/collapse
                IconButton(
                  icon: Icon(
                    expanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: Colors.white54,
                  ),
                  onPressed: onToggle,
                ),
              ],
            ),
          ),

          // Expanded content
          if (expanded) ...[
            const Divider(color: Colors.white12, height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
              child: Column(
                children: [
                  _WeightProgress(plan: plan),
                  const SizedBox(height: 12),
                  _CheckInTimeline(plan: plan),
                  if (plan.checkInDueToday) ...[
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () => _showCheckInSheet(context),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.webPink,
                          foregroundColor: AppColors.webPinkInk,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text(
                          'Start 10-day check-in',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],

          if (!expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: Row(
                children: [
                  if (plan.currentWeight != null)
                    _CompactStat(
                      label: 'Current',
                      value: '${plan.currentWeight!.toStringAsFixed(1)} lb',
                    ),
                  if (plan.currentWeight != null && plan.targetWeight != null)
                    const SizedBox(width: 12),
                  if (plan.targetWeight != null)
                    _CompactStat(
                      label: 'Goal',
                      value: '${plan.targetWeight!.toStringAsFixed(1)} lb',
                    ),
                  const Spacer(),
                  if (plan.checkInDueToday)
                    GestureDetector(
                      onTap: () => _showCheckInSheet(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.webPink,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Check-in due',
                          style: TextStyle(
                            color: AppColors.webPinkInk,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    )
                  else
                    Text(
                      '${plan.daysUntilCheckIn}d until check-in',
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void _showCoachSettings(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _CoachSettingsSheet(plan: plan),
    );
  }

  void _showCheckInSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _CheckInSheet(plan: plan),
    );
  }
}

class _CompactStat extends StatelessWidget {
  final String label, value;
  const _CompactStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.white54,
            fontSize: 10,
            letterSpacing: 1,
          ),
        ),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 14)),
      ],
    );
  }
}

class _WeightProgress extends StatelessWidget {
  final CoachPlanStatus plan;
  const _WeightProgress({required this.plan});

  @override
  Widget build(BuildContext context) {
    final pct = plan.weightProgressPercent ?? 0;
    // First bar (start → current): fill proportionally up to 50% of total
    final bar1Fill = (pct / 100 * 2).clamp(0.0, 1.0);
    // Second bar (current → goal): fill once past 50%
    final bar2Fill = ((pct / 100 * 2) - 1).clamp(0.0, 1.0);
    final hasCurrent = plan.currentWeight != null;
    final hasProgress = pct > 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'WEIGHT PROGRESS',
                style: TextStyle(
                  color: Colors.white54,
                  fontSize: 10,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                '${pct.toInt()}% to goal',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // Start node
              _weightNode(
                plan.startWeight != null
                    ? plan.startWeight!.toStringAsFixed(1)
                    : '—',
                'Start',
                const Color(0xFF7DD3FC), // sky-300
              ),
              // Bar 1: start → current
              Expanded(
                child: _progressBar(
                  bar1Fill,
                  const Color(0xFF7DD3FC),
                  const Color(0xFF22D3EE),
                ),
              ),
              // Current node
              _weightNode(
                hasCurrent
                    ? plan.currentWeight!.toStringAsFixed(1)
                    : '—',
                'Current',
                hasProgress
                    ? const Color(0xFF22D3EE) // cyan-400
                    : Colors.white24,
              ),
              // Bar 2: current → goal
              Expanded(
                child: _progressBar(
                  bar2Fill,
                  const Color(0xFF22D3EE),
                  const Color(0xFF34D399),
                ),
              ),
              // Goal node
              _weightNode(
                plan.targetWeight != null
                    ? plan.targetWeight!.toStringAsFixed(1)
                    : '—',
                'Goal',
                pct >= 100
                    ? const Color(0xFF34D399) // emerald-400
                    : Colors.white24,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _weightNode(String value, String label, Color borderColor) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.05),
            border: Border.all(color: borderColor.withValues(alpha: 0.6), width: 2),
          ),
          child: Center(
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: Colors.white38, fontSize: 9),
        ),
      ],
    );
  }

  Widget _progressBar(double fill, Color fromColor, Color toColor) {
    return Container(
      height: 4,
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(2),
        color: Colors.white.withValues(alpha: 0.1),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: fill,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(2),
            gradient: LinearGradient(colors: [fromColor, toColor]),
          ),
        ),
      ),
    );
  }
}

class _CheckInTimeline extends StatelessWidget {
  final CoachPlanStatus plan;
  const _CheckInTimeline({required this.plan});

  String _dateLabel(DateTime? date) {
    if (date == null) return '—';
    return DateFormat('MMM d').format(date);
  }

  @override
  Widget build(BuildContext context) {
    final dots = plan.checkInDots;
    final lastDate = plan.lastCheckInDate ?? plan.effectiveDate;
    final daysUntil = plan.daysUntilCheckIn;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Last check-in: ${_dateLabel(lastDate)}',
                style: const TextStyle(color: Colors.white54, fontSize: 11),
              ),
              Text(
                'Next check-in: ${_dateLabel(plan.nextCheckInDate)}',
                style: const TextStyle(color: Colors.white54, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: List.generate(10, (i) {
              return Expanded(
                child: Container(
                  height: 8,
                  margin: EdgeInsets.only(right: i < 9 ? 3 : 0),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    gradient: dots[i]
                        ? const LinearGradient(
                            colors: [Color(0xFF38BDF8), Color(0xFF22D3EE)],
                          )
                        : null,
                    color: dots[i] ? null : Colors.white.withValues(alpha: 0.1),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          Text(
            daysUntil == 0
                ? 'Check-in due today'
                : '$daysUntil day${daysUntil == 1 ? '' : 's'} until next check-in',
            style: TextStyle(
              color: daysUntil == 0 ? Colors.amber : Colors.white54,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _CoachSettingsSheet extends ConsumerStatefulWidget {
  final CoachPlanStatus plan;
  const _CoachSettingsSheet({required this.plan});

  @override
  ConsumerState<_CoachSettingsSheet> createState() =>
      _CoachSettingsSheetState();
}

class _CoachSettingsSheetState extends ConsumerState<_CoachSettingsSheet> {
  late String _selectedGoal;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _selectedGoal = widget.plan.goalType ?? 'lose_weight';
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Coach Settings',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'GOAL',
              style: TextStyle(
                color: Colors.white54,
                fontSize: 11,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 8),
            ...NutritionGoal.values.map(
              (goal) => _GoalOption(
                goal: goal,
                isSelected: _selectedGoal == goal.id,
                onTap: () => setState(() => _selectedGoal = goal.id),
              ),
            ),
            if (_saving)
              const Padding(
                padding: EdgeInsets.only(top: 16),
                child: Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white54,
                  ),
                ),
              ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  _saving ? 'Saving…' : 'Save Changes',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/coach-setup');
                },
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.white24),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Edit Full Plan',
                  style: TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref
          .read(nutritionRepositoryProvider)
          .updateCoachGoal(_selectedGoal);
      ref.invalidate(coachPlanStatusProvider);
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _GoalOption extends StatelessWidget {
  final NutritionGoal goal;
  final bool isSelected;
  final VoidCallback onTap;

  const _GoalOption({
    required this.goal,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF0EA5E9).withValues(alpha: 0.2)
              : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF0EA5E9).withValues(alpha: 0.6)
                : Colors.white10,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected
                    ? const Color(0xFF0EA5E9)
                    : Colors.transparent,
                border: Border.all(
                  color: isSelected ? const Color(0xFF0EA5E9) : Colors.white24,
                  width: 2,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              goal.label,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.white70,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Check-in Sheet — 10-day review form
// ---------------------------------------------------------------------------

class _CheckInSheet extends ConsumerStatefulWidget {
  final CoachPlanStatus plan;
  const _CheckInSheet({required this.plan});

  @override
  ConsumerState<_CheckInSheet> createState() => _CheckInSheetState();
}

class _CheckInSheetState extends ConsumerState<_CheckInSheet> {
  late final TextEditingController _weightCtrl;
  late final TextEditingController _bfCtrl;
  late NutritionGoal _goal;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _weightCtrl = TextEditingController(
      text: widget.plan.currentWeight?.toStringAsFixed(1) ?? '',
    );
    _bfCtrl = TextEditingController(
      text: widget.plan.bodyFatPercent?.toStringAsFixed(1) ?? '',
    );
    _goal =
        NutritionGoal.fromString(widget.plan.goalType) ??
        NutritionGoal.maintain;
  }

  @override
  void dispose() {
    _weightCtrl.dispose();
    _bfCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final weight = double.tryParse(_weightCtrl.text.trim());
    final bf = double.tryParse(_bfCtrl.text.trim());
    if (weight == null || weight <= 0) {
      setState(() => _error = 'Enter a valid bodyweight in pounds.');
      return;
    }
    if (bf == null || bf <= 0 || bf >= 100) {
      setState(() => _error = 'Body fat must be between 1 and 99 percent.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await CoachApiService.submitCheckIn(
        bodyWeightLbs: weight,
        bodyFatPercent: bf,
        goalType: _goal.id,
      );
      if (!mounted) return;
      ref.invalidate(coachPlanStatusProvider);
      Navigator.pop(context);
      final messenger = ScaffoldMessenger.maybeOf(context);
      final delta = result.calorieDelta;
      final msg = switch (result.action) {
        'adjusted' when delta != null && delta != 0 =>
          'Check-in applied. Calories ${delta > 0 ? 'increased' : 'decreased'} by ${delta.abs()} kcal/day.',
        'adjusted' => 'Check-in applied. Plan updated.',
        'counter_reset' =>
          'Check-in window reset — log more consistently before the next review.',
        _ => 'Check-in recorded. Plan held steady.',
      };
      messenger?.showSnackBar(SnackBar(content: Text(msg)));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Could not submit check-in. Try again.';
      });
      debugPrint('[CheckInSheet] submit failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + viewInsets),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '10-day check-in',
            style: TextStyle(
              color: AppColors.webPink,
              fontSize: 11,
              letterSpacing: 1.8,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Confirm your numbers',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'If tracking was adherent, your calories will adjust based on progress.',
            style: TextStyle(color: Colors.white60, fontSize: 12),
          ),
          const SizedBox(height: 20),
          _CheckInField(
            label: 'Bodyweight (lbs)',
            controller: _weightCtrl,
          ),
          const SizedBox(height: 12),
          _CheckInField(
            label: 'Body fat (%)',
            controller: _bfCtrl,
          ),
          const SizedBox(height: 16),
          const Text(
            'Goal',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ...NutritionGoal.values.map(
            (g) => _GoalOption(
              goal: g,
              isSelected: _goal == g,
              onTap: () => setState(() => _goal = g),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 13),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.webPink,
              foregroundColor: AppColors.webPinkInk,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text(
                    'Submit check-in',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
          ),
        ],
      ),
    );
  }
}

class _CheckInField extends StatelessWidget {
  final String label;
  final TextEditingController controller;

  const _CheckInField({required this.label, required this.controller});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.white60),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.05),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.white12),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.webCyan, width: 1.5),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Meals Card
// ---------------------------------------------------------------------------

class _MealsCard extends StatelessWidget {
  final List<dynamic> entries;
  final DateTime selectedDate;
  final ({
    double calories,
    double protein,
    double carbs,
    double fat,
    double fiber,
  })
  consumed;

  const _MealsCard({
    required this.entries,
    required this.selectedDate,
    required this.consumed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: const Row(
              children: [
                Text(
                  'MEALS',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    letterSpacing: 2,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          // Meal rows
          ..._mealKeys.asMap().entries.map((mapEntry) {
            final i = mapEntry.key;
            final mealKey = mapEntry.value;
            final mealEntries = entries
                .where((e) => e['meal_type'] == mealKey)
                .toList();
            final isLast = i == _mealKeys.length - 1;
            return Column(
              children: [
                _MealRow(
                  mealKey: mealKey,
                  entries: mealEntries,
                  selectedDate: selectedDate,
                  isLast: isLast,
                ),
                if (!isLast) const Divider(height: 1, color: Colors.black12),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _MealRow extends ConsumerWidget {
  final String mealKey;
  final List<dynamic> entries;
  final DateTime selectedDate;
  final bool isLast;

  const _MealRow({
    required this.mealKey,
    required this.entries,
    required this.selectedDate,
    required this.isLast,
  });

  double _mealCalories() {
    return entries.fold(
      0.0,
      (s, e) => s + _num(e['calories']) * _qty(e['quantity']),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: isLast
            ? const BorderRadius.vertical(bottom: Radius.circular(24))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _mealLabel(mealKey),
                style: const TextStyle(
                  color: Color(0xFF020617),
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Row(
                children: [
                  Text(
                    '${_mealCalories().toInt()} kcal',
                    style: const TextStyle(
                      color: Colors.black45,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 4),
                  // Actions menu
                  GestureDetector(
                    onTap: () => _showMealActions(context, ref),
                    child: const Icon(
                      Icons.more_vert,
                      color: Colors.black26,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 4),
                  // Add button
                  GestureDetector(
                    onTap: () => _openAddFood(context, ref),
                    child: const Icon(
                      Icons.add_circle,
                      color: Color(0xFFE11D8A),
                      size: 28,
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Entry list
          if (entries.isNotEmpty) ...[
            const SizedBox(height: 12),
            // Stable key on each entry so Flutter reuses the State of
            // _FoodEntryRow across parent rebuilds instead of disposing +
            // reconstructing on every viewMode toggle / data refresh.
            ...entries.map(
              (entry) => _FoodEntryRow(
                key: ValueKey(entry['id']),
                entry: entry,
                selectedDate: selectedDate,
              ),
            ),
          ] else ...[
            const SizedBox(height: 12),
            const Center(
              child: Text(
                'No entries yet.',
                style: TextStyle(color: Colors.black26, fontSize: 13),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _openAddFood(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) =>
          _FoodDialog(mealKey: mealKey, selectedDate: selectedDate, ref: ref),
    );
  }

  void _showMealActions(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(
                Icons.calendar_today,
                color: Colors.blueAccent,
              ),
              title: const Text(
                'Copy Meal to Another Day',
                style: TextStyle(color: Colors.white),
              ),
              onTap: () {
                Navigator.pop(ctx);
                _openCopyMealDialog(context, ref);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete, color: Colors.redAccent),
              title: const Text(
                'Delete Entire Meal',
                style: TextStyle(color: Colors.white),
              ),
              onTap: () async {
                Navigator.pop(ctx);
                final confirmed = await _confirmDelete(context);
                if (!confirmed) return;
                await ref
                    .read(nutritionRepositoryProvider)
                    .deleteMealEntries(selectedDate, mealKey);
                ref.invalidate(nutritionDayProvider(selectedDate));
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<bool> _confirmDelete(BuildContext context) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            title: const Text(
              'Delete Meal?',
              style: TextStyle(color: Colors.white),
            ),
            content: Text(
              'Remove all ${_mealLabel(mealKey)} entries for ${DateFormat('MMM d').format(selectedDate)}?',
              style: const TextStyle(color: Colors.white70),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: TextButton.styleFrom(foregroundColor: Colors.redAccent),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _openCopyMealDialog(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _CopyMealSheet(
        sourceDate: selectedDate,
        sourceMeal: mealKey,
        ref: ref,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Food Entry Row (with serving size editor)
// ---------------------------------------------------------------------------

class _FoodEntryRow extends ConsumerStatefulWidget {
  final dynamic entry;
  final DateTime selectedDate;

  const _FoodEntryRow({super.key, required this.entry, required this.selectedDate});

  @override
  ConsumerState<_FoodEntryRow> createState() => _FoodEntryRowState();
}

class _FoodEntryRowState extends ConsumerState<_FoodEntryRow> {
  bool _editing = false;
  late TextEditingController _servingCtrl;
  late double _quantity;

  @override
  void initState() {
    super.initState();
    _quantity = _qty(widget.entry['quantity']);
    _servingCtrl = TextEditingController(text: _fmt(_quantity));
  }

  @override
  void dispose() {
    _servingCtrl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _FoodEntryRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.entry['id'] != widget.entry['id']) {
      _quantity = _qty(widget.entry['quantity']);
      _servingCtrl.text = _fmt(_quantity);
      _editing = false;
    }
  }

  double get _cal => _num(widget.entry['calories']) * _quantity;
  double get _p => _num(widget.entry['protein']) * _quantity;
  double get _c => _num(widget.entry['carbs']) * _quantity;
  double get _f => _num(widget.entry['fat']) * _quantity;
  String get _name => widget.entry['entry_name'] ?? 'Unknown';
  String get _id => widget.entry['id'];

  Future<void> _saveServing() async {
    final parsed = double.tryParse(_servingCtrl.text.replaceAll(',', '.'));
    if (parsed == null || parsed <= 0) return;
    setState(() => _editing = false);
    _quantity = parsed;
    await ref
        .read(nutritionRepositoryProvider)
        .updateEntryQuantity(_id, parsed);
    // Avoid touching `ref` if the row was dismissed mid-save.
    if (!mounted) return;
    ref.invalidate(nutritionDayProvider(widget.selectedDate));
  }

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(_id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.redAccent.withValues(alpha: 0.8),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      confirmDismiss: (details) async {
        final nav = Navigator.of(context);
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            title: const Text(
              'Remove Entry?',
              style: TextStyle(color: Colors.white),
            ),
            content: Text(
              'Remove "$_name"?',
              style: const TextStyle(color: Colors.white70),
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => nav.pop(),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => nav.pop(true),
                style: TextButton.styleFrom(foregroundColor: Colors.redAccent),
                child: const Text('Remove'),
              ),
            ],
          ),
        );
        return confirmed ?? false;
      },
      onDismissed: (_) async {
        await ref.read(nutritionRepositoryProvider).deleteNutritionEntry(_id);
        ref.invalidate(nutritionDayProvider(widget.selectedDate));
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _name,
                    style: const TextStyle(
                      color: Color(0xFF020617),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    '${_cal.toInt()} kcal  ·  P:${_p.toInt()}g  C:${_c.toInt()}g  F:${_f.toInt()}g',
                    style: const TextStyle(color: Colors.black45, fontSize: 12),
                  ),
                ],
              ),
            ),
            // Serving size control
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_editing) ...[
                  SizedBox(
                    width: 60,
                    child: TextField(
                      controller: _servingCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFF020617),
                        fontSize: 14,
                      ),
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 6,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: Colors.black12),
                        ),
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[\d.,]')),
                      ],
                      onSubmitted: (_) => _saveServing(),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.check,
                      color: Colors.greenAccent,
                      size: 18,
                    ),
                    onPressed: _saveServing,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.close,
                      color: Colors.redAccent,
                      size: 18,
                    ),
                    onPressed: () {
                      setState(() {
                        _editing = false;
                        _servingCtrl.text = _fmt(_quantity);
                      });
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32),
                  ),
                ] else ...[
                  // Quick adjust buttons
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.black12),
                      ),
                      child: const Icon(
                        Icons.remove,
                        color: Colors.black26,
                        size: 14,
                      ),
                    ),
                    onPressed: () async {
                      final next = (_quantity - 0.25).clamp(0.25, 99.0);
                      await ref
                          .read(nutritionRepositoryProvider)
                          .updateEntryQuantity(_id, next);
                      ref.invalidate(nutritionDayProvider(widget.selectedDate));
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 28),
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _editing = true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.black12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${_fmt(_quantity)} srv',
                        style: const TextStyle(
                          color: Color(0xFF020617),
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.black12),
                      ),
                      child: const Icon(
                        Icons.add,
                        color: Colors.black26,
                        size: 14,
                      ),
                    ),
                    onPressed: () async {
                      final next = _quantity + 0.25;
                      await ref
                          .read(nutritionRepositoryProvider)
                          .updateEntryQuantity(_id, next);
                      ref.invalidate(nutritionDayProvider(widget.selectedDate));
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 28),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Food Dialog (tabs: Recent / My Foods / USDA Search / Create)
// ---------------------------------------------------------------------------

class _FoodDialog extends StatefulWidget {
  final String mealKey;
  final DateTime selectedDate;
  final WidgetRef ref;

  const _FoodDialog({
    required this.mealKey,
    required this.selectedDate,
    required this.ref,
  });

  @override
  State<_FoodDialog> createState() => _FoodDialogState();
}

class _FoodDialogState extends State<_FoodDialog>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  List<Map<String, dynamic>> _recent = [];
  List<Map<String, dynamic>> _myFoods = [];
  List<Map<String, dynamic>> _usdaResults = [];
  bool _loading = true;
  bool _searching = false;
  String _searchQuery = '';

  // Filter for Recents / My Foods tabs
  final _listSearchCtrl = TextEditingController();
  String _listSearchQuery = '';

  // Create form
  final _nameCtrl = TextEditingController();
  final _calCtrl = TextEditingController();
  final _proCtrl = TextEditingController();
  final _carbCtrl = TextEditingController();
  final _fatCtrl = TextEditingController();
  bool _creating = false;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
    _tabCtrl.addListener(() {
      if (mounted) setState(() {});
    });
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _listSearchCtrl.dispose();
    _nameCtrl.dispose();
    _calCtrl.dispose();
    _proCtrl.dispose();
    _carbCtrl.dispose();
    _fatCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final repo = widget.ref.read(nutritionRepositoryProvider);
    final results = await Future.wait([
      repo.fetchRecentFoods(),
      repo.fetchMyFoods(),
    ]);
    if (mounted) {
      setState(() {
        _recent = results[0].cast<Map<String, dynamic>>();
        _myFoods = results[1].cast<Map<String, dynamic>>();
        _loading = false;
      });
    }
  }

  Future<void> _searchUsda(String query) async {
    if (query.trim().length < 2) return;
    setState(() {
      _searching = true;
      _searchQuery = query;
    });
    final repo = widget.ref.read(nutritionRepositoryProvider);
    final results = await repo.searchUsdaFoods(query);
    if (mounted) {
      setState(() {
        _usdaResults = results;
        _searching = false;
      });
    }
  }

  Future<void> _addFood(Map<String, dynamic> food) async {
    final repo = widget.ref.read(nutritionRepositoryProvider);
    await repo.addNutritionEntry(
      date: widget.selectedDate,
      mealType: widget.mealKey,
      name: food['entry_name'] ?? food['name'] ?? 'Unknown',
      quantity: 1.0,
      calories: food['calories'],
      protein: food['protein'],
      carbs: food['carbs'],
      fat: food['fat'],
    );
    widget.ref.invalidate(nutritionDayProvider(widget.selectedDate));
    if (mounted) Navigator.pop(context);
  }

  Future<void> _createFood() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) return;
    setState(() => _creating = true);
    try {
      final repo = widget.ref.read(nutritionRepositoryProvider);
      final food = await repo.addCustomFood(
        name: name,
        calories: num.tryParse(_calCtrl.text),
        protein: num.tryParse(_proCtrl.text),
        carbs: num.tryParse(_carbCtrl.text),
        fat: num.tryParse(_fatCtrl.text),
      );
      if (food != null && mounted) {
        await _addFood(food);
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        top: 24,
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        children: [
          // Title
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Add to ${_mealLabel(widget.mealKey)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white54),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Tab bar
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: TabBar(
              controller: _tabCtrl,
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              indicator: BoxDecoration(
                color: const Color(0xFF0EA5E9),
                borderRadius: BorderRadius.circular(12),
              ),
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white54,
              labelStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
              tabs: const [
                Tab(text: 'Recents'),
                Tab(text: 'My Foods'),
                Tab(text: 'Search'),
                Tab(text: 'Create'),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Search field for Recents / My Foods tabs
          if (_tabCtrl.index == 0 || _tabCtrl.index == 1) ...[
            TextField(
              controller: _listSearchCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search foods...',
                hintStyle: const TextStyle(color: Colors.white38),
                prefixIcon: const Icon(Icons.search, color: Colors.white38),
                suffixIcon: _listSearchQuery.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close, color: Colors.white38),
                        onPressed: () {
                          _listSearchCtrl.clear();
                          setState(() => _listSearchQuery = '');
                        },
                      ),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.05),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
              onChanged: (v) => setState(() => _listSearchQuery = v),
            ),
            const SizedBox(height: 12),
          ],

          // Tab content
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.white54),
                  )
                : TabBarView(
                    controller: _tabCtrl,
                    children: [
                      _FoodList(
                        foods: _filterFoods(_recent),
                        onAdd: _addFood,
                        emptyMsg: 'No recent foods.',
                      ),
                      _MyFoodsTab(
                        foods: _filterFoods(_myFoods),
                        onAdd: _addFood,
                        onEdit: (f) => _showEditFoodDialog(f),
                        onDelete: _deleteFood,
                        emptyMsg: 'No custom foods yet.',
                      ),
                      _UsdaSearchTab(
                        results: _usdaResults,
                        searching: _searching,
                        query: _searchQuery,
                        onSearch: _searchUsda,
                        onAdd: _addFood,
                      ),
                      _CreateFoodTab(
                        nameCtrl: _nameCtrl,
                        calCtrl: _calCtrl,
                        proCtrl: _proCtrl,
                        carbCtrl: _carbCtrl,
                        fatCtrl: _fatCtrl,
                        creating: _creating,
                        onCreate: _createFood,
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _filterFoods(List<Map<String, dynamic>> foods) {
    final q = _listSearchQuery.trim().toLowerCase();
    if (q.isEmpty) return foods;
    return foods.where((f) {
      final name = (f['entry_name'] ?? f['name'] ?? '').toString().toLowerCase();
      return name.contains(q);
    }).toList();
  }

  void _showEditFoodDialog(Map<String, dynamic> food) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _EditFoodSheet(
        food: food,
        onSave: (updated) async {
          final repo = widget.ref.read(nutritionRepositoryProvider);
          await repo.updateCustomFood(food['id'], updated);
          setState(() {
            final idx = _myFoods.indexWhere((f) => f['id'] == food['id']);
            if (idx >= 0) _myFoods[idx] = {..._myFoods[idx], ...updated};
          });
        },
      ),
    );
  }

  Future<void> _deleteFood(String id) async {
    final repo = widget.ref.read(nutritionRepositoryProvider);
    await repo.deleteCustomFood(id);
    setState(() {
      _myFoods.removeWhere((f) => f['id'] == id);
    });
  }
}

class _FoodList extends StatelessWidget {
  final List<Map<String, dynamic>> foods;
  final void Function(Map<String, dynamic>) onAdd;
  final String emptyMsg;

  const _FoodList({
    required this.foods,
    required this.onAdd,
    required this.emptyMsg,
  });

  @override
  Widget build(BuildContext context) {
    if (foods.isEmpty) {
      return Center(
        child: Text(emptyMsg, style: const TextStyle(color: Colors.white54)),
      );
    }
    return ListView.builder(
      itemCount: foods.length,
      itemBuilder: (ctx, i) {
        final food = foods[i];
        final name = food['entry_name'] ?? food['name'] ?? '?';
        return ListTile(
          title: Text(name, style: const TextStyle(color: Colors.white)),
          subtitle: Text(
            '${food['calories'] ?? 0}cal · P:${food['protein'] ?? 0}g · C:${food['carbs'] ?? 0}g · F:${food['fat'] ?? 0}g',
            style: const TextStyle(color: Colors.white38, fontSize: 12),
          ),
          trailing: ElevatedButton(
            onPressed: () => onAdd(food),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0EA5E9),
              shape: const StadiumBorder(),
            ),
            child: const Text('Add', style: TextStyle(color: Colors.white)),
          ),
        );
      },
    );
  }
}

class _MyFoodsTab extends StatelessWidget {
  final List<Map<String, dynamic>> foods;
  final void Function(Map<String, dynamic>) onAdd;
  final void Function(Map<String, dynamic>) onEdit;
  final void Function(String) onDelete;
  final String emptyMsg;

  const _MyFoodsTab({
    required this.foods,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
    required this.emptyMsg,
  });

  @override
  Widget build(BuildContext context) {
    if (foods.isEmpty) {
      return Center(
        child: Text(emptyMsg, style: const TextStyle(color: Colors.white54)),
      );
    }
    return ListView.builder(
      itemCount: foods.length,
      itemBuilder: (ctx, i) {
        final food = foods[i];
        final name = food['name'] ?? '?';
        return ListTile(
          title: Text(name, style: const TextStyle(color: Colors.white)),
          subtitle: Text(
            '${food['calories'] ?? 0}cal · P:${food['protein'] ?? 0}g · C:${food['carbs'] ?? 0}g · F:${food['fat'] ?? 0}g',
            style: const TextStyle(color: Colors.white38, fontSize: 12),
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.edit, color: Colors.white38, size: 18),
                onPressed: () => onEdit(food),
              ),
              IconButton(
                icon: const Icon(
                  Icons.delete,
                  color: Colors.redAccent,
                  size: 18,
                ),
                onPressed: () => onDelete(food['id']),
              ),
              ElevatedButton(
                onPressed: () => onAdd(food),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  shape: const StadiumBorder(),
                ),
                child: const Text(
                  'Add',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _UsdaSearchTab extends StatefulWidget {
  final List<Map<String, dynamic>> results;
  final bool searching;
  final String query;
  final void Function(String) onSearch;
  final void Function(Map<String, dynamic>) onAdd;

  const _UsdaSearchTab({
    required this.results,
    required this.searching,
    required this.query,
    required this.onSearch,
    required this.onAdd,
  });

  @override
  State<_UsdaSearchTab> createState() => _UsdaSearchTabState();
}

class _UsdaSearchTabState extends State<_UsdaSearchTab> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Search bar
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _searchCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Search USDA foods…',
                  hintStyle: const TextStyle(color: Colors.white38),
                  prefixIcon: const Icon(Icons.search, color: Colors.white38),
                  filled: true,
                  fillColor: Colors.white.withValues(alpha: 0.05),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                ),
                onSubmitted: (v) => widget.onSearch(v),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: () => widget.onSearch(_searchCtrl.text),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5E9),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
              ),
              child: const Text(
                'Search',
                style: TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Results
        Expanded(
          child: widget.searching
              ? const Center(
                  child: CircularProgressIndicator(color: Colors.white54),
                )
              : widget.results.isEmpty
              ? Center(
                  child: Text(
                    widget.query.isEmpty
                        ? 'Search for foods by name'
                        : 'No results for "${widget.query}"',
                    style: const TextStyle(color: Colors.white54),
                  ),
                )
              : ListView.builder(
                  itemCount: widget.results.length,
                  itemBuilder: (ctx, i) {
                    final r = widget.results[i];
                    return ListTile(
                      title: Text(
                        r['description'] ?? '?',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: r['brandOwner'] != null
                          ? Text(
                              r['brandOwner'],
                              style: const TextStyle(
                                color: Colors.white38,
                                fontSize: 11,
                              ),
                            )
                          : null,
                      trailing: Text(
                        '${r['calories'] ?? 0}cal',
                        style: const TextStyle(
                          color: Colors.white54,
                          fontSize: 12,
                        ),
                      ),
                      onTap: () => widget.onAdd({
                        'entry_name': r['description'],
                        'calories': r['calories'],
                        'protein': r['protein'],
                        'carbs': r['carbs'],
                        'fat': r['fat'],
                      }),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _CreateFoodTab extends StatelessWidget {
  final TextEditingController nameCtrl, calCtrl, proCtrl, carbCtrl, fatCtrl;
  final bool creating;
  final VoidCallback onCreate;

  const _CreateFoodTab({
    required this.nameCtrl,
    required this.calCtrl,
    required this.proCtrl,
    required this.carbCtrl,
    required this.fatCtrl,
    required this.creating,
    required this.onCreate,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        children: [
          TextField(
            controller: nameCtrl,
            style: const TextStyle(color: Colors.white),
            decoration: _inputDeco('Food Name *'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: calCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDeco('Calories'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: proCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDeco('Protein (g)'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: carbCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDeco('Carbs (g)'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: fatCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDeco('Fat (g)'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: creating ? null : onCreate,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5E9),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                creating ? 'Saving…' : 'Save & Add',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDeco(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white54),
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.white10),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF0EA5E9)),
      ),
    );
  }
}

class _EditFoodSheet extends StatefulWidget {
  final Map<String, dynamic> food;
  final Future<void> Function(Map<String, dynamic>) onSave;

  const _EditFoodSheet({required this.food, required this.onSave});

  @override
  State<_EditFoodSheet> createState() => _EditFoodSheetState();
}

class _EditFoodSheetState extends State<_EditFoodSheet> {
  late TextEditingController _name, _cal, _pro, _carb, _fat;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.food['name'] ?? '');
    _cal = TextEditingController(text: '${widget.food['calories'] ?? ''}');
    _pro = TextEditingController(text: '${widget.food['protein'] ?? ''}');
    _carb = TextEditingController(text: '${widget.food['carbs'] ?? ''}');
    _fat = TextEditingController(text: '${widget.food['fat'] ?? ''}');
  }

  @override
  void dispose() {
    _name.dispose();
    _cal.dispose();
    _pro.dispose();
    _carb.dispose();
    _fat.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Edit Food',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _name,
              style: const TextStyle(color: Colors.white),
              decoration: _deco('Food Name'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _cal,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: _deco('Calories'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _pro,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: _deco('Protein'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _carb,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: _deco('Carbs'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _fat,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: _deco('Fat'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving
                    ? null
                    : () async {
                        // Capture the navigator before awaiting so we don't
                        // use a stale BuildContext after the async gap.
                        final navigator = Navigator.of(context);
                        setState(() => _saving = true);
                        await widget.onSave({
                          'name': _name.text.trim(),
                          'calories': num.tryParse(_cal.text),
                          'protein': num.tryParse(_pro.text),
                          'carbs': num.tryParse(_carb.text),
                          'fat': num.tryParse(_fat.text),
                        });
                        if (mounted) navigator.pop();
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  _saving ? 'Saving…' : 'Save Changes',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _deco(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white54),
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.white10),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF0EA5E9)),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Copy Meal Sheet
// ---------------------------------------------------------------------------

class _CopyMealSheet extends StatefulWidget {
  final DateTime sourceDate;
  final String sourceMeal;
  final WidgetRef ref;

  const _CopyMealSheet({
    required this.sourceDate,
    required this.sourceMeal,
    required this.ref,
  });

  @override
  State<_CopyMealSheet> createState() => _CopyMealSheetState();
}

class _CopyMealSheetState extends State<_CopyMealSheet> {
  late DateTime _targetDate;
  late String _targetMeal;
  bool _copying = false;

  @override
  void initState() {
    super.initState();
    _targetDate = DateTime.now();
    _targetMeal = widget.sourceMeal;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Copy ${_mealLabel(widget.sourceMeal)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Target date
            const Text(
              'TARGET DATE',
              style: TextStyle(
                color: Colors.white54,
                fontSize: 11,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _targetDate,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                  builder: (context, child) {
                    return Theme(
                      data: Theme.of(context).copyWith(
                        colorScheme: const ColorScheme.light(
                          primary: Color(0xFF0EA5E9),
                          onPrimary: Colors.white,
                          surface: Color(0xFF1E293B),
                          onSurface: Colors.white,
                        ),
                      ),
                      child: child!,
                    );
                  },
                );
                if (picked != null) {
                  setState(() => _targetDate = picked);
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_today,
                      color: Colors.white54,
                      size: 18,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      DateFormat('MMMM d, yyyy').format(_targetDate),
                      style: const TextStyle(color: Colors.white, fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Target meal
            const Text(
              'TARGET MEAL',
              style: TextStyle(
                color: Colors.white54,
                fontSize: 11,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: _mealKeys.map((key) {
                final selected = _targetMeal == key;
                return GestureDetector(
                  onTap: () => setState(() => _targetMeal = key),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? const Color(0xFF0EA5E9)
                          : Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: selected
                            ? const Color(0xFF0EA5E9)
                            : Colors.white10,
                      ),
                    ),
                    child: Text(
                      _mealLabel(key),
                      style: TextStyle(
                        color: selected ? Colors.white : Colors.white70,
                        fontWeight: selected
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),

            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _copying ? null : _copy,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  _copying
                      ? 'Copying…'
                      : 'Copy to ${_mealLabel(_targetMeal)} on ${DateFormat('MMM d').format(_targetDate)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _copy() async {
    setState(() => _copying = true);
    try {
      await widget.ref
          .read(nutritionRepositoryProvider)
          .copyMealToDate(
            sourceDate: widget.sourceDate,
            sourceMeal: widget.sourceMeal,
            targetDate: _targetDate,
            targetMeal: _targetMeal,
          );
      // Refresh both days if different
      widget.ref.invalidate(nutritionDayProvider(widget.sourceDate));
      if (_dateStr(_targetDate) != _dateStr(widget.sourceDate)) {
        widget.ref.invalidate(nutritionDayProvider(_targetDate));
      }
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _copying = false);
    }
  }
}
