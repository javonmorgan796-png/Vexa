import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAdmin } from './AdminContext';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading } = useAdmin();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E14] text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#F0B90B] animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold tracking-tight text-white">Vexa Core Administration</h2>
            <p className="text-xs text-gray-400 mt-1">Authenticating administrative session & cryptographic privileges...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E14] text-white p-6">
        <div className="max-w-md w-full bg-[#161A23] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied (403 Forbidden)</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Your account does not possess authorized administrative roles or permissions to access the Vexa Institutional Terminal.
          </p>
          <div className="bg-[#0B0E14] border border-gray-800 rounded-xl p-3 text-xs text-gray-500 mb-6 font-mono text-left">
            <div>Incident Reference: ERR_UNAUTHORIZED_ADMIN_ENTRY</div>
            <div>Time: {new Date().toISOString()}</div>
            <div>Security Level: High (Attempt logged)</div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-3 px-4 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to User Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
