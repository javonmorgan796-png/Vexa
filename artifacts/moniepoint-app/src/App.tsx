import React from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { 
  Wifi, BatteryMedium, Signal, Headphones, Bell, Copy, EyeOff, 
  Clock, ArrowRightLeft, Phone, Smartphone, Target, PiggyBank, GraduationCap, 
  FileText, LayoutGrid, Trophy, CreditCard, Home, MoveDownLeft
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function MoniepointHome() {
  return (
    <div className="min-h-[100dvh] w-full flex justify-center bg-[#F5F5F5] font-sans text-[#111111]">
      <div className="w-full max-w-[390px] bg-[#F5F5F5] flex flex-col relative shadow-xl overflow-hidden h-[100dvh]">
        
        {/* Status bar */}
        <div className="flex-none flex justify-between items-center px-4 py-3 text-[12px] font-medium text-black">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tracking-wide">5:16</span>
            <div className="bg-[#111111] text-white rounded-[4px] w-[14px] h-[14px] flex items-center justify-center text-[9px] font-bold">
              $
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span>0.00 KB/s</span>
            <div className="flex items-center gap-0.5">
              <span>4G</span>
              <Signal className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-0.5">
              <span>45G</span>
              <Signal className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-0.5">
              <span>81%</span>
              <BatteryMedium className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Scrollable content container */}
        <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4 pb-24 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          {/* Header row */}
          <div className="flex justify-between items-center py-2 mt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white text-lg font-bold shadow-sm">
                C
              </div>
              <div className="bg-white rounded-full px-3 py-1 text-[13px] font-semibold text-gray-600 shadow-sm border border-gray-100">
                Level 3
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Headphones className="w-6 h-6 text-gray-800" strokeWidth={1.5} />
              <div className="relative">
                <Bell className="w-6 h-6 text-gray-800" strokeWidth={1.5} />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-[1.5px] border-[#F5F5F5]"></span>
              </div>
            </div>
          </div>

          {/* Account card */}
          <div className="bg-[#1B2B5E] rounded-[20px] p-5 text-white shadow-lg flex flex-col mt-1">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-1.5 opacity-90 text-[12px] font-medium tracking-wide">
                <span>9067212032 | Chibuzor Emmanuel Dike</span>
                <Copy className="w-3.5 h-3.5 ml-1 opacity-70" />
              </div>
            </div>
            
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-[32px] font-extrabold tracking-tight">₦1,000.00</h2>
              <EyeOff className="w-5 h-5 opacity-70 mt-1" />
            </div>
            
            <p className="text-[12px] text-blue-200/70 mb-6 font-medium">Last updated 4 minutes ago</p>
            
            <div className="flex gap-3">
              <button className="flex-1 bg-white/10 hover:bg-white/20 transition-colors rounded-full py-3 flex items-center justify-center gap-2 text-[13px] font-semibold tracking-wide backdrop-blur-sm">
                <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-[14px] leading-none mb-[1px]">+</span>
                </div>
                Add Money
              </button>
              <button className="flex-1 bg-white/10 hover:bg-white/20 transition-colors rounded-full py-3 flex items-center justify-center gap-2 text-[13px] font-semibold tracking-wide backdrop-blur-sm">
                <Clock className="w-4 h-4" />
                History
              </button>
            </div>
          </div>

          {/* Services section */}
          <div className="mt-2">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Services</h3>
              <button className="text-[#2563EB] text-[13px] font-bold tracking-wide">Edit</button>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Transfer', icon: ArrowRightLeft, color: 'text-blue-500' },
                { label: 'Airtime', icon: Phone, color: 'text-orange-500' },
                { label: 'Data', icon: Smartphone, color: 'text-emerald-500' },
                { label: 'Betting', icon: Target, color: 'text-red-500' },
                { label: 'Savings', icon: PiggyBank, color: 'text-purple-500' },
                { label: 'Education', icon: GraduationCap, color: 'text-blue-600' },
                { label: 'Statement', icon: FileText, color: 'text-teal-600' },
                { label: 'More', icon: LayoutGrid, color: 'text-gray-500' },
              ].map((service, i) => (
                <button key={i} className="bg-white rounded-[16px] p-3 flex flex-col items-center justify-center gap-2.5 shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all">
                  <div className={`w-[42px] h-[42px] rounded-full bg-gray-50 flex items-center justify-center ${service.color}`}>
                    <service.icon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <span className="text-[11px] font-bold text-gray-700 tracking-wide">{service.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Rewards section */}
          <div className="mt-2">
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight mb-3">Rewards</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-white rounded-[16px] p-4 shadow-sm border border-gray-100 flex items-center gap-3.5 hover:bg-gray-50 active:scale-[0.98] transition-all text-left">
                <div className="w-10 h-10 rounded-full bg-[#FFF5E5] flex items-center justify-center text-[22px]">
                  🪙
                </div>
                <div className="flex flex-col">
                  <div className="text-[12px] text-gray-500 font-semibold mb-0.5">Cashback</div>
                  <div className="text-[15px] font-bold text-gray-900 tracking-tight">₦0.00</div>
                </div>
              </button>
              <button className="bg-white rounded-[16px] p-4 shadow-sm border border-gray-100 flex items-center gap-3.5 hover:bg-gray-50 active:scale-[0.98] transition-all text-left">
                <div className="w-10 h-10 rounded-full bg-[#E5F0FF] flex items-center justify-center text-[22px]">
                  📣
                </div>
                <div className="flex flex-col">
                  <div className="text-[12px] text-gray-500 font-semibold mb-0.5">Referrals</div>
                  <div className="text-[15px] font-bold text-gray-900 tracking-tight">₦0.00</div>
                </div>
              </button>
            </div>
          </div>

          {/* Recent transactions */}
          <div className="mt-2">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Recent transactions</h3>
              <button className="text-[#2563EB] text-[13px] font-bold tracking-wide">View All</button>
            </div>
            
            <button className="w-full bg-white rounded-[16px] p-4 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 active:scale-[0.99] transition-all text-left">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-[#EBF3FF] flex items-center justify-center text-[#2563EB]">
                  <MoveDownLeft className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <div className="text-[14px] font-bold text-gray-900 mb-1 tracking-tight">Chibuzor Emmanuel Dike</div>
                  <div className="text-[12px] text-gray-500 font-medium">14 Jul, 06:39 PM</div>
                </div>
              </div>
              <div className="text-[15px] font-bold text-[#16A34A] tracking-tight">
                +₦1,000.00
              </div>
            </button>
          </div>

          {/* Do more with Moniepoint banner */}
          <div className="mt-4 mb-2">
            <h3 className="text-[11px] font-bold text-gray-500 mb-3 uppercase tracking-widest pl-1">Do more with Moniepoint</h3>
            
            <button className="w-full bg-white rounded-[16px] p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 active:scale-[0.99] transition-all text-left">
              <div className="flex-1 pr-5">
                <div className="text-[15px] font-bold text-gray-900 mb-1.5 tracking-tight">Earn big with MonieWorld</div>
                <div className="text-[12px] text-gray-500 leading-relaxed font-medium">
                  Refer your UK friends and earn ₦10,000 when they send at least £100.
                </div>
              </div>
              <div className="w-[60px] h-[60px] bg-[#E8F6EE] rounded-full flex items-center justify-center text-[28px] shrink-0 border-[3px] border-[#D1EFE0]">
                💷
                <span className="absolute bottom-4 right-4 text-[16px] shadow-sm rounded-sm">🇬🇧</span>
              </div>
            </button>
          </div>
          
        </div>

        {/* Bottom tab bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 pt-3 pb-8 z-10 rounded-b-none">
          <div className="flex justify-between items-center max-w-[320px] mx-auto">
            <button className="flex flex-col items-center gap-1.5 px-2">
              <Home className="w-[26px] h-[26px] text-[#2563EB]" strokeWidth={2.5} />
              <span className="text-[11px] font-bold text-[#2563EB] tracking-wide">Home</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 px-2 opacity-60 hover:opacity-100 transition-opacity">
              <CreditCard className="w-[26px] h-[26px] text-gray-500" strokeWidth={2} />
              <span className="text-[11px] font-bold text-gray-500 tracking-wide">Card</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 px-2 opacity-60 hover:opacity-100 transition-opacity">
              <LayoutGrid className="w-[26px] h-[26px] text-gray-500" strokeWidth={2} />
              <span className="text-[11px] font-bold text-gray-500 tracking-wide">Services</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 px-2 opacity-60 hover:opacity-100 transition-opacity">
              <Trophy className="w-[26px] h-[26px] text-gray-500" strokeWidth={2} />
              <span className="text-[11px] font-bold text-gray-500 tracking-wide">Rewards</span>
            </button>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[5px] bg-black rounded-full opacity-80"></div>
        </div>

      </div>
      <style dangerouslySet={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={MoniepointHome} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;