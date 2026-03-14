import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ----------------------------------------------------------------------
// DATA MODELS
// ----------------------------------------------------------------------
enum UserRole {
  member,
  coach,
  admin,
  owner,
}

extension UserRoleRank on UserRole {
  int get rank {
    switch (this) {
      case UserRole.member: return 1;
      case UserRole.coach: return 2;
      case UserRole.admin: return 3;
      case UserRole.owner: return 4;
    }
  }
}

class NavChild {
  final String label;
  final String href;
  final UserRole minRole;
  final List<NavChild>? children;

  const NavChild({
    required this.label,
    required this.href,
    this.minRole = UserRole.member,
    this.children,
  });
}

class NavItem {
  final String label;
  final String href;
  final IconData icon;
  final UserRole minRole;
  final List<NavChild>? children;

  const NavItem({
    required this.label,
    required this.href,
    required this.icon,
    this.minRole = UserRole.member,
    this.children,
  });
}

// ----------------------------------------------------------------------
// NAVIGATION DATA
// ----------------------------------------------------------------------

const List<NavItem> navItems = [
  NavItem(
    label: "Owner",
    href: "/organization/owner",
    icon: Icons.admin_panel_settings_outlined,
    minRole: UserRole.owner,
    children: [
      NavChild(label: "Staff", href: "/organization/owner/staff", minRole: UserRole.owner),
      NavChild(label: "Schedule", href: "/organization/owner/schedule", minRole: UserRole.owner),
      NavChild(label: "Payroll", href: "/organization/owner/payroll", minRole: UserRole.owner),
      NavChild(label: "Billing", href: "/organization/owner/billing", minRole: UserRole.owner),
      NavChild(label: "Tracks & Memberships", href: "/organization/owner/tracks-memberships", minRole: UserRole.owner),
      NavChild(label: "Integrations", href: "/organization/owner/integrations", minRole: UserRole.owner),
      NavChild(label: "Members", href: "/organization/owner/members", minRole: UserRole.owner),
    ],
  ),
  NavItem(
    label: "Admin",
    href: "/organization/admin",
    icon: Icons.manage_accounts_outlined,
    minRole: UserRole.admin,
    children: [
      NavChild(label: "Management", href: "/management", minRole: UserRole.admin),
      NavChild(label: "Content", href: "/content", minRole: UserRole.admin),
      NavChild(label: "Business Analytics", href: "/organization/admin/analytics", minRole: UserRole.admin),
      NavChild(label: "Programming", href: "/organization/admin/programming", minRole: UserRole.admin),
    ],
  ),
  NavItem(
    label: "Coach",
    href: "/organization/coach",
    icon: Icons.sports_outlined,
    minRole: UserRole.coach,
    children: [
      NavChild(label: "Schedule", href: "/organization/coach/schedule", minRole: UserRole.coach),
      NavChild(label: "Reports - Members", href: "/organization/coach/reports-members", minRole: UserRole.coach),
    ],
  ),
  NavItem(
    label: "Member",
    href: "/organization/member",
    icon: Icons.person_outline,
    minRole: UserRole.member,
    children: [
      NavChild(label: "Workout", href: "/organization/member/workout", minRole: UserRole.member),
      NavChild(label: "Nutrition", href: "/organization/member/nutrition", minRole: UserRole.member),
      NavChild(label: "Class Schedule", href: "/organization/member/class-schedule", minRole: UserRole.member),
      NavChild(label: "Account Dashboard", href: "/organization/member/account-dashboard", minRole: UserRole.member),
      NavChild(label: "Athlete Dashboard", href: "/organization/member/athlete-dashboard", minRole: UserRole.member),
      NavChild(label: "Store", href: "/organization/member/store", minRole: UserRole.member),
    ],
  ),
];

// ----------------------------------------------------------------------
// PROVIDERS
// ----------------------------------------------------------------------

final userRoleProvider = FutureProvider<UserRole>((ref) async {
  // Hardcoded for testing purposes
  return UserRole.owner;
  /*
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return UserRole.member;

  try {
    final response = await Supabase.instance.client
        .from('app_users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    final roleStr = response?['role'] as String?;
    switch (roleStr) {
      case 'owner': return UserRole.owner;
      case 'admin': return UserRole.admin;
      case 'coach': return UserRole.coach;
      case 'member':
      default: return UserRole.member;
    }
  } catch (_) {
    return UserRole.member;
  }
  */
});

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
  // Equivalent to `openSubnav` object in React for tracking expanded folders
  final Set<String> _expandedRoutes = {};

  bool _canViewRole(UserRole? minRole, UserRole currentRole) {
    if (minRole == null) return true;
    return currentRole.rank >= minRole.rank;
  }

  void _toggleExpanded(String href) {
    setState(() {
      if (_expandedRoutes.contains(href)) {
        _expandedRoutes.remove(href);
      } else {
        _expandedRoutes.add(href);
      }
    });
  }

  void _handleNavigation(String href) {
    if (href.contains('nutrition')) {
      context.go('/nutrition');
    } else if (href.contains('schedule')) {
      context.go('/schedule');
    } else {
      context.go('/');
    }

    if (!mounted) return;
    final scaffold = Scaffold.maybeOf(context);
    if (scaffold != null && scaffold.hasDrawer && scaffold.isDrawerOpen) {
      Navigator.of(context).pop(); // close drawer
    }
  }

  @override
  Widget build(BuildContext context) {
    final roleAsync = ref.watch(userRoleProvider);
    final isDesktop = MediaQuery.of(context).size.width >= 1024; // lg breakpoint 
    
    // In Flutter, since we have routing (GoRouter), we check the current path
    final currentPath = GoRouterState.of(context).uri.toString();

    return Scaffold(
      backgroundColor: const Color(0xFF020617), // slate-950
      // If it's desktop, show side drawer, else show bottom/hamburger logic (Using Drawer for simplicity here)
      drawer: isDesktop ? null : _buildDrawer(roleAsync.value ?? UserRole.member, currentPath),
      body: Row(
        children: [
          // Fixed Sidebar for Desktop
          if (isDesktop)
            Container(
              width: 220, // narrower sidebar width
              decoration: BoxDecoration(
                color: const Color(0xFF020617).withOpacity(0.95),
                border: const Border(
                  right: BorderSide(color: Colors.white10),
                ),
              ),
              child: _buildSidebarContent(roleAsync.value ?? UserRole.member, currentPath),
            ),
          
          // Main Content
          Expanded(
            child: Column(
              children: [
                // Mobile Header
                if (!isDesktop)
                  Container(
                    height: 60,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      border: const Border(bottom: BorderSide(color: Colors.white10)),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        Builder(
                          builder: (ctx) => IconButton(
                            icon: const Icon(Icons.menu, color: Colors.white),
                            onPressed: () => Scaffold.of(ctx).openDrawer(),
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Text(
                          "Elev8 Control Center",
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                // The actual injected page content
                Expanded(child: widget.child),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawer(UserRole currentRole, String currentPath) {
    return Drawer(
      backgroundColor: const Color(0xFF020617).withOpacity(0.95), // slate-950
      child: SafeArea(
        child: _buildSidebarContent(currentRole, currentPath),
      ),
    );
  }

  Widget _buildSidebarContent(UserRole currentRole, String currentPath) {
    // Filter items recursively based on role
    final visibleItems = navItems.where((item) => _canViewRole(item.minRole, currentRole)).toList();

    return Column(
      children: [
        // Sidebar Header
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white10,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.fitness_center, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text("Elev8", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  Text("Control Center", style: TextStyle(color: Colors.white54, fontSize: 12)),
                ],
              )
            ],
          ),
        ),
        
        // Navigation Tree
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12.0),
            itemCount: visibleItems.length,
            itemBuilder: (context, index) {
              final item = visibleItems[index];
              return _buildNavItem(item, currentRole, currentPath);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildNavItem(NavItem item, UserRole currentRole, String currentPath) {
    // Top-Level Item (e.g., Organization)
    bool isActive = currentPath.startsWith(item.href);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListTile(
          leading: Icon(item.icon, color: isActive ? Colors.blueAccent : Colors.white54, size: 20),
          title: Text(
            item.label,
            style: TextStyle(
              color: isActive ? Colors.white : Colors.white70,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          tileColor: isActive ? Colors.white10 : Colors.transparent,
          onTap: () {
            // Ideally we navigate, but for now we'll just toggle expansion if it has children
            if (item.children != null && item.children!.isNotEmpty) {
               _toggleExpanded(item.href);
            } else {
               _handleNavigation(item.href);
            }
          },
        ),
        
        // Render immediate children (e.g., Coach, Admin, Member)
        if (item.children != null && (_expandedRoutes.contains(item.href) || isActive)) ...[
          Padding(
            padding: const EdgeInsets.only(left: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: item.children!
                  .where((child) => _canViewRole(child.minRole, currentRole))
                  .map((child) => _buildNavChild(child, currentRole, currentPath))
                  .toList(),
            ),
          )
        ]
      ],
    );
  }

  Widget _buildNavChild(NavChild child, UserRole currentRole, String currentPath) {
    bool isExpanded = _expandedRoutes.contains(child.href);
    bool isActive = currentPath.startsWith(child.href);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () {
            if (child.children != null && child.children!.isNotEmpty) {
              _toggleExpanded(child.href);
            } else {
              _handleNavigation(child.href);
            }
          },
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    child.label,
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.white70,
                      fontSize: 13,
                    ),
                  ),
                ),
                if (child.children != null)
                  Icon(
                    isExpanded ? Icons.expand_more : Icons.chevron_right,
                    color: Colors.white54,
                    size: 16,
                  )
              ],
            ),
          ),
        ),
        
        // Render Grandchildren (e.g., Schedule, Workout, Details)
        if (child.children != null && isExpanded) ...[
          Padding(
            padding: const EdgeInsets.only(left: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: child.children!
                  .where((gc) => _canViewRole(gc.minRole, currentRole))
                  .map((gc) => _buildNavGrandchild(gc, currentPath))
                  .toList(),
            ),
          )
        ]
      ],
    );
  }

  Widget _buildNavGrandchild(NavChild grandchild, String currentPath) {
    bool isActive = currentPath == grandchild.href;
    return InkWell(
      onTap: () {
        _handleNavigation(grandchild.href);
      },
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
        child: Text(
          grandchild.label,
          style: TextStyle(
            color: isActive ? Colors.white : Colors.white60,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}
