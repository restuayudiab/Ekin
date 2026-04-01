import React from 'react';
import { User, Activity, ReportPeriod } from '@/src/types';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

interface ReportPreviewProps {
  user: User;
  activities: Activity[];
  period: ReportPeriod;
}

const ReportPreview = React.forwardRef<HTMLDivElement, ReportPreviewProps>(({ user, activities, period }, ref) => {
  // Sort activities by date
  const sortedActivities = [...activities].sort((a, b) => {
    try {
      return parseISO(a.date).getTime() - parseISO(b.date).getTime();
    } catch (e) {
      return 0;
    }
  });

  // Group activities by date
  const groupedByDate = sortedActivities.reduce((acc, activity) => {
    const dateKey = activity.date || 'unknown';
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(activity);
    return acc;
  }, {} as { [key: string]: Activity[] });

  const dateKeys = Object.keys(groupedByDate).sort();

  interface TableRow {
    type: 'normal' | 'special';
    dateKey: string;
    dateIndex: number;
    activity: Activity;
    activityIndex: number;
    rowSpan: number;
  }

  // Flatten activities for rendering with rowSpan
  const tableRows: TableRow[] = [];
  (Array.isArray(dateKeys) ? dateKeys : []).forEach((dateKey, dateIndex) => {
    const dayActivities = groupedByDate[dateKey];
    const isNormal = (Array.isArray(dayActivities) ? dayActivities : []).some(a => a.isNormal);

    if (!isNormal) {
      const activity = dayActivities[0];
      tableRows.push({
        type: 'special',
        dateKey,
        dateIndex,
        activity,
        rowSpan: 1,
        activityIndex: 0
      });
    } else {
      (Array.isArray(dayActivities) ? dayActivities : []).forEach((activity, activityIndex) => {
        tableRows.push({
          type: 'normal',
          dateKey,
          dateIndex,
          activity,
          activityIndex,
          rowSpan: dayActivities.length
        });
      });
    }
  });

  return (
    <div ref={ref} className="bg-white text-black font-serif p-0 max-w-[210mm] mx-auto print:m-0" style={{ color: '#000000', backgroundColor: '#ffffff' }}>
      {/* Page 1: Cover */}
      <div className="min-h-[297mm] flex flex-col items-center text-center p-8 pt-12 relative page-break-after-always overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
        <div className="mt-2">
          <h1 className="text-3xl font-bold mb-1 capitalize">Laporan Kinerja</h1>
          <h2 className="text-xl font-bold mb-1 leading-tight capitalize">Penyedia Jasa Lainnya Orang Perorangan</h2>
          <h2 className="text-xl font-bold mb-1 leading-tight">(PJLP)</h2>
          <h2 className="text-xl font-bold mb-6 leading-tight capitalize">Dinas Perhubungan Provinsi DKI Jakarta</h2>

          <div className="w-32 h-32 mx-auto flex items-center justify-center my-6">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/b/b9/Logo_Dinas_Perhubungan.png" 
              alt="Logo Dishub" 
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="mt-auto mb-12 space-y-0 text-lg font-bold">
          <p className="capitalize leading-tight text-xl">{user.name}</p>
          <p className="leading-tight">ID PJLP {user.idPjlp}</p>
          <p className="capitalize leading-tight">{user.satuanKerja}</p>
          <p className="capitalize leading-tight">{user.jabatan}</p>
          <div className="mt-6 space-y-0">
            <p className="leading-tight">Periode :</p>
            <p className="leading-tight">
              {(() => {
                try {
                  return format(parseISO(period.startDate), 'dd MMMM yyyy', { locale: id });
                } catch (e) {
                  return period.startDate;
                }
              })()} – {(() => {
                try {
                  return format(parseISO(period.endDate), 'dd MMMM yyyy', { locale: id });
                } catch (e) {
                  return period.endDate;
                }
              })()}
            </p>
            <p className="capitalize max-w-md mx-auto leading-tight mt-1">{user.unitKerja}</p>
          </div>
        </div>
      </div>

      {/* Page 2+: Content Table */}
      <div className="p-10 min-h-[297mm]">
        <div className="mb-4 text-sm">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="w-32 py-0.5 leading-tight">Nama</td>
                <td className="w-4 py-0.5">:</td>
                <td className="font-bold py-0.5 leading-tight capitalize">{user.name}</td>
              </tr>
              <tr>
                <td className="py-0.5 leading-tight">ID PJLP</td>
                <td className="py-0.5">:</td>
                <td className="py-0.5 leading-tight">{user.idPjlp}</td>
              </tr>
              <tr>
                <td className="py-0.5 leading-tight">Jabatan</td>
                <td className="py-0.5">:</td>
                <td className="py-0.5 leading-tight">{user.jabatan}</td>
              </tr>
              <tr>
                <td className="py-0.5 leading-tight">Unit Kerja</td>
                <td className="py-0.5">:</td>
                <td className="py-0.5 leading-tight">{user.unitKerja}</td>
              </tr>
              <tr>
                <td className="py-0.5 leading-tight">Periode</td>
                <td className="py-0.5">:</td>
                <td className="py-0.5 leading-tight font-bold">
                  {(() => {
                    try {
                      return format(parseISO(period.startDate), 'dd MMMM yyyy', { locale: id });
                    } catch (e) {
                      return period.startDate;
                    }
                  })()} – {(() => {
                    try {
                      return format(parseISO(period.endDate), 'dd MMMM yyyy', { locale: id });
                    } catch (e) {
                      return period.endDate;
                    }
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-center font-bold text-sm mb-6 capitalize leading-tight">
          Laporan Kinerja Penyedia Jasa Lainnya Orang Perorangan (PJLP)<br />
          {user.unitKerja}
        </h3>

        <table className="w-full border-collapse border border-[#94a3b8] text-[10px]" style={{ tableLayout: 'fixed', boxSizing: 'border-box' }}>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '41%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th className="border border-[#94a3b8] p-2 text-center align-middle font-bold" style={{ width: '5%', boxSizing: 'border-box' }}>No</th>
              <th className="border border-[#94a3b8] p-2 text-center align-middle font-bold" style={{ width: '22%', boxSizing: 'border-box' }}>Hari / Tanggal</th>
              <th className="border border-[#94a3b8] p-2 text-center align-middle font-bold" style={{ width: '12%', boxSizing: 'border-box' }}>Pukul</th>
              <th className="border border-[#94a3b8] p-2 text-center align-middle font-bold" style={{ width: '41%', boxSizing: 'border-box' }}>Kegiatan</th>
              <th className="border border-[#94a3b8] p-2 text-center align-middle font-bold" style={{ width: '20%', boxSizing: 'border-box' }}>Dokumentasi</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(tableRows) ? tableRows : []).map((row, rowIndex) => {
              if (row.type === 'special') {
                return (
                  <tr key={row.dateKey} className="break-inside-avoid">
                    <td className="border border-[#94a3b8] p-2 text-center align-middle" style={{ boxSizing: 'border-box' }}>{row.dateIndex + 1}</td>
                    <td className="border border-[#94a3b8] p-2 text-center align-middle capitalize text-[9px] whitespace-nowrap" style={{ boxSizing: 'border-box' }}>
                      {(() => {
                        try {
                          return format(parseISO(row.activity.date), 'EEEE, d MMMM yyyy', { locale: id });
                        } catch (e) {
                          return row.activity.date;
                        }
                      })()}
                    </td>
                    <td colSpan={3} className="border border-[#94a3b8] p-4 align-middle text-center font-bold capitalize" style={{ backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
                      {row.activity.isLibur ? (
                        "Libur"
                      ) : row.activity.isMfd ? (
                        <div>
                          <p>Mfd</p>
                          <p>(Mental, Fisik dan Disiplin)</p>
                          <p>{row.activity.mfdLocation}</p>
                        </div>
                      ) : (
                        row.activity.description || "Tidak ada kegiatan"
                      )}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.activity.id} className="break-inside-avoid">
                  {row.activityIndex === 0 && (
                    <>
                      <td rowSpan={row.rowSpan} className="border border-[#94a3b8] p-2 text-center align-middle" style={{ boxSizing: 'border-box' }}>{row.dateIndex + 1}</td>
                      <td rowSpan={row.rowSpan} className="border border-[#94a3b8] p-2 text-center align-middle capitalize text-[9px] whitespace-nowrap" style={{ boxSizing: 'border-box' }}>
                        {(() => {
                          try {
                            return format(parseISO(row.dateKey), 'EEEE, d MMMM yyyy', { locale: id });
                          } catch (e) {
                            return row.dateKey;
                          }
                        })()}
                      </td>
                    </>
                  )}
                  <td className="border border-[#94a3b8] p-2 text-center align-middle whitespace-nowrap" style={{ boxSizing: 'border-box' }}>
                    {row.activity.startTime} – {row.activity.endTime}
                  </td>
                  <td className="border border-[#94a3b8] p-2 align-top" style={{ boxSizing: 'border-box' }}>
                    <div 
                      className="prose prose-sm max-w-none prose-p:my-0 prose-ul:my-0 prose-li:my-0 text-[10px]"
                      style={{ color: '#000000' }}
                      dangerouslySetInnerHTML={{ __html: row.activity.description }} 
                    />
                  </td>
                  <td className="border border-[#94a3b8] p-2 align-middle text-center" style={{ boxSizing: 'border-box' }}>
                    <div className={`grid gap-1 ${Array.isArray(row.activity.photos) && row.activity.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {Array.isArray(row.activity.photos) && row.activity.photos.map((photo, i) => (
                        <img 
                          key={i} 
                          src={photo} 
                          alt="Dokumentasi" 
                          className="w-full h-auto max-h-16 object-cover border"
                          style={{ borderColor: '#cbd5e1' }}
                          referrerPolicy="no-referrer"
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Signature Section */}
        <div className="mt-8 space-y-12 break-inside-avoid">
          <div className="grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-16">
              <div>
                <p>Pengawas,</p>
                <p>Petugas Teknisi</p>
                <p>{user.unitKerja}</p>
              </div>
              <div>
                <p className="font-bold underline capitalize">{user.pengawasName || 'Dianty Subagiarty'}</p>
                <p>NIP. {user.pengawasNip || '198301112009042006'}</p>
              </div>
            </div>
            <div className="space-y-16">
              <div>
                <p>Jakarta, {(() => {
                  try {
                    return format(new Date(), 'dd MMMM yyyy', { locale: id });
                  } catch (e) {
                    return '';
                  }
                })()}</p>
                <p>Petugas Teknisi</p>
                <p>{user.unitKerja}</p>
              </div>
              <div>
                <p className="font-bold underline capitalize">{user.name}</p>
                <p>ID PJLP. {user.idPjlp}</p>
              </div>
            </div>
          </div>

          <div className="text-center text-xs space-y-16">
            <div>
              <p>Mengetahui,</p>
              <p>Kepala Satuan Pelaksana Prasarana dan Sarana</p>
              <p>{user.unitKerja}</p>
            </div>
            <div>
              <p className="font-bold underline capitalize">{user.kepalaSatuanName || 'Wahyu Hidayat'}</p>
              <p>NIP. {user.kepalaSatuanNip || '198303142010011020'}</p>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { 
            background: none !important; 
            -webkit-print-color-adjust: exact;
          }
          .page-break-after-always { 
            page-break-after: always; 
            break-after: always;
          }
          .break-inside-avoid { 
            break-inside: avoid; 
            page-break-inside: avoid; 
          }
          table { 
            page-break-inside: auto; 
          }
          tr { 
            page-break-inside: avoid; 
            page-break-after: auto; 
          }
          thead { 
            display: table-header-group; 
          }
          tfoot { 
            display: table-footer-group; 
          }
        }
      `}} />
    </div>
  );
});

ReportPreview.displayName = 'ReportPreview';
export default ReportPreview;
