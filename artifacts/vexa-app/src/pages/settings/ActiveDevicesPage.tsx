import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Check,
  LogOut,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Active now';
  if (minutes === 1) return 'Active 1 minute ago';
  if (minutes < 60) return `Active ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'Active 1 hour ago';
  if (hours < 24) return `Active ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `Active ${days} day${days === 1 ? '' : 's'} ago`;
}

export default function ActiveDevicesPage() {
  const [, navigate] = useLocation();
  const {
    activeSessions,
    sessionsLoading,
    sessionsError,
    refreshSessions,
    revokeSession,
    revokeOtherSessions,
  } = useAuth();
  const [workingSession, setWorkingSession] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  async function handleRevoke(sessionId: string, isCurrent: boolean) {
    if (isCurrent && !window.confirm('Sign out this device?')) return;
    setWorkingSession(sessionId);
    setFeedback('');
    const result = await revokeSession(sessionId);
    setWorkingSession('');
    if (!result.success) setFeedback(result.error ?? 'Could not sign out that device.');
    else if (isCurrent) navigate('/signin');
  }

  async function handleRevokeOthers() {
    if (!window.confirm('Sign out all other devices?')) return;
    setWorkingSession('others');
    setFeedback('');
    const result = await revokeOtherSessions();
    setWorkingSession('');
    if (!result.success) setFeedback(result.error ?? 'Could not sign out other devices.');
    else setFeedback('All other devices have been signed out.');
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div
        className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Back to settings"
        >
          <ArrowLeft className="w-5 h-5 text-[#222]" />
        </button>
        <span className="text-[16px] font-bold text-[#111]">Active devices</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="bg-[#162353] rounded-2xl px-4 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#8BE3FF]" />
            </div>
            <div>
              <p className="text-[14px] font-bold">Keep your account secure</p>
              <p className="text-[11px] text-white/65 mt-1 leading-relaxed">
                Review where your Vexa account is signed in. Signing out a device blocks its app session on the next security check.
              </p>
            </div>
          </div>
        </div>

        {sessionsError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] text-amber-800">
            {sessionsError}
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide">Signed-in devices</p>
            <p className="text-[11px] text-[#999] mt-1">You can remove any device you no longer recognize.</p>
          </div>
          <button
            onClick={() => void refreshSessions()}
            disabled={sessionsLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white disabled:opacity-50"
            aria-label="Refresh active devices"
          >
            <RefreshCw className={`w-4 h-4 text-[#162353] ${sessionsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
          {sessionsLoading && activeSessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[#888]">Loading active devices…</div>
          ) : activeSessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[#888]">
              No active devices were found.
            </div>
          ) : (
            activeSessions.map((session, index) => {
              const DeviceIcon = session.deviceType === 'tablet'
                ? Tablet
                : session.deviceType === 'mobile'
                  ? Smartphone
                  : Monitor;
              const isWorking = workingSession === session.sessionId;
              return (
                <div
                  key={session.id}
                  className={`px-4 py-4 flex items-center gap-3 ${index < activeSessions.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${session.isCurrent ? 'bg-[#EAF0FF]' : 'bg-[#F5F6F8]'}`}>
                    <DeviceIcon className={`w-5 h-5 ${session.isCurrent ? 'text-[#162353]' : 'text-[#667085]'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-bold text-[#111] truncate">{session.deviceName}</p>
                      {session.isCurrent && (
                        <span className="inline-flex items-center gap-0.5 bg-[#EAFBF4] text-[#159669] rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0">
                          <Check className="w-2.5 h-2.5" /> This device
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#888] mt-1">{relativeTime(session.lastActiveAt)}</p>
                  </div>
                  <button
                    onClick={() => void handleRevoke(session.sessionId, session.isCurrent)}
                    disabled={Boolean(workingSession)}
                    className={`text-[11px] font-bold px-2.5 py-2 rounded-lg disabled:opacity-50 ${session.isCurrent ? 'text-red-600 hover:bg-red-50' : 'text-[#162353] hover:bg-[#F1F4FF]'}`}
                  >
                    {isWorking ? 'Signing out…' : session.isCurrent ? 'Sign out' : 'Remove'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {activeSessions.some(session => !session.isCurrent) && (
          <button
            onClick={() => void handleRevokeOthers()}
            disabled={Boolean(workingSession)}
            className="w-full h-12 rounded-xl border border-red-200 bg-white text-red-600 text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {workingSession === 'others' ? 'Signing out other devices…' : 'Sign out all other devices'}
          </button>
        )}

        {feedback && <p className="text-center text-[12px] text-[#159669] font-medium">{feedback}</p>}
      </div>
    </div>
  );
}