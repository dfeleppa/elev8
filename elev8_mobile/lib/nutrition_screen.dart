import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'components/sidebar_shell.dart';
import 'components/bottom_nav_bar.dart';
import 'data/repositories/nutrition_repository.dart';

class NutritionScreen extends ConsumerWidget {
  const NutritionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nutritionAsync = ref.watch(todaysNutritionProvider);

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
          title: const Text('Nutrition', style: TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: SafeArea(
          child: nutritionAsync.when(
            data: (data) => _buildNutritionDashboard(context, data),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
          ),
        ),
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 3),
      ),
    );
  }

  Widget _buildNutritionDashboard(BuildContext context, Map<String, dynamic>? data) {
    // If we have no mock data or DB data yet, we provide a placeholder target visualization
    final targetCalories = (data?['calorie_target'] as num?)?.toDouble() ?? 2500.0;
    final targetProtein = (data?['protein_target'] as num?)?.toDouble() ?? 180.0;
    final targetCarbs = (data?['carbs_target'] as num?)?.toDouble() ?? 250.0;
    final targetFat = (data?['fat_target'] as num?)?.toDouble() ?? 75.0;

    final entries = (data?['nutrition_entries'] as List<dynamic>?) ?? [];
    
    // In a real app we'd calculate these by summing up the entries
    // we use some mock logic here if there are no entries to show something beautiful
    final consumedCalories = entries.fold<double>(0.0, (sum, item) => sum + ((item['calories'] as num?)?.toDouble() ?? 0.0));
    final consumedProtein = entries.fold<double>(0.0, (sum, item) => sum + ((item['protein'] as num?)?.toDouble() ?? 0.0));
    final consumedCarbs = entries.fold<double>(0.0, (sum, item) => sum + ((item['carbs'] as num?)?.toDouble() ?? 0.0));
    final consumedFat = entries.fold<double>(0.0, (sum, item) => sum + ((item['fat'] as num?)?.toDouble() ?? 0.0));

    // For prototyping aesthetics, if completely empty, let's inject a visually pleasing stub so you can see the UI layout
    final cCals = consumedCalories == 0 ? 1850.0 : consumedCalories;
    final cPro = consumedProtein == 0 ? 120.0 : consumedProtein;
    final cCarbs = consumedCarbs == 0 ? 190.0 : consumedCarbs;
    final cFat = consumedFat == 0 ? 55.0 : consumedFat;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Summary Ring
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A), // slate-900
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Remaining', style: TextStyle(color: Colors.white54, fontSize: 16)),
                    const SizedBox(height: 8),
                    Text(
                      '${(targetCalories - cCals).toInt()}',
                      style: const TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.bold),
                    ),
                    const Text('kcal', style: TextStyle(color: Colors.white38, fontSize: 16)),
                  ],
                ),
                // Pseudo-Ring Chart using a CircularProgressIndicator stack
                SizedBox(
                  height: 120,
                  width: 120,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      CircularProgressIndicator(
                        value: 1.0,
                        strokeWidth: 12,
                        backgroundColor: Colors.transparent,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white.withOpacity(0.05)),
                      ),
                      CircularProgressIndicator(
                        value: cCals / targetCalories,
                        strokeWidth: 12,
                        backgroundColor: Colors.transparent,
                        valueColor: const AlwaysStoppedAnimation<Color>(Colors.greenAccent),
                        strokeCap: StrokeCap.round,
                      ),
                      Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.restaurant_menu, color: Colors.greenAccent, size: 24),
                            Text(
                              '${cCals.toInt()} / ${targetCalories.toInt()}',
                              style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      )
                    ],
                  ),
                )
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Macros Breakdown
          Row(
            children: [
              Expanded(child: _MacroBar(title: 'Protein', consumed: cPro, target: targetProtein, color: Colors.blueAccent)),
              const SizedBox(width: 16),
              Expanded(child: _MacroBar(title: 'Carbs', consumed: cCarbs, target: targetCarbs, color: Colors.orangeAccent)),
              const SizedBox(width: 16),
              Expanded(child: _MacroBar(title: 'Fat', consumed: cFat, target: targetFat, color: Colors.purpleAccent)),
            ],
          ),

          const SizedBox(height: 32),
          const Text('Meals', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),

          // Add Entry Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.add),
              label: const Text('Add Food Entry', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1E293B), // slate-800
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Breakfast Mock Block
          _MealContainer(
            title: 'Breakfast',
            calories: 550,
            children: const [
              _FoodEntryRow(name: 'Oatmeal with Berries', calories: 350, protein: 12, carbs: 60, fat: 6),
              _FoodEntryRow(name: 'Black Coffee', calories: 5, protein: 0, carbs: 1, fat: 0),
              _FoodEntryRow(name: 'Scrambled Eggs (3 large)', calories: 195, protein: 18, carbs: 1, fat: 12),
            ]
          ),
          const SizedBox(height: 16),
          // Lunch Mock Block
          _MealContainer(
            title: 'Lunch',
            calories: 820,
            children: const [
              _FoodEntryRow(name: 'Chicken Rice Bowl', calories: 650, protein: 55, carbs: 75, fat: 14),
              _FoodEntryRow(name: 'Protein Shake', calories: 170, protein: 25, carbs: 5, fat: 2),
            ]
          ),
        ],
      ),
    );
  }
}

class _MacroBar extends StatelessWidget {
  final String title;
  final double consumed;
  final double target;
  final Color color;

  const _MacroBar({required this.title, required this.consumed, required this.target, required this.color});

  @override
  Widget build(BuildContext context) {
    final double percent = (consumed / target).clamp(0.0, 1.0);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.white54, fontSize: 14)),
          const SizedBox(height: 8),
          Text('${consumed.toInt()}g', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text('of ${target.toInt()}g', style: const TextStyle(color: Colors.white38, fontSize: 12)),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: percent,
            backgroundColor: color.withOpacity(0.1),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 6,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }
}

class _MealContainer extends StatelessWidget {
  final String title;
  final int calories;
  final List<Widget> children;

  const _MealContainer({required this.title, required this.calories, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              Text('$calories kcal', style: const TextStyle(color: Colors.white54, fontSize: 14, fontWeight: FontWeight.bold)),
            ],
          ),
          const Divider(color: Colors.white10, height: 24),
          ...children,
        ],
      ),
    );
  }
}

class _FoodEntryRow extends StatelessWidget {
  final String name;
  final int calories;
  final int protein;
  final int carbs;
  final int fat;

  const _FoodEntryRow({required this.name, required this.calories, required this.protein, required this.carbs, required this.fat});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(color: Colors.white70, fontSize: 16)),
                const SizedBox(height: 4),
                Text('P: ${protein}g  C: ${carbs}g  F: ${fat}g', style: const TextStyle(color: Colors.white38, fontSize: 12)),
              ],
            ),
          ),
          Text('$calories', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        ],
      ),
    );
  }
}
