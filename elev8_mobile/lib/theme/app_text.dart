import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Centralised text styles, lifted from the nutrition page.
///
/// Uses the project's existing typography (no custom font registration —
/// keeps within current `pubspec.yaml` deps) but standardises the size and
/// weight pairings the nutrition screen already established.
abstract final class AppText {
  /// Screen title — large, bold. e.g. "Nutrition", "Today".
  static const TextStyle screenTitle = TextStyle(
    color: AppColors.textOnGlass,
    fontSize: 28,
    fontWeight: FontWeight.bold,
  );

  /// Card title, e.g. "Daily Targets" / "Today's Workout".
  static const TextStyle cardTitle = TextStyle(
    color: AppColors.textOnGlass,
    fontSize: 18,
    fontWeight: FontWeight.bold,
  );

  /// Section eyebrow — small uppercase tracking-loose label above a card.
  static const TextStyle eyebrow = TextStyle(
    color: AppColors.textMutedOnGlass,
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 1.5,
  );

  /// Big numeric value (calorie counter, streak count, weight).
  static const TextStyle bigValue = TextStyle(
    color: AppColors.textOnGlass,
    fontSize: 36,
    fontWeight: FontWeight.bold,
  );

  /// Inline value next to a label, e.g. "1,847 kcal".
  static const TextStyle value = TextStyle(
    color: AppColors.textOnGlass,
    fontSize: 16,
    fontWeight: FontWeight.w600,
  );

  /// Muted label below a value or beside it.
  static const TextStyle label = TextStyle(
    color: AppColors.textMutedOnGlass,
    fontSize: 13,
  );

  /// Small caption (used for "+x kcal", "-2.1 lbs", etc.).
  static const TextStyle caption = TextStyle(
    color: AppColors.textMutedOnGlass,
    fontSize: 12,
  );
}
