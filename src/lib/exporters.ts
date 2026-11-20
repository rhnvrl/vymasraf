import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type { AccountingSummaries, CompanySettings, DateRangeStatement } from '../types';

const formatTry = (val: number) =>
  val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';

export function exportStatementToXlsx(
  statement: DateRangeStatement,
  summaries: AccountingSummaries,
  company: CompanySettings,
  filterLabel: string,
  includeCoordinates = false
) {
  const wb = XLSX.utils.book_new();

  const summaryRows: Array<Array<string | number>> = [
    [company.companyName, '', '', '', '', '', '', ''],
    [`Masraf & Bakiye Raporu (${filterLabel})`, '', '', '', '', '', '', ''],
    [`Tarih Aralığı: ${statement.startDate} - ${statement.endDate}`, '', '', '', '', '', '', ''],
    [],
    ['Dönem Başı Devir Alacak Bakiyesi', statement.openingBalance, 'TL'],
    ['Dönem İçi Toplam Masraf', statement.periodExpenseTotal, 'TL'],
    ['Dönem İçi Alacak Harcamalar', statement.periodReimbursableTotal, 'TL'],
    ['Dönem İçi Yapılan Ödemeler', statement.periodPayoutTotal, 'TL'],
    ['Dönem Sonu Alacak Bakiyesi', statement.closingBalance, 'TL'],
    [],
    [
      'Tarih',
      'İşlem Türü',
      'Kullanıcı',
      'Yer / Ödeme Kanalı',
      'Kategori / Açıklama',
      'Tutar (TL)',
      'Bakiye Etkisi (+/-)',
      'Yürüyen Bakiye (TL)',
      ...(includeCoordinates ? ['Konum (Enlem, Boylam)'] : []),
    ],
  ];

  for (const m of statement.movements) {
    const row: Array<string | number> = [
      m.date,
      m.type === 'masraf' ? 'Masraf' : 'Ödeme',
      m.userName,
      m.title,
      m.detail,
      m.grossAmount,
      m.receivableEffect,
      m.runningBalance,
    ];
    if (includeCoordinates) {
      row.push(
        typeof m.latitude === 'number' && typeof m.longitude === 'number'
          ? `${m.latitude.toFixed(5)}, ${m.longitude.toFixed(5)}`
          : ''
      );
    }
    summaryRows.push(row);
  }

  const wsMovements = XLSX.utils.aoa_to_sheet(summaryRows);
  wsMovements['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 28 },
    { wch: 38 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    ...(includeCoordinates ? [{ wch: 22 }] : []),
  ];
  XLSX.utils.book_append_sheet(wb, wsMovements, 'Hareket Dökümü');

  if (includeCoordinates && summaries.userBalances.length > 0) {
    const balanceRows: Array<Array<string | number>> = [
      ['Kişi', 'Rol', 'Alacak Harcamaları', 'Yapılan Ödemeler', 'Kalan Alacak Bakiyesi', 'Şirket Kartı', 'Toplam Masraf'],
      ...summaries.userBalances.map((u) => [
        u.userName,
        u.role === 'ortak' ? 'Ortak' : u.role === 'admin' ? 'Admin' : 'Çalışan',
        u.reimbursablePending,
        u.payoutsTotal,
        u.netReceivableBalance,
        u.companyCardTotal,
        u.totalSpent,
      ]),
    ];
    const wsBalances = XLSX.utils.aoa_to_sheet(balanceRows);
    wsBalances['!cols'] = [
      { wch: 24 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsBalances, 'Kullanıcı Bakiyeleri');
  }

  XLSX.writeFile(wb, `masraf-raporu-${statement.startDate}_${statement.endDate}.xlsx`);
}

function renderStatementCanvases(
  statement: DateRangeStatement,
  company: CompanySettings,
  filterLabel: string
): HTMLCanvasElement[] {
  const PAGE_W = 1240;
  const PAGE_H = 1754; // A4 proportion at ~150 DPI
  const PAD = 64;
  const ROW_H = 52;

  const pages: HTMLCanvasElement[] = [];

  const createPageCanvas = (pageNum: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    ctx.fillStyle = '#0F766E';
    ctx.fillRect(0, 0, PAGE_W, 12);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(company.companyName || 'Masraf Raporu', PAD, 68);

    ctx.fillStyle = '#475569';
    ctx.font = '18px "DM Sans", sans-serif';
    ctx.fillText(
      `Masraf & Bakiye Raporu · ${filterLabel} · ${statement.startDate} / ${statement.endDate}`,
      PAD,
      100
    );

    ctx.fillStyle = '#64748B';
    ctx.font = '15px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Sayfa ${pageNum}`, PAGE_W - PAD, 68);
    ctx.fillText(`Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}`, PAGE_W - PAD, 96);
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD, 122);
    ctx.lineTo(PAGE_W - PAD, 122);
    ctx.stroke();

    return { canvas, ctx };
  };

  let pageNum = 1;
  let { canvas, ctx } = createPageCanvas(pageNum);
  let y = 148;

  // Summary Balance Boxes on Page 1
  const cardW = (PAGE_W - PAD * 2 - 48) / 4;
  const cards = [
    { label: 'DÖNEM BAŞI DEVİR', value: formatTry(statement.openingBalance), color: '#0F172A' },
    { label: 'DÖNEM İÇİ MASRAF', value: formatTry(statement.periodExpenseTotal), color: '#0F172A' },
    { label: 'YAPILAN ÖDEMELER', value: formatTry(statement.periodPayoutTotal), color: '#0F766E' },
    { label: 'DÖNEM SONU BAKİYE', value: formatTry(statement.closingBalance), color: '#B45309' },
  ];

  cards.forEach((c, idx) => {
    const cx = PAD + idx * (cardW + 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx, y, cardW, 92);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, y, cardW, 92);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 13px "DM Sans", sans-serif';
    ctx.fillText(c.label, cx + 16, y + 30);

    ctx.fillStyle = c.color;
    ctx.font = 'bold 21px "JetBrains Mono", monospace';
    ctx.fillText(c.value, cx + 16, y + 66);
  });

  y += 126;

  const drawTableHeader = (currCtx: CanvasRenderingContext2D, startY: number) => {
    currCtx.fillStyle = '#0F172A';
    currCtx.fillRect(PAD, startY, PAGE_W - PAD * 2, 40);
    currCtx.fillStyle = '#FFFFFF';
    currCtx.font = 'bold 14px "DM Sans", sans-serif';
    currCtx.fillText('Tarih', PAD + 12, startY + 25);
    currCtx.fillText('Kişi', PAD + 130, startY + 25);
    currCtx.fillText('İşlem / Satıcı & Açıklama', PAD + 310, startY + 25);
    currCtx.textAlign = 'right';
    currCtx.fillText('Tutar', PAGE_W - PAD - 190, startY + 25);
    currCtx.fillText('Yürüyen Bakiye', PAGE_W - PAD - 14, startY + 25);
    currCtx.textAlign = 'left';
    return startY + 40;
  };

  y = drawTableHeader(ctx, y);

  if (statement.movements.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '18px "DM Sans", sans-serif';
    ctx.fillText('Seçilen tarih aralığında kayıtlı hareket bulunmamaktadır.', PAD + 16, y + 48);
  } else {
    statement.movements.forEach((m, index) => {
      if (y + ROW_H > PAGE_H - 90) {
        pages.push(canvas);
        pageNum += 1;
        const next = createPageCanvas(pageNum);
        canvas = next.canvas;
        ctx = next.ctx;
        y = drawTableHeader(ctx, 148);
      }

      if (index % 2 === 1) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(PAD, y, PAGE_W - PAD * 2, ROW_H);
      }

      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(PAD, y + ROW_H);
      ctx.lineTo(PAGE_W - PAD, y + ROW_H);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.fillText(m.date, PAD + 12, y + 31);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "DM Sans", sans-serif';
      ctx.fillText(m.userName.slice(0, 18), PAD + 130, y + 31);

      ctx.fillStyle = m.type === 'odeme' ? '#0F766E' : '#0F172A';
      ctx.font = 'bold 14px "DM Sans", sans-serif';
      ctx.fillText(m.title.slice(0, 36), PAD + 310, y + 22);

      ctx.fillStyle = '#64748B';
      ctx.font = '12px "DM Sans", sans-serif';
      ctx.fillText(m.detail.slice(0, 48), PAD + 310, y + 41);

      ctx.textAlign = 'right';
      ctx.fillStyle = m.type === 'odeme' ? '#0F766E' : '#0F172A';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      const prefix = m.type === 'odeme' ? '-' : '+';
      ctx.fillText(`${prefix}${formatTry(m.grossAmount)}`, PAGE_W - PAD - 190, y + 31);

      ctx.fillStyle = '#0F172A';
      ctx.fillText(formatTry(m.runningBalance), PAGE_W - PAD - 14, y + 31);
      ctx.textAlign = 'left';

      y += ROW_H;
    });
  }

  pages.push(canvas);
  return pages;
}

export function exportStatementToImage(
  statement: DateRangeStatement,
  company: CompanySettings,
  filterLabel: string,
  format: 'png' | 'jpg'
) {
  const canvases = renderStatementCanvases(statement, company, filterLabel);
  const firstCanvas = canvases[0];
  if (!firstCanvas) return;

  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const dataUrl = firstCanvas.toDataURL(mime, 0.94);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `masraf-raporu-${statement.startDate}_${statement.endDate}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportStatementToPdf(
  statement: DateRangeStatement,
  company: CompanySettings,
  filterLabel: string
) {
  const canvases = renderStatementCanvases(statement, company, filterLabel);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  canvases.forEach((canvas, idx) => {
    if (idx > 0) doc.addPage();
    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
  });

  doc.save(`masraf-raporu-${statement.startDate}_${statement.endDate}.pdf`);
}
