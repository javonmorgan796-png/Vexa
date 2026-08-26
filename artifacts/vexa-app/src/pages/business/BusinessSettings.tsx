import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useBusiness, EmployeeRole } from '@/context/BusinessContext';

const ROLE_PERMS: Record<EmployeeRole, string[]> = {
  admin:    ['View Dashboard', 'Manage Employees', 'Run Payroll', 'Make Transfers', 'View Analytics', 'Change Settings', 'Manage Roles'],
  manager:  ['View Dashboard', 'Manage Employees', 'Run Payroll', 'View Analytics'],
  employee: ['View Dashboard', 'View own Payslip'],
  viewer:   ['View Dashboard'],
};

export default function BusinessSettings() {
  const [, navigate] = useLocation();
  const { business, updateBusiness, employees } = useBusiness();
  const [tab, setTab] = useState<'profile' | 'roles' | 'security' | 'notifications'>('profile');
  const [saved, setSaved] = useState(false);
  const [selectedRole, setSelectedRole] = useState<EmployeeRole>('admin');
  const [txLimitInput, setTxLimitInput] = useState(business?.transactionLimit?.toString() || '5000000');
  const [bizName, setBizName] = useState(business?.businessName || '');
  const [bizEmail, setBizEmail] = useState(business?.email || '');
  const [bizAddress, setBizAddress] = useState(business?.address || '');

  if (!business) return null;

  function saveProfile() {
    updateBusiness({ businessName: bizName, email: bizEmail, address: bizAddress });
    showSaved();
  }

  function showSaved() { setSaved(true); setTimeout(() => setSaved(false), 2500); }

  const roleColor: Record<EmployeeRole, string> = { admin: '#7C3AED', manager: '#2563EB', employee: '#16A34A', viewer: '#888' };

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-[#162353]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center gap-3 px-5 pb-4">
          <button onClick={() => navigate('/business')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <p className="text-white text-[16px] font-bold">Business Settings</p>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-1 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {(['profile', 'roles', 'security', 'notifications'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t ? 'bg-white text-[#162353]' : 'text-white/60'}`}>
              {t === 'profile' ? 'Profile' : t === 'roles' ? 'Roles' : t === 'security' ? 'Security' : 'Notifications'}
            </button>
          ))}
        </div>
      </div>

      {saved && (
        <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-[12px] text-green-700 font-medium flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Changes saved successfully
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* BUSINESS PROFILE */}
        {tab === 'profile' && (
          <>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#162353] flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-[20px] font-extrabold">{business.businessName.slice(0, 2).toUpperCase()}</span>
              </div>
              <p className="text-[16px] font-bold text-[#111]">{business.businessName}</p>
              <p className="text-[12px] text-[#888] mt-0.5">{business.industry} · {business.businessType.replace('_', ' ')}</p>
              <div className="inline-flex items-center gap-1.5 mt-2 bg-green-100 px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] font-semibold text-green-700">Active Business Account</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4 space-y-4">
              <p className="text-[13px] font-bold text-[#111]">Edit Business Info</p>
              {[
                { label: 'Business Name', value: bizName, onChange: setBizName, placeholder: 'Business name' },
                { label: 'Business Email', value: bizEmail, onChange: setBizEmail, placeholder: 'business@company.com' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[11px] font-semibold text-[#444] mb-1 block">{f.label}</label>
                  <input type="text" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                    className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[13px] text-[#111] focus:outline-none focus:border-[#162353] transition-colors" />
                </div>
              ))}
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-1 block">Business Address</label>
                <textarea value={bizAddress} onChange={e => setBizAddress(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 py-3 text-[13px] text-[#111] focus:outline-none focus:border-[#162353] transition-colors resize-none" />
              </div>
              <button onClick={saveProfile} className="w-full h-[48px] rounded-xl bg-[#162353] text-white text-[14px] font-bold">Save Changes</button>
            </div>

            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4 space-y-3">
              <p className="text-[13px] font-bold text-[#111]">Account Details</p>
              {[
                { label: 'Account Number', value: business.accountNumber },
                { label: 'Bank', value: 'Vexa Business Bank' },
                { label: 'Owner', value: business.ownerName },
                { label: 'Owner Phone', value: business.ownerPhone },
                { label: 'Created', value: new Date(business.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-1 border-b border-[#F5F5F5] last:border-0">
                  <span className="text-[12px] text-[#888]">{row.label}</span>
                  <span className="text-[12px] font-semibold text-[#111]">{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ROLES & PERMISSIONS */}
        {tab === 'roles' && (
          <>
            <div className="bg-[#F0F4FF] border border-[#C7D7FF] rounded-xl px-4 py-3">
              <p className="text-[12px] font-semibold text-[#162353] mb-0.5">Team Roles & Permissions</p>
              <p className="text-[11px] text-[#555]">Control what each team member can see and do in Vexa Business</p>
            </div>

            {/* Role selector */}
            <div className="flex gap-2">
              {(['admin', 'manager', 'employee', 'viewer'] as EmployeeRole[]).map(r => (
                <button key={r} onClick={() => setSelectedRole(r)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-[11px] font-bold transition-all capitalize ${selectedRole === r ? 'border-[#162353] bg-[#F0F4FF] text-[#162353]' : 'border-[#E2E8F0] text-[#888]'}`}>
                  {r}
                </button>
              ))}
            </div>

            {/* Permissions for selected role */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[13px] font-bold text-[#111] capitalize">{selectedRole}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: roleColor[selectedRole] + '20', color: roleColor[selectedRole] }}>
                  {ROLE_PERMS[selectedRole].length} permissions
                </span>
              </div>
              {['View Dashboard', 'Manage Employees', 'Run Payroll', 'Make Transfers', 'View Analytics', 'Change Settings', 'Manage Roles', 'View own Payslip'].map(perm => {
                const has = ROLE_PERMS[selectedRole].includes(perm);
                return (
                  <div key={perm} className="flex items-center justify-between py-2.5 border-b border-[#F9F9F9] last:border-0">
                    <span className={`text-[13px] font-medium ${has ? 'text-[#111]' : 'text-[#CCC]'}`}>{perm}</span>
                    {has
                      ? <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                      : <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                    }
                  </div>
                );
              })}
            </div>

            {/* Team members and roles */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[#F5F5F5]">
                <p className="text-[13px] font-bold text-[#111]">Team Members</p>
              </div>
              {employees.slice(0, 5).map(emp => (
                <div key={emp.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#F9F9F9] last:border-0">
                  <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[11px] font-bold text-[#2563EB] shrink-0">
                    {emp.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-[#111]">{emp.name}</p>
                    <p className="text-[10px] text-[#888]">{emp.role}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: roleColor[emp.appRole] + '20', color: roleColor[emp.appRole] }}>
                    {emp.appRole}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* SECURITY */}
        {tab === 'security' && (
          <>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[#F5F5F5]">
                <p className="text-[13px] font-bold text-[#111]">Security Settings</p>
              </div>
              {[
                {
                  label: 'Two-Factor Authentication',
                  desc: business.twoFAEnabled ? '2FA is enabled' : 'Add an extra layer of security',
                  value: business.twoFAEnabled,
                  onChange: () => { updateBusiness({ twoFAEnabled: !business.twoFAEnabled }); showSaved(); },
                },
                {
                  label: 'Transaction PIN',
                  desc: 'Required for all transfers',
                  value: true,
                  onChange: () => {},
                },
                {
                  label: 'Login Alerts',
                  desc: 'Get notified of new logins',
                  value: true,
                  onChange: () => {},
                },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-4 py-4 border-b border-[#F9F9F9] last:border-0">
                  <div className="flex-1 pr-4">
                    <p className="text-[13px] font-semibold text-[#111]">{item.label}</p>
                    <p className="text-[11px] text-[#888]">{item.desc}</p>
                  </div>
                  <button onClick={item.onChange}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${item.value ? 'bg-[#162353]' : 'bg-[#E2E8F0]'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.value ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* Transaction limit */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
              <p className="text-[13px] font-bold text-[#111] mb-1">Daily Transaction Limit</p>
              <p className="text-[11px] text-[#888] mb-3">Maximum amount per day across all transfers</p>
              <input type="number" value={txLimitInput} onChange={e => setTxLimitInput(e.target.value)}
                className="w-full h-[48px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] font-bold text-[#111] focus:outline-none focus:border-[#162353] transition-colors" />
              <button onClick={() => { updateBusiness({ transactionLimit: Number(txLimitInput) }); showSaved(); }}
                className="w-full h-[48px] rounded-xl bg-[#162353] text-white text-[14px] font-bold mt-3">Update Limit</button>
            </div>

            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
              <p className="text-[13px] font-bold text-[#111] mb-3">Danger Zone</p>
              <button className="w-full h-[48px] rounded-xl border-2 border-red-200 text-red-600 text-[14px] font-semibold">
                Deactivate Business Account
              </button>
            </div>
          </>
        )}

        {/* NOTIFICATIONS */}
        {tab === 'notifications' && (
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#F5F5F5]">
              <p className="text-[13px] font-bold text-[#111]">Notification Preferences</p>
            </div>
            {[
              { label: 'Payroll Processed', desc: 'When salary runs complete', key: 'notificationsEnabled' },
              { label: 'Transfer Alerts', desc: 'Incoming and outgoing transfers', key: 'notificationsEnabled' },
              { label: 'Low Balance Warning', desc: 'When balance drops below threshold', key: 'notificationsEnabled' },
              { label: 'New Employee Added', desc: 'Team membership changes', key: 'notificationsEnabled' },
              { label: 'Failed Transactions', desc: 'When a payment fails', key: 'notificationsEnabled' },
              { label: 'Monthly Reports', desc: 'Monthly summary emails', key: 'notificationsEnabled' },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-4 border-b border-[#F9F9F9] last:border-0">
                <div>
                  <p className="text-[13px] font-semibold text-[#111]">{item.label}</p>
                  <p className="text-[11px] text-[#888]">{item.desc}</p>
                </div>
                <button onClick={() => { updateBusiness({ notificationsEnabled: !business.notificationsEnabled }); showSaved(); }}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${business.notificationsEnabled ? 'bg-[#162353]' : 'bg-[#E2E8F0]'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${business.notificationsEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pb-4" />
      </div>
    </div>
  );
}
