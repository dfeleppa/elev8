import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Builds the app's [ThemeData].
///
/// Centralises what `main.dart` previously defined inline. The choice here
/// matches the existing app: dark Material 3 base, slate-900 seed, slate-950
/// scaffold. Light glass cards painted on top of an [Elev8Background] are a
/// per-screen concern and continue to use the surface colors directly.
abstract final class AppTheme {
  static ThemeData dark() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.slate900,
        brightness: Brightness.dark,
      ),
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.slate950,
    );
  }
}
