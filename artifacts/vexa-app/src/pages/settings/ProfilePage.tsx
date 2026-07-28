import React, { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { User, Mail, Phone, Hash, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, updateProfile, profilePhoto, updateProfilePhoto } = useAuth();
  const [editing, setEditing] = useState<'name' | 'email' | 'phone' | null>(null);
  const [draftName, setDraftName] = useState(user?.name ?? '');
  const [draftEmail, setDraftEmail] = useState(user?.email ?? '');
  const [draftPhone, setDraftPhone] = useState(user?.phone ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const photo = profilePhoto;
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) { navigate('/signin'); return null; }

  const initials = user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateProfilePhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function openEdit(field: 'name' | 'email' | 'phone') {
    setDraftName(user!.name);
    setDraftEmail(user!.email);
    setDraftPhone(user!.phone);
    setError('');
    setEditing(field);
  }

  function saveEdit() {
    if (editing === 'name' && !draftName.trim()) { setError('Name cannot be empty'); return; }
    if (editing === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftEmail)) { setError('Invalid email'); return; }
    if (editing === 'phone' && draftPhone.replace(/\D/g,'').length < 10) { setError('Invalid phone number'); return; }
    updateProfile(draftName.trim(), draftEmail.trim(), draftPhone.trim());
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const fields = [
    { key: 'name' as const,  label: 'Full Name',      value: user.name,          icon: <User className="w-4.5 h-4.5" />, draft: draftName,  setDraft: setDraftName,  type: 'text',  placeholder: 'Your full name' },
    { key: 'email' as const, label: 'Email Address',  value: user.email,         icon: <Mail className="w-4.5 h-4.5" />, draft: draftEmail, setDraft: setDraftEmail, type: 'email', placeholder: 'you@example.com' },
    { key: 'phone' as const, label: 'Phone Number',   value: user.phone,         icon: <Phone className="w-4.5 h-4.5" />, draft: draftPhone, setDraft: setDraftPhone, type: 'tel',   placeholder: '080XXXXXXXX' },
  ];

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/settings')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Profile</span>
      </div>

      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {/* Avatar hero */}
        <div className="bg-[#162353] rounded-2xl py-7 flex flex-col items-center gap-3">
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          {/* Tappable avatar */}
          <button
            onClick={() => fileRef.current?.click()}
            className="relative group"
            title="Change photo"
          >
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-[28px] font-bold overflow-hidden">
              {photo
                ? <img src={photo} alt="Profile" className="w-full h-full object-cover" />
                : initials}
            </div>
            {/* Camera overlay */}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            {/* Always-visible camera badge */}
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#162353" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </button>
          <div className="text-center">
            <p className="text-white font-bold text-[17px]">{user.name}</p>
            <p className="text-white/60 text-[12px] mt-0.5">{user.email}</p>
          </div>
          {user.verified && (
            <span className="bg-green-400/20 text-green-300 text-[11px] font-semibold px-3 py-1 rounded-full border border-green-400/30">
              ✓ Verified Account
            </span>
          )}
        </div>

        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-[13px] text-green-700 font-medium text-center">
            ✓ Profile updated successfully
          </div>
        )}

        {/* Account number (read-only) */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
          <div className="px-4 py-4 flex items-center gap-3.5">
            <span className="text-[#555]"><Hash className="w-4.5 h-4.5" /></span>
            <div className="flex-1">
              <p className="text-[11px] text-[#888] mb-0.5">Account Number</p>
              <p className="text-[14px] font-semibold text-[#111]">{user.accountNumber}</p>
            </div>
            <span className="text-[10px] bg-[#F0F4FF] text-[#162353] font-semibold px-2 py-1 rounded-lg">Vexa Bank</span>
          </div>
        </div>

        {/* Editable fields */}
        <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide px-1">Personal Information</p>
        <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
          {fields.map((f, i) => (
            <button key={f.key} onClick={() => openEdit(f.key)}
              className={`w-full flex items-center gap-3.5 px-4 py-4 text-left hover:bg-[#F8F9FB] transition-colors ${i < fields.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
              <span className="text-[#555]">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#888] mb-0.5">{f.label}</p>
                <p className="text-[14px] font-semibold text-[#111] truncate">{f.value}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#CBD5E1] shrink-0" />
            </button>
          ))}
        </div>

        {/* Verification badge */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-4 flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#111]">Identity Verified</p>
            <p className="text-[11px] text-[#888] mt-0.5">Level {user.level} · BVN & NIN linked</p>
          </div>
          <span className="text-[10px] bg-[#DCFCE7] text-[#16A34A] font-bold px-2 py-1 rounded-lg">Active</span>
        </div>
      </div>

      {/* Edit bottom sheet */}
      {editing && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-t-3xl px-6 pt-6 pb-10 z-10">
            <div className="w-10 h-1 bg-[#E2E8F0] rounded-full mx-auto mb-5" />
            <p className="text-[16px] font-bold text-[#111] mb-4">
              Edit {fields.find(f => f.key === editing)?.label}
            </p>
            {error && <p className="text-[12px] text-red-500 mb-3 font-medium">{error}</p>}
            <input
              type={fields.find(f => f.key === editing)?.type}
              placeholder={fields.find(f => f.key === editing)?.placeholder}
              value={fields.find(f => f.key === editing)?.draft}
              onChange={e => {
                setError('');
                const setter = fields.find(f => f.key === editing)?.setDraft;
                if (setter) setter(e.target.value);
              }}
              autoFocus
              className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)}
                className="flex-1 h-[50px] rounded-xl border border-[#E2E8F0] text-[14px] font-semibold text-[#444]">
                Cancel
              </button>
              <button onClick={saveEdit}
                className="flex-1 h-[50px] rounded-xl bg-[#162353] text-[14px] font-semibold text-white">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
