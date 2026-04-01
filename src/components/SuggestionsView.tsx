import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { User, Suggestion } from '../types';
import { MessageSquare, Send, User as UserIcon, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

interface SuggestionsViewProps {
  currentUser: User | null;
  isAdmin: boolean;
}

export default function SuggestionsView({ currentUser, isAdmin }: SuggestionsViewProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [newSuggestion, setNewSuggestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/suggestions');
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error(`Expected JSON but got ${contentType}:`, text.substring(0, 100));
        throw new Error('Server returned non-JSON response');
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuggestions(data);
      } else {
        console.error('Suggestions data is not an array:', data);
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      setSuggestions([]);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestion.trim() || !currentUser) return;

    setIsSubmitting(true);
    const suggestion: Suggestion = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      userName: currentUser.name,
      content: newSuggestion,
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suggestion)
      });

      if (res.ok) {
        setNewSuggestion('');
        setMessage({ type: 'success', text: 'Saran Anda telah terkirim. Terima kasih!' });
        fetchSuggestions();
      } else {
        setMessage({ type: 'error', text: 'Gagal mengirim saran. Silakan coba lagi.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <MessageSquare className="text-blue-600" />
            Saran & Masukan
          </h2>
          <p className="text-slate-500 dark:text-zinc-400">
            {isAdmin 
              ? 'Daftar saran dan masukan dari seluruh personel PJLP.' 
              : 'Berikan saran atau masukan Anda untuk pengembangan sistem E-Lapor PJLP.'}
          </p>
        </div>
      </div>

      {!isAdmin && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                Tulis Saran/Masukan Anda
              </label>
              <div className="bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                <ReactQuill
                  theme="snow"
                  value={newSuggestion}
                  onChange={setNewSuggestion}
                  placeholder="Ketik saran di sini..."
                  className="bg-white dark:bg-zinc-900 dark:text-white min-h-[120px]"
                  modules={{
                    toolbar: [
                      ['bold', 'italic', 'underline'],
                      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                      ['clean']
                    ],
                  }}
                />
              </div>
            </div>
            
            <AnimatePresence>
              {message.text && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`p-3 rounded-xl text-sm ${
                    message.type === 'success' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isSubmitting || !newSuggestion.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
            >
              <Send size={18} />
              {isSubmitting ? 'Mengirim...' : 'Kirim Saran'}
            </button>
          </form>
        </motion.div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
          {isAdmin ? 'Semua Saran' : 'Saran Terbaru'}
        </h3>
        
        {suggestions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-zinc-800">
            <MessageSquare className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" size={48} />
            <p className="text-slate-500 dark:text-zinc-500">Belum ada saran yang masuk.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {(Array.isArray(suggestions) ? suggestions : []).map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400">
                      <UserIcon size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white">{s.userName}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                        <Calendar size={12} />
                        {format(new Date(s.createdAt), 'dd MMMM yyyy, HH:mm', { locale: id })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: s.content }} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
