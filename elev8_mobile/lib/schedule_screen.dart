import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'components/bottom_nav_bar.dart';
import 'components/elev8_background.dart';
import 'components/glass_card.dart';
import 'components/sidebar_shell.dart';
import 'theme/app_colors.dart';
import 'theme/app_text.dart';

class ScheduleScreen extends ConsumerWidget {
  const ScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Schedule', style: AppText.screenTitle),
                  const SizedBox(height: 4),
                  Text("Today's classes", style: AppText.label),
                  const SizedBox(height: 20),
                  Expanded(
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.only(bottom: 24),
                      children: const [
                        // Placeholder data — wired to /api/athlete/schedule in
                        // a later pass.
                        _ClassCard(time: '5:00 AM', name: 'CrossFit', coach: 'Mike T', spots: 2),
                        _ClassCard(time: '6:15 AM', name: 'CrossFit', coach: 'Mike T', spots: 8),
                        _ClassCard(time: '9:00 AM', name: 'Powerlifting', coach: 'Sarah J', spots: 12, isActive: true),
                        _ClassCard(time: '12:00 PM', name: 'CrossFit', coach: 'Alex B', spots: 15),
                        _ClassCard(time: '4:30 PM', name: 'CrossFit', coach: 'Mike T', spots: 1),
                        _ClassCard(time: '5:45 PM', name: 'CrossFit', coach: 'Alex B', spots: 0),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 1),
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  final String time;
  final String name;
  final String coach;
  final int spots;
  final bool isActive;

  const _ClassCard({
    required this.time,
    required this.name,
    required this.coach,
    required this.spots,
    this.isActive = false,
  });

  @override
  Widget build(BuildContext context) {
    final spotsLabel = spots > 0 ? '$spots spots' : 'Waitlist';
    final spotsColor = spots > 0 ? AppColors.fatGreen : Colors.orangeAccent;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        decoration: isActive
            ? BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.accent.withValues(alpha: 0.18),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              )
            : null,
        child: GlassCard(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              SizedBox(
                width: 78,
                child: Text(
                  time,
                  style: AppText.value.copyWith(
                    color: AppColors.accent,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                width: 1,
                height: 36,
                color: AppColors.glassBorder,
                margin: const EdgeInsets.symmetric(horizontal: 12),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: AppText.cardTitle.copyWith(fontSize: 16)),
                    const SizedBox(height: 2),
                    Text('Coach $coach', style: AppText.caption),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    spotsLabel,
                    style: AppText.caption.copyWith(
                      color: spotsColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  OutlinedButton(
                    onPressed: () {},
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textOnGlass,
                      side: BorderSide(color: AppColors.glassBorder),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    ),
                    child: Text(
                      spots > 0 ? 'Reserve' : 'Join WL',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
