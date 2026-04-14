import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../data/repositories/nutrition_repository.dart';
import '../services/coach_api_service.dart';

// ─── Entry point ─────────────────────────────────────────────────────────────

class CoachSetupScreen extends ConsumerStatefulWidget {
  const CoachSetupScreen({super.key});

  @override
  ConsumerState<CoachSetupScreen> createState() => _CoachSetupScreenState();
}

class _CoachSetupScreenState extends ConsumerState<CoachSetupScreen> {
  final PageController _pages = PageController();
  int _step = 0;

  // ── Form state ──────────────────────────────────────────────────────────────
  String _goalType = 'lose_weight';
  String _sex = 'male';
  DateTime? _birthDate;
  final _weightCtrl = TextEditingController();
  final _feetCtrl = TextEditingController();
  final _inchesCtrl = TextEditingController();
  final _targetWeightCtrl = TextEditingController();
  final _bodyFatCtrl = TextEditingController();
  int _sessionsPerWeek = 3;
  DateTime _effectiveDate = DateTime.now();
  String _intensityPreset = 'moderate';

  // ── Preview state ────────────────────────────────────────────────────────────
  CoachPlanPreview? _preview;
  bool _loadingPreview = false;
  String? _previewError;
  bool _applying = false;

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  @override
  void dispose() {
    _pages.dispose();
    _weightCtrl.dispose();
    _feetCtrl.dispose();
    _inchesCtrl.dispose();
    _targetWeightCtrl.dispose();
    _bodyFatCtrl.dispose();
    super.dispose();
  }

  // ── Pre-fill from existing plan ──────────────────────────────────────────────
  Future<void> _loadExisting() async {
    try {
      final data = await CoachApiService.fetchExistingPlan();
      if (!mounted) return;
      setState(() {
        if (data.latestPlan != null) {
          final p = data.latestPlan!;
          _goalType = p['goal_type'] as String? ?? _goalType;
          _intensityPreset = p['intensity_preset'] as String? ?? _intensityPreset;
          _sessionsPerWeek = (p['sessions_per_week'] as num?)?.toInt() ?? _sessionsPerWeek;
          if (p['target_weight_lbs'] != null) {
            _targetWeightCtrl.text = (p['target_weight_lbs'] as num).toStringAsFixed(1);
          }
        }
        if (data.profile != null) {
          final pr = data.profile!;
          _sex = pr['sex'] as String? ?? _sex;
          if (pr['birth_date'] != null) {
            _birthDate = DateTime.tryParse(pr['birth_date'] as String);
          }
          if (pr['current_weight_kg'] != null) {
            final kg = (pr['current_weight_kg'] as num).toDouble();
            _weightCtrl.text = (kg * 2.20462).toStringAsFixed(1);
          }
          if (pr['height_cm'] != null) {
            final cm = (pr['height_cm'] as num).toDouble();
            final totalInches = cm / 2.54;
            _feetCtrl.text = (totalInches ~/ 12).toString();
            _inchesCtrl.text = (totalInches % 12).toStringAsFixed(0);
          }
          if (pr['body_fat_percent'] != null) {
            _bodyFatCtrl.text = (pr['body_fat_percent'] as num).toStringAsFixed(1);
          }
        }
      });
    } catch (_) {}
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  void _next() {
    if (_step < 3) {
      setState(() => _step++);
      _pages.animateToPage(_step,
          duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      if (_step == 3) _generatePreview();
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() => _step--);
      _pages.animateToPage(_step,
          duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    } else {
      Navigator.of(context).pop(false);
    }
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  bool get _step1Valid => _goalType.isNotEmpty;
  bool get _step2Valid {
    final w = double.tryParse(_weightCtrl.text);
    final ft = int.tryParse(_feetCtrl.text);
    return w != null && w > 0 && ft != null && ft > 0 && _birthDate != null;
  }
  bool get _step3Valid => _sessionsPerWeek > 0;

  // ── Height/weight helpers ────────────────────────────────────────────────────
  double? get _heightCm {
    final ft = int.tryParse(_feetCtrl.text) ?? 0;
    final inches = double.tryParse(_inchesCtrl.text) ?? 0;
    final totalInches = ft * 12 + inches;
    return totalInches > 0 ? totalInches * 2.54 : null;
  }

  Map<String, dynamic> get _apiInputs {
    final birthDate = _birthDate != null
        ? DateFormat('yyyy-MM-dd').format(_birthDate!)
        : null;
    final effectiveDate = DateFormat('yyyy-MM-dd').format(_effectiveDate);
    final targetWeight = double.tryParse(_targetWeightCtrl.text);
    final bodyFat = double.tryParse(_bodyFatCtrl.text);
    return {
      'goalType': _goalType,
      'sex': _sex,
      'birthDate': birthDate,
      'currentWeightLbs': double.tryParse(_weightCtrl.text) ?? 0,
      'heightCm': _heightCm ?? 0,
      'targetWeightLbs': targetWeight,
      'bodyFatPercentage': bodyFat,
      'sessionsPerWeek': _sessionsPerWeek,
      'effectiveDate': effectiveDate,
      'intensityPreset': _intensityPreset,
    };
  }

  // ── Preview ───────────────────────────────────────────────────────────────────
  Future<void> _generatePreview() async {
    setState(() {
      _loadingPreview = true;
      _previewError = null;
      _preview = null;
    });
    try {
      final preview = await CoachApiService.previewPlan(_apiInputs);
      if (mounted) setState(() => _preview = preview);
    } catch (e) {
      if (mounted) setState(() => _previewError = e.toString());
    } finally {
      if (mounted) setState(() => _loadingPreview = false);
    }
  }

  // ── Apply ─────────────────────────────────────────────────────────────────────
  Future<void> _applyPlan() async {
    setState(() => _applying = true);
    try {
      await CoachApiService.applyPlan(_apiInputs);
      if (!mounted) return;
      ref.invalidate(coachPlanStatusProvider);
      ref.invalidate(nutritionDayProvider);
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to apply plan: $e'),
              backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 18),
          onPressed: _back,
        ),
        title: const Text('Nutrition Coach',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: Column(
        children: [
          _StepIndicator(step: _step),
          Expanded(
            child: PageView(
              controller: _pages,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _Step1Goal(
                  selected: _goalType,
                  onSelect: (g) => setState(() => _goalType = g),
                ),
                _Step2Body(
                  sex: _sex,
                  birthDate: _birthDate,
                  weightCtrl: _weightCtrl,
                  feetCtrl: _feetCtrl,
                  inchesCtrl: _inchesCtrl,
                  targetWeightCtrl: _targetWeightCtrl,
                  bodyFatCtrl: _bodyFatCtrl,
                  onSexChanged: (s) => setState(() => _sex = s),
                  onBirthDateChanged: (d) => setState(() => _birthDate = d),
                ),
                _Step3Training(
                  sessionsPerWeek: _sessionsPerWeek,
                  effectiveDate: _effectiveDate,
                  intensityPreset: _intensityPreset,
                  onSessionsChanged: (v) => setState(() => _sessionsPerWeek = v),
                  onEffectiveDateChanged: (d) => setState(() => _effectiveDate = d),
                  onIntensityChanged: (i) => setState(() => _intensityPreset = i),
                ),
                _Step4Preview(
                  preview: _preview,
                  loading: _loadingPreview,
                  error: _previewError,
                  applying: _applying,
                  onRetry: _generatePreview,
                  onApply: _applyPlan,
                ),
              ],
            ),
          ),
          if (_step < 3)
            _BottomNav(
              step: _step,
              canNext: _step == 0
                  ? _step1Valid
                  : _step == 1
                      ? _step2Valid
                      : _step3Valid,
              onBack: _back,
              onNext: _next,
            ),
        ],
      ),
    );
  }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

class _StepIndicator extends StatelessWidget {
  final int step;
  const _StepIndicator({required this.step});

  @override
  Widget build(BuildContext context) {
    const labels = ['Goal', 'Body', 'Training', 'Plan'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        children: List.generate(labels.length, (i) {
          final active = i == step;
          final done = i < step;
          return Expanded(
            child: Row(
              children: [
                if (i > 0)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: done ? const Color(0xFF63f7ff) : Colors.white12,
                    ),
                  ),
                if (i > 0) const SizedBox(width: 6),
                Column(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: done
                            ? const Color(0xFF63f7ff)
                            : active
                                ? const Color(0xFF0EA5E9)
                                : Colors.white10,
                        border: active
                            ? Border.all(color: const Color(0xFF63f7ff), width: 2)
                            : null,
                      ),
                      child: Center(
                        child: done
                            ? const Icon(Icons.check, size: 14, color: Colors.black)
                            : Text('${i + 1}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: active ? Colors.white : Colors.white38,
                                  fontWeight: FontWeight.bold,
                                )),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      labels[i],
                      style: TextStyle(
                        fontSize: 10,
                        color: active ? Colors.white : Colors.white38,
                        fontWeight: active ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
                if (i < labels.length - 1) const SizedBox(width: 6),
                if (i < labels.length - 1)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: done ? const Color(0xFF63f7ff) : Colors.white12,
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────

class _BottomNav extends StatelessWidget {
  final int step;
  final bool canNext;
  final VoidCallback onBack;
  final VoidCallback onNext;

  const _BottomNav({
    required this.step,
    required this.canNext,
    required this.onBack,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Colors.white10)),
      ),
      child: Row(
        children: [
          if (step > 0)
            TextButton(
              onPressed: onBack,
              child: const Text('Back', style: TextStyle(color: Colors.white54)),
            ),
          const Spacer(),
          FilledButton(
            onPressed: canNext ? onNext : null,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF0EA5E9),
              disabledBackgroundColor: Colors.white12,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(
              step == 2 ? 'Generate Plan' : 'Next',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Step 1: Goal ─────────────────────────────────────────────────────────────

const _goals = [
  (id: 'lose_weight', label: 'Lose Weight', icon: Icons.trending_down, desc: 'Reduce body fat while preserving muscle'),
  (id: 'gain_weight', label: 'Gain Weight', icon: Icons.trending_up, desc: 'Build muscle mass with a calorie surplus'),
  (id: 'maintain_weight', label: 'Maintain', icon: Icons.balance, desc: 'Keep current weight and improve body composition'),
  (id: 'performance_reverse_diet', label: 'Performance / Reverse', icon: Icons.bolt, desc: 'Gradually increase calories to boost metabolism'),
];

class _Step1Goal extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelect;
  const _Step1Goal({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('What\'s your goal?',
              style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Your nutrition plan will be built around this.',
              style: TextStyle(color: Colors.white54, fontSize: 14)),
          const SizedBox(height: 24),
          ...(_goals.map((g) {
            final isSelected = selected == g.id;
            return GestureDetector(
              onTap: () => onSelect(g.id),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: isSelected
                      ? const Color(0xFF0EA5E9).withOpacity(0.15)
                      : Colors.white.withOpacity(0.04),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF63f7ff) : Colors.white12,
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF0EA5E9).withOpacity(0.3)
                            : Colors.white10,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(g.icon,
                          color: isSelected ? const Color(0xFF63f7ff) : Colors.white38,
                          size: 22),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(g.label,
                              style: TextStyle(
                                  color: isSelected ? Colors.white : Colors.white70,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15)),
                          const SizedBox(height: 2),
                          Text(g.desc,
                              style: const TextStyle(color: Colors.white38, fontSize: 12)),
                        ],
                      ),
                    ),
                    if (isSelected)
                      const Icon(Icons.check_circle, color: Color(0xFF63f7ff), size: 20),
                  ],
                ),
              ),
            );
          })),
        ],
      ),
    );
  }
}

// ─── Step 2: Body metrics ─────────────────────────────────────────────────────

class _Step2Body extends StatelessWidget {
  final String sex;
  final DateTime? birthDate;
  final TextEditingController weightCtrl;
  final TextEditingController feetCtrl;
  final TextEditingController inchesCtrl;
  final TextEditingController targetWeightCtrl;
  final TextEditingController bodyFatCtrl;
  final ValueChanged<String> onSexChanged;
  final ValueChanged<DateTime> onBirthDateChanged;

  const _Step2Body({
    required this.sex,
    required this.birthDate,
    required this.weightCtrl,
    required this.feetCtrl,
    required this.inchesCtrl,
    required this.targetWeightCtrl,
    required this.bodyFatCtrl,
    required this.onSexChanged,
    required this.onBirthDateChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Tell us about you',
              style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Used to calculate your personalised targets.',
              style: TextStyle(color: Colors.white54, fontSize: 14)),
          const SizedBox(height: 28),

          // Sex
          _FieldLabel('Biological Sex'),
          const SizedBox(height: 8),
          Row(children: [
            _SexButton(label: 'Male', icon: Icons.male, selected: sex == 'male',
                onTap: () => onSexChanged('male')),
            const SizedBox(width: 12),
            _SexButton(label: 'Female', icon: Icons.female, selected: sex == 'female',
                onTap: () => onSexChanged('female')),
          ]),

          const SizedBox(height: 20),
          _FieldLabel('Birthday'),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: birthDate ?? DateTime(1990),
                firstDate: DateTime(1930),
                lastDate: DateTime.now().subtract(const Duration(days: 365 * 13)),
                builder: (ctx, child) => Theme(
                  data: Theme.of(ctx).copyWith(
                    colorScheme: const ColorScheme.dark(primary: Color(0xFF0EA5E9)),
                  ),
                  child: child!,
                ),
              );
              if (picked != null) onBirthDateChanged(picked);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: Row(children: [
                const Icon(Icons.calendar_today, color: Colors.white38, size: 18),
                const SizedBox(width: 12),
                Text(
                  birthDate != null
                      ? DateFormat('MMMM d, yyyy').format(birthDate!)
                      : 'Select your birthday',
                  style: TextStyle(
                    color: birthDate != null ? Colors.white : Colors.white38,
                    fontSize: 15,
                  ),
                ),
              ]),
            ),
          ),

          const SizedBox(height: 20),
          _FieldLabel('Current Weight (lbs) *'),
          const SizedBox(height: 8),
          _NumField(ctrl: weightCtrl, hint: 'e.g. 185', decimal: true),

          const SizedBox(height: 20),
          _FieldLabel('Height *'),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _NumField(ctrl: feetCtrl, hint: 'Feet', suffix: 'ft')),
            const SizedBox(width: 12),
            Expanded(child: _NumField(ctrl: inchesCtrl, hint: 'Inches', suffix: 'in', decimal: true)),
          ]),

          const SizedBox(height: 20),
          _FieldLabel('Goal Weight (lbs)  –  optional'),
          const SizedBox(height: 8),
          _NumField(ctrl: targetWeightCtrl, hint: 'e.g. 165', decimal: true),

          const SizedBox(height: 20),
          _FieldLabel('Body Fat %  –  optional'),
          const SizedBox(height: 8),
          _NumField(ctrl: bodyFatCtrl, hint: 'e.g. 18', decimal: true, suffix: '%'),

          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _SexButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _SexButton({required this.label, required this.icon, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF0EA5E9).withOpacity(0.15) : Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? const Color(0xFF63f7ff) : Colors.white12,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, color: selected ? const Color(0xFF63f7ff) : Colors.white38, size: 20),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(color: selected ? Colors.white : Colors.white54, fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

// ─── Step 3: Training + Intensity ─────────────────────────────────────────────

const _intensities = [
  (id: 'conservative', label: 'Conservative', desc: 'Slow, sustainable changes', icon: Icons.spa),
  (id: 'moderate', label: 'Moderate', desc: 'Balanced pace for most people', icon: Icons.directions_run),
  (id: 'aggressive', label: 'Aggressive', desc: 'Faster results, more discipline required', icon: Icons.local_fire_department),
];

class _Step3Training extends StatelessWidget {
  final int sessionsPerWeek;
  final DateTime effectiveDate;
  final String intensityPreset;
  final ValueChanged<int> onSessionsChanged;
  final ValueChanged<DateTime> onEffectiveDateChanged;
  final ValueChanged<String> onIntensityChanged;

  const _Step3Training({
    required this.sessionsPerWeek,
    required this.effectiveDate,
    required this.intensityPreset,
    required this.onSessionsChanged,
    required this.onEffectiveDateChanged,
    required this.onIntensityChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Training & Intensity',
              style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('How hard do you want to push?',
              style: TextStyle(color: Colors.white54, fontSize: 14)),
          const SizedBox(height: 28),

          _FieldLabel('Workouts per week'),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _CounterButton(
                icon: Icons.remove,
                onTap: sessionsPerWeek > 1 ? () => onSessionsChanged(sessionsPerWeek - 1) : null,
              ),
              const SizedBox(width: 24),
              Text(
                '$sessionsPerWeek',
                style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 24),
              _CounterButton(
                icon: Icons.add,
                onTap: sessionsPerWeek < 7 ? () => onSessionsChanged(sessionsPerWeek + 1) : null,
              ),
            ],
          ),

          const SizedBox(height: 28),
          _FieldLabel('Plan Start Date'),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: effectiveDate,
                firstDate: DateTime.now().subtract(const Duration(days: 7)),
                lastDate: DateTime.now().add(const Duration(days: 30)),
                builder: (ctx, child) => Theme(
                  data: Theme.of(ctx).copyWith(
                    colorScheme: const ColorScheme.dark(primary: Color(0xFF0EA5E9)),
                  ),
                  child: child!,
                ),
              );
              if (picked != null) onEffectiveDateChanged(picked);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: Row(children: [
                const Icon(Icons.calendar_month, color: Colors.white38, size: 18),
                const SizedBox(width: 12),
                Text(
                  DateFormat('MMMM d, yyyy').format(effectiveDate),
                  style: const TextStyle(color: Colors.white, fontSize: 15),
                ),
              ]),
            ),
          ),

          const SizedBox(height: 28),
          _FieldLabel('Intensity'),
          const SizedBox(height: 12),
          ...(_intensities.map((i) {
            final selected = intensityPreset == i.id;
            return GestureDetector(
              onTap: () => onIntensityChanged(i.id),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFF0EA5E9).withOpacity(0.15)
                      : Colors.white.withOpacity(0.04),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: selected ? const Color(0xFF63f7ff) : Colors.white12,
                    width: selected ? 1.5 : 1,
                  ),
                ),
                child: Row(children: [
                  Icon(i.icon,
                      color: selected ? const Color(0xFF63f7ff) : Colors.white38,
                      size: 22),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(i.label,
                          style: TextStyle(
                              color: selected ? Colors.white : Colors.white70,
                              fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(i.desc,
                          style: const TextStyle(color: Colors.white38, fontSize: 12)),
                    ]),
                  ),
                  if (selected)
                    const Icon(Icons.check_circle, color: Color(0xFF63f7ff), size: 20),
                ]),
              ),
            );
          })),
        ],
      ),
    );
  }
}

class _CounterButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _CounterButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: onTap != null ? Colors.white10 : Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white12),
        ),
        child: Icon(icon,
            color: onTap != null ? Colors.white : Colors.white24, size: 20),
      ),
    );
  }
}

// ─── Step 4: Preview + Apply ──────────────────────────────────────────────────

class _Step4Preview extends StatelessWidget {
  final CoachPlanPreview? preview;
  final bool loading;
  final String? error;
  final bool applying;
  final VoidCallback onRetry;
  final Future<void> Function() onApply;

  const _Step4Preview({
    required this.preview,
    required this.loading,
    required this.error,
    required this.applying,
    required this.onRetry,
    required this.onApply,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircularProgressIndicator(color: Color(0xFF63f7ff)),
          SizedBox(height: 16),
          Text('Calculating your plan…',
              style: TextStyle(color: Colors.white54, fontSize: 14)),
        ]),
      );
    }

    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
            const SizedBox(height: 16),
            const Text('Something went wrong',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: Colors.white54, fontSize: 12),
                textAlign: TextAlign.center),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0EA5E9)),
            ),
          ]),
        ),
      );
    }

    if (preview == null) return const SizedBox();

    final p = preview!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Your Plan',
              style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Based on your inputs. Apply to start tracking.',
              style: TextStyle(color: Colors.white54, fontSize: 14)),
          const SizedBox(height: 24),

          // Primary targets
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0EA5E9), Color(0xFF2563EB)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.local_fire_department, color: Colors.white70, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    '${p.targetCalories.round()} kcal / day',
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ]),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _MacroChip('Protein', p.proteinGrams, Colors.pink.shade300),
                    _MacroChip('Carbs', p.carbsGrams, Colors.amber.shade300),
                    _MacroChip('Fat', p.fatGrams, Colors.cyan.shade300),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Details
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Column(children: [
              _DetailRow('Maintenance Calories', '${p.maintenanceCalories.round()} kcal'),
              _DetailRow('Target Calories', '${p.targetCalories.round()} kcal'),
              _DetailRow('Weekly Rate', '${p.weeklyRatePercent.toStringAsFixed(1)}%'),
              _DetailRow('Activity Multiplier', p.activityMultiplier.toStringAsFixed(2)),
              _DetailRow('Formula', p.formulaUsed.replaceAll('_', ' ').toUpperCase()),
            ]),
          ),

          const SizedBox(height: 28),

          // Apply button
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: applying ? null : onApply,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5E9),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: applying
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Apply Plan',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _MacroChip extends StatelessWidget {
  final String label;
  final double grams;
  final Color color;
  const _MacroChip(this.label, this.grams, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text('${grams.round()}g',
          style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold)),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
    ]);
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  const _DetailRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          Text(value,
              style: const TextStyle(
                  color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            color: Colors.white70, fontSize: 12, letterSpacing: 0.5, fontWeight: FontWeight.w600));
  }
}

class _NumField extends StatelessWidget {
  final TextEditingController ctrl;
  final String hint;
  final bool decimal;
  final String? suffix;

  const _NumField({
    required this.ctrl,
    required this.hint,
    this.decimal = false,
    this.suffix,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: ctrl,
      keyboardType: TextInputType.numberWithOptions(decimal: decimal),
      inputFormatters: [
        FilteringTextInputFormatter.allow(decimal ? RegExp(r'[\d.]') : RegExp(r'\d')),
      ],
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.white24),
        suffixText: suffix,
        suffixStyle: const TextStyle(color: Colors.white38),
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.white12),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.white12),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF0EA5E9)),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}
