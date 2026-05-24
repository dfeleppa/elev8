import 'package:flutter/material.dart';

/// Centralised color tokens for the Elev8 mobile app.
///
/// Lifted from the nutrition page's existing visual language (light glass
/// cards over a soft tinted background, sky-blue accents, distinct macro
/// colors) so the rest of the app can adopt the same look without each
/// screen redefining its own palette.
abstract final class AppColors {
  // Brand accent (sky-500) and a darker variant for gradients.
  static const Color accent = Color(0xFF0EA5E9);
  static const Color accentDeep = Color(0xFF2563EB);

  // Macro tones — used by the rings on nutrition + the dashboard summary.
  static const Color proteinBlue = Colors.blueAccent;
  static const Color carbsOrange = Colors.orangeAccent;
  static const Color fatGreen = Colors.greenAccent;

  // Highlight accents picked from the existing nutrition gradients.
  static const Color cyanAccent = Color(0xFF22D3EE);
  static const Color emeraldAccent = Color(0xFF34D399);
  static const Color sky300 = Color(0xFF7DD3FC);

  // Web design-system accents (mirrors src/app/globals.css):
  // pink hero, cyan highlight, violet coach tone.
  static const Color webPink = Color(0xFFFFB1C4);
  static const Color webPinkInk = Color(0xFF230012);
  static const Color webCyan = Color(0xFF63F7FF);
  static const Color webViolet = Color(0xFFC4B5FD);
  static const Color webVioletInk = Color(0xFF140A2E);

  // Slate scaffold tones for the dark Material 3 base.
  static const Color slate900 = Color(0xFF0F172A);
  static const Color slate950 = Color(0xFF020617);

  // Glass surfaces over the Elev8Background.
  static const Color glassFill = Colors.white;
  static Color glassBorder = Colors.black.withValues(alpha: 0.05);
  static Color glassShadow = Colors.black.withValues(alpha: 0.05);

  // Body text on light glass cards.
  static const Color textOnGlass = Color(0xFF020617);
  static const Color textMutedOnGlass = Colors.black45;

  // Body text on the dark scaffold.
  static const Color textOnDark = Colors.white;
  static const Color textMutedOnDark = Colors.white70;
}
