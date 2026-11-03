import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  Headphones,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  User,
  MessageSquare,
  Shield,
} from 'lucide-react';

export const CustomerSupportTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission } = useAdmin();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/support');
      const list = res.tickets || [];
      setTickets(list);
      if (list.length > 0 && !activeTicket) {
        setActiveTicket(list[0]);
        setReplyStatus(list[0].status);
      }
    } catch (err) {
      console.error('Failed to load support tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetchAdminApi(`/api/admin/support/${activeTicket.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          text: replyText,
          status: replyStatus || activeTicket.status,
        }),
      });

      setActiveTicket(res.ticket);
      setReplyText('');
      loadTickets();
    } catch (err: any) {
      alert(err.message || 'Reply failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Customer Support & Dispute Escalations
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Manage customer inquiries, failed transaction investigations, and dispatch official communications.
        </p>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[620px]">
        {/* Left Column: Tickets Queue */}
        <div
          className={`lg:col-span-5 rounded-2xl border flex flex-col overflow-hidden ${
            isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className={`p-3.5 border-b flex items-center justify-between ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Active Inquiries ({tickets.length})
            </span>
            <span className="text-[11px] text-[#F0B90B] font-mono">Real-Time Routing</span>
          </div>

          <div className={`flex-1 overflow-y-auto divide-y ${isDark ? 'divide-gray-800/40' : 'divide-slate-200'}`}>
            {tickets.map((t) => {
              const isSelected = activeTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveTicket(t);
                    setReplyStatus(t.status);
                  }}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? isDark
                        ? 'bg-gray-800/60 border-l-4 border-l-[#F0B90B]'
                        : 'bg-amber-50/60 border-l-4 border-l-[#F0B90B]'
                      : isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono font-semibold text-[#F0B90B]">{t.ticketNumber}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        t.priority === 'urgent'
                          ? 'bg-rose-500/20 text-rose-400'
                          : t.priority === 'high'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>

                  <h4 className={`text-xs font-bold line-clamp-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.subject}</h4>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                    <span className={isDark ? 'text-gray-300' : 'text-slate-700'}>{t.userName}</span>
                    <span>{new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Conversation & Reply Drawer */}
        <div
          className={`lg:col-span-7 rounded-2xl border flex flex-col overflow-hidden ${
            isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          {activeTicket ? (
            <>
              {/* Ticket Top bar */}
              <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-gray-800 bg-gray-900/30' : 'border-slate-200 bg-slate-50'}`}>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-[#F0B90B]">{activeTicket.ticketNumber}</span>
                    <span className="text-xs font-semibold text-gray-400">· Category: {activeTicket.category}</span>
                  </div>
                  <h3 className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeTicket.subject}</h3>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold outline-none focus:border-[#F0B90B] ${
                      isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="open">Status: Open</option>
                    <option value="in_progress">Status: In Progress</option>
                    <option value="resolved">Status: Resolved</option>
                    <option value="closed">Status: Closed</option>
                  </select>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {activeTicket.messages?.map((msg: any, idx: number) => {
                  const isAdminMsg = msg.sender === 'admin';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isAdminMsg ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center space-x-1.5 text-[11px] text-gray-400 mb-1">
                        <span className="font-semibold">{msg.name}</span>
                        <span>·</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isAdminMsg
                            ? 'bg-[#F0B90B] text-black font-medium rounded-tr-none'
                            : isDark
                            ? 'bg-gray-800/80 text-white border border-gray-700/50 rounded-tl-none'
                            : 'bg-slate-100 text-slate-900 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Composer */}
              {hasPermission('support.manage') && (
                <form onSubmit={handleSendReply} className={`p-3 border-t flex items-center space-x-2 ${isDark ? 'border-gray-800 bg-gray-900/30' : 'border-slate-200 bg-slate-50'}`}>
                  <input
                    type="text"
                    required
                    placeholder="Type official administrative customer response..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs outline-none focus:border-[#F0B90B] ${
                      isDark
                        ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="p-2.5 bg-[#F0B90B] hover:bg-[#d9a606] text-black rounded-xl transition-colors shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mb-3 stroke-[1.2]" />
              <p className="text-sm">Select an inquiry from the queue to view full conversation history.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
