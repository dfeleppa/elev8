/// One row from the owner-facing members directory.
///
/// Mirrors `OwnerMemberRow` in `src/app/owner/members/page.tsx` so the
/// Flutter list view and the web table can be evolved together.
class OwnerMember {
  final String? firstName;
  final String? lastName;
  final String? email;
  final String? membership;
  final String? role;
  final String? status;
  final String? tracks;
  final String? phone;
  final String? gender;
  final String? address;
  final String? birthDate;
  final String? tags;
  final String? statusNotes;
  final num? mrr;
  final int? attendanceCount;
  final DateTime? lastCheckIn;
  final DateTime? lastActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const OwnerMember({
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.membership,
    required this.role,
    required this.status,
    required this.tracks,
    required this.phone,
    required this.gender,
    required this.address,
    required this.birthDate,
    required this.tags,
    required this.statusNotes,
    required this.mrr,
    required this.attendanceCount,
    required this.lastCheckIn,
    required this.lastActive,
    required this.createdAt,
    required this.updatedAt,
  });

  String get displayName {
    final first = (firstName ?? '').trim();
    final last = (lastName ?? '').trim();
    final full = [first, last].where((s) => s.isNotEmpty).join(' ').trim();
    if (full.isNotEmpty) return full;
    final mail = (email ?? '').trim();
    if (mail.isEmpty) return 'Unknown Member';
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

  factory OwnerMember.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(Object? v) {
      if (v == null) return null;
      final s = v.toString();
      if (s.isEmpty) return null;
      return DateTime.tryParse(s);
    }

    int? parseInt(Object? v) {
      if (v == null) return null;
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString());
    }

    num? parseNum(Object? v) {
      if (v == null) return null;
      if (v is num) return v;
      return num.tryParse(v.toString());
    }

    return OwnerMember(
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      email: json['email'] as String?,
      membership: json['membership'] as String?,
      role: json['role'] as String?,
      status: json['status'] as String?,
      tracks: json['tracks'] as String?,
      phone: json['phone'] as String?,
      gender: json['gender'] as String?,
      address: json['address'] as String?,
      birthDate: json['birth_date'] as String?,
      tags: json['tags'] as String?,
      statusNotes: json['status_notes'] as String?,
      mrr: parseNum(json['mrr']),
      attendanceCount: parseInt(json['attendance_count']),
      lastCheckIn: parseDate(json['last_check_in']),
      lastActive: parseDate(json['last_active']),
      createdAt: parseDate(json['created_at']),
      updatedAt: parseDate(json['updated_at']),
    );
  }
}
