import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Two-segment pill toggle used by the nutrition page's "Consumed /
/// Remaining" switch. Extracted so the dashboard / future screens can reuse
/// the same shape with their own labels and state.
class ModeToggle<T> extends StatelessWidget {
  final List<ModeToggleOption<T>> options;
  final T value;
  final ValueChanged<T> onChanged;

  const ModeToggle({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final opt in options) _segment(opt, opt.value == value),
        ],
      ),
    );
  }

  Widget _segment(ModeToggleOption<T> opt, bool active) {
    return GestureDetector(
      onTap: () => onChanged(opt.value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          opt.label,
          style: TextStyle(
            color: active ? Colors.white : AppColors.textMutedOnGlass,
            fontWeight: active ? FontWeight.bold : FontWeight.normal,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}

class ModeToggleOption<T> {
  final T value;
  final String label;
  const ModeToggleOption({required this.value, required this.label});
}
