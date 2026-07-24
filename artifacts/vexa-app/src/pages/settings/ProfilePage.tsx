import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { User, Mail, Phone, Hash, ChevronRight, Camera, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const AVATAR_KEY = 'vexa_avatar';

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState<'name' | 'email' | 'phone' | null>(null);
  const [draftName, setDraftName] = useState(user?.name ?? '');
  const [draftEmail, setDraftEmail] = useState(user?.email ?? '');
  const [draftPhone, setDraftPhone] = useState(user?.phone ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState<string | null>(() => localStorage.getItem(AVATAR_KEY));
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (avatar) localStorage.setItem(AVATAR_KEY, avatar);
    else localStorage.removeItem(AVATAR_KEY);
  }, [avatar]);

  if (!user) { navigate('/signin'); return null; }

  const initials = user.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      setAvatar(ev.target?.result as string);
      setShowAvatarMenu(false);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function removeAvatar() {
    setAvatar(null);
    setShowAvatarMenu(false);
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
    if (editing === 'phone' && draftPhone.replace(/\D/g, '').length < 10) { setError('Invalid phone number'); return; }
    updateProfile(draftName.trim(), draftEmail.trim(), draftPhone.trim());
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const fields = [
    { key: 'name'  as const, label: 'Full Name',     value: user.name,  icon: <User  className="w-4 h-4" />, draft: draftName,  setDraft: setDraftName,  type: 'text',  placeholder: 'Your full name' },
    { key: 'email' as const, label: 'Email Address', value: user.email || '—', icon: <Mail  className="w-4 h-4" />, draft: draftEmail, setDraft: setDraftEmail, type: 'email', placeholder: 'you@example.com' },
    { key: 'phone' as const, label: 'Phone Number',  value: user.phone, icon: <Phone className="w-4 h-4" />, draft: draftPhone, setDraft: setDraftPhone, type: 'tel',   placeholder: '080XXXXXXXX' },
  ];

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/settings')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Profile</span>
      </div>

      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Avatar hero */}
        <div className="bg-[#162353] rounded-2xl py-7 flex flex-col items-center gap-3">
          {/* Avatar with camera button */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/20 flex items-center justify-center bg-white/20">
              {avatar ? (
                <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-[30px] font-bold">{initials}</span>
              )}
            </div>
            {/* Camera badge */}
            <button
              onClick={() => setShowAvatarMenu(true)}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              <Camera className="w-4 h-4 text-[#162353]" />
            </button>
          </div>

          <div className="text-center">
            <p className="text-white font-bold text-[17px]">{user.name}</p>
            <p className="text-white/60 text-[12px] mt-0.5">{user.phone}</p>
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
            <span className="text-[#555]"><Hash className="w-4 h-4" /></span>
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
              className={`w-full flex items-center gap-3.5 px-4 py-4 text-left active:bg-[#F8F9FB] transition-colors ${i < fields.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#111]">Identity Verified</p>
            <p className="text-[11px] text-[#888] mt-0.5">Level {user.level} · BVN & NIN linked</p>
          </div>
          <span className="text-[10px] bg-[#DCFCE7] text-[#16A34A] font-bold px-2 py-1 rounded-lg">Active</span>
        </div>
      </div>

      {/* Avatar action sheet */}
      {showAvatarMenu && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAvatarMenu(false)} />
          <div className="relative bg-white rounded-t-3xl px-6 pt-5 pb-10 z-10">
            <div className="w-10 h-1 bg-[#E2E8F0] rounded-full mx-auto mb-5" />
            <p className="text-[16px] font-bold text-[#111] mb-5">Profile Photo</p>
            <div className="space-y-3">
              <button
                onClick={() => { setShowAvatarMenu(false); setTimeout(() => fileRef.current?.click(), 100); }}
                className="w-full flex items-center gap-4 px-4 py-4 bg-[#F8F9FB] rounded-2xl active:bg-[#EFF0F2] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#162353] flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-semibold text-[#111]">Upload Photo</p>
                  <p className="text-[12px] text-[#888]">Choose from your gallery (max 5 MB)</p>
                </div>
              </button>

              {avatar && (
                <button
                  onClick={removeAvatar}
                  className="w-full flex items-center gap-4 px-4 py-4 bg-red-50 rounded-2xl active:bg-red-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-semibold text-red-600">Remove Photo</p>
                    <p className="text-[12px] text-red-400">Revert to initials avatar</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => setShowAvatarMenu(false)}
                className="w-full h-[50px] rounded-2xl border border-[#E2E8F0] text-[14px] font-semibold text-[#444]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
