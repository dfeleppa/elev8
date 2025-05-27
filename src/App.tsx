import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import BillingDashboard from './pages/billing/BillingDashboard';
import BillingSetup from './pages/billing/BillingSetup';
import Invoices from './pages/billing/Invoices';
import Planning from './pages/Planning';
import Marketing from './pages/planning/Marketing';
import SocialMedia from './pages/planning/SocialMedia';
import Planner from './pages/planning/social-media/Planner';
import Content from './pages/planning/social-media/Content';
import Statistics from './pages/planning/social-media/Statistics';
import Settings from './pages/planning/social-media/Settings';
import Events from './pages/planning/Events';
import Retention from './pages/planning/Retention';
import Members from './pages/Members';
import NewMember from './pages/NewMember';
import MemberProfile from './pages/profile/MemberProfile';
import Staff from './pages/Staff';
import CoachingSchedule from './pages/CoachingSchedule';
import ProgrammingSetup from './pages/ProgrammingSetup';
import Programming from './pages/coach/Programming';
import Results from './pages/coach/Results';
import Attendance from './pages/coach/Attendance';
import DatabaseTest from './pages/debug/DatabaseTest';
import SupabaseDebug from './pages/debug/SupabaseDebug';
import ApiKeyTest from './pages/debug/ApiKeyTest';
import RegistrationTest from './pages/debug/RegistrationTest';
import DatabasePolicyTest from './pages/debug/DatabasePolicyTest';
import NetworkDiagnostic from './pages/debug/NetworkDiagnostic';
import MinimalApiTest from './pages/debug/MinimalApiTest';
import PolicyFix from './pages/debug/PolicyFix';
import RBACTest from './pages/debug/RBACTest';
import MemberDashboard from './pages/member/MemberDashboard';
import MemberWorkouts from './pages/member/MemberWorkouts';
import AdminManagement from './pages/AdminManagement';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleBasedRedirect from './components/auth/RoleBasedRedirect';

// Import Supabase connection test for debugging
import './utils/supabaseTest';

const router = createBrowserRouter([
  {
    path: "/auth/login",
    element: <Login />
  },
  {
    path: "/auth/register", 
    element: <Register />
  },
  {
    path: "/auth/reset-password",
    element: <ResetPassword />
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      // Admin Routes
      {
        path: "dashboard",
        element: <ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>
      },
      {
        path: "billing/dashboard",
        element: <ProtectedRoute requiredRole="admin"><BillingDashboard /></ProtectedRoute>
      },
      {
        path: "billing/setup",
        element: <ProtectedRoute requiredRole="admin"><BillingSetup /></ProtectedRoute>
      },
      {
        path: "billing/invoices",
        element: <ProtectedRoute requiredRole="admin"><Invoices /></ProtectedRoute>
      },
      {
        path: "planning",
        element: <ProtectedRoute requiredRole="admin"><Planning /></ProtectedRoute>
      },
      {
        path: "planning/marketing",
        element: <ProtectedRoute requiredRole="admin"><Marketing /></ProtectedRoute>
      },
      {
        path: "planning/social-media",
        element: <ProtectedRoute requiredRole="admin"><SocialMedia /></ProtectedRoute>,
        children: [
          {
            index: true,
            element: <Planner />
          },
          {
            path: "content",
            element: <Content />
          },
          {
            path: "statistics",
            element: <Statistics />
          },
          {
            path: "settings",
            element: <Settings />
          }
        ]
      },
      {
        path: "planning/events",
        element: <ProtectedRoute requiredRole="admin"><Events /></ProtectedRoute>
      },
      {
        path: "planning/retention",
        element: <ProtectedRoute requiredRole="admin"><Retention /></ProtectedRoute>
      },
      {
        path: "members",
        element: <ProtectedRoute requiredRole="admin"><Members /></ProtectedRoute>
      },
      {
        path: "members/new",
        element: <ProtectedRoute requiredRole="admin"><NewMember /></ProtectedRoute>
      },
      {
        path: "members/:id",
        element: <ProtectedRoute requiredRole="admin"><MemberProfile /></ProtectedRoute>
      },
      {
        path: "staff",
        element: <ProtectedRoute requiredRole="admin"><Staff /></ProtectedRoute>
      },
      {
        path: "staff/:id",
        element: <ProtectedRoute requiredRole="admin"><MemberProfile /></ProtectedRoute>
      },
      {
        path: "admin-management",
        element: <ProtectedRoute requiredRole="admin"><AdminManagement /></ProtectedRoute>
      },
      {
        path: "coaching-schedule",
        element: <ProtectedRoute allowedRoles={["admin", "staff"]}><CoachingSchedule /></ProtectedRoute>
      },
      {
        path: "programming-setup",
        element: <ProtectedRoute allowedRoles={["admin", "staff"]}><ProgrammingSetup /></ProtectedRoute>
      },
      // Coach Routes (accessible by staff and admin)
      {
        path: "coach/programming",
        element: <ProtectedRoute allowedRoles={["admin", "staff"]}><Programming /></ProtectedRoute>
      },
      {
        path: "coach/results",
        element: <ProtectedRoute allowedRoles={["admin", "staff"]}><Results /></ProtectedRoute>
      },
      {
        path: "coach/attendance",
        element: <ProtectedRoute allowedRoles={["admin", "staff"]}><Attendance /></ProtectedRoute>
      },
      // Debug Routes (Admin Only)
      {
        path: "debug/database",
        element: <ProtectedRoute requiredRole="admin"><DatabaseTest /></ProtectedRoute>
      },
      {
        path: "debug/supabase",
        element: <ProtectedRoute requiredRole="admin"><SupabaseDebug /></ProtectedRoute>
      },
      {
        path: "debug/apikey",
        element: <ProtectedRoute requiredRole="admin"><ApiKeyTest /></ProtectedRoute>
      },
      {
        path: "debug/registration",
        element: <ProtectedRoute requiredRole="admin"><RegistrationTest /></ProtectedRoute>
      },
      {
        path: "debug/policies",
        element: <ProtectedRoute requiredRole="admin"><DatabasePolicyTest /></ProtectedRoute>
      },
      {
        path: "debug/network",
        element: <ProtectedRoute requiredRole="admin"><NetworkDiagnostic /></ProtectedRoute>
      },
      {
        path: "debug/minimal",
        element: <ProtectedRoute requiredRole="admin"><MinimalApiTest /></ProtectedRoute>
      },
      {
        path: "debug/policyfix",
        element: <ProtectedRoute requiredRole="admin"><PolicyFix /></ProtectedRoute>
      },
      {
        path: "debug/rbac",
        element: <ProtectedRoute requiredRole="admin"><RBACTest /></ProtectedRoute>
      },
      // Member Routes (accessible by all authenticated users)
      {
        path: "member/dashboard",
        element: <ProtectedRoute><MemberDashboard /></ProtectedRoute>
      },
      {
        path: "member/workouts",
        element: <ProtectedRoute><MemberWorkouts /></ProtectedRoute>
      },
      {
        path: "member/schedule",
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>
      },
      {
        path: "member/account",
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>
      },
      // Settings and Help (accessible by all authenticated users)
      {
        path: "settings",
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>
      },
      {
        path: "help",
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>
      },
      // Analytics (admin only)
      {
        path: "analytics",
        element: <ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>
      },
      // Additional billing routes
      {
        path: "billing/memberships",
        element: <ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>
      },
      {
        path: "billing/products",
        element: <ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>
      },
      {
        path: "billing/coupons",
        element: <ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>
      },
      {
        path: "billing/reports",
        element: <ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>
      },
      {
        index: true,
        element: <RoleBasedRedirect />
      }
    ]
  }
]);

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </AuthProvider>
  );
}