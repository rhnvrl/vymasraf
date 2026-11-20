import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { requireAdmin, requireAuth, signSessionToken, type AuthRequest } from './src/middleware/auth.ts';
import {
  createExpenseRecord,
  createManagedUser,
  createPayoutRecord,
  deletePayoutRecord,
  ensureSeedData,
  getCompanySettings,
  getUserByEmail,
  listAuditLogs,
  listExpensesForUser,
  listPayoutsForUser,
  listUsers,
  softDeleteExpenseRecord,
  updateCompanySettings,
  updateExpenseRecord,
  updateExpenseStatusRecord,
  updateUserProfile,
} from './src/db/repository.ts';
import { parseReceiptImageWithGemini, parseVoiceExpenseWithGemini } from './src/lib/gemini-server.ts';
import {
  buildDateRangeStatement,
  computeAccountingSummaries,
  formatExpensesCsv,
  sanitizeExpenseForViewer,
  type UserRole,
} from './src/utils/accounting.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '15mb' }));

function serializeUser(u: Awaited<ReturnType<typeof getUserByEmail>>) {
  if (!u) return null;
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    fullName: u.fullName,
    role: u.role as UserRole,
    department: u.department,
    phone: u.phone,
    iban: u.iban,
    monthlyBudgetLimit: u.monthlyBudgetLimit,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}

// Dynamic PWA Manifest reflecting Admin-uploaded company name & mobile icon
app.get('/manifest.webmanifest', async (_req, res) => {
  try {
    const settings = await getCompanySettings();
    const hasCustomIcon = Boolean(settings.pwaIconDataUrl);
    const icons = hasCustomIcon
      ? [
          { src: '/api/pwa/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/api/pwa/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      : [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ];

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
      id: '/',
      name: settings.companyName || 'Kurum Masraf Takip',
      short_name: (settings.shortName || 'MasrafPro').slice(0, 12),
      description: 'Kurumsal mobil masraf takip, fiş okutma ve muhasebe denetim uygulaması.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#0F766E',
      background_color: '#F8FAFC',
      icons,
    });
  } catch (error) {
    console.error('Manifest route error:', error);
    res.status(500).json({ error: 'Manifest oluşturulamadı.' });
  }
});

app.get('/api/pwa/icon/:size', async (req, res) => {
  try {
    const settings = await getCompanySettings();
    if (settings.pwaIconDataUrl) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(settings.pwaIconDataUrl);
      if (match) {
        res.setHeader('Content-Type', match[1]);
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(Buffer.from(match[2], 'base64'));
      }
    }
    const fallbackFile = req.params.size === '192' ? 'pwa-192x192.png' : 'pwa-512x512.png';
    const filePath = path.resolve(process.cwd(), 'public', fallbackFile);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    return res.status(404).end();
  } catch (error) {
    console.error('PWA icon error:', error);
    return res.status(500).end();
  }
});

// Public company branding (used on login screen & header before login)
app.get('/api/company/public', async (_req, res) => {
  try {
    const settings = await getCompanySettings();
    res.json({
      companyName: settings.companyName,
      shortName: settings.shortName,
      logoDataUrl: settings.logoDataUrl,
      pwaIconDataUrl: settings.pwaIconDataUrl,
      setupCompleted: settings.setupCompleted,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Şirket bilgisi alınamadı.' });
  }
});

// Password Login
app.post('/api/auth/login', async (req, res) => {
  try {
    await ensureSeedData();
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
    }
    const user = await getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Hesabınız pasif durumdadır.' });
    }
    const token = signSessionToken({ id: user.id, uid: user.uid, role: user.role });
    res.json({ token, user: serializeUser(user) });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Giriş yapılamadı.' });
  }
});

// Quick Demo Role Login (for instant evaluation / ?autostart=1 without bypassing auth)
app.post('/api/auth/demo-login', async (req, res) => {
  try {
    await ensureSeedData();
    const { role } = req.body as { role?: UserRole };
    const emailMap: Record<UserRole, string> = {
      admin: 'admin@firma.com',
      ortak: 'ortak@firma.com',
      calisan: 'calisan@firma.com',
    };
    const targetEmail = emailMap[role || 'admin'] || emailMap.admin;
    const user = await getUserByEmail(targetEmail);
    if (!user) {
      return res.status(404).json({ error: 'Demo kullanıcısı bulunamadı.' });
    }
    const token = signSessionToken({ id: user.id, uid: user.uid, role: user.role });
    res.json({ token, user: serializeUser(user) });
  } catch (error: any) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: error.message || 'Demo oturumu açılamadı.' });
  }
});

// Current authenticated user + company settings
app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const settings = await getCompanySettings();
    res.json({
      user: serializeUser(req.authUser!),
      company: settings,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Profil yüklenemedi.' });
  }
});

// Update own profile & password (Çalışan, Ortak, Admin)
app.patch('/api/me/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.authUser!;
    const { fullName, department, phone, iban, currentPassword, newPassword } = req.body as {
      fullName?: string;
      department?: string;
      phone?: string;
      iban?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır.' });
      }
      if (actor.passwordHash) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Şifre değiştirmek için mevcut şifrenizi girin.' });
        }
        const ok = await bcrypt.compare(currentPassword, actor.passwordHash);
        if (!ok) {
          return res.status(400).json({ error: 'Mevcut şifreniz eşleşmiyor.' });
        }
      }
    }

    const updated = await updateUserProfile(actor.id, {
      fullName,
      department,
      phone,
      iban,
      newPassword,
    });

    res.json({ user: serializeUser(updated) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Profil güncellenemedi.' });
  }
});

// Admin: Company initial setup, logo, PWA mobile icon, budget rules
app.put('/api/company/settings', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const updated = await updateCompanySettings(req.body);
    res.json({ company: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Şirket ayarları kaydedilemedi.' });
  }
});

// Admin: List & manage users / partners / employees
app.get('/api/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const all = await listUsers();
    res.json({ users: all.map(serializeUser) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Kullanıcılar alınamadı.' });
  }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, fullName, role, department, phone, iban, monthlyBudgetLimit, password } = req.body;
    if (!email || !fullName || !password) {
      return res.status(400).json({ error: 'Ad soyad, e-posta ve başlangıç şifresi zorunludur.' });
    }
    const created = await createManagedUser({
      email,
      fullName,
      role: (['admin', 'ortak', 'calisan'].includes(role) ? role : 'calisan') as UserRole,
      department: department || 'Genel',
      phone: phone || '',
      iban: iban || '',
      monthlyBudgetLimit: Number(monthlyBudgetLimit) || 15000,
      password,
    });
    res.status(201).json({ user: serializeUser(created) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Kullanıcı eklenemedi.' });
  }
});

app.patch('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ error: 'Geçersiz kullanıcı ID.' });
    }
    const updated = await updateUserProfile(targetId, req.body);
    res.json({ user: serializeUser(updated) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Kullanıcı güncellenemedi.' });
  }
});

// Expenses CRUD + RBAC Coordinate Privacy
app.get('/api/expenses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const viewer = req.authUser!;
    const [rawExpenses, payoutList] = await Promise.all([
      listExpensesForUser(viewer),
      listPayoutsForUser(viewer),
    ]);
    const sanitized = rawExpenses.map((exp) =>
      sanitizeExpenseForViewer(exp, viewer.role as UserRole)
    );
    const summaries = computeAccountingSummaries(sanitized, payoutList);
    res.json({ expenses: sanitized, payouts: payoutList, summaries });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Masraflar alınamadı.' });
  }
});

app.post('/api/expenses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.authUser!;
    const { merchant, amount, category, expenseDate } = req.body;
    if (!merchant || !String(merchant).trim()) {
      return res.status(400).json({ error: 'Satıcı veya kurum adı zorunludur.' });
    }
    if (!(Number(amount) > 0)) {
      return res.status(400).json({ error: 'Tutar 0 TL üzerinde olmalıdır.' });
    }
    if (!category || !expenseDate) {
      return res.status(400).json({ error: 'Kategori ve tarih alanları zorunludur.' });
    }

    const result = await createExpenseRecord(actor, {
      ...req.body,
      targetUserId: actor.role === 'admin' && req.body.targetUserId ? Number(req.body.targetUserId) : undefined,
      amount: Number(amount),
      vatRate: 0,
    });

    if (result.duplicateWarning) {
      return res.status(409).json({
        error: 'Mükerrer fiş/fatura tespit edildi.',
        duplicate: sanitizeExpenseForViewer(result.duplicateWarning, actor.role as UserRole),
      });
    }

    const sanitized = sanitizeExpenseForViewer(result.created!, actor.role as UserRole);
    res.status(201).json({ expense: sanitized });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Masraf kaydedilemedi.' });
  }
});

app.patch('/api/expenses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.authUser!;
    const expenseId = Number(req.params.id);
    if (!Number.isFinite(expenseId)) {
      return res.status(400).json({ error: 'Geçersiz masraf ID.' });
    }
    const { merchant, amount, category, expenseDate } = req.body;
    if (merchant !== undefined && !String(merchant).trim()) {
      return res.status(400).json({ error: 'Satıcı veya yer adı boş bırakılamaz.' });
    }
    if (amount !== undefined && !(Number(amount) > 0)) {
      return res.status(400).json({ error: 'Tutar 0 TL üzerinde olmalıdır.' });
    }

    const result = await updateExpenseRecord(expenseId, actor, {
      targetUserId: actor.role === 'admin' && req.body.targetUserId ? Number(req.body.targetUserId) : undefined,
      merchant,
      receiptNumber: req.body.receiptNumber,
      category: category || undefined,
      paymentMethod: req.body.paymentMethod,
      amount: amount !== undefined ? Number(amount) : undefined,
      expenseDate: expenseDate || undefined,
      description: req.body.description,
      receiptImageDataUrl: req.body.receiptImageDataUrl,
      editReason: req.body.editReason,
    });

    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Masraf kaydı bulunamadı.' });
    }
    if (result.status === 'forbidden') {
      return res.status(403).json({ error: 'Yalnızca kendi girdiğiniz masrafları düzenleyebilirsiniz.' });
    }

    res.json({ expense: sanitizeExpenseForViewer(result.updated!, actor.role as UserRole) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Masraf güncellenemedi.' });
  }
});

app.delete('/api/expenses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.authUser!;
    const expenseId = Number(req.params.id);
    if (!Number.isFinite(expenseId)) {
      return res.status(400).json({ error: 'Geçersiz masraf ID.' });
    }
    const reason = (req.body?.reason as string) || (req.query.reason as string) || 'Kullanıcı tarafından silindi';
    const result = await softDeleteExpenseRecord(expenseId, actor, reason);
    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Masraf kaydı bulunamadı.' });
    }
    if (result.status === 'forbidden') {
      return res.status(403).json({ error: 'Yalnızca kendi girdiğiniz masrafları silebilirsiniz.' });
    }
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Masraf silinemedi.' });
  }
});

app.patch('/api/expenses/:id/status', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const expenseId = Number(req.params.id);
    const { status, rejectionReason } = req.body as {
      status?: 'beklemede' | 'onaylandi' | 'odendi' | 'reddedildi';
      rejectionReason?: string;
    };
    if (!status || !['beklemede', 'onaylandi', 'odendi', 'reddedildi'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz onay durumu.' });
    }
    const updated = await updateExpenseStatusRecord(expenseId, req.authUser!, status, rejectionReason);
    if (!updated) {
      return res.status(404).json({ error: 'Masraf bulunamadı.' });
    }
    res.json({ expense: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Durum güncellenemedi.' });
  }
});

// CSV Export for Accountant / Luca / Logo / Mikro import
app.get('/api/expenses/export.csv', requireAuth, async (req: AuthRequest, res) => {
  try {
    const viewer = req.authUser!;
    const raw = await listExpensesForUser(viewer);
    const isAdmin = viewer.role === 'admin';
    const csv = formatExpensesCsv(raw, isAdmin);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="masraf-dokumu-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'CSV oluşturulamadı.' });
  }
});

// Admin-only Audit Log & Deleted Expenses History
app.get('/api/audit-logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const onlyDeleted = req.query.onlyDeleted === 'true';
    const logs = await listAuditLogs(onlyDeleted);
    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Denetim kayıtları alınamadı.' });
  }
});

// Payouts (Toplu Ödeme Girişi & Listeleme)
app.get('/api/payouts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await listPayoutsForUser(req.authUser!);
    res.json({ payouts: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ödemeler alınamadı.' });
  }
});

app.post('/api/payouts', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId, amount, payoutDate, paymentChannel, referenceNo, description } = req.body;
    if (!Number(userId) || !(Number(amount) > 0) || !payoutDate) {
      return res.status(400).json({ error: 'Kişi, tutar (0 üstü) ve tarih alanları zorunludur.' });
    }
    const created = await createPayoutRecord(req.authUser!, {
      userId: Number(userId),
      amount: Number(amount),
      payoutDate: String(payoutDate),
      paymentChannel: paymentChannel || 'havale_eft',
      referenceNo,
      description,
    });
    res.status(201).json({ payout: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Toplu ödeme kaydedilemedi.' });
  }
});

app.delete('/api/payouts/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Geçersiz ödeme ID.' });
    }
    const deleted = await deletePayoutRecord(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Ödeme kaydı bulunamadı.' });
    }
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ödeme kaydı silinemedi.' });
  }
});

// Date-Range Statement & Balance Report (Admin: all/filtered users, Partner/Employee: own only)
app.get('/api/reports/statement', requireAuth, async (req: AuthRequest, res) => {
  try {
    const viewer = req.authUser!;
    const startDate = String(req.query.startDate || '2026-01-01');
    const endDate = String(req.query.endDate || new Date().toISOString().slice(0, 10));
    const userIdParam = String(req.query.userId || 'all');
    const categoryParam = String(req.query.category || 'all');

    const filterUserId: number | 'all' =
      viewer.role === 'admin'
        ? userIdParam === 'all'
          ? 'all'
          : Number(userIdParam)
        : viewer.id;

    const [rawExpenses, payoutList] = await Promise.all([
      listExpensesForUser(viewer),
      listPayoutsForUser(viewer),
    ]);

    const sanitized = rawExpenses.map((exp) =>
      sanitizeExpenseForViewer(exp, viewer.role as UserRole)
    );

    const statement = buildDateRangeStatement(
      sanitized,
      payoutList,
      startDate,
      endDate,
      filterUserId,
      categoryParam
    );
    res.json({ statement });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Tarih aralığı raporu oluşturulamadı.' });
  }
});

// Server-side Gemini OCR & Voice Expense Parsing
app.post('/api/ai/scan-receipt', requireAuth, async (req, res) => {
  try {
    const { imageDataUrl } = req.body as { imageDataUrl?: string };
    if (!imageDataUrl) {
      return res.status(400).json({ error: 'Fiş veya fatura görseli gereklidir.' });
    }
    const parsed = await parseReceiptImageWithGemini(imageDataUrl);
    res.json({ parsed });
  } catch (error: any) {
    console.error('Receipt scan error:', error);
    res.status(502).json({ error: error.message || 'Fiş okuma servisi şu anda yanıt veremedi.' });
  }
});

app.post('/api/ai/parse-voice', requireAuth, async (req, res) => {
  try {
    const { audioDataUrl, transcriptText } = req.body as {
      audioDataUrl?: string;
      transcriptText?: string;
    };
    if (!audioDataUrl && !transcriptText) {
      return res.status(400).json({ error: 'Ses kaydı veya sesli metin gereklidir.' });
    }
    const parsed = await parseVoiceExpenseWithGemini({ audioDataUrl, transcriptText });
    res.json({ parsed });
  } catch (error: any) {
    console.error('Voice parse error:', error);
    res.status(502).json({ error: error.message || 'Sesli masraf çözümlenemedi.' });
  }
});

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    // Prevent Vite 8's /@vite/client from opening a failing WebSocket in proxy/HMR-disabled environments
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) return next();
        const patchedCode = result.code.replace(
          'const createWebSocketModuleRunnerTransport = (options) => {',
          'const createWebSocketModuleRunnerTransport = () => ({ connect: async () => {}, disconnect: async () => {}, send: () => {} }); const _disabledCreateWsTransport = (options) => {'
        );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(patchedCode);
      } catch {
        return next();
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
