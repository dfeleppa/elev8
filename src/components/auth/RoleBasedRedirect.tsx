import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRedirectPath } from '../../utils/permissions';

const RoleBasedRedirect: React.FC = () => {
  const { userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const redirectPath = getRedirectPath(userRole);
  return <Navigate to={redirectPath} replace />;
};

export default RoleBasedRedirect;
