/// One row from the payroll_entries table.
///
/// Mirrors the JSON shape returned by GET /api/owner/payroll. Hours and
/// totals are coerced to `double` because the server returns them as
/// `Number(...)` and Dart's JSON decoder doesn't always pick `double`.
class OwnerPayrollEntry {
  final String id;
  final String weekEndingDate; // YYYY-MM-DD
  final String staffName;
  final double coachingHours;
  final double officeHours;
  final double totalPay;
  final String? payDate; // YYYY-MM-DD or empty
  final String notes;

  const OwnerPayrollEntry({
    required this.id,
    required this.weekEndingDate,
    required this.staffName,
    required this.coachingHours,
    required this.officeHours,
    required this.totalPay,
    required this.payDate,
    required this.notes,
  });

  double get totalHours => coachingHours + officeHours;
  bool get isPaid => (payDate ?? '').isNotEmpty;

  factory OwnerPayrollEntry.fromJson(Map<String, dynamic> json) {
    double parseDouble(Object? v) {
      if (v == null) return 0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0;
    }

    final payDate = json['payDate'] as String?;
    return OwnerPayrollEntry(
      id: json['id'].toString(),
      weekEndingDate: (json['weekEndingDate'] as String?) ?? '',
      staffName: (json['staffName'] as String?) ?? '',
      coachingHours: parseDouble(json['coachingHours']),
      officeHours: parseDouble(json['officeHours']),
      totalPay: parseDouble(json['totalPay']),
      payDate: (payDate != null && payDate.isNotEmpty) ? payDate : null,
      notes: (json['notes'] as String?) ?? '',
    );
  }
}
