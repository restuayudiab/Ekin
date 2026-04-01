export interface User {
  id: string;
  name: string;
  idPjlp: string;
  jabatan: string;
  satuanKerja: string;
  unitKerja: string;
  username: string;
  password?: string;
  role: 'admin' | 'user';
  signatureUrl?: string;
  whatsapp?: string;
  pengawasName?: string;
  pengawasNip?: string;
  kepalaSatuanName?: string;
  kepalaSatuanNip?: string;
}

export interface ActivityType {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  isNormal: boolean;
}

export interface SystemLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Activity {
  id: string;
  userId: string;
  date: string; // ISO format
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  description: string;
  type: string; // Dynamic activity type
  location?: string;
  isLibur?: boolean;
  isMfd?: boolean;
  isNormal?: boolean;
  mfdLocation?: string;
  photos: string[]; // Base64 or URLs
}

export interface ReportPeriod {
  startDate: string;
  endDate: string;
}

export interface Suggestion {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}
