import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';

import 'components/sidebar_shell.dart';
import 'components/bottom_nav_bar.dart';
import 'data/repositories/workout_repository.dart';

final userNameProvider = FutureProvider<String?>((ref) async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return "Guest";
  
  // Try to fetch full name from app_users table based on the schema
  try {
    final response = await Supabase.instance.client
        .from('app_users')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
    
    return response?['full_name'] as String? ?? user.email?.split('@').first ?? 'Athlete';
  } catch (e) {
    return user.email?.split('@').first ?? 'Athlete';
  }
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userNameAsync = ref.watch(userNameProvider);

    return SidebarShell(
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
        title: const Text('Elev8', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () async {
              await Supabase.instance.client.auth.signOut();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
             crossAxisAlignment: CrossAxisAlignment.start,
             children: [
               userNameAsync.when(
                 data: (name) => Text(
                   'Hello, $name',
                   style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                     fontWeight: FontWeight.w900,
                     color: Colors.white,
                   ),
                 ),
                 loading: () => const CircularProgressIndicator(),
                 error: (_, __) => const Text('Hello, Athlete', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
               ),
               const SizedBox(height: 8),
               Text(
                 "Ready to crush today's goals?",
                 style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                   color: Colors.white54,
                 ),
               ),
               const SizedBox(height: 32),
               
               // Stats Section
               Row(
                 children: [
                   Expanded(
                     child: _StatCard(
                       title: 'Streak',
                       value: '12',
                       unit: 'Days',
                       icon: Icons.local_fire_department,
                       color: Colors.orangeAccent,
                     ),
                   ),
                   const SizedBox(width: 16),
                   Expanded(
                     child: _StatCard(
                       title: 'Completed',
                       value: '4',
                       unit: 'Workouts',
                       icon: Icons.check_circle_outline,
                       color: Colors.greenAccent,
                     ),
                   ),
                 ],
               ),
               
               const SizedBox(height: 32),
               Text(
                 "Today's Programming",
                 style: Theme.of(context).textTheme.titleLarge?.copyWith(
                   fontWeight: FontWeight.bold,
                   color: Colors.white,
                 ),
               ),
               const SizedBox(height: 16),
               
               // Real Programming Blocks
               _TodaysProgrammingSection(),
             ],
          ),
        ),
      ),
      bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 0),
    ));
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String unit;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.title,
    required this.value,
    required this.unit,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
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
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 16),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
          Row(
            children: [
              Text(unit, style: const TextStyle(color: Colors.white54, fontSize: 12)),
              const Spacer(),
              Text(title, style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500)),
            ],
          ),
        ],
      ),
    );
  }
}

class _TodaysProgrammingSection extends ConsumerWidget {
  const _TodaysProgrammingSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final programmingAsync = ref.watch(todaysProgrammingProvider);

    return programmingAsync.when(
      data: (blocks) {
        if (blocks.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: Text(
                'No programming scheduled for today or not published.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white54),
              ),
            ),
          );
        }

        return ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: blocks.length,
          itemBuilder: (context, index) {
            final block = blocks[index];
            final type = (block['block_type'] as String).toUpperCase();
            final title = block['title'] as String;
            final description = block['description'] as String?;

            return Container(
              margin: const EdgeInsets.only(bottom: 16),
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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: _getColorForBlockType(type).withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(type, style: TextStyle(color: _getColorForBlockType(type), fontWeight: FontWeight.bold, fontSize: 12)),
                      ),
                      const Icon(Icons.fitness_center, color: Colors.white54, size: 20),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    title,
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  if (description != null && description.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      description,
                      style: const TextStyle(color: Colors.white70, height: 1.5),
                    ),
                  ],
                  if (type == 'WORKOUT' || type == 'LIFT') ...[
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {},
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFF020617),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text('Log Result', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    )
                  ]
                ],
              ),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Text('Error loading programming: $error', style: const TextStyle(color: Colors.redAccent)),
    );
  }

  Color _getColorForBlockType(String type) {
    switch (type) {
      case 'WARMUP': return Colors.orangeAccent;
      case 'LIFT': return Colors.purpleAccent;
      case 'WORKOUT': return Colors.blueAccent;
      case 'COOLDOWN': return Colors.tealAccent;
      default: return Colors.white54;
    }
  }
}
