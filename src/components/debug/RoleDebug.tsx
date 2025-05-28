import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';

const RoleDebug: React.FC = () => {
  const { user, member, userRole, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border z-50 max-w-sm">
      <h3 className="font-bold text-sm mb-2">Debug Info</h3>
      <div className="text-xs space-y-1">
        <div><strong>User:</strong> {user?.email || 'Not logged in'}</div>
        <div><strong>Role:</strong> {userRole}</div>
        <div><strong>Is Admin:</strong> {member?.isadmin ? 'Yes' : 'No'}</div>
        <div><strong>Is Staff:</strong> {member?.isstaff ? 'Yes' : 'No'}</div>
        <div><strong>Admin Management Access:</strong> {hasPermission(userRole, '/admin-management') ? 'Yes' : 'No'}</div>
        <div><strong>Member ID:</strong> {member?.id || 'None'}</div>
      </div>
    </div>
  );
};

export default RoleDebug;
