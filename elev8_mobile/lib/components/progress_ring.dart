import 'package:flutter/material.dart';

/// Single progress ring with a tinted background track and a solid foreground
/// arc. Lifted from the `_ring()` helper in `nutrition_screen.dart`'s
/// `_MacroRings` so other screens (the dashboard summary card, future
/// progress widgets) can reuse the same shape.
class ProgressRing extends StatelessWidget {
  /// Normalised progress 0..1; values outside the range are clamped.
  final double progress;
  final Color foreground;
  final Color? background;
  final double size;
  final double strokeWidth;

  const ProgressRing({
    super.key,
    required this.progress,
    required this.foreground,
    this.background,
    this.size = 100,
    this.strokeWidth = 9,
  });

  @override
  Widget build(BuildContext context) {
    final bg = background ?? foreground.withValues(alpha: 0.15);
    return SizedBox(
      height: size,
      width: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            height: size,
            width: size,
            child: CircularProgressIndicator(
              value: 1.0,
              strokeWidth: strokeWidth,
              backgroundColor: Colors.transparent,
              valueColor: AlwaysStoppedAnimation<Color>(bg),
            ),
          ),
          SizedBox(
            height: size,
            width: size,
            child: CircularProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              strokeWidth: strokeWidth,
              backgroundColor: Colors.transparent,
              valueColor: AlwaysStoppedAnimation<Color>(foreground),
              strokeCap: StrokeCap.round,
            ),
          ),
        ],
      ),
    );
  }
}
