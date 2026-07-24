import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, ArrowDownLeft, ArrowUpRight, Shield, Tag, Bell, Check, Trash2 } from 'lucide-react';

type NotifCategory = 'All' | 'Transactions' | 'Alerts' | 'Promotions';

interface Notification {
  id: number;
  type: 'credit' | 'debit' | 'security' | 'promo' | 'system';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFS: Notification[] = [
  {
    id: 1, type: 'credit',
    title: 'Money Received',
    body: 'You received ₦15,000.00 from Emeka Okafor.',
    time: 'Just now', read: false,
  },
  {
    id: 2, type: 'security',
    title: 'New Login Detected',
    body: 'Your account was accessed from a new device. If this wasn\'t you, change your passcode immediately.',
    time: '2 min ago', read: false,
  },
  {
    id: 3, type: 'debit',
    title: 'Transfer Successful',
    body: '₦5,000.00 was sent to Adaeze Nwosu (0123456789).',
    time: '1 hr ago', read: false,
  },
  {
    id: 4, type: 'promo',
    title: 'Earn 5% Cashback 🎉',
    body: 'Pay bills with Vexa this weekend and get 5% cashback — up to ₦2,000. Offer ends Sunday.',
    time: '3 hrs ago', read: true,
  },
  {
    id: 5, type: 'credit',
    title: 'Money Received',
    body: 'You received ₦50,000.00 from Salary Payment.',
    time: 'Yesterday', read: true,
  },
  {
    id: 6, type: 'system',
    title: 'Profile Updated',
    body: 'Your account profile was updated successfully.',
    time: 'Yesterday', read: true,
  },
  {
    id: 7, type: 'debit',
    title: 'Airtime Purchase',
    body: '₦1,000.00 airtime recharge to 08067212032 was successful.',
    time: '2 days ago', read: true,
  },
  {
    id: 8, type: 'promo',
    title: 'Refer & Earn 💰',
    body: 'Invite friends to Vexa and earn ₦500 for every friend who completes their first transaction.',
    time: '3 days ago', read: true,
  },
  {
    id: 9, type: 'security',
    title: 'Passcode Changed',
    body: 'Your login passcode was changed successfully. Contact support if you did not make this change.',
    time: '5 days ago', read: true,
  },
  {
    id: 10, type: 'debit',
    title: 'Data Purchase',
    body: '₦2,500.00 for 5GB data on 08067212032 was successful.',
    time: '1 week ago', read: true,
  },
];

function categoryOf(n: Notification): NotifCategory {
  if (n.type === 'credit' || n.type === 'debit') return 'Transactions';
  if (n.type === 'security' || n.type === 'system') return 'Alerts';
  if (n.type === 'promo') return 'Promotions';
  return 'All';
}

function NotifIcon({ type }: { type: Notification['type'] }) {
  const base = 'w-10 h-10 rounded-full flex items-center justify-center shrink-0';
  if (type === 'credit')   return <div className={`${base} bg-green-50`}><ArrowDownLeft className="w-5 h-5 text-green-600" /></div>;
  if (type === 'debit')    return <div className={`${base} bg-red-50`}><ArrowUpRight className="w-5 h-5 text-red-500" /></div>;
  if (type === 'security') return <div className={`${base} bg-orange-50`}><Shield className="w-5 h-5 text-orange-500" /></div>;
  if (type === 'promo')    return <div className={`${base} bg-purple-50`}><Tag className="w-5 h-5 text-purple-500" /></div>;
  return                          <div className={`${base} bg-blue-50`}><Bell className="w-5 h-5 text-blue-500" /></div>;
}

export default function NotificationsPage() {
  const [, navigate] = useLocation();
  const [notifs, setNotifs] = useState<Notification[]>(INITIAL_NOTIFS);
  const [active, setActive] = useState<NotifCategory>('All');

  const unreadCount = notifs.filter(n => !n.read).length;

  const filtered = active === 'All'
    ? notifs
    : notifs.filter(n => categoryOf(n) === active);

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  function markRead(id: number) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function deleteNotif(id: number) {
    setNotifs(prev => prev.filter(n => n.id !== id));
  }

  const TABS: NotifCategory[] = ['All', 'Transactions', 'Alerts', 'Promotions'];

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div className="bg-white border-b border-[#E8EBF0] flex-none" style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}>
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-full bg-[#F2F3F5] flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-[#222]" />
            </button>
            <div>
              <h1 className="text-[17px] font-bold text-[#111] leading-tight">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-[11px] text-[#888]">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#162353]"
              >
                <Check className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-0 px-4 pb-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`shrink-0 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                active === tab
                  ? 'border-[#162353] text-[#162353]'
                  : 'border-transparent text-[#888]'
              }`}
            >
              {tab}
              {tab === 'All' && unreadCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-8" style={{ scrollbarWidth: 'none' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
            <div className="w-16 h-16 rounded-full bg-[#E8EBF0] flex items-center justify-center">
              <Bell className="w-8 h-8 text-[#C0C8D4]" />
            </div>
            <p className="text-[15px] font-semibold text-[#444]">No notifications</p>
            <p className="text-[13px] text-[#888] text-center">You're all caught up! Check back later.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0F2F5]">
            {filtered.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`flex items-start gap-3 px-4 py-4 transition-colors active:bg-[#F0F2F5] ${
                  !n.read ? 'bg-[#F7F9FF]' : 'bg-white'
                }`}
              >
                <NotifIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[14px] leading-snug ${!n.read ? 'font-bold text-[#111]' : 'font-semibold text-[#333]'}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-[#162353] shrink-0 mt-1" />
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                        className="text-[#C0C8D4] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[12px] text-[#666] leading-relaxed mt-0.5 pr-2">{n.body}</p>
                  <p className="text-[11px] text-[#AAB0BE] mt-1.5">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
