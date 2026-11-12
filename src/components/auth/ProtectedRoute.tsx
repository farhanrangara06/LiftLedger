import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role, loading, isSetupRequired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner message="Authenticating LiftLedger..." size="lg" />
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Needs company setup and not already on the setup route
  if (isSetupRequired && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  // Check role authorization
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <span className="text-2xl font-bold">!</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Your current role (<span className="font-semibold text-slate-700">{role}</span>) does not
          have permission to access this module. Please contact your company administrator.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Return to Dashboard
        </a>
      </div>
    );
  }

  return <>{children}</>;
};
