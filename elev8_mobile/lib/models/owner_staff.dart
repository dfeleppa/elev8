/// One staff member returned by GET /api/owner/staff.
///
/// Maps the JSON shape that route emits — flattened compared to the raw
/// app_users row so the iOS list can render it directly.
class OwnerStaff {
  final String id;
  final String? userId;
  final String? role;
  final String? fullName;
  final String? email;
  final num? coachingPayrate;
  final num? officePayrate;

  const OwnerStaff({
    required this.id,
    required this.userId,
    required this.role,
    required this.fullName,
    required this.email,
    required this.coachingPayrate,
    required this.officePayrate,
  });

  String get displayName {
    final n = (fullName ?? '').trim();
    if (n.isNotEmpty) return n;
    final mail = (email ?? '').trim();
    if (mail.isEmpty) return 'Unknown Staff';
    final at = mail.indexOf('@');
    return at > 0 ? mail.substring(0, at) : mail;
  }

  String get initials {
    final parts = displayName
        .split(RegExp(r'\s+'))
        .where((s) => s.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  factory OwnerStaff.fromJson(Map<String, dynamic> json) {
    num? parseNum(Object? v) {
      if (v == null) return null;
      if (v is num) return v;
      return num.tryParse(v.toString());
    }

    final user = (json['user'] as Map<String, dynamic>?) ?? const {};
    return OwnerStaff(
      id: (json['id'] ?? json['userId'] ?? '').toString(),
      userId: json['userId']?.toString(),
      role: json['role'] as String?,
      fullName: user['fullName'] as String?,
      email: user['email'] as String?,
      coachingPayrate: parseNum(json['coachingPayrate']),
      officePayrate: parseNum(json['officePayrate']),
    );
  }
}
