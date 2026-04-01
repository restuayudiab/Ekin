import React, { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Plus, Trash2, Image as ImageIcon, Calendar as CalendarIcon, Clock, Edit3, Users } from 'lucide-react';
import { Activity, ActivityType, User } from '@/src/types';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';

interface ActivityFormProps {
  onAdd: (activity: Activity) => Promise<void>;
  userId: string;
  initialData?: Activity;
  onCancel?: () => void;
  activityTypes: ActivityType[];
  users: User[];
  activities: Activity[];
}

export default function ActivityForm({ 
  onAdd, 
  userId, 
  initialData, 
  onCancel, 
  activityTypes, 
  users,
  activities 
}: ActivityFormProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initialData?.date || today);
  const [startTime, setStartTime] = useState(initialData?.startTime || '07:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '15:00');
  const [description, setDescription] = useState(initialData?.description || '');
  const [typeId, setTypeId] = useState<string>(
    initialData?.type || (activityTypes.find(t => t.isNormal)?.id || '')
  );
  const [mfdLocation, setMfdLocation] = useState(initialData?.mfdLocation || '');
  const [photos, setPhotos] = useState<string[]>(initialData?.photos || []);
  const [selectedColleagues, setSelectedColleagues] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = (Array.isArray(users) ? users : []).find(u => u.id === userId);
  const colleagues = (Array.isArray(users) ? users : []).filter(u => u.id !== userId && u.role === 'user' && u.jabatan === currentUser?.jabatan);

  const selectedType = (Array.isArray(activityTypes) ? activityTypes : []).find(t => t.id === typeId);
  const isNormal = selectedType?.isNormal ?? true;
  const isLibur = selectedType?.name.toUpperCase().includes('LIBUR');
  const isMfd = selectedType?.name.toUpperCase() === 'MFD';

  // Sync state when initialData changes (for editing)
  React.useEffect(() => {
    if (initialData) {
      setDate(initialData.date);
      setStartTime(initialData.startTime);
      setEndTime(initialData.endTime);
      setDescription(initialData.description);
      setTypeId(initialData.type);
      setMfdLocation(initialData.mfdLocation || '');
      setPhotos(initialData.photos || []);
      setSelectedColleagues([]);
    } else {
      // Reset to defaults when initialData is cleared
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setStartTime('07:00');
      setEndTime('15:00');
      setDescription('');
      setTypeId(activityTypes.find(t => t.isNormal)?.id || '');
      setMfdLocation('');
      setPhotos([]);
      setSelectedColleagues([]);
    }
  }, [initialData, activityTypes]);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setPhotos(prev => [...(Array.isArray(prev) ? prev : []), compressed]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form handleSubmit triggered');
    
    if (date > today) {
      alert('Tanggal tidak boleh lebih dari hari ini!');
      return;
    }

    if (isNormal && startTime && endTime && endTime <= startTime) {
      alert('Waktu selesai harus setelah waktu mulai!');
      return;
    }

    // Check for overlapping time slots
    if (isNormal) {
      const isOverlapping = (Array.isArray(activities) ? activities : []).some(a => {
        if (a.userId !== userId || a.date !== date || a.id === initialData?.id || !a.isNormal) return false;
        
        // Overlap condition: (newStart < existingEnd) && (existingStart < newEnd)
        return startTime < a.endTime && a.startTime < endTime;
      });

      if (isOverlapping) {
        alert('Waktu kegiatan tidak boleh bertabrakan dengan kegiatan lain pada hari yang sama!');
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      const baseActivity = {
        date,
        startTime: isNormal ? startTime : '',
        endTime: isNormal ? endTime : '',
        description: isNormal ? description : (isLibur ? 'LIBUR' : (isMfd ? `MFD (Mental, Fisik dan Disiplin) ${mfdLocation}` : selectedType?.name || '')),
        type: typeId,
        isLibur,
        isMfd,
        isNormal,
        mfdLocation: isMfd ? mfdLocation : undefined,
        photos: isNormal ? photos : []
      };

      // Create activity for current user
      const newActivity: Activity = {
        ...baseActivity,
        id: initialData?.id || Math.random().toString(36).substr(2, 9),
        userId,
      };
      
      console.log('Calling onAdd for current user:', newActivity);
      await onAdd(newActivity);

      // Create activities for colleagues if not editing
      if (!initialData && selectedColleagues.length > 0) {
        for (const colleagueId of selectedColleagues) {
          const colleagueActivity: Activity = {
            ...baseActivity,
            id: Math.random().toString(36).substr(2, 9),
            userId: colleagueId,
          };
          console.log(`Calling onAdd for colleague ${colleagueId}:`, colleagueActivity);
          await onAdd(colleagueActivity);
        }
      }
      
      // Reset form fields after submission
      if (!initialData) {
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setStartTime('07:00');
        setEndTime('15:00');
        setDescription('');
        setTypeId(activityTypes.find(t => t.isNormal)?.id || '');
        setMfdLocation('');
        setPhotos([]);
        setSelectedColleagues([]);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <CalendarIcon size={16} className="text-blue-500" /> Tanggal
          </label>
          <input 
            type="date" 
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock size={16} className="text-blue-500" /> Tipe Kegiatan
          </label>
          <select 
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
          >
            {(Array.isArray(activityTypes) ? activityTypes : []).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {isNormal && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium dark:text-zinc-400">Mulai</label>
              <input 
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium dark:text-zinc-400">Selesai</label>
              <input 
                type="time" 
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {isMfd && (
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Lokasi MFD</label>
          <input 
            type="text" 
            value={mfdLocation}
            onChange={(e) => setMfdLocation(e.target.value)}
            placeholder="Contoh: RINDAM JAYA CONDET"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
          />
        </div>
      )}

      {isNormal && (
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Deskripsi Kegiatan</label>
          <div className="bg-white dark:bg-zinc-950 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800">
            <ReactQuill
              theme="snow"
              value={description}
              onChange={setDescription}
              placeholder="Masukkan rincian kegiatan..."
              className="bg-white dark:bg-zinc-900 dark:text-white min-h-[200px]"
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                  ['clean']
                ],
              }}
            />
          </div>
          <p className="text-[10px] text-slate-400 italic">* Gunakan editor di atas untuk merinci kegiatan Anda (seperti di Word)</p>
        </div>
      )}

      {isNormal && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2 dark:text-zinc-300">
              <ImageIcon size={16} className="text-blue-500" /> Dokumentasi (Foto)
            </label>
            <label className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Plus size={14} /> Tambah Foto
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
          </div>
          
          <div className="flex flex-wrap gap-4">
            {(Array.isArray(photos) ? photos : []).map((photo, i) => (
              <div key={i} className="relative group">
                <img 
                  src={photo} 
                  alt="Preview" 
                  className="w-24 h-24 object-cover rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm" 
                  referrerPolicy="no-referrer"
                />
                <button 
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg transition-all transform hover:scale-110 flex items-center justify-center"
                  title="Hapus Foto"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {(Array.isArray(photos) ? photos : []).length === 0 && (
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-400">
                <ImageIcon size={24} />
              </div>
            )}
          </div>
        </div>
      )}

      {isNormal && !initialData && colleagues.length > 0 && (
        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
          <label className="text-sm font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Users size={16} /> Teman Sejawat (Input Bersama)
          </label>
          <p className="text-[10px] text-blue-600 dark:text-blue-500 mb-2">
            Pilih teman yang melakukan kegiatan yang sama. Kegiatan akan otomatis muncul di laporan mereka.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(colleagues) ? colleagues : []).map(colleague => (
              <button
                key={colleague.id}
                type="button"
                onClick={() => {
                  setSelectedColleagues(prev => {
                    const current = Array.isArray(prev) ? prev : [];
                    return current.includes(colleague.id) 
                      ? current.filter(id => id !== colleague.id) 
                      : [...current, colleague.id];
                  });
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  selectedColleagues.includes(colleague.id)
                    ? "bg-blue-600 border-blue-600 text-white shadow-md"
                    : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-blue-300"
                )}
              >
                {colleague.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold py-4 rounded-xl transition-all"
          >
            Batal
          </button>
        )}
        <button 
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2",
            onCancel ? "flex-[2]" : "w-full",
            isSubmitting && "opacity-70 cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {initialData ? <Edit3 size={20} /> : <Plus size={20} />}
              {initialData ? 'Simpan Perubahan' : 'Simpan Kegiatan'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
