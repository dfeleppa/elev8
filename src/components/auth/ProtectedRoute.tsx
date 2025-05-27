import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MemberService } from '../../utils/memberService';
import { getUserRole, isPathAccessible, getRedirectPath, UserRole } from '../../utils/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, allowedRoles }) => {  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [memberLoading, setMemberLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>('member');

  useEffect(() => {
    const fetchMemberData = async () => {
      if (!user) {
        setMemberLoading(false);
        return;
      }      try {
        const member = await MemberService.getMemberById(user.id);
        
        if (member) {
          const role = getUserRole(member);
          setUserRole(role);
        }
      } catch (error) {
        console.error('Error fetching member data:', error);
        // Default to member role if there's an error
        setUserRole('member');
      } finally {
        setMemberLoading(false);
      }
    };

    fetchMemberData();
  }, [user]);

  // Show loading spinner while checking authentication and permissions
  if (isLoading || memberLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Check if the current path is accessible for the user's role
  const currentPath = location.pathname;
  const hasAccess = isPathAccessible(currentPath, userRole);

  // If access is denied, redirect to the appropriate dashboard
  if (!hasAccess) {
    const redirectPath = getRedirectPath(userRole);
    return <Navigate to={redirectPath} replace />;
  }
  // If a specific role is required and user doesn't have it, redirect
  if (requiredRole && userRole !== requiredRole && userRole !== 'admin') {
    const redirectPath = getRedirectPath(userRole);
    return <Navigate to={redirectPath} replace />;
  }

  // If specific roles are allowed and user doesn't have any of them, redirect
  if (allowedRoles && !allowedRoles.includes(userRole) && userRole !== 'admin') {
    const redirectPath = getRedirectPath(userRole);
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
