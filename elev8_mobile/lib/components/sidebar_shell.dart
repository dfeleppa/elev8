import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:elev8_mobile/components/elev8_background.dart';

// ----------------------------------------------------------------------
// DATA MODELS
// ----------------------------------------------------------------------

enum UserRole { member, coach, admin, owner }

extension UserRoleRank on UserRole {
  int get rank {
    switch (this) {
      case UserRole.member:
        return 1;
      case UserRole.coach:
        return 2;
      case UserRole.admin:
        return 3;
      case UserRole.owner:
        return 4;
    }
  }
}

enum ViewMode { gym, athlete }

class NavEntry {
  final String label;
  final String href;
  final IconData icon;
  final UserRole minRole;

  const NavEntry({
    required this.label,
    required this.href,
    required this.icon,
    this.minRole = UserRole.member,
  });
}

class NavSection {
  final String label;
  final List<NavEntry> entries;

  const NavSection({required this.label, required this.entries});
}

// ----------------------------------------------------------------------
// NAVIGATION DATA — mirrors src/components/SidebarShell.tsx
// ----------------------------------------------------------------------
//
// Athlete view sections (visible to all roles).
// Maps 1:1 to ATHLETE_SECTIONS in the web SidebarShell.
const List<NavSection> athleteSections = [
  NavSection(
    label: 'Today',
    entries: [
      NavEntry(
        label: 'Athlete Dashboard',
        href: '/member/athlete-dashboard',
        icon: Icons.show_chart,
      ),
    ],
  ),
  NavSection(
    label: 'Train',
    entries: [
      NavEntry(
        label: 'Workout',
        href: '/member/workout',
        icon: Icons.fitness_center,
      ),
    ],
  ),
  NavSection(
    label: 'Schedule',
    entries: [
      NavEntry(
        label: 'Class Schedule',
        href: '/member/class-schedule',
        icon: Icons.calendar_month,
      ),
    ],
  ),
  NavSection(
    label: 'Nutrition',
    entries: [
      NavEntry(
        label: 'Nutrition',
        href: '/member/nutrition',
        icon: Icons.restaurant,
      ),
      NavEntry(
        label: 'Nutrition Coach',
        href: '/member/nutrition-coach',
        icon: Icons.monitor_heart,
      ),
    ],
  ),
  NavSection(
    label: 'Account',
    entries: [
      NavEntry(
        label: 'Account Dashboard',
        href: '/member/account-dashboard',
        icon: Icons.person_outline,
      ),
      NavEntry(
        label: 'Store',
        href: '/member/store',
        icon: Icons.shopping_bag_outlined,
      ),
    ],
  ),
];

// Gym view sections — only role-appropriate sections render. Mirrors the
// Overview / Management / Operations / Coaching grouping the web shell uses
// when viewMode === 'gym'.
const NavEntry gymDashboardEntry = NavEntry(
  label: 'Gym Dashboard',
  href: '/gym-dashboard',
  icon: Icons.bar_chart,
  minRole: UserRole.coach,
);

const NavSection ownerSection = NavSection(
  label: 'Management',
  entries: [
    NavEntry(
      label: 'Staff',
      href: '/owner/staff',
      icon: Icons.groups_outlined,
      minRole: UserRole.owner,
    ),
    NavEntry(
      label: 'Class Setup',
      href: '/owner/schedule',
      icon: Icons.calendar_month,
      minRole: UserRole.owner,
    ),
    NavEntry(
      label: 'Payroll',
      href: '/owner/payroll',
      icon: Icons.account_balance_wallet_outlined,
      minRole: UserRole.owner,
    ),
    NavEntry(
      label: 'Billing',
      href: '/owner/billing',
      icon: Icons.receipt_long_outlined,
      minRole: UserRole.owner,
    ),
    NavEntry(
      label: 'Tracks & Memberships',
      href: '/owner/tracks-memberships',
      icon: Icons.verified_user_outlined,
      minRole: UserRole.owner,
    ),
    NavEntry(
      label: 'Members',
      href: '/owner/members',
      icon: Icons.people_alt_outlined,
      minRole: UserRole.owner,
    ),
    NavEntry(
      label: 'Gym Settings',
      href: '/owner/settings',
      icon: Icons.settings_outlined,
      minRole: UserRole.owner,
    ),
  ],
);

const NavSection adminSection = NavSection(
  label: 'Operations',
  entries: [
    NavEntry(
      label: 'Management',
      href: '/management',
      icon: Icons.work_outline,
      minRole: UserRole.admin,
    ),
    NavEntry(
      label: 'Content',
      href: '/admin/content',
      icon: Icons.article_outlined,
      minRole: UserRole.admin,
    ),
    NavEntry(
      label: 'Business Analytics',
      href: '/admin/analytics',
      icon: Icons.insights_outlined,
      minRole: UserRole.admin,
    ),
    NavEntry(
      label: 'Programming',
      href: '/admin/programming',
      icon: Icons.fitness_center,
      minRole: UserRole.admin,
    ),
  ],
);

const NavSection coachSection = NavSection(
  label: 'Coaching',
  entries: [
    NavEntry(
      label: 'Nutrition Coach',
      href: '/coach/nutrition-coach',
      icon: Icons.monitor_heart,
      minRole: UserRole.coach,
    ),
    NavEntry(
      label: 'Schedule',
      href: '/coach/schedule',
      icon: Icons.calendar_month,
      minRole: UserRole.coach,
    ),
    NavEntry(
      label: 'Reports - Members',
      href: '/coach/reports-members',
      icon: Icons.assignment_outlined,
      minRole: UserRole.coach,
    ),
  ],
);

// ----------------------------------------------------------------------
// PROVIDERS
// ----------------------------------------------------------------------

UserRole _parseUserRole(String? value) {
  switch (value) {
    case 'owner':
      return UserRole.owner;
    case 'admin':
      return UserRole.admin;
    case 'coach':
      return UserRole.coach;
    case 'member':
    default:
      return UserRole.member;
  }
}

final userRoleProvider = FutureProvider<UserRole>((ref) async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return UserRole.member;

  // app_users.id is set by the web's NextAuth flow, not by Supabase Auth, so
  // we resolve via supabase_auth_uid first (stamped by main.dart on sign-in)
  // and fall back to email for the brief window before that stamp lands.
  try {
    final byUid = await Supabase.instance.client
        .from('app_users')
        .select('role')
        .eq('supabase_auth_uid', user.id)
        .maybeSingle();
    if (byUid != null) {
      return _parseUserRole(byUid['role'] as String?);
    }

    final email = user.email;
    if (email == null || email.isEmpty) return UserRole.member;

    final byEmail = await Supabase.instance.client
        .from('app_users')
        .select('role')
        .eq('email', email)
        .maybeSingle();
    return _parseUserRole(byEmail?['role'] as String?);
  } catch (e) {
    debugPrint('userRoleProvider failed: $e');
    return UserRole.member;
  }
});

/// Selected view mode (gym vs athlete). Coach+ users default to gym; members
/// are locked to athlete. Persisted in memory only for now — mirrors the
/// `viewMode` state in the web SidebarShell.
class ViewModeNotifier extends Notifier<ViewMode> {
  @override
  ViewMode build() => ViewMode.athlete;

  void set(ViewMode mode) => state = mode;
}

final viewModeProvider = NotifierProvider<ViewModeNotifier, ViewMode>(
  ViewModeNotifier.new,
);

// ----------------------------------------------------------------------
// SIDEBAR SHELL WIDGET
// ----------------------------------------------------------------------

class SidebarShell extends ConsumerStatefulWidget {
  final Widget child;

  const SidebarShell({super.key, required this.child});

  @override
  ConsumerState<SidebarShell> createState() => _SidebarShellState();
}

class _SidebarShellState extends ConsumerState<SidebarShell> {
  bool _viewModeInitialised = false;

  bool _canViewRole(UserRole minRole, UserRole currentRole) {
    return currentRole.rank >= minRole.rank;
  }

  /// Auto-pick a sensible default view mode the first time we know the role:
  ///   - coach/admin/owner → gym
  ///   - member            → athlete
  /// After that, the user controls it via the toggle in the drawer.
  void _ensureDefaultViewMode(UserRole role) {
    if (_viewModeInitialised) return;
    final canAccessGym = role.rank >= UserRole.coach.rank;
    final next = canAccessGym ? ViewMode.gym : ViewMode.athlete;
    // Defer to next frame to avoid mutating provider state during build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(viewModeProvider.notifier).set(next);
      setState(() => _viewModeInitialised = true);
    });
  }

  void _navigate(BuildContext context, String href) {
    // Close the drawer (if open) before navigating so the current page
    // doesn't briefly flash behind the open drawer.
    final scaffold = Scaffold.maybeOf(context);
    if (scaffold != null && scaffold.hasDrawer && scaffold.isDrawerOpen) {
      Navigator.of(context).pop();
    }
    context.go(href);
  }

  String _getPageTitle(String path) {
    if (path.isEmpty || path == '/') return 'Lyfe Fitness';
    for (final s in [
      ...athleteSections,
      gymDashboardWrapper,
      ownerSection,
      adminSection,
      coachSection,
    ]) {
      for (final e in s.entries) {
        if (e.href == path || path.startsWith('${e.href}/')) {
          return e.label;
        }
      }
    }
    return 'Lyfe Fitness';
  }

  @override
  Widget build(BuildContext context) {
    final roleAsync = ref.watch(userRoleProvider);
    final role = roleAsync.value ?? UserRole.member;
    final viewMode = ref.watch(viewModeProvider);
    final canAccessGym = role.rank >= UserRole.coach.rank;

    _ensureDefaultViewMode(role);

    final currentPath = GoRouterState.of(context).uri.toString();

    return Scaffold(
      backgroundColor: Colors.transparent,
      drawer: _buildDrawer(role, viewMode, canAccessGym, currentPath),
      body: Elev8Background(
        child: Column(
          children: [
            // Top bar with hamburger + page title.
            SafeArea(
              bottom: false,
              child: Container(
                height: 56,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: [
                    Builder(
                      builder: (ctx) => IconButton(
                        icon: const Icon(Icons.menu, color: Color(0xFF020617)),
                        onPressed: () => Scaffold.of(ctx).openDrawer(),
                        tooltip: 'Open menu',
                      ),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        _getPageTitle(currentPath),
                        style: const TextStyle(
                          color: Color(0xFF020617),
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(child: widget.child),
          ],
        ),
      ),
    );
  }

  // ── Drawer ─────────────────────────────────────────────────────────────

  Widget _buildDrawer(
    UserRole role,
    ViewMode viewMode,
    bool canAccessGym,
    String currentPath,
  ) {
    return Drawer(
      backgroundColor: const Color(0xFF020617).withValues(alpha: 0.97),
      child: SafeArea(
        child: Column(
          children: [
            _buildDrawerHeader(),
            if (canAccessGym) _buildViewToggle(viewMode),
            const Divider(color: Colors.white12, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: viewMode == ViewMode.athlete
                    ? _athleteNav(role, currentPath)
                    : _gymNav(role, currentPath),
              ),
            ),
            const Divider(color: Colors.white12, height: 1),
            _buildSignOutTile(),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white10,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Image.asset('assets/logo.png', fit: BoxFit.contain),
            ),
          ),
          const SizedBox(width: 12),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Lyfe Fitness',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              Text(
                'Gym OS',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildViewToggle(ViewMode current) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white10,
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.all(4),
        child: Row(
          children: [
            _viewToggleButton(
              label: 'Gym',
              icon: Icons.work_outline,
              selected: current == ViewMode.gym,
              onTap: () =>
                  ref.read(viewModeProvider.notifier).set(ViewMode.gym),
            ),
            _viewToggleButton(
              label: 'Athlete',
              icon: Icons.directions_run,
              selected: current == ViewMode.athlete,
              onTap: () =>
                  ref.read(viewModeProvider.notifier).set(ViewMode.athlete),
            ),
          ],
        ),
      ),
    );
  }

  Widget _viewToggleButton({
    required String label,
    required IconData icon,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: selected ? const Color(0xFF020617) : Colors.white70,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: selected ? const Color(0xFF020617) : Colors.white70,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Nav builders ───────────────────────────────────────────────────────

  List<Widget> _athleteNav(UserRole role, String currentPath) {
    final widgets = <Widget>[];
    for (final section in athleteSections) {
      final visible = section.entries
          .where((e) => _canViewRole(e.minRole, role))
          .toList();
      if (visible.isEmpty) continue;
      widgets.add(_sectionHeader(section.label));
      for (final entry in visible) {
        widgets.add(_navTile(entry, currentPath));
      }
    }
    return widgets;
  }

  List<Widget> _gymNav(UserRole role, String currentPath) {
    final widgets = <Widget>[];

    // Overview — always shown for coach+ since gymDashboardEntry is coach+ only.
    if (_canViewRole(gymDashboardEntry.minRole, role)) {
      widgets
        ..add(_sectionHeader('Overview'))
        ..add(_navTile(gymDashboardEntry, currentPath));
    }

    // Owner > Admin > Coach (highest privilege first, matching web).
    final orderedSections = <NavSection>[];
    if (role == UserRole.owner) {
      orderedSections.addAll([ownerSection, adminSection, coachSection]);
    } else if (role == UserRole.admin) {
      orderedSections.addAll([adminSection, coachSection]);
    } else if (role == UserRole.coach) {
      orderedSections.add(coachSection);
    }

    for (final section in orderedSections) {
      final visible = section.entries
          .where((e) => _canViewRole(e.minRole, role))
          .toList();
      if (visible.isEmpty) continue;
      widgets.add(_sectionHeader(section.label));
      for (final entry in visible) {
        widgets.add(_navTile(entry, currentPath));
      }
    }

    return widgets;
  }

  Widget _sectionHeader(String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 6),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          color: Colors.white38,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.4,
        ),
      ),
    );
  }

  Widget _navTile(NavEntry entry, String currentPath) {
    final isActive =
        currentPath == entry.href || currentPath.startsWith('${entry.href}/');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
      child: Material(
        color: isActive ? Colors.white10 : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => _navigate(context, entry.href),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Icon(
                  entry.icon,
                  size: 18,
                  color: isActive ? Colors.white : Colors.white54,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    entry.label,
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.white70,
                      fontSize: 13,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignOutTile() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () async {
          await Supabase.instance.client.auth.signOut();
          if (mounted) context.go('/auth');
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white10,
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Row(
            children: [
              Icon(Icons.logout, size: 18, color: Colors.white70),
              SizedBox(width: 12),
              Text(
                'Sign out',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Internal wrapper so [_getPageTitle] can iterate gym dashboard alongside
/// the section lists.
const NavSection gymDashboardWrapper = NavSection(
  label: 'Overview',
  entries: [gymDashboardEntry],
);
