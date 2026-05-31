import 'package:flutter_test/flutter_test.dart';

import 'package:elev8_mobile/data/repositories/nutrition_repository.dart';

void main() {
  group('CoachPlanStatus', () {
    test('hasPlan=false short-circuits derived getters', () {
      final s = CoachPlanStatus(hasPlan: false);
      expect(s.weightProgressPercent, isNull);
      expect(s.checkInDots.length, CoachPlanStatus.checkInDotsCount);
      expect(s.checkInDots.where((b) => b).length, lessThanOrEqualTo(10));
    });

    test('weightProgressPercent reports 0 at start, 100 at goal', () {
      final start = CoachPlanStatus(
        hasPlan: true,
        goalType: 'lose_weight',
        startWeight: 200,
        currentWeight: 200,
        targetWeight: 180,
      );
      expect(start.weightProgressPercent, 0);

      final done = CoachPlanStatus(
        hasPlan: true,
        goalType: 'lose_weight',
        startWeight: 200,
        currentWeight: 180,
        targetWeight: 180,
      );
      expect(done.weightProgressPercent, 100);
    });

    test('weightProgressPercent is symmetric for cuts and bulks', () {
      final cut = CoachPlanStatus(
        hasPlan: true,
        goalType: 'lose_weight',
        startWeight: 200,
        currentWeight: 190,
        targetWeight: 180,
      );
      final bulk = CoachPlanStatus(
        hasPlan: true,
        goalType: 'gain_weight',
        startWeight: 180,
        currentWeight: 190,
        targetWeight: 200,
      );
      expect(cut.weightProgressPercent, 50);
      expect(bulk.weightProgressPercent, 50);
    });

    test('weightProgressPercent clamps at 100 when overshooting', () {
      final overshoot = CoachPlanStatus(
        hasPlan: true,
        goalType: 'lose_weight',
        startWeight: 200,
        currentWeight: 170,
        targetWeight: 180,
      );
      expect(overshoot.weightProgressPercent, 100);
    });

    test('weightProgressPercent returns 100 if start equals target', () {
      final flat = CoachPlanStatus(
        hasPlan: true,
        goalType: 'lose_weight',
        startWeight: 180,
        currentWeight: 180,
        targetWeight: 180,
      );
      expect(flat.weightProgressPercent, 100);
    });

    test('weightProgressPercent is null when any input is missing', () {
      expect(
        CoachPlanStatus(
          hasPlan: true,
          goalType: 'lose_weight',
          startWeight: 200,
          currentWeight: null,
          targetWeight: 180,
        ).weightProgressPercent,
        isNull,
      );
    });

    test('weightProgressPercent is null for non-target-weight goals', () {
      final maintain = CoachPlanStatus(
        hasPlan: true,
        goalType: 'maintain_weight',
        startWeight: 180,
        currentWeight: 180,
        targetWeight: 180,
      );
      final reverseDiet = CoachPlanStatus(
        hasPlan: true,
        goalType: 'performance_reverse_diet',
        startWeight: 180,
        currentWeight: 182,
        targetWeight: 180,
      );

      expect(maintain.hasTargetWeightGoal, isFalse);
      expect(maintain.weightProgressPercent, isNull);
      expect(reverseDiet.hasTargetWeightGoal, isFalse);
      expect(reverseDiet.weightProgressPercent, isNull);
    });

    test('daysUntilCheckIn is 0 on the check-in day', () {
      final today = DateTime.now();
      final s = CoachPlanStatus(
        hasPlan: true,
        lastCheckInDate: today.subtract(const Duration(days: 10)),
        nextCheckInDate: today,
      );
      expect(s.daysUntilCheckIn, 0);
    });

    test('daysUntilCheckIn never exceeds 10', () {
      final today = DateTime.now();
      final s = CoachPlanStatus(
        hasPlan: true,
        lastCheckInDate: today,
        nextCheckInDate: today.add(const Duration(days: 30)),
      );
      expect(s.daysUntilCheckIn, lessThanOrEqualTo(10));
    });

    test('checkInDots returns the configured length', () {
      final s = CoachPlanStatus(
        hasPlan: true,
        lastCheckInDate: DateTime.now().subtract(const Duration(days: 5)),
        nextCheckInDate: DateTime.now().add(const Duration(days: 5)),
      );
      expect(s.checkInDots, hasLength(CoachPlanStatus.checkInDotsCount));
    });

    test('goalLabel maps known goal_type ids to friendly labels', () {
      expect(
        CoachPlanStatus(hasPlan: true, goalType: 'lose_weight').goalLabel,
        'Lose Weight',
      );
      expect(
        CoachPlanStatus(hasPlan: true, goalType: 'maintain_weight').goalLabel,
        'Maintain',
      );
    });

    test('goalLabel falls back to raw value for unknown ids', () {
      expect(
        CoachPlanStatus(hasPlan: true, goalType: 'recomposition').goalLabel,
        'recomposition',
      );
    });

    test('goalLabel falls back to "Plan Active" when goalType is null', () {
      expect(CoachPlanStatus(hasPlan: true).goalLabel, 'Plan Active');
    });
  });
}
