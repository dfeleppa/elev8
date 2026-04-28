import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'components/bottom_nav_bar.dart';
import 'components/elev8_background.dart';
import 'components/glass_card.dart';
import 'components/sidebar_shell.dart';
import 'theme/app_colors.dart';
import 'theme/app_text.dart';

class MessengerScreen extends ConsumerWidget {
  const MessengerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Messages', style: AppText.screenTitle),
                  const SizedBox(height: 24),
                  GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.accent.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.forum_outlined, color: AppColors.accent),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Direct messaging is coming soon',
                          style: AppText.cardTitle,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          "We're building a chat surface so coaches and athletes can message inside the app. For now, talk to your coach in person or via your gym's existing channels.",
                          style: AppText.label.copyWith(height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        bottomNavigationBar: const Elev8BottomNavBar(selectedIndex: 4),
      ),
    );
  }
}
