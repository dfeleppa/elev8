/// One row of `/api/owner/tracks-memberships/members`.
///
/// `tracks` is the comma-split list of programming-track names a member
/// is currently assigned to. The web endpoint normalizes the source
/// `members.tracks` text column into this list shape.
class MemberTrackAssignment {
  final String email;
  final String fullName;
  final List<String> tracks;

  const MemberTrackAssignment({
    required this.email,
    required this.fullName,
    required this.tracks,
  });

  factory MemberTrackAssignment.fromJson(Map<String, dynamic> json) {
    final tracks = (json['tracks'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList();
    return MemberTrackAssignment(
      email: (json['email'] as String?) ?? '',
      fullName: (json['fullName'] as String?) ?? '',
      tracks: tracks,
    );
  }
}
