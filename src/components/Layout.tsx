import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Sun,
  Moon,
  Menu,
  LogOut,
  ClipboardList,
  Tags,
  ShieldAlert,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { User } from '@/src/types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  currentUser: User;
}

export default function Layout({ children, activeTab, setActiveTab, onLogout, currentUser }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('pjlp_theme') as 'light' | 'dark';
    let initialTheme: 'light' | 'dark';
    
    if (savedTheme) {
      initialTheme = savedTheme;
    } else {
      const hour = new Date().getHours();
      const isNight = hour < 6 || hour >= 18;
      initialTheme = isNight ? 'dark' : 'light';
    }
    
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('pjlp_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'activities', label: 'Input Kegiatan', icon: ClipboardList },
    { id: 'report', label: 'Laporan Kinerja', icon: FileText },
    ...(currentUser.role === 'admin' ? [
      { id: 'activity-types', label: 'Tipe Kegiatan', icon: Tags },
      { id: 'users', label: 'Manajemen User', icon: Users },
      { id: 'logs', label: 'Log Aktivitas', icon: ShieldAlert }
    ] : [
      { id: 'users', label: 'Data Personel', icon: Users }
    ]),
    { id: 'settings', label: 'Pengaturan', icon: Settings },
    { id: 'suggestions', label: 'Saran & Masukan', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex transition-colors duration-300">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 transition-all duration-300 z-50",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400"
            >
              E-LAPOR PJLP
            </motion.span>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="mt-6 px-4 space-y-2">
          {(Array.isArray(menuItems) ? menuItems : []).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200",
                activeTab === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                  : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
              )}
            >
              <item.icon size={22} />
              {!isSidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-8 w-full px-4 space-y-2">
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-all"
          >
            {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
            {!isSidebarCollapsed && <span className="font-medium">{theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}</span>}
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 transition-all"
          >
            <LogOut size={22} />
            {!isSidebarCollapsed && <span className="font-medium">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        isSidebarCollapsed ? "ml-20" : "ml-64"
      )}>
        {/* Header */}
        <header className="h-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg">
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-semibold capitalize dark:text-white">{activeTab.replace('-', ' ')}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold dark:text-white">{currentUser.name}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-500">{currentUser.jabatan}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800">
              {(currentUser.name || '').split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="p-8 border-t border-slate-200 dark:border-zinc-800 text-center text-sm text-slate-500 dark:text-zinc-500">
          &copy; 2026 Sistem Laporan Kinerja PJLP - Dinas Perhubungan DKI Jakarta
        </footer>
      </main>
    </div>
  );
}
