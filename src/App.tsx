import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import ReportPreview from './components/ReportPreview';
import ActivityForm from './components/ActivityForm';
import SuggestionsView from './components/SuggestionsView';
import { MOCK_USERS, MOCK_ACTIVITIES } from './constants';
import { Activity, ActivityType, ReportPeriod, User, SystemLog } from './types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { useReactToPrint } from 'react-to-print';
import { Printer, Trash2, Edit3, Filter, LogIn, UserCircle, Users, Settings, Plus, Download, AlertCircle, CheckCircle2, Search, MessageSquare, ShieldAlert, ClipboardList, Share2, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, getDay, isAfter, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import html2pdf from 'html2pdf.js';

export default function App() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isChangingPage, setIsChangingPage] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loginError, setLoginError] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([
    { id: '1', name: 'NORMAL (Hari Kerja)', color: '#3b82f6', isActive: true, isNormal: true },
    { id: '2', name: 'LIBUR (Hari Libur)', color: '#f59e0b', isActive: true, isNormal: false },
    { id: '3', name: 'MFD (Mental, Fisik dan Disiplin)', color: '#8b5cf6', isActive: true, isNormal: false }
  ]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [showLogDetails, setShowLogDetails] = useState<SystemLog | null>(null);
  const [editingActivityType, setEditingActivityType] = useState<ActivityType | null>(null);
  const [showActivityTypeForm, setShowActivityTypeForm] = useState(false);
  const [sharingActivity, setSharingActivity] = useState<Activity | null>(null);
  const [selectedColleaguesForShare, setSelectedColleaguesForShare] = useState<string[]>([]);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [activitySubView, setActivitySubView] = useState<'calendar' | 'day-list' | 'add-form' | 'edit-form'>('calendar');

  // Global helper to parse API responses and handle non-JSON errors
  const parseRes = async (res: Response) => {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    console.error(`Expected JSON but got ${contentType}:`, text.substring(0, 100));
    if (!res.ok) {
      throw new Error(`Server error (${res.status}): ${text.substring(0, 50)}`);
    }
    throw new Error('Server returned non-JSON response');
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setDbError(null);
        
        // First check health
        const healthRes = await fetch('/api/health').catch(() => null);
        if (healthRes) {
          const health = await parseRes(healthRes).catch(() => ({}));
          if (health.code === 'DB_NOT_CONNECTED') {
            setDbError(health.error);
            return;
          }
        }

        const [usersRes, activitiesRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/activities')
        ]);

        if (!usersRes.ok || !activitiesRes.ok) {
          const uErr = !usersRes.ok ? await parseRes(usersRes).catch(() => ({})) : {};
          const aErr = !activitiesRes.ok ? await parseRes(activitiesRes).catch(() => ({})) : {};
          
          if (uErr.code === 'DB_NOT_CONNECTED' || aErr.code === 'DB_NOT_CONNECTED') {
            setDbError(uErr.error || aErr.error);
            return;
          }
          throw new Error(uErr.error || aErr.error || 'Gagal terhubung ke database');
        }

        const usersData = await parseRes(usersRes);
        const activitiesData = await parseRes(activitiesRes);
        
        if (Array.isArray(usersData)) {
          setUsers(usersData);
        } else {
          console.error('Users data is not an array:', usersData);
          setUsers([]);
        }

        if (Array.isArray(activitiesData)) {
          setActivities(activitiesData);
        } else {
          console.error('Activities data is not an array:', activitiesData);
          setActivities([]);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setDbError(err instanceof Error ? err.message : 'Koneksi database terputus');
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    setIsChangingPage(true);
    const timer = setTimeout(() => setIsChangingPage(false), 500);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const [period, setPeriod] = useState<ReportPeriod>({
    startDate: format(new Date(), 'yyyy-MM-01'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  // Automatically set end date to end of month when start date changes
  const handleStartDateChange = (date: string) => {
    try {
      const d = parseISO(date);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      setPeriod({
        startDate: date,
        endDate: format(lastDay, 'yyyy-MM-dd')
      });
    } catch (e) {
      setPeriod({ ...period, startDate: date });
    }
  };

  // Load user from localStorage if exists
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('pjlp_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        if (user && typeof user === 'object' && user.id) {
          setCurrentUser(user);
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('pjlp_user');
        }
      }
    } catch (err) {
      console.error('Failed to parse saved user:', err);
      localStorage.removeItem('pjlp_user');
    }
  }, []);

  const addLog = (action: string, details: string, user?: User) => {
    const logUser = user || currentUser;
    if (!logUser) return;
    const newLog: SystemLog = {
      id: Math.random().toString(36).substr(2, 9),
      userId: logUser.id,
      userName: logUser.name,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
      setLoginError('Username dan password wajib diisi!');
      return;
    }

    const user = (Array.isArray(users) ? users : []).find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      localStorage.setItem('pjlp_user', JSON.stringify(user));
      addLog('LOGIN', `User ${user.name} logged in`, user);
    } else {
      setLoginError('Username atau password salah!');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('pjlp_user');
    setActiveTab('dashboard');
  };

  const handleExportDatabase = () => {
    const data = {
      users,
      activities,
      exportDate: new Date().toISOString(),
      version: 'v2.4.0-stable'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_pjlp_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUserFormError('');
    const formData = new FormData(e.currentTarget);
    
    const name = formData.get('name') as string;
    const idPjlp = (formData.get('idPjlp') as string) || editingUser?.idPjlp || '';
    const username = (formData.get('username') as string) || editingUser?.username || '';
    const password = formData.get('password') as string;
    const pengawasNip = formData.get('pengawasNip') as string;
    const kepalaSatuanNip = formData.get('kepalaSatuanNip') as string;
    const role = (formData.get('role') as 'admin' | 'user') || editingUser?.role || 'user';
    const whatsapp = formData.get('whatsapp') as string;

    // Validation
    if (!name || !idPjlp || !username || (!editingUser && !password)) {
      setUserFormError('Mohon lengkapi semua field wajib!');
      return;
    }

    if (users.find(u => u.username === username && u.id !== editingUser?.id)) {
      setUserFormError('Username sudah digunakan!');
      return;
    }

    if (pengawasNip && !/^\d+$/.test(pengawasNip)) {
      setUserFormError('NIP Pengawas harus berupa angka!');
      return;
    }

    if (kepalaSatuanNip && !/^\d+$/.test(kepalaSatuanNip)) {
      setUserFormError('NIP Kepala Satuan harus berupa angka!');
      return;
    }

    if (whatsapp && !/^\d+$/.test(whatsapp)) {
      setUserFormError('Nomor WhatsApp harus berupa angka!');
      return;
    }

    const newUser: User = {
      id: editingUser?.id || Math.random().toString(36).substr(2, 9),
      name,
      idPjlp,
      jabatan: formData.get('jabatan') as string,
      satuanKerja: formData.get('satuanKerja') as string,
      unitKerja: formData.get('unitKerja') as string,
      username,
      whatsapp,
      password: password || editingUser?.password || 'password123',
      role,
      pengawasName: formData.get('pengawasName') as string,
      pengawasNip,
      kepalaSatuanName: formData.get('kepalaSatuanName') as string,
      kepalaSatuanNip,
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      
      if (!res.ok) {
        const errorData = await safeJson(res).catch(() => ({ error: `Server returned ${res.status}` }));
        throw new Error(errorData.error || `Server returned ${res.status}`);
      }

      if (editingUser) {
        setUsers(users.map(u => u.id === editingUser.id ? newUser : u));
        addLog('EDIT_USER', `Mengedit user: ${newUser.name} (${newUser.username})`);
        // Update current user if editing self
        if (editingUser.id === currentUser?.id) {
          setCurrentUser(newUser);
          localStorage.setItem('pjlp_user', JSON.stringify(newUser));
        }
        alert('Data user berhasil diperbarui!');
      } else {
        setUsers([...users, newUser]);
        addLog('ADD_USER', `Menambah user baru: ${newUser.name} (${newUser.username})`);
        alert('User baru berhasil ditambahkan!');
      }
      setEditingUser(null);
      setShowUserForm(false);
    } catch (err) {
      console.error('Failed to save user:', err);
      setUserFormError(`Gagal menyimpan user: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser?.id) {
      alert('Anda tidak dapat menghapus akun Anda sendiri!');
      return;
    }
    
    if (window.confirm('Apakah Anda yakin ingin menghapus user ini?')) {
      try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const errorData = await safeJson(res).catch(() => ({ error: `Server returned ${res.status}` }));
          throw new Error(errorData.error || `Server returned ${res.status}`);
        }
        const deletedUser = users.find(u => u.id === id);
        setUsers(users.filter(u => u.id !== id));
        addLog('DELETE_USER', `Menghapus user: ${deletedUser?.name || id}`);
        alert('User berhasil dihapus!');
      } catch (err) {
        console.error('Failed to delete user:', err);
        alert(`Gagal menghapus user: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const onBeforePrint = useCallback(async () => {
    // Ensure all images in the reportRef are loaded
    const images = reportRef.current?.querySelectorAll('img');
    if (images) {
      const promises = Array.from(images).map(img => {
        const image = img as HTMLImageElement;
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.onload = resolve;
          image.onerror = resolve; // Continue even if one fails
        });
      });
      await Promise.all(promises);
    }
    // Extra delay to ensure layout is stable
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, [reportRef]);

  const onPrintError = useCallback((errorLocation: string, error: Error) => {
    console.error('Print Error:', errorLocation, error);
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Laporan_Kinerja_${currentUser?.name?.replace(/\s+/g, '_') || 'User'}_${period.startDate}`,
    onBeforePrint,
    onPrintError,
  });

  const handleDownloadPDF = async () => {
    if (!reportRef.current) {
      console.error('Report ref is null');
      return;
    }
    
    try {
      const element = reportRef.current;
      
      // Ensure all images are loaded before generating PDF
      const images = element.querySelectorAll('img');
      const imagePromises = Array.from(images).map(img => {
        const image = img as HTMLImageElement;
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      });
      await Promise.all(imagePromises);
      
      // Small delay to ensure styles are applied
      await new Promise(resolve => setTimeout(resolve, 500));

      const opt = {
        margin: 0,
        filename: `Laporan_Kinerja_${currentUser?.name?.replace(/\s+/g, '_') || 'User'}_${period.startDate}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          letterRendering: true,
          onclone: (clonedDoc: Document) => {
            // Force light color scheme
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              :root {
                color-scheme: light !important;
              }
              * {
                color-scheme: light !important;
              }
            `;
            clonedDoc.head.appendChild(style);
          }
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4' as const, 
          orientation: 'portrait' as const,
          compress: true
        }
      };

      // Use a more standard way to call html2pdf
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('PDF Download Error:', errorMessage);
      alert('Gagal mengunduh PDF. Silakan coba gunakan tombol Cetak.');
    }
  };

  const safeJson = async (res: Response) => {
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      console.error(`Expected JSON but got ${contentType}:`, text.substring(0, 100));
      throw new Error('Server returned non-JSON response');
    }
    return res.json();
  };

  const getActivitiesForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return (Array.isArray(activities) ? activities : []).filter(a => a.userId === currentUser?.id && a.date === dateStr);
  };

  const handleAddActivity = async (newActivity: Activity) => {
    console.log('Attempting to save activity:', newActivity);
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newActivity)
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await safeJson(response).catch(() => ({ error: `Server returned ${response.status}` }));
        console.error('Server error data:', errorData);
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const result = await safeJson(response);
      console.log('Save result:', result);

      if (editingActivity) {
        setActivities(prev => (Array.isArray(prev) ? prev : []).map(a => a.id === editingActivity.id ? newActivity : a));
        addLog('EDIT_ACTIVITY', `Mengedit kegiatan tanggal ${newActivity.date}`);
        setEditingActivity(null);
        alert('Kegiatan berhasil diperbarui!');
      } else {
        setActivities(prev => [...(Array.isArray(prev) ? prev : []), newActivity]);
        addLog('ADD_ACTIVITY', `Menambah kegiatan baru tanggal ${newActivity.date}`);
        alert('Kegiatan berhasil disimpan!');
      }
    } catch (err) {
      console.error('Failed to save activity:', err);
      alert(`Gagal menyimpan kegiatan: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteActivity = async (id: string | null) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await safeJson(res).catch(() => ({ error: `Server returned ${res.status}` }));
        throw new Error(errorData.error || `Server returned ${res.status}`);
      }
      const deletedActivity = activities.find(a => a.id === id);
      setActivities(prev => (Array.isArray(prev) ? prev : []).filter(a => a.id !== id));
      addLog('DELETE_ACTIVITY', `Menghapus kegiatan tanggal ${deletedActivity?.date || id}`);
      setDeletingActivityId(null);
    } catch (err) {
      console.error('Failed to delete activity:', err);
      alert(`Gagal menghapus kegiatan: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleShareExistingActivity = async () => {
    if (!sharingActivity || selectedColleaguesForShare.length === 0) return;
    
    try {
      for (const colleagueId of selectedColleaguesForShare) {
        const duplicatedActivity: Activity = {
          ...sharingActivity,
          id: Math.random().toString(36).substr(2, 9),
          userId: colleagueId
        };
        
        const res = await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(duplicatedActivity)
        });

        if (!res.ok) {
          const errorData = await safeJson(res).catch(() => ({ error: `Server returned ${res.status}` }));
          throw new Error(errorData.error || `Server returned ${res.status}`);
        }
        
        setActivities(prev => [...(Array.isArray(prev) ? prev : []), duplicatedActivity]);
      }
      
      addLog('SHARE_ACTIVITY', `Membagikan kegiatan tanggal ${sharingActivity.date} ke ${selectedColleaguesForShare.length} teman`);
      setSharingActivity(null);
      setSelectedColleaguesForShare([]);
      alert('Kegiatan berhasil dibagikan!');
    } catch (err) {
      console.error('Failed to share activity:', err);
      alert(`Gagal membagikan kegiatan: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const userActivities = (Array.isArray(activities) ? activities : []).filter(a => {
    const isUser = a.userId === currentUser?.id;
    if (!isUser) return false;
    
    if (dashboardFilter.startDate && a.date < dashboardFilter.startDate) return false;
    if (dashboardFilter.endDate && a.date > dashboardFilter.endDate) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        a.description.toLowerCase().includes(query) ||
        a.type.toLowerCase().includes(query) ||
        (a.mfdLocation && a.mfdLocation.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [userActivities.length, dashboardFilter, searchQuery]);

  const sortedActivities = [...userActivities].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  
  // Group activities by month
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: Activity[] } = {};
    sortedActivities.forEach(activity => {
      const monthYear = format(parseISO(activity.date), 'MMMM yyyy', { locale: id });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(activity);
    });
    return groups;
  }, [sortedActivities]);

  const monthKeys = Object.keys(groupedActivities);
  const totalItems = sortedActivities.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Flatten for pagination but keep track of month headers
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedActivities.slice(start, end);
  }, [sortedActivities, currentPage]);

  if (!isLoggedIn || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl space-y-8">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 mb-4">
              <UserCircle size={48} />
            </div>
            <h1 className="text-2xl font-bold dark:text-white">Login E-Lapor PJLP</h1>
            <p className="text-slate-500 dark:text-zinc-400">Masukkan kredensial Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-red-100 text-red-600 text-sm font-medium border border-red-200">
                {loginError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-zinc-300">Username</label>
              <input 
                name="username"
                type="text" 
                required
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-zinc-300">Password</label>
              <input 
                name="password"
                type="password" 
                required
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                placeholder="Password"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 mt-4"
            >
              <LogIn size={20} /> Masuk
            </button>
          </form>
          
          <div className="pt-4 text-center">
            <p className="text-xs text-slate-400">Default: agung / password123</p>
          </div>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    const activityTypeCounts = (Array.isArray(activityTypes) ? activityTypes : []).map(type => ({
      name: type.name,
      count: userActivities.filter(a => a.type === type.id).length,
      color: type.color
    }));

    const totalActivities = userActivities.length;
    const pieData = activityTypeCounts.filter(c => c.count > 0).map(c => ({
      name: c.name,
      value: c.count,
      color: c.color
    }));

    return (
      <div className="space-y-8">
        {dbError && (
          <div className="p-4 bg-red-100 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <div>
              <p className="font-bold">Error Database</p>
              <p className="text-sm">{dbError}. Mohon cek konfigurasi MySQL di Secrets.</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500 dark:text-zinc-500">Total Kegiatan</p>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                <ClipboardList size={18} />
              </div>
            </div>
            <h3 className="text-3xl font-bold dark:text-white">{totalActivities}</h3>
          </div>
          
          {Array.isArray(activityTypes) && activityTypes.slice(0, 3).map((type, idx) => (
            <div key={type.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-500 dark:text-zinc-500">{type.name}</p>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }}></div>
              </div>
              <h3 className="text-3xl font-bold dark:text-white">
                {userActivities.filter(a => a.type === type.id).length}
              </h3>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-lg font-bold mb-6 dark:text-white">Distribusi Tipe Kegiatan</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityTypeCounts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.1} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(Array.isArray(activityTypeCounts) ? activityTypeCounts : []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-lg font-bold mb-6 dark:text-white">Persentase Kegiatan</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(Array.isArray(pieData) ? pieData : []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {(Array.isArray(pieData) ? pieData : []).map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-xs text-slate-500 dark:text-zinc-400">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {currentUser?.role === 'admin' && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-lg font-bold mb-6 dark:text-white flex items-center gap-2">
              <ShieldAlert size={20} className="text-red-500" /> Monitoring Deadline Laporan
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
                    <th className="p-4 text-sm font-bold dark:text-white">Nama Personil</th>
                    <th className="p-4 text-sm font-bold dark:text-white">Status Hari Ini</th>
                    <th className="p-4 text-sm font-bold dark:text-white">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {(Array.isArray(users) ? users : []).filter(u => u.role === 'user').map(user => {
                    const today = format(new Date(), 'yyyy-MM-dd');
                    const hasActivityToday = (Array.isArray(activities) ? activities : []).some(a => a.userId === user.id && a.date === today);
                    return (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/50 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium dark:text-white">{user.name}</span>
                            <span className="text-xs text-slate-500">{user.jabatan}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${hasActivityToday ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {hasActivityToday ? 'SUDAH LAPOR' : 'BELUM LAPOR'}
                          </span>
                        </td>
                        <td className="p-4">
                          {!hasActivityToday && user.whatsapp && (
                            <a 
                              href={`https://wa.me/${user.whatsapp}?text=Halo ${user.name}, mohon segera input laporan kegiatan hari ini di sistem E-LAPOR PJLP. Terima kasih.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs font-bold text-green-600 hover:underline"
                            >
                              <MessageSquare size={14} /> Ingatkan via WA
                            </a>
                          )}
                          {!user.whatsapp && !hasActivityToday && (
                            <span className="text-[10px] text-slate-400 italic">No WA tidak tersedia</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentCalendarMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    const handleDayClick = (day: Date) => {
      const dayActivities = getActivitiesForDay(day);
      
      setSelectedCalendarDate(day);
      if (dayActivities.length > 0) {
        setActivitySubView('day-list');
      } else {
        setActivitySubView('add-form');
      }
    };

    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <CalendarIcon size={20} />
            </div>
            <h2 className="text-xl font-bold dark:text-white">
              {format(currentCalendarMonth, 'MMMM yyyy', { locale: id })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentCalendarMonth(subMonths(currentCalendarMonth, 1))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all dark:text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentCalendarMonth(new Date())}
              className="px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
            >
              Hari Ini
            </button>
            <button 
              onClick={() => setCurrentCalendarMonth(addMonths(currentCalendarMonth, 1))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all dark:text-white"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-zinc-800">
          {(Array.isArray(dayNames) ? dayNames : []).map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {(Array.isArray(calendarDays) ? calendarDays : []).map((day, idx) => {
            const dayActivities = getActivitiesForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDay = isToday(day);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;
            const hasLiburActivity = dayActivities.some(a => {
              if (a.isLibur) return true;
              const type = activityTypes.find(t => t.id === a.type);
              return type?.name.toUpperCase().includes('LIBUR') || a.description.toUpperCase().includes('LIBUR');
            });
            const isHoliday = isWeekend || hasLiburActivity;
            const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));
            
            return (
              <div 
                key={idx}
                onClick={() => {
                  if (!isFuture) handleDayClick(day);
                }}
                className={cn(
                  "min-h-[100px] p-2 border-r border-b border-slate-100 dark:border-zinc-800 transition-all group relative",
                  !isFuture 
                    ? cn("cursor-pointer", isHoliday ? "hover:bg-red-50/50 dark:hover:bg-red-900/10" : "hover:bg-blue-50/50 dark:hover:bg-blue-900/10") 
                    : "cursor-not-allowed",
                  !isCurrentMonth && "bg-slate-50/50 dark:bg-zinc-950/50 opacity-40",
                  isHoliday && isCurrentMonth && "bg-red-50 dark:bg-red-900/30",
                  isFuture && "cursor-not-allowed opacity-30",
                  idx % 7 === 6 && "border-r-0"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all",
                    isTodayDay ? (isHoliday ? "bg-red-600 text-white shadow-lg shadow-red-500/30" : "bg-blue-600 text-white shadow-lg shadow-blue-500/30") : 
                    isHoliday && isCurrentMonth ? "text-red-600 dark:text-red-400" :
                    "text-slate-600 dark:text-zinc-400 group-hover:text-blue-600"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                {dayActivities.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-lg flex items-center justify-between shadow-sm",
                      isHoliday ? "bg-red-600 text-white" : "bg-blue-600 text-white"
                    )}>
                      <span>{isHoliday ? 'LIBUR' : `${dayActivities.length} Kegiatan`}</span>
                      <Plus size={10} className="text-white" />
                    </div>
                    {(Array.isArray(dayActivities) ? dayActivities : []).slice(0, 2).map((a, i) => (
                      <div key={i} className="text-[9px] text-slate-500 dark:text-zinc-500 truncate px-1">
                        • {a.description.replace(/<[^>]*>/g, '').substring(0, 20)}...
                      </div>
                    ))}
                    {dayActivities.length > 2 && (
                      <div className={cn(
                        "text-[9px] font-bold px-1",
                        isHoliday ? "text-red-500" : "text-blue-500"
                      )}>
                        +{dayActivities.length - 2} lainnya
                      </div>
                    )}
                  </div>
                )}
                
                {dayActivities.length === 0 && isCurrentMonth && !isFuture && !isHoliday && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-2 bg-blue-600 text-white rounded-full shadow-lg">
                      <Plus size={16} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActivities = () => {
    if (activitySubView === 'day-list') {
      return renderDayActivitiesView();
    }
    if (activitySubView === 'add-form' || activitySubView === 'edit-form') {
      return renderActivityFormView();
    }

    return (
      <div className="space-y-8">
        {renderCalendar()}
      </div>
    );
  };

  const renderDayActivitiesView = () => {
    if (!selectedCalendarDate) return null;
    const dateStr = format(selectedCalendarDate, 'yyyy-MM-dd');
    const dayActivities = (Array.isArray(activities) ? activities : []).filter(
      a => a.userId === currentUser?.id && a.date === dateStr
    );

    const hasLiburActivity = dayActivities.some(a => {
      if (a.isLibur) return true;
      const type = activityTypes.find(t => t.id === a.type);
      return type?.name.toUpperCase().includes('LIBUR') || a.description.toUpperCase().includes('LIBUR');
    });

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActivitySubView('calendar')}
              className="p-3 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-all dark:text-white"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-bold dark:text-white">
                Kegiatan {format(selectedCalendarDate, 'd MMMM yyyy', { locale: id })}
              </h2>
              <p className="text-slate-500 dark:text-zinc-400">
                Daftar kegiatan Anda pada hari ini
              </p>
            </div>
          </div>
          <button 
            disabled={hasLiburActivity}
            onClick={() => {
              if (hasLiburActivity) return;
              setEditingActivity(null);
              setActivitySubView('add-form');
            }}
            className={cn(
              "flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-2xl shadow-lg transition-all active:scale-95",
              hasLiburActivity 
                ? "bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed shadow-none" 
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30"
            )}
          >
            <Plus size={20} /> Tambah Kegiatan
          </button>
        </div>

        {hasLiburActivity && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium">
            <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
              <Plus size={16} className="rotate-45" />
            </div>
            <span>Status hari ini adalah <strong>LIBUR</strong>. Hapus status libur untuk menambah kegiatan lain.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {dayActivities.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
              <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-4">
                <ClipboardList size={40} />
              </div>
              <p className="text-slate-500 dark:text-zinc-500 font-medium">Belum ada kegiatan untuk tanggal ini.</p>
              <button 
                onClick={() => setActivitySubView('add-form')}
                className="mt-4 text-blue-600 font-bold hover:underline"
              >
                Tambah kegiatan sekarang
              </button>
            </div>
          ) : (
            (Array.isArray(dayActivities) ? dayActivities : []).map((activity) => (
              <motion.div 
                key={activity.id}
                layout
                className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          activity.isLibur ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                          activity.isMfd ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                          "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        )}>
                          {activityTypes.find(t => t.id === activity.type)?.name.split(' ')[0] || 'NORMAL'}
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 dark:text-zinc-500 text-xs">
                          <Printer size={14} />
                          <span>{activity.startTime || '--:--'} - {activity.endTime || '--:--'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setSharingActivity(activity);
                            setSelectedColleaguesForShare([]);
                          }}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-all"
                          title="Share Kegiatan"
                        >
                          <Share2 size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingActivity(activity);
                            setActivitySubView('edit-form');
                          }}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                          title="Edit"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => setDeletingActivityId(activity.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                          title="Hapus"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div 
                        className="text-slate-700 dark:text-zinc-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: activity.description }}
                      />
                    </div>

                    {activity.location && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-950 p-2 rounded-xl border border-slate-100 dark:border-zinc-800 w-fit">
                        <UserCircle size={14} />
                        <span>Lokasi: {activity.location}</span>
                      </div>
                    )}
                  </div>

                  {Array.isArray(activity.photos) && activity.photos.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-2 md:w-72">
                      {activity.photos.map((photo, pIdx) => (
                        <img 
                          key={pIdx}
                          src={photo}
                          alt={`Activity ${pIdx + 1}`}
                          className="w-28 h-28 object-cover rounded-2xl border-2 border-white dark:border-zinc-800 shadow-sm flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    );
  };

  const renderActivityFormView = () => {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto"
      >
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-zinc-800 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
                <Edit3 size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold dark:text-white">
                  {editingActivity ? 'Edit Kegiatan' : 'Tambah Kegiatan Baru'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-500">
                  {selectedCalendarDate ? `Untuk tanggal ${format(selectedCalendarDate, 'd MMMM yyyy', { locale: id })}` : 'Silakan isi detail kegiatan di bawah ini'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setEditingActivity(null);
                const dayActivities = selectedCalendarDate ? getActivitiesForDay(selectedCalendarDate) : [];
                setActivitySubView(dayActivities.length > 0 ? 'day-list' : 'calendar');
              }}
              className="p-3 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-2xl transition-all text-slate-400 hover:text-slate-600"
            >
              <X size={24} />
            </button>
          </div>
          
          <ActivityForm 
            onAdd={async (a) => {
              await handleAddActivity(a);
              setActivitySubView('day-list');
            }} 
            userId={currentUser?.id || ''} 
            initialData={editingActivity || (selectedCalendarDate ? { 
              date: format(selectedCalendarDate, 'yyyy-MM-dd'),
              startTime: '07:00',
              endTime: '15:00',
              type: activityTypes.find(t => t.isNormal)?.id || '1'
            } as any : undefined)}
            onCancel={() => {
              setEditingActivity(null);
              const dayActivities = selectedCalendarDate ? getActivitiesForDay(selectedCalendarDate) : [];
              setActivitySubView(dayActivities.length > 0 ? 'day-list' : 'calendar');
            }}
            activityTypes={activityTypes}
            users={users}
            activities={activities}
          />
        </div>
      </motion.div>
    );
  };


  const renderActivityTypes = () => {
    if (currentUser?.role !== 'admin') {
      return (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl border border-slate-200 dark:border-zinc-800 text-center space-y-4">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-2xl font-bold dark:text-white">Akses Ditolak</h2>
          <p className="text-slate-500 dark:text-zinc-400 max-w-md mx-auto">Halaman ini hanya dapat diakses oleh Administrator.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold dark:text-white">Manajemen Tipe Kegiatan</h2>
          <button 
            onClick={() => {
              setEditingActivityType(null);
              setShowActivityTypeForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={20} /> Tambah Tipe
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
                <th className="p-4 text-sm font-bold dark:text-white">Nama Tipe</th>
                <th className="p-4 text-sm font-bold dark:text-white">Warna Label</th>
                <th className="p-4 text-sm font-bold dark:text-white">Status</th>
                <th className="p-4 text-sm font-bold dark:text-white text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {(Array.isArray(activityTypes) ? activityTypes : []).map((type) => (
                <tr key={type.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/50 transition-colors">
                  <td className="p-4">
                    <span className="font-medium dark:text-white">{type.name}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-slate-200" style={{ backgroundColor: type.color }}></div>
                      <span className="text-xs font-mono text-slate-500">{type.color}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${type.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {type.isActive ? 'AKTIF' : 'NON-AKTIF'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingActivityType(type);
                          setShowActivityTypeForm(true);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('Hapus tipe kegiatan ini?')) {
                            setActivityTypes(prev => (Array.isArray(prev) ? prev : []).filter(t => t.id !== type.id));
                            addLog('DELETE_ACTIVITY_TYPE', `Menghapus tipe kegiatan: ${type.name}`);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AnimatePresence>
          {showActivityTypeForm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-zinc-800"
              >
                <h3 className="text-xl font-bold mb-6 dark:text-white">
                  {editingActivityType ? 'Edit Tipe Kegiatan' : 'Tambah Tipe Kegiatan'}
                </h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const name = formData.get('name') as string;
                  const color = formData.get('color') as string;
                  const isActive = formData.get('isActive') === 'on';
                  const isNormal = formData.get('isNormal') === 'on';

                  if (editingActivityType) {
                    setActivityTypes(prev => (Array.isArray(prev) ? prev : []).map(t => t.id === editingActivityType.id ? { ...t, name, color, isActive, isNormal } : t));
                    addLog('EDIT_ACTIVITY_TYPE', `Mengubah tipe kegiatan: ${name}`);
                  } else {
                    const newType: ActivityType = {
                      id: Math.random().toString(36).substr(2, 9),
                      name,
                      color,
                      isActive,
                      isNormal
                    };
                    setActivityTypes(prev => [...(Array.isArray(prev) ? prev : []), newType]);
                    addLog('ADD_ACTIVITY_TYPE', `Menambah tipe kegiatan baru: ${name}`);
                  }
                  setShowActivityTypeForm(false);
                }} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium dark:text-zinc-300">Nama Tipe</label>
                    <input 
                      name="name"
                      defaultValue={editingActivityType?.name}
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium dark:text-zinc-300">Warna Label</label>
                    <div className="flex gap-4">
                      <input 
                        name="color"
                        type="color"
                        defaultValue={editingActivityType?.color || '#3b82f6'}
                        className="h-12 w-20 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 cursor-pointer"
                      />
                      <div className="flex-grow flex items-center text-xs text-slate-500 italic">
                        Pilih warna yang kontras untuk label di dashboard.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <input 
                      name="isActive"
                      type="checkbox"
                      defaultChecked={editingActivityType ? editingActivityType.isActive : true}
                      className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium dark:text-zinc-300">Tipe Aktif</label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <input 
                      name="isNormal"
                      type="checkbox"
                      defaultChecked={editingActivityType ? editingActivityType.isNormal : true}
                      className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium dark:text-zinc-300">Tipe Normal (Ada Form Lengkap & Foto)</label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowActivityTypeForm(false)}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all dark:text-white"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderLogs = () => {
    if (currentUser?.role !== 'admin') {
      return (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl border border-slate-200 dark:border-zinc-800 text-center space-y-4">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-2xl font-bold dark:text-white">Akses Ditolak</h2>
          <p className="text-slate-500 dark:text-zinc-400 max-w-md mx-auto">Halaman ini hanya dapat diakses oleh Administrator.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold dark:text-white">Log Aktivitas Sistem</h2>
          <div className="text-sm text-slate-500 dark:text-zinc-500">
            Total: {logs.length} log tercatat
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
                  <th className="p-4 text-sm font-bold dark:text-white">Waktu</th>
                  <th className="p-4 text-sm font-bold dark:text-white">User</th>
                  <th className="p-4 text-sm font-bold dark:text-white">Aksi</th>
                  <th className="p-4 text-sm font-bold dark:text-white">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {(Array.isArray(logs) ? logs : []).length > 0 ? (
                  [...logs].reverse().map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/50 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">
                          {format(parseISO(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            {log.userName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium dark:text-white">{log.userName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.action.includes('DELETE') ? 'bg-red-100 text-red-600' :
                          log.action.includes('ADD') ? 'bg-green-100 text-green-600' :
                          log.action.includes('EDIT') ? 'bg-blue-100 text-blue-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-slate-600 dark:text-zinc-400">{log.details}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 dark:text-zinc-500">
                      Belum ada log aktivitas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    if (currentUser?.role === 'admin') {
      return (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl border border-slate-200 dark:border-zinc-800 text-center space-y-4">
          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto text-orange-600 dark:text-orange-400">
            <Settings size={48} />
          </div>
          <h2 className="text-2xl font-bold dark:text-white">Akses Terbatas</h2>
          <p className="text-slate-500 dark:text-zinc-400 max-w-md mx-auto">Admin hanya diperbolehkan mengelola user. Input dan cetak laporan hanya untuk user PJLP.</p>
        </div>
      );
    }

    const reportActivities = (Array.isArray(activities) ? activities : []).filter(a => {
      const isUser = a.userId === currentUser?.id;
      if (!isUser) return false;
      if (period.startDate && a.date < period.startDate) return false;
      if (period.endDate && a.date > period.endDate) return false;
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm no-print">
          <div className="flex items-center gap-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Mulai Periode</label>
              <input 
                type="date" 
                value={period.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="block w-full p-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Akhir Periode</label>
              <input 
                type="date" 
                value={period.endDate}
                onChange={(e) => setPeriod({ ...period, endDate: e.target.value })}
                className="block w-full p-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm dark:text-white"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handlePrint()}
              className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl font-bold transition-all"
            >
              <Printer size={20} /> Cetak
            </button>
            <button 
              onClick={() => handleDownloadPDF()}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all"
            >
              <Download size={20} /> Download PDF
            </button>
          </div>
        </div>

      <div className="overflow-x-auto pb-8 bg-slate-100 dark:bg-zinc-950 p-4 rounded-3xl border border-slate-200 dark:border-zinc-800 min-h-[800px]">
        <div className="bg-white shadow-2xl mx-auto max-w-[210mm]">
          <ReportPreview 
            ref={reportRef}
            user={currentUser!} 
            activities={reportActivities} 
            period={period} 
          />
        </div>
      </div>
      </div>
    );
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} currentUser={currentUser!}>
      <AnimatePresence>
        {/* Removed isChangingPage overlay to prevent stuck loading screen */}
      </AnimatePresence>
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'activities' && renderActivities()}
      {activeTab === 'report' && renderReport()}
      {activeTab === 'activity-types' && renderActivityTypes()}
      {activeTab === 'logs' && renderLogs()}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div>
              <h2 className="text-xl font-bold dark:text-white">{currentUser?.role === 'admin' ? 'Manajemen User' : 'Data Personel'}</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-500">Kelola data personel PJLP Dinas Perhubungan</p>
            </div>
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => { setEditingUser(null); setShowUserForm(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center gap-2"
              >
                <Plus size={18} /> Tambah User
              </button>
            )}
          </div>

          {showUserForm && (currentUser?.role === 'admin' || editingUser?.id === currentUser?.id) && (
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-lg">
              <h3 className="text-lg font-bold mb-6 dark:text-white">{editingUser ? 'Edit Data Diri' : 'Tambah User Baru'}</h3>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userFormError && (
                  <div className="md:col-span-2 p-3 rounded-xl bg-red-100 text-red-600 text-sm font-medium border border-red-200">
                    {userFormError}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Nama Lengkap</label>
                  <input name="name" defaultValue={editingUser?.name} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">ID PJLP</label>
                  <input name="idPjlp" defaultValue={editingUser?.idPjlp} required disabled={currentUser?.role !== 'admin'} className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Jabatan</label>
                  <input name="jabatan" defaultValue={editingUser?.jabatan} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Satuan Kerja</label>
                  <input name="satuanKerja" defaultValue={editingUser?.satuanKerja} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Unit Kerja</label>
                  <input name="unitKerja" defaultValue={editingUser?.unitKerja} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Nama Pengawas</label>
                  <input name="pengawasName" defaultValue={editingUser?.pengawasName} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">NIP Pengawas</label>
                  <input name="pengawasNip" defaultValue={editingUser?.pengawasNip} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Nama Kepala Satuan</label>
                  <input name="kepalaSatuanName" defaultValue={editingUser?.kepalaSatuanName} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">NIP Kepala Satuan</label>
                  <input name="kepalaSatuanNip" defaultValue={editingUser?.kepalaSatuanNip} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Role</label>
                  <select name="role" defaultValue={editingUser?.role || 'user'} disabled={currentUser?.role !== 'admin'} className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white disabled:opacity-50">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Username</label>
                  <input name="username" defaultValue={editingUser?.username} required disabled={currentUser?.role !== 'admin'} className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Password</label>
                  <input name="password" type="password" placeholder={editingUser ? 'Kosongkan jika tidak diubah' : 'Password'} className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-300">Nomor WhatsApp (Contoh: 628123456789)</label>
                  <input name="whatsapp" defaultValue={editingUser?.whatsapp} placeholder="628..." className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 dark:text-white" />
                </div>
                <div className="md:col-span-2 flex gap-4">
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">
                    {editingUser ? 'Simpan Perubahan' : 'Tambah User'}
                  </button>
                  <button type="button" onClick={() => setShowUserForm(false)} className="flex-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold py-3 rounded-xl transition-all">
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(Array.isArray(users) && users.length > 0 ? users : (currentUser ? [currentUser] : [])).filter(u => currentUser?.role === 'admin' || u.id === currentUser?.id).map((user) => (
              <div key={user.id} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm relative group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                    {(user.name || '').split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-white">{user.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-500">{user.jabatan}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="flex justify-between"><span className="text-slate-500">ID PJLP:</span> <span className="font-medium dark:text-white">{user.idPjlp}</span></p>
                  <p className="flex justify-between"><span className="text-slate-500">Username:</span> <span className="font-medium dark:text-white">{user.username}</span></p>
                  <p className="flex justify-between"><span className="text-slate-500">Role:</span> <span className="font-medium capitalize dark:text-white">{user.role}</span></p>
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 mt-2 space-y-1">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Pengawas</p>
                    <p className="text-xs dark:text-zinc-300">{user.pengawasName || '-'}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mt-2">Kepala Satuan</p>
                    <p className="text-xs dark:text-zinc-300">{user.kepalaSatuanName || '-'}</p>
                  </div>
                </div>
                
                {(currentUser?.role === 'admin' || user.id === currentUser?.id) && (
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingUser(user); setShowUserForm(true); }} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit3 size={16} /></button>
                    {currentUser?.role === 'admin' && (
                      <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16} /></button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'suggestions' && (
        <SuggestionsView currentUser={currentUser} isAdmin={currentUser?.role === 'admin'} />
      )}

      {/* Share Activity Modal */}
      <AnimatePresence>
        {sharingActivity && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <Share2 size={20} className="text-green-500" /> Bagikan Kegiatan
                </h3>
                <button onClick={() => setSharingActivity(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-100 dark:border-zinc-800">
                  <p className="text-xs text-slate-500 mb-1 uppercase font-bold">Kegiatan yang dibagikan:</p>
                  <p className="text-sm font-medium dark:text-white line-clamp-2" dangerouslySetInnerHTML={{ __html: sharingActivity.description }} />
                  <p className="text-[10px] text-blue-600 mt-1">
                    {(() => {
                      try {
                        return format(parseISO(sharingActivity.date), 'EEEE, d MMMM yyyy', { locale: id });
                      } catch (e) {
                        return sharingActivity.date;
                      }
                    })()}
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold dark:text-zinc-300">Pilih Teman Sejawat:</label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {(Array.isArray(users) ? users : []).filter(u => u.id !== currentUser.id && u.role === 'user' && u.jabatan === currentUser.jabatan).map(colleague => (
                      <button
                        key={colleague.id}
                        type="button"
                        onClick={() => {
                          setSelectedColleaguesForShare(prev => {
                            const current = Array.isArray(prev) ? prev : [];
                            return current.includes(colleague.id) 
                              ? current.filter(id => id !== colleague.id) 
                              : [...current, colleague.id];
                          });
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                          selectedColleaguesForShare.includes(colleague.id)
                            ? "bg-green-600 border-green-600 text-white shadow-md"
                            : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-green-300"
                        )}
                      >
                        {colleague.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setSharingActivity(null)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all dark:text-white"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleShareExistingActivity}
                    disabled={selectedColleaguesForShare.length === 0}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-green-500/20 transition-all"
                  >
                    Bagikan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <h2 className="text-xl font-bold dark:text-white">Pengaturan Sistem</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-500">Sesuaikan preferensi aplikasi Anda di sini</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <Settings size={24} />
                <h3 className="font-bold">Preferensi Tampilan</h3>
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium dark:text-white">Mode Gelap</p>
                    <p className="text-xs text-slate-500">Gunakan tema gelap untuk mengurangi kelelahan mata</p>
                  </div>
                  <button 
                    onClick={() => document.documentElement.classList.toggle('dark')}
                    className="w-12 h-6 bg-slate-200 dark:bg-blue-600 rounded-full relative transition-all"
                  >
                    <div className="absolute top-1 left-1 dark:left-7 w-4 h-4 bg-white rounded-full transition-all shadow-sm"></div>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium dark:text-white">Notifikasi Email</p>
                    <p className="text-xs text-slate-500">Terima pengingat laporan harian</p>
                  </div>
                  <button className="w-12 h-6 bg-slate-200 rounded-full relative transition-all opacity-50 cursor-not-allowed">
                    <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <UserCircle size={24} />
                <h3 className="font-bold">Tanda Tangan Digital</h3>
              </div>
              <div className="space-y-4 pt-2">
                <div className="p-4 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl text-center">
                  <p className="text-xs text-slate-500 mb-2">Unggah file PNG transparan untuk tanda tangan Anda</p>
                  <button className="text-sm font-bold text-blue-600 hover:underline">Pilih File</button>
                </div>
                <p className="text-[10px] text-slate-400 italic">Tanda tangan ini akan otomatis muncul pada laporan kinerja bulanan Anda.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4 md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <AlertCircle size={24} />
                  <h3 className="font-bold">Informasi & Utilitas Sistem</h3>
                </div>
                <button 
                  onClick={handleExportDatabase}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                  <Download size={16} /> Export Database (JSON)
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total User</p>
                  <p className="font-bold dark:text-white">{users.length} Personil</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Kegiatan</p>
                  <p className="font-bold dark:text-white">{activities.length} Entri</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Versi Sistem</p>
                  <p className="font-bold dark:text-white">v2.4.0-stable</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Status Server</p>
                  <p className="font-bold text-green-500 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Online
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {deletingActivityId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2 dark:text-white">Hapus Kegiatan?</h3>
              <p className="text-slate-500 dark:text-zinc-500 mb-6">Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus kegiatan ini?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleDeleteActivity(deletingActivityId)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
                >
                  Ya, Hapus
                </button>
                <button 
                  onClick={() => setDeletingActivityId(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
