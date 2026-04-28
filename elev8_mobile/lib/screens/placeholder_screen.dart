import 'package:flutter/material.dart';

import '../components/elev8_background.dart';
import '../components/glass_card.dart';
import '../components/sidebar_shell.dart';
import '../theme/app_colors.dart';
import '../theme/app_text.dart';

/// Stub screen for sidebar entries that don't yet have a real implementation.
///
/// Wraps a centered "Coming soon" card inside [SidebarShell] so the hamburger
/// drawer is reachable from every nav target while we build the real screens
/// out one by one.
class PlaceholderScreen extends StatelessWidget {
  final String title;
  final String section;
  final IconData icon;

  const PlaceholderScreen({
    super.key,
    required this.title,
    required this.section,
    this.icon = Icons.construction_outlined,
  });

  @override
  Widget build(BuildContext context) {
    return SidebarShell(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Elev8Background(
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(section.toUpperCase(), style: AppText.eyebrow),
                  const SizedBox(height: 4),
                  Text(title, style: AppText.screenTitle),
                  const SizedBox(height: 24),
                  Expanded(
                    child: Center(
                      child: GlassCard(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(icon, size: 40, color: AppColors.accent),
                              const SizedBox(height: 12),
                              Text('Coming soon', style: AppText.cardTitle),
                              const SizedBox(height: 6),
                              Text(
                                "We're scaffolding $title for the iOS app. "
                                'Check the web app for the full experience.',
                                style: AppText.label,
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
