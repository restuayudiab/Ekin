import { User, Activity } from './types';

export const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'AGUNG SUMARDI',
    idPjlp: '80339397',
    jabatan: 'PETUGAS TEKNISI AC',
    satuanKerja: 'SATUAN PRASARANA DAN SARANA',
    unitKerja: 'UP. TERMINAL TERPADU PULO GEBANG',
    username: 'agung',
    password: 'password123',
    role: 'admin',
    pengawasName: 'DIANTY SUBAGIARTY',
    pengawasNip: '198301112009042006',
    kepalaSatuanName: 'WAHYU HIDAYAT',
    kepalaSatuanNip: '198303142010011020',
  },
  {
    id: '2',
    name: 'BUDI SANTOSO',
    idPjlp: '80339400',
    jabatan: 'PETUGAS TEKNISI LISTRIK',
    satuanKerja: 'SATUAN PRASARANA DAN SARANA',
    unitKerja: 'UP. TERMINAL TERPADU PULO GEBANG',
    username: 'budi',
    password: 'password123',
    role: 'user',
    pengawasName: 'DIANTY SUBAGIARTY',
    pengawasNip: '198301112009042006',
    kepalaSatuanName: 'WAHYU HIDAYAT',
    kepalaSatuanNip: '198303142010011020',
  }
];

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    userId: '1',
    date: '2025-10-30',
    startTime: '',
    endTime: '',
    description: 'LIBUR',
    type: '2',
    isLibur: true,
    isNormal: false,
    photos: []
  },
  {
    id: '2',
    userId: '1',
    date: '2025-10-31',
    startTime: '',
    endTime: '',
    description: 'LIBUR',
    type: '2',
    isLibur: true,
    isNormal: false,
    photos: []
  },
  {
    id: '3',
    userId: '1',
    date: '2025-11-01',
    startTime: '07:00',
    endTime: '15:00',
    description: '- Pelaksanaan Apel Pagi rutin\n- Monitoring unit AC dan Menyalakan unit ac Area Terminal pulogebang.\n- maintenance of indoor air conditioning filter changes in the 2nd floor area of departure.\n- ISHOMA\n- Giat Cleaning filter AC dan mengecek unit AC seluruh area',
    type: '1',
    isNormal: true,
    photos: ['https://picsum.photos/seed/ac1/200/200', 'https://picsum.photos/seed/ac2/200/200']
  },
  {
    id: '4',
    userId: '1',
    date: '2025-11-03',
    startTime: '',
    endTime: '',
    description: 'MFD (Mental, Fisik dan Disiplin) RINDAM JAYA CONDET',
    type: '3',
    isMfd: true,
    isNormal: false,
    mfdLocation: 'RINDAM JAYA CONDET',
    photos: []
  }
];
