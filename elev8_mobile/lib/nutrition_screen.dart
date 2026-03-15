import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'components/sidebar_shell.dart';
import 'components/bottom_nav_bar.dart';
import 'data/repositories/nutrition_repository.dart';

class NutritionViewModeNotifier extends Notifier<String> {
  @override
  String build() => 'remaining';
}

final nutritionViewModeProvider = NotifierProvider<NutritionViewModeNotifier, String>(NutritionViewModeNotifier.new);

class NutritionScreen extends ConsumerWidget {
  const NutritionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedDateProvider);
    final nutritionAsync = ref.watch(nutritionDayProvider(selectedDate));
    final viewMode = ref.watch(nutritionViewModeProvider);

    final displayDateStr = DateFormat('MMMM d, yyyy').format(selectedDate);
    final isToday = DateFormat('yyyy-MM-dd').format(selectedDate) == DateFormat('yyyy-MM-dd').format(DateTime.now());

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent, // Let gradient show through
        body: SafeArea(
          child: Column(
            children: [
              // Date Selector Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left, color: Color(0xFF020617)),
                      onPressed: () {
                        ref.read(selectedDateProvider.notifier).state = selectedDate.subtract(const Duration(days: 1));
                      },
                    ),
                    GestureDetector(
                      onTap: () {
                        ref.read(selectedDateProvider.notifier).state = DateTime.now();
                      },
                      child: Column(
                        children: [
                          Text(
                            isToday ? 'Today' : displayDateStr,
                            style: const TextStyle(color: Color(0xFF020617), fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          if (!isToday) 
                            const Text('Tap to return to Today', style: TextStyle(color: Colors.blueAccent, fontSize: 12)),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right, color: Color(0xFF020617)),
                      onPressed: () {
                        ref.read(selectedDateProvider.notifier).state = selectedDate.add(const Duration(days: 1));
                      },
                    ),
                  ],
                ),
              ),

              // View Mode Toggle
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.black.withOpacity(0.05)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          )
                        ],
                      ),
                      child: Row(
                        children: [
                          _ModeToggleButton(title: 'Remaining', mode: 'remaining', currentMode: viewMode, ref: ref),
                          _ModeToggleButton(title: 'Consumed', mode: 'consumed', currentMode: viewMode, ref: ref),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              Expanded(
                child: nutritionAsync.when(
                  data: (data) => _buildNutritionDashboard(context, ref, data, viewMode, selectedDate),
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: Colors.redAccent))),
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 3),
      ),
    );
  }

  Widget _buildNutritionDashboard(BuildContext context, WidgetRef ref, Map<String, dynamic>? data, String viewMode, DateTime selectedDate) {
    final targetCalories = (data?['calorie_target'] as num?)?.toDouble() ?? 2500.0;
    final targetProtein = (data?['protein_target'] as num?)?.toDouble() ?? 180.0;
    final targetCarbs = (data?['carbs_target'] as num?)?.toDouble() ?? 250.0;
    final targetFat = (data?['fat_target'] as num?)?.toDouble() ?? 75.0;

    final entries = (data?['nutrition_entries'] as List<dynamic>?) ?? [];
    
    final consumedCalories = entries.fold<double>(0.0, (sum, item) => sum + (((item['calories'] as num?)?.toDouble() ?? 0.0) * ((item['quantity'] as num?)?.toDouble() ?? 1.0)));
    final consumedProtein = entries.fold<double>(0.0, (sum, item) => sum + (((item['protein'] as num?)?.toDouble() ?? 0.0) * ((item['quantity'] as num?)?.toDouble() ?? 1.0)));
    final consumedCarbs = entries.fold<double>(0.0, (sum, item) => sum + (((item['carbs'] as num?)?.toDouble() ?? 0.0) * ((item['quantity'] as num?)?.toDouble() ?? 1.0)));
    final consumedFat = entries.fold<double>(0.0, (sum, item) => sum + (((item['fat'] as num?)?.toDouble() ?? 0.0) * ((item['quantity'] as num?)?.toDouble() ?? 1.0)));

    final displayCalories = viewMode == 'remaining' ? (targetCalories - consumedCalories) : consumedCalories;
    
    final breakfastEntries = entries.where((e) => e['meal_type'] == 'breakfast').toList();
    final lunchEntries = entries.where((e) => e['meal_type'] == 'lunch').toList();
    final dinnerEntries = entries.where((e) => e['meal_type'] == 'dinner').toList();
    final snackEntries = entries.where((e) => e['meal_type'] == 'snack').toList();

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(nutritionDayProvider(selectedDate));
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [

            // Header Summary Ring
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.black.withOpacity(0.05)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: Row(
                children: [
                  SizedBox(
                    height: 100,
                    width: 100,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          height: 100, width: 100,
                          child: CircularProgressIndicator(
                            value: 1.0,
                            strokeWidth: 9,
                            backgroundColor: Colors.transparent,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.blueAccent.withOpacity(0.15)),
                          ),
                        ),
                        SizedBox(
                          height: 100, width: 100,
                          child: CircularProgressIndicator(
                            value: (consumedProtein / targetProtein).clamp(0.0, 1.0),
                            strokeWidth: 9,
                            backgroundColor: Colors.transparent,
                            valueColor: const AlwaysStoppedAnimation<Color>(Colors.blueAccent),
                            strokeCap: StrokeCap.round,
                          ),
                        ),
                        SizedBox(
                          height: 72, width: 72,
                          child: CircularProgressIndicator(
                            value: 1.0,
                            strokeWidth: 9,
                            backgroundColor: Colors.transparent,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.orangeAccent.withOpacity(0.15)),
                          ),
                        ),
                        SizedBox(
                          height: 72, width: 72,
                          child: CircularProgressIndicator(
                            value: (consumedCarbs / targetCarbs).clamp(0.0, 1.0),
                            strokeWidth: 9,
                            backgroundColor: Colors.transparent,
                            valueColor: const AlwaysStoppedAnimation<Color>(Colors.orangeAccent),
                            strokeCap: StrokeCap.round,
                          ),
                        ),
                        SizedBox(
                          height: 44, width: 44,
                          child: CircularProgressIndicator(
                            value: 1.0,
                            strokeWidth: 9,
                            backgroundColor: Colors.transparent,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.greenAccent.withOpacity(0.15)),
                          ),
                        ),
                        SizedBox(
                          height: 44, width: 44,
                          child: CircularProgressIndicator(
                            value: (consumedFat / targetFat).clamp(0.0, 1.0),
                            strokeWidth: 9,
                            backgroundColor: Colors.transparent,
                            valueColor: const AlwaysStoppedAnimation<Color>(Colors.greenAccent),
                            strokeCap: StrokeCap.round,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _MacroRowItem(
                          title: 'Cal', 
                          val1: displayCalories, 
                          val2: targetCalories, 
                          isHeader: true,
                          textColor: const Color(0xFF020617),
                          subTextColor: Colors.black54,
                        ),
                        const SizedBox(height: 20),
                        _MacroRowItem(
                          title: 'Protein', 
                          dotColor: Colors.blueAccent, 
                          val1: viewMode == 'remaining' ? (targetProtein - consumedProtein) : consumedProtein, 
                          val2: targetProtein,
                          textColor: const Color(0xFF020617),
                          subTextColor: Colors.black54,
                        ),
                        const SizedBox(height: 16),
                        _MacroRowItem(
                          title: 'Carbs', 
                          dotColor: Colors.orangeAccent, 
                          val1: viewMode == 'remaining' ? (targetCarbs - consumedCarbs) : consumedCarbs, 
                          val2: targetCarbs,
                          textColor: const Color(0xFF020617),
                          subTextColor: Colors.black54,
                        ),
                        const SizedBox(height: 16),
                        _MacroRowItem(
                          title: 'Fat', 
                          dotColor: Colors.greenAccent, 
                          val1: viewMode == 'remaining' ? (targetFat - consumedFat) : consumedFat, 
                          val2: targetFat,
                          textColor: const Color(0xFF020617),
                          subTextColor: Colors.black54,
                        ),
                      ],
                    ),
                  )
                ],
              ),
            ),

            const SizedBox(height: 16),
            const _CoachCard(),
            const SizedBox(height: 16),
            // Unified Meals Card
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.black.withOpacity(0.05)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: Column(
                children: [
                  // Blue Gradient Header
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Color(0xFF0EA5E9), Color(0xFF2563EB)],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                    ),
                    width: double.infinity,
                    child: const Text(
                      'MEALS', 
                      style: TextStyle(color: Colors.white, fontSize: 14, letterSpacing: 2, fontWeight: FontWeight.bold)
                    ),
                  ),
                  
                  // Meal Sections
                  _MealContainer(title: 'Breakfast', mealType: 'breakfast', entries: breakfastEntries, selectedDate: selectedDate, ref: ref, isFlat: true),
                  const Divider(height: 1, color: Colors.black12),
                  _MealContainer(title: 'Lunch', mealType: 'lunch', entries: lunchEntries, selectedDate: selectedDate, ref: ref, isFlat: true),
                  const Divider(height: 1, color: Colors.black12),
                  _MealContainer(title: 'Dinner', mealType: 'dinner', entries: dinnerEntries, selectedDate: selectedDate, ref: ref, isFlat: true),
                  const Divider(height: 1, color: Colors.black12),
                  _MealContainer(title: 'Snack', mealType: 'snack', entries: snackEntries, selectedDate: selectedDate, ref: ref, isFlat: true, isLast: true),
                ],
              ),
            ),
            
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _CoachCard extends StatefulWidget {
  const _CoachCard();

  @override
  State<_CoachCard> createState() => _CoachCardState();
}

class _CoachCardState extends State<_CoachCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0EA5E9), Color(0xFF2563EB)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white10),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(
          dividerColor: Colors.transparent,
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
        ),
        child: ExpansionTile(
          initiallyExpanded: false,
          onExpansionChanged: (val) => setState(() => _isExpanded = val),
          tilePadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          childrenPadding: const EdgeInsets.only(left: 24, right: 24, bottom: 24, top: 0),
          title: const Text('COACH', style: TextStyle(color: Colors.white, fontSize: 14, letterSpacing: 2, fontWeight: FontWeight.bold)),
          trailing: Icon(
            _isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
            color: Colors.white54,
          ),
          children: [
            Row(
              children: [
                const Expanded(child: _CoachStat(title: 'GOAL OBJECTIVE', value: 'Lose weight')),
                const SizedBox(width: 12),
                const Expanded(child: _CoachStat(title: 'GOAL WEIGHT', value: '180 lb')),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Expanded(child: _CoachStat(title: 'TREND WEIGHT', value: '183.6 lb')),
                const SizedBox(width: 12),
                Expanded(child: _CoachStat(title: 'NEXT CHECK-IN', value: DateFormat('MMM d, yyyy').format(DateTime.now().add(const Duration(days: 7))))),
              ],
            ),
            const SizedBox(height: 20),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blueAccent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                child: const Text('Check-in', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            )
          ],
        ),
      ),
    );
  }
}

class _CoachStat extends StatelessWidget {
  final String title;
  final String value;
  const _CoachStat({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 14)),
        ],
      ),
    );
  }
}

class _ModeToggleButton extends StatelessWidget {
  final String title;
  final String mode;
  final String currentMode;
  final WidgetRef ref;

  const _ModeToggleButton({required this.title, required this.mode, required this.currentMode, required this.ref});

  @override
  Widget build(BuildContext context) {
    final isSelected = mode == currentMode;
    return GestureDetector(
      onTap: () => ref.read(nutritionViewModeProvider.notifier).state = mode,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0EA5E9) : Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          title, 
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.black45, 
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: 14,
          )
        ),
      ),
    );
  }
}

class _MacroRowItem extends StatelessWidget {
  final String title;
  final Color? dotColor;
  final double val1;
  final double val2;
  final bool isHeader;
  final Color textColor;
  final Color subTextColor;

  const _MacroRowItem({
    required this.title,
    this.dotColor,
    required this.val1,
    required this.val2,
    this.isHeader = false,
    this.textColor = Colors.white,
    this.subTextColor = Colors.white70,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Spacer(),
        if (dotColor != null)
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: dotColor!.withOpacity(0.5),
                  blurRadius: 4,
                )
              ]
            ),
          ),
        if (dotColor == null) const SizedBox(width: 8),
        const SizedBox(width: 8),
        SizedBox(
          width: 55,
          child: Text(
            title,
            textAlign: TextAlign.left,
            style: TextStyle(
              color: isHeader ? textColor : subTextColor,
              fontWeight: isHeader ? FontWeight.bold : FontWeight.w500,
              fontSize: 15,
            ),
          ),
        ),
        const SizedBox(width: 14),
        SizedBox(
          width: 42,
          child: Text(
            val1.toInt().toString(),
            textAlign: TextAlign.right,
            style: TextStyle(
              color: textColor,
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
        ),
        const SizedBox(width: 14),
        SizedBox(
          width: 42,
          child: Text(
            val2.toInt().toString(),
            textAlign: TextAlign.right,
            style: TextStyle(
              color: subTextColor,
              fontSize: 15,
            ),
          ),
        ),
      ],
    );
  }
}

class _MealContainer extends StatelessWidget {
  final String title;
  final String mealType;
  final List<dynamic> entries;
  final DateTime selectedDate;
  final WidgetRef ref;
  final bool isFlat;
  final bool isLast;

  const _MealContainer({
    required this.title, 
    required this.mealType, 
    required this.entries, 
    required this.selectedDate, 
    required this.ref,
    this.isFlat = false,
    this.isLast = false,
  });

  void _showAddFoodDialog(BuildContext context) {
     showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => _FoodTabbedDialog(title: title, mealType: mealType, selectedDate: selectedDate, ref: ref),
    );
  }

  void _showMealActionsMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.copy, color: Colors.blueAccent),
                title: const Text('Copy Meal to Today', style: TextStyle(color: Colors.white)),
                onTap: () async {
                  Navigator.pop(ctx);
                  final repo = ref.read(nutritionRepositoryProvider);
                  await repo.copyMealToDate(selectedDate, mealType, DateTime.now(), mealType);
                  ref.invalidate(nutritionDayProvider(selectedDate));
                  ref.invalidate(nutritionDayProvider(DateTime.now()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete, color: Colors.redAccent),
                title: const Text('Delete Entire Meal', style: TextStyle(color: Colors.white)),
                onTap: () async {
                  Navigator.pop(ctx);
                  final repo = ref.read(nutritionRepositoryProvider);
                  await repo.deleteMealEntries(selectedDate, mealType);
                  ref.invalidate(nutritionDayProvider(selectedDate));
                },
              ),
            ],
          ),
        );
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    final mealCalories = entries.fold<double>(0.0, (sum, item) => sum + (((item['calories'] as num?)?.toDouble() ?? 0.0) * ((item['quantity'] as num?)?.toDouble() ?? 1.0)));

    return Container(
      decoration: BoxDecoration(
        color: isFlat ? Colors.white : null,
        gradient: isFlat ? null : const LinearGradient(
          colors: [Color(0xFF0EA5E9), Color(0xFF2563EB)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: isFlat 
          ? (isLast ? const BorderRadius.vertical(bottom: Radius.circular(24)) : BorderRadius.zero)
          : BorderRadius.circular(20),
        border: isFlat ? null : Border.all(color: Colors.white10),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: TextStyle(color: isFlat ? const Color(0xFF020617) : Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              Row(
                children: [
                  Text('${mealCalories.toInt()} kcal', style: TextStyle(color: isFlat ? Colors.black45 : Colors.white54, fontSize: 14, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => _showMealActionsMenu(context),
                    child: Icon(Icons.more_vert, color: isFlat ? Colors.black26 : Colors.white38, size: 24),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => _showAddFoodDialog(context),
                    child: const Icon(Icons.add_circle, color: Color(0xFFE11D8A), size: 28),
                  )
                ],
              ),
            ],
          ),
          if (entries.isNotEmpty) ...[
            Divider(color: isFlat ? Colors.black12 : Colors.white10, height: 24),
            ...entries.map((entry) {
              final quantity = (entry['quantity'] as num?)?.toDouble() ?? 1.0;
              final cal = ((entry['calories'] as num?)?.toDouble() ?? 0.0) * quantity;
              final p = ((entry['protein'] as num?)?.toDouble() ?? 0.0) * quantity;
              final c = ((entry['carbs'] as num?)?.toDouble() ?? 0.0) * quantity;
              final f = ((entry['fat'] as num?)?.toDouble() ?? 0.0) * quantity;
              final name = entry['entry_name'] as String? ?? 'Unknown';
              final id = entry['id'] as String;

              return Dismissible(
                key: Key(id),
                direction: DismissDirection.endToStart,
                background: Container(
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: 20),
                  color: Colors.redAccent.withOpacity(0.8),
                  child: const Icon(Icons.delete, color: Colors.white),
                ),
                onDismissed: (_) async {
                  final repo = ref.read(nutritionRepositoryProvider);
                  await repo.deleteNutritionEntry(id);
                  ref.invalidate(nutritionDayProvider(selectedDate));
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8.0),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: TextStyle(color: isFlat ? const Color(0xFF020617) : Colors.white, fontWeight: FontWeight.w500)),
                            Text('${cal.toInt()} kcal • P: ${p.toInt()}g C: ${c.toInt()}g F: ${f.toInt()}g', style: TextStyle(color: isFlat ? Colors.black45 : Colors.white54, fontSize: 12)),
                          ],
                        ),
                      ),
                      Row(
                        children: [
                          GestureDetector(
                            onTap: () async {
                              final repo = ref.read(nutritionRepositoryProvider);
                              await repo.updateEntryQuantity(id, (quantity - 0.25).clamp(0.25, 20.0));
                              ref.invalidate(nutritionDayProvider(selectedDate));
                            },
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: isFlat ? Colors.black12 : Colors.white24)),
                              child: Icon(Icons.remove, color: isFlat ? Colors.black26 : Colors.white54, size: 14),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text('${cal.toInt()}', style: TextStyle(color: isFlat ? const Color(0xFF020617) : Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () async {
                              final repo = ref.read(nutritionRepositoryProvider);
                              await repo.updateEntryQuantity(id, quantity + 0.25);
                              ref.invalidate(nutritionDayProvider(selectedDate));
                            },
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: isFlat ? Colors.black12 : Colors.white24)),
                              child: Icon(Icons.add, color: isFlat ? Colors.black26 : Colors.white54, size: 14),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ] else ...[
            const SizedBox(height: 16),
            const Center(
               child: Text('No entries yet.', style: TextStyle(color: Colors.white38, fontSize: 13, fontStyle: FontStyle.italic)),
            ),
          ]
        ],
      ),
    );
  }
}

class _FoodTabbedDialog extends StatefulWidget {
  final String title;
  final String mealType;
  final DateTime selectedDate;
  final WidgetRef ref;

  const _FoodTabbedDialog({required this.title, required this.mealType, required this.selectedDate, required this.ref});

  @override
  State<_FoodTabbedDialog> createState() => _FoodTabbedDialogState();
}

class _FoodTabbedDialogState extends State<_FoodTabbedDialog> {
  int _tabIndex = 0;
  List<Map<String, dynamic>> _recents = [];
  List<Map<String, dynamic>> _myFoods = [];
  bool _isLoading = true;

  // Draft for custom food
  String _draftName = '';
  String _draftCal = '';
  String _draftPro = '';
  String _draftCarb = '';
  String _draftFat = '';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final repo = widget.ref.read(nutritionRepositoryProvider);
    final recents = await repo.fetchRecentFoods();
    final myFoods = await repo.fetchMyFoods();
    if (mounted) {
      setState(() {
        _recents = recents;
        _myFoods = myFoods;
        _isLoading = false;
      });
    }
  }

  Future<void> _addSelectedFood(Map<String, dynamic> food) async {
    final repo = widget.ref.read(nutritionRepositoryProvider);
    await repo.addNutritionEntry(
      date: widget.selectedDate,
      mealType: widget.mealType,
      name: food['entry_name'] ?? food['name'] ?? 'Unknown',
      quantity: 1.0,
      calories: food['calories'],
      protein: food['protein'],
      carbs: food['carbs'],
      fat: food['fat']
    );
    widget.ref.invalidate(nutritionDayProvider(widget.selectedDate));
    if (mounted) Navigator.pop(context);
  }

  Widget _buildRecentsTab() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_recents.isEmpty) return const Center(child: Text('No recent foods.', style: TextStyle(color: Colors.white54)));

    return ListView.builder(
      itemCount: _recents.length,
      itemBuilder: (ctx, i) {
        final food = _recents[i];
        final name = food['entry_name'] ?? 'Unknown';
        return ListTile(
          title: Text(name, style: const TextStyle(color: Colors.white)),
          subtitle: Text('${food['calories'] ?? 0}cal • P:${food['protein'] ?? 0} C:${food['carbs'] ?? 0} F:${food['fat'] ?? 0}', style: const TextStyle(color: Colors.white38)),
          trailing: ElevatedButton(
            onPressed: () => _addSelectedFood(food),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent, shape: const StadiumBorder()),
            child: const Text('Add', style: TextStyle(color: Colors.white)),
          ),
        );
      },
    );
  }

  Widget _buildMyFoodsTab() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_myFoods.isEmpty) return const Center(child: Text('No custom foods yet.', style: TextStyle(color: Colors.white54)));

    return ListView.builder(
      itemCount: _myFoods.length,
      itemBuilder: (ctx, i) {
        final food = _myFoods[i];
        final name = food['name'] ?? 'Unknown';
        return ListTile(
          title: Text(name, style: const TextStyle(color: Colors.white)),
          subtitle: Text('${food['calories'] ?? 0}cal • P:${food['protein'] ?? 0} C:${food['carbs'] ?? 0} F:${food['fat'] ?? 0}', style: const TextStyle(color: Colors.white38)),
          trailing: ElevatedButton(
            onPressed: () => _addSelectedFood(food),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent, shape: const StadiumBorder()),
            child: const Text('Add', style: TextStyle(color: Colors.white)),
          ),
        );
      },
    );
  }

  Widget _buildCreateTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Food Name', labelStyle: TextStyle(color: Colors.white54)), onChanged: (v) => _draftName = v),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: TextField(keyboardType: TextInputType.number, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Calories', labelStyle: TextStyle(color: Colors.white54)), onChanged: (v) => _draftCal = v)),
              const SizedBox(width: 16),
              Expanded(child: TextField(keyboardType: TextInputType.number, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Protein', labelStyle: TextStyle(color: Colors.white54)), onChanged: (v) => _draftPro = v)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: TextField(keyboardType: TextInputType.number, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Carbs', labelStyle: TextStyle(color: Colors.white54)), onChanged: (v) => _draftCarb = v)),
              const SizedBox(width: 16),
              Expanded(child: TextField(keyboardType: TextInputType.number, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Fat', labelStyle: TextStyle(color: Colors.white54)), onChanged: (v) => _draftFat = v)),
            ],
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () async {
                if (_draftName.trim().isEmpty) return;
                final repo = widget.ref.read(nutritionRepositoryProvider);
                await repo.addCustomFood(
                  name: _draftName,
                  calories: num.tryParse(_draftCal),
                  protein: num.tryParse(_draftPro),
                  carbs: num.tryParse(_draftCarb),
                  fat: num.tryParse(_draftFat),
                );
                setState(() => _isLoading = true);
                _loadData();
                setState(() => _tabIndex = 1); // switch to my foods
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent, padding: const EdgeInsets.symmetric(vertical: 16)),
              child: const Text('Save Custom Food', style: TextStyle(color: Colors.white)),
            ),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, top: 24, left: 16, right: 16),
      child: Column(
        children: [
          Text('Add to ${widget.title}', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _TabBtn(title: 'Recents', isActive: _tabIndex == 0, onTap: () => setState(() => _tabIndex = 0)),
              _TabBtn(title: 'My Foods', isActive: _tabIndex == 1, onTap: () => setState(() => _tabIndex = 1)),
              _TabBtn(title: 'Create', isActive: _tabIndex == 2, onTap: () => setState(() => _tabIndex = 2)),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _tabIndex == 0 ? _buildRecentsTab() : _tabIndex == 1 ? _buildMyFoodsTab() : _buildCreateTab()
          )
        ],
      ),
    );
  }
}

class _TabBtn extends StatelessWidget {
  final String title;
  final bool isActive;
  final VoidCallback onTap;
  const _TabBtn({required this.title, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? Colors.blueAccent : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isActive ? Colors.blueAccent : Colors.white24),
        ),
        child: Text(title, style: TextStyle(color: isActive ? Colors.white : Colors.white70, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
