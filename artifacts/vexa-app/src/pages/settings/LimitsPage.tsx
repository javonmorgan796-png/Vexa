import React from 'react';
import { useLocation } from 'wouter';
import { Shield, CheckCircle, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const TIERS = [
  {
    level: 1,
    name: 'Basic',
    color: '#F59E0B',
    bg: '#FEF3C7',
    daily: '₦50,000',
    single: '₦20,000',
    requirements: ['Valid phone number', 'BVN linked'],
  },
  {
    level: 2,
    name: 'Standard',
    color: '#2563EB',
    bg: '#EFF6FF',
    daily: '₦200,000',
    single: '₦100,000',
    requirements: ['Level 1 complete', 'Government ID verified', 'Selfie verification'],
  },
  {
    level: 3,
    name: 'Premium',
    color: '#16A34A',
    bg: '#DCFCE7',
    daily: '₦5,000,000',
    single: '₦1,000,000',
    requirements: ['Level 2 complete', 'NIN verified', 'Address confirmed'],
  },
];

export default function LimitsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  if (!user) { navigate('/signin'); return null; }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/settings')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Limits & Verification</span>
      </div>

      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {/* Current status hero */}
        <div className="bg-[#162353] rounded-2xl px-5 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-400/20 flex items-center justify-center shrink-0">
            <Shield className="w-7 h-7 text-green-300" />
          </div>
          <div>
            <p className="text-white/70 text-[12px] mb-0.5">Your current level</p>
            <p className="text-white font-bold text-[20px]">Level {user.level} — {TIERS[user.level - 1]?.name}</p>
            <p className="text-white/60 text-[12px] mt-0.5">Daily limit: {TIERS[user.level - 1]?.daily}</p>
          </div>
        </div>

        {/* Current limits summary */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F5F5F5]">
            <p className="text-[12px] font-bold text-[#111]">Your Active Limits</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#F5F5F5]">
            <div className="px-4 py-4">
              <p className="text-[11px] text-[#888] mb-1">Daily Transfer</p>
              <p className="text-[18px] font-extrabold text-[#111]">{TIERS[user.level - 1]?.daily}</p>
            </div>
            <div className="px-4 py-4">
              <p className="text-[11px] text-[#888] mb-1">Per Transaction</p>
              <p className="text-[18px] font-extrabold text-[#111]">{TIERS[user.level - 1]?.single}</p>
            </div>
          </div>
        </div>

        {/* Tier cards */}
        <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide px-1">Verification Tiers</p>

        {TIERS.map(tier => {
          const isActive = user.level === tier.level;
          const isUnlocked = user.level >= tier.level;
          return (
            <div key={tier.level}
              className={`bg-white rounded-2xl border overflow-hidden ${isActive ? 'border-[#162353]' : 'border-[#F0F0F0]'}`}>
              {/* Tier header */}
              <div className="px-4 py-3.5 flex items-center gap-3 border-b border-[#F5F5F5]">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: tier.bg }}>
                  {isUnlocked
                    ? <CheckCircle className="w-5 h-5" style={{ color: tier.color }} />
                    : <Lock className="w-4.5 h-4.5 text-[#9CA3AF]" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-bold text-[#111]">Level {tier.level} — {tier.name}</p>
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: tier.bg, color: tier.color }}>
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#888]">Up to {tier.daily}/day</p>
                </div>
              </div>
              {/* Limits */}
              <div className="px-4 py-3 grid grid-cols-2 gap-2 border-b border-[#F5F5F5]">
                <div className="bg-[#F8F9FB] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-[#888] mb-0.5">Daily Limit</p>
                  <p className="text-[13px] font-bold text-[#111]">{tier.daily}</p>
                </div>
                <div className="bg-[#F8F9FB] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-[#888] mb-0.5">Per Transaction</p>
                  <p className="text-[13px] font-bold text-[#111]">{tier.single}</p>
                </div>
              </div>
              {/* Requirements */}
              <div className="px-4 py-3">
                <p className="text-[11px] font-semibold text-[#888] mb-2">Requirements</p>
                <div className="space-y-1.5">
                  {tier.requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isUnlocked ? '' : 'bg-[#F5F5F5]'}`}
                        style={isUnlocked ? { backgroundColor: tier.bg } : {}}>
                        {isUnlocked
                          ? <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5 5 4 7.5 8.5 2" stroke={tier.color} strokeWidth="1.8" strokeLinecap="round"/></svg>
                          : <div className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" />}
                      </div>
                      <span className={`text-[12px] ${isUnlocked ? 'text-[#444]' : 'text-[#9CA3AF]'}`}>{req}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Upgrade CTA for next level */}
              {!isUnlocked && (
                <div className="px-4 pb-4">
                  <button className="w-full h-[42px] rounded-xl border-2 border-[#162353] text-[13px] font-semibold text-[#162353]">
                    Upgrade to Level {tier.level}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <p className="text-center text-[11px] text-[#CCC] pb-2">
          Contact support to upgrade your verification level
        </p>
      </div>
    </div>
  );
}
