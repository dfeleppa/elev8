// Role-based permission system for Elev8 gym application

export type UserRole = 'member' | 'staff' | 'admin';

export interface PermissionConfig {
  role: UserRole;
  allowedPaths: string[];
  redirectPath: string;
}

// Define role permissions
export const ROLE_PERMISSIONS: Record<UserRole, PermissionConfig> = {
  admin: {
    role: 'admin',
    allowedPaths: [
      // Admin has access to everything
      '/dashboard',
      '/planning',
      '/planning/marketing',
      '/planning/social-media',
      '/planning/social-media/content',
      '/planning/social-media/statistics',
      '/planning/social-media/settings',
      '/planning/events',
      '/planning/retention',
      '/members',
      '/members/*',
      '/staff',
      '/staff/*',
      '/admin-management',
      '/billing/dashboard',
      '/billing/setup',
      '/billing/invoices',
      '/billing/memberships',
      '/billing/products',
      '/billing/coupons',
      '/billing/reports',
      '/coaching-schedule',
      '/programming-setup',
      '/analytics',
      // Coach pages
      '/coach/programming',
      '/coach/results',
      '/coach/attendance',
      // Member pages
      '/member/dashboard',
      '/member/workouts',
      '/member/schedule',
      '/member/account',
      // Settings and help
      '/settings',
      '/help',
      // Debug pages (admin only)
      '/debug/*'
    ],
    redirectPath: '/dashboard'
  },
  
  staff: {
    role: 'staff',
    allowedPaths: [
      // Staff can access coach pages and member pages
      '/coach/programming',
      '/coach/results',
      '/coach/attendance',
      '/coaching-schedule',
      '/programming-setup',
      // Member pages
      '/member/dashboard',
      '/member/workouts',
      '/member/schedule',
      '/member/account',
      // Basic member viewing (limited)
      '/members',
      '/members/*',
      // Settings and help
      '/settings',
      '/help'
    ],
    redirectPath: '/coach/programming'
  },
  
  member: {
    role: 'member',
    allowedPaths: [
      // Members can only access their own pages
      '/member/dashboard',
      '/member/workouts',
      '/member/schedule',
      '/member/account',
      // Settings and help
      '/settings',
      '/help'
    ],
    redirectPath: '/member/dashboard'
  }
};

// Check if a user role has permission to access a path
export const hasPermission = (userRole: UserRole, path: string): boolean => {
  const roleConfig = ROLE_PERMISSIONS[userRole];
  
  return roleConfig.allowedPaths.some(allowedPath => {
    // Handle wildcard paths
    if (allowedPath.endsWith('/*')) {
      const basePath = allowedPath.slice(0, -2);
      return path.startsWith(basePath);
    }
    
    // Handle exact path matches
    return path === allowedPath;
  });
};

// Get the appropriate redirect path for a role
export const getRedirectPath = (userRole: UserRole): string => {
  return ROLE_PERMISSIONS[userRole].redirectPath;
};

// Determine user role from member data
export const getUserRole = (member: any): UserRole => {
  if (member?.isadmin) return 'admin';
  if (member?.isstaff) return 'staff';
  return 'member';
};

// Get role display name
export const getRoleDisplayName = (role: UserRole): string => {
  switch (role) {
    case 'admin': return 'Administrator';
    case 'staff': return 'Staff Member';
    case 'member': return 'Member';
    default: return 'Member';
  }
};

// Get role color class for UI
export const getRoleColorClass = (role: UserRole): string => {
  switch (role) {
    case 'admin': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20';
    case 'staff': return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20';
    case 'member': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20';
    default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
  }
};

// Check if current path is accessible for role
export const isPathAccessible = (path: string, userRole: UserRole): boolean => {
  // Always allow auth pages
  if (path.startsWith('/auth/')) {
    return true;
  }
  
  return hasPermission(userRole, path);
};

// Get filtered navigation items based on role
export const getFilteredNavigation = (userRole: UserRole) => {
  const adminItems = [
    { path: '/dashboard', label: 'Dashboard', adminOnly: true },
    { path: '/planning', label: 'Planning', adminOnly: true },
    { path: '/members', label: 'Members', adminOnly: true },
    { path: '/staff', label: 'Staff', adminOnly: true },
    { path: '/admin-management', label: 'Admin Management', adminOnly: true },
    { path: '/billing/dashboard', label: 'Billing', adminOnly: true },
    { path: '/coaching-schedule', label: 'Coaching Schedule', adminOnly: true },
    { path: '/programming-setup', label: 'Programming Setup', adminOnly: true },
    { path: '/analytics', label: 'Analytics', adminOnly: true }
  ];

  const staffItems = [
    { path: '/coach/programming', label: 'Programming', staffOnly: true },
    { path: '/coach/results', label: 'Results', staffOnly: true },
    { path: '/coach/attendance', label: 'Attendance', staffOnly: true },
    { path: '/coaching-schedule', label: 'Schedule', staffOnly: true },
    { path: '/members', label: 'Members', staffOnly: true }
  ];

  const memberItems = [
    { path: '/member/dashboard', label: 'My Dashboard', memberOnly: true },
    { path: '/member/workouts', label: 'Daily Workouts', memberOnly: true },
    { path: '/member/schedule', label: 'Class Schedule', memberOnly: true },
    { path: '/member/account', label: 'Account Info', memberOnly: true }
  ];

  const commonItems = [
    { path: '/settings', label: 'Settings' },
    { path: '/help', label: 'Help & Support' }
  ];

  switch (userRole) {
    case 'admin':
      return [...adminItems, ...staffItems, ...memberItems, ...commonItems];
    case 'staff':
      return [...staffItems, ...memberItems, ...commonItems];
    case 'member':
      return [...memberItems, ...commonItems];
    default:
      return memberItems;
  }
};
