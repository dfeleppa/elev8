import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const UserInfo: React.FC = () => {
  const { user, member, userRole } = useAuth();
  
  return (
    <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border z-50 max-w-sm">
      <h3 className="font-bold text-sm mb-2">Debug: User Info</h3>
      <div className="text-xs space-y-1">
        <div><strong>Email:</strong> {user?.email || 'Not logged in'}</div>
        <div><strong>User ID:</strong> {user?.id || 'None'}</div>
        <div><strong>Role:</strong> {userRole}</div>
        <div><strong>Is Admin:</strong> {member?.isadmin ? 'Yes' : 'No'}</div>
        <div><strong>Is Staff:</strong> {member?.isstaff ? 'Yes' : 'No'}</div>
        <div><strong>Member ID:</strong> {member?.id || 'None'}</div>
        <div><strong>Name:</strong> {member ? `${member.firstname} ${member.lastname}` : 'None'}</div>
      </div>
    </div>
  );
};
