import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, UserRole, ROLE_PERMISSIONS } from '../../utils/permissions';
import { Crown, Users, User, Check, X, Shield } from 'lucide-react';

const RBACTest: React.FC = () => {
  const { userRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(userRole || 'member');

  const testPaths = [
    // Admin-only paths
    '/dashboard',
    '/planning',
    '/planning/marketing',
    '/planning/social-media',
    '/members',
    '/staff',
    '/admin-management',
    '/billing/dashboard',
    '/billing/setup',
    '/analytics',
    '/debug/database',
    
    // Staff/Coach paths
    '/coaching-schedule',
    '/programming-setup',
    '/coach/programming',
    '/coach/results',
    '/coach/attendance',
    
    // Member paths
    '/member/dashboard',
    '/member/workouts',
    '/member/schedule',
    '/member/account',
    
    // Common paths
    '/settings',
    '/help'
  ];

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Crown className="w-5 h-5 text-orange-500" />;
      case 'staff': return <Users className="w-5 h-5 text-purple-500" />;
      case 'member': return <User className="w-5 h-5 text-blue-500" />;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'staff': return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'member': return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              RBAC (Role-Based Access Control) Test
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Test role-based permissions and navigation filtering
            </p>
          </div>
        </div>

        {/* Current User Role */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Current User Role</h2>
          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getRoleColor(userRole || 'member')}`}>
            {getRoleIcon(userRole || 'member')}
            <span className="font-medium capitalize">{userRole || 'member'}</span>
          </div>
        </div>

        {/* Role Selector for Testing */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Test Different Roles</h2>
          <div className="flex gap-3">
            {(['admin', 'staff', 'member'] as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  selectedRole === role
                    ? getRoleColor(role)
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {getRoleIcon(role)}
                <span className="font-medium capitalize">{role}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Permission Test Results */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Permission Test Results for: <span className="capitalize text-blue-600">{selectedRole}</span>
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {testPaths.map((path) => {
              const hasAccess = hasPermission(selectedRole, path);
              
              return (
                <div
                  key={path}
                  className={`p-4 rounded-lg border ${
                    hasAccess
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                        {path}
                      </code>
                    </div>
                    <div className="flex items-center">
                      {hasAccess ? (
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                  </div>
                  <div className="mt-1">
                    <span className={`text-xs font-medium ${
                      hasAccess
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {hasAccess ? 'Allowed' : 'Denied'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Role Permissions Summary */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Role Permissions Summary</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {(['admin', 'staff', 'member'] as UserRole[]).map((role) => (
              <div key={role} className={`p-4 rounded-lg border ${getRoleColor(role)}`}>
                <div className="flex items-center gap-2 mb-3">
                  {getRoleIcon(role)}
                  <h3 className="font-semibold capitalize">{role}</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-sm">
                    <strong>Total Paths:</strong> {ROLE_PERMISSIONS[role].allowedPaths.length}
                  </p>
                  <p className="text-sm">
                    <strong>Redirect:</strong> {ROLE_PERMISSIONS[role].redirectPath}
                  </p>
                  <div className="mt-2">
                    <p className="text-xs font-medium mb-1">Key Access Areas:</p>
                    <div className="text-xs space-y-0.5">
                      {role === 'admin' && (
                        <>
                          <div>• Full system access</div>
                          <div>• Admin management</div>
                          <div>• Billing & analytics</div>
                          <div>• Debug tools</div>
                        </>
                      )}
                      {role === 'staff' && (
                        <>
                          <div>• Coach features</div>
                          <div>• Member management</div>
                          <div>• Programming tools</div>
                        </>
                      )}
                      {role === 'member' && (
                        <>
                          <div>• Personal dashboard</div>
                          <div>• Workouts & schedule</div>
                          <div>• Account settings</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RBACTest;
