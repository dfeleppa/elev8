import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Primary CTA in the Elev8 sky-blue accent.
///
/// Lifted from the inline button in `nutrition_screen.dart` so CTAs across
/// the app share the same shape, color, and tap target.
class AccentButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool fullWidth;

  const AccentButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.fullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    final button = ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        elevation: 0,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
      child: isLoading
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : (icon == null
                ? Text(label)
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, size: 18),
                      const SizedBox(width: 8),
                      Text(label),
                    ],
                  )),
    );

    if (!fullWidth) return button;
    return SizedBox(width: double.infinity, child: button);
  }
}

/// Secondary outlined variant for less-prominent actions next to an
/// [AccentButton] (e.g. "Cancel" beside a primary "Save").
class GhostButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool fullWidth;

  const GhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.fullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    final button = OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textOnGlass,
        side: BorderSide(color: AppColors.glassBorder),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
      child: Text(label),
    );
    if (!fullWidth) return button;
    return SizedBox(width: double.infinity, child: button);
  }
}
