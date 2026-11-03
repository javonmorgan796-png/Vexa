import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  CreditCard,
  Lock,
  Unlock,
  Plus,
  ShieldCheck,
  Search,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';

export const CardManagementTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission } = useAdmin();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [newCardData, setNewCardData] = useState({
    userName: '',
    userPhone: '',
    cardType: 'virtual',
    brand: 'mastercard',
    limit: 500000,
  });
  const [submitting, setSubmitting] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadCards = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/cards');
      setCards(res.cards || []);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  const handleToggleFreeze = async (id: string) => {
    try {
      await fetchAdminApi(`/api/admin/cards/${id}/toggle-freeze`, { method: 'POST' });
      loadCards();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleIssueCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await fetchAdminApi('/api/admin/cards/issue', {
        method: 'POST',
        body: JSON.stringify(newCardData),
      });
      setIssueModalOpen(false);
      setNewCardData({
        userName: '',
        userPhone: '',
        cardType: 'virtual',
        brand: 'mastercard',
        limit: 500000,
      });
      loadCards();
    } catch (err: any) {
      alert(err.message || 'Card issue failed');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = cards.filter((c) => {
    return (
      !search ||
      c.cardHolder.toLowerCase().includes(search.toLowerCase()) ||
      c.userPhone.includes(search) ||
      c.cardNumber.includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Card Management & BIN Processing
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Monitor active Mastercard and Visa virtual/physical debit cards, adjust spend velocity, and freeze compromised PANs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search cardholder, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-60 pl-9 pr-3 py-2 rounded-xl text-xs border outline-none ${
                isDark
                  ? 'bg-[#161A23] border-gray-800 text-white placeholder-gray-500 focus:border-[#F0B90B]'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#F0B90B]'
              }`}
            />
          </div>

          {hasPermission('cards.manage') && (
            <button
              onClick={() => setIssueModalOpen(true)}
              className="px-4 py-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Virtual Card</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((card) => (
          <div
            key={card.id}
            className={`p-5 rounded-2xl border transition-all ${
              card.status === 'frozen'
                ? 'bg-rose-500/5 border-rose-500/30 opacity-75'
                : isDark
                ? 'bg-[#161A23] border-gray-800'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            {/* Virtual Card Graphic */}
            <div
              className={`h-44 rounded-2xl p-5 text-white flex flex-col justify-between shadow-xl relative overflow-hidden ${
                card.status === 'frozen'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900'
                  : card.cardBrand === 'mastercard'
                  ? 'bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#F59E0B]'
                  : 'bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#3B82F6]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest uppercase">VEXA INSTITUTIONAL</span>
                <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm">
                  {card.cardType}
                </span>
              </div>

              <div className="font-mono text-base tracking-widest font-semibold my-auto">
                {card.cardNumber}
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-300">Cardholder</div>
                  <div className="text-xs font-bold font-sans tracking-wide">{card.cardHolder}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-300">Expires</div>
                  <div className="text-xs font-mono font-bold">
                    {card.expiryMonth}/{card.expiryYear}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Metadata & Action Bar */}
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <div>
                <span className="text-gray-400">Limit: </span>
                <span className={`font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  ₦{Number(card.spendingLimit).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                    card.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {card.status}
                </span>

                {hasPermission('cards.manage') && (
                  <button
                    onClick={() => handleToggleFreeze(card.id)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      card.status === 'frozen'
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                    title={card.status === 'frozen' ? 'Unfreeze Card' : 'Freeze Card'}
                  >
                    {card.status === 'frozen' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Issue Modal */}
      {issueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-[#F0B90B]" />
                <span>Issue Customer Virtual Card</span>
              </h3>
              <button onClick={() => setIssueModalOpen(false)} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueCard} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-gray-400 mb-1 block">Customer Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chinedu Okafor"
                  value={newCardData.userName}
                  onChange={(e) => setNewCardData({ ...newCardData, userName: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border outline-none focus:border-[#F0B90B] ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-gray-400 mb-1 block">Customer Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 08034567890"
                  value={newCardData.userPhone}
                  onChange={(e) => setNewCardData({ ...newCardData, userPhone: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border outline-none focus:border-[#F0B90B] font-mono ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 mb-1 block">Card Network</label>
                  <select
                    value={newCardData.brand}
                    onChange={(e) => setNewCardData({ ...newCardData, brand: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border outline-none focus:border-[#F0B90B] ${
                      isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="mastercard">Mastercard</option>
                    <option value="visa">Visa</option>
                    <option value="verve">Verve</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 mb-1 block">Monthly Spend Limit (NGN)</label>
                  <input
                    type="number"
                    value={newCardData.limit}
                    onChange={(e) => setNewCardData({ ...newCardData, limit: Number(e.target.value) })}
                    className={`w-full px-3 py-2 rounded-xl border outline-none focus:border-[#F0B90B] font-mono ${
                      isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIssueModalOpen(false)}
                  className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl transition-colors"
                >
                  {submitting ? 'Generating Card...' : 'Issue Card Instantly'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
