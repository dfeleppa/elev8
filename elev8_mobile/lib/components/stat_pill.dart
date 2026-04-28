import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_text.dart';

/// Compact label + value tile used for "Body Weight: 187 lb" style stats.
///
/// Adapted from the `_CompactStat` widget in the nutrition screen so the
/// athlete dashboard, coach plan view, and any future readout cards share
/// the same visual treatment.
class StatPill extends StatelessWidget {
  final String label;
  final String value;
  final String? trailing;
  final IconData? icon;
  final Color? accentColor;

  const StatPill({
    super.key,
    required this.label,
    required this.value,
    this.trailing,
    this.icon,
    this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? AppColors.accent;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.06),
        border: Border.all(color: accent.withValues(alpha: 0.18)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: accent),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppText.caption),
                const SizedBox(height: 2),
                Text(value, style: AppText.value),
              ],
            ),
          ),
          if (trailing != null)
            Text(
              trailing!,
              style: AppText.caption.copyWith(
                color: accent,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }
}
