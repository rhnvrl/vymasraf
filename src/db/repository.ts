import bcrypt from 'bcryptjs';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, insertAndFetchById } from './index.ts';
import { companySettings, expenseAuditLogs, expenses, payouts, users } from './schema.ts';
import {
  calculateVatBreakdown,
  findPotentialDuplicate,
  suggestAccountCodeForCategory,
  type UserRole,
} from '../utils/accounting.ts';

export type DbUser = typeof users.$inferSelect;
export type DbExpense = typeof expenses.$inferSelect;
export type DbCompanySettings = typeof companySettings.$inferSelect;
export type DbAuditLog = typeof expenseAuditLogs.$inferSelect;
export type DbPayout = typeof payouts.$inferSelect;

let seedPromise: Promise<void> | null = null;

export async function ensureSeedData(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const existingSettings = await db.select().from(companySettings).limit(1);
      if (existingSettings.length === 0) {
        await db.insert(companySettings).values({
          companyName: 'Anadolu Mühendislik ve Danışmanlık A.Ş.',
          shortName: 'MasrafPro',
          taxNumber: '1234567890',
          taxOffice: 'Büyük Mükellefler V.D.',
          monthlyCompanyBudget: 120000,
          requireReceiptAboveAmount: 500,
          setupCompleted: false,
        });
      }

      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length === 0) {
        const adminHash = await bcrypt.hash('Admin123!', 10);
        const ortakHash = await bcrypt.hash('Ortak123!', 10);
        const calisanHash = await bcrypt.hash('Calisan123!', 10);

        await db.insert(users).values([
          {
            uid: 'demo-admin-uid',
            email: 'admin@firma.com',
            fullName: 'Selim Yılmaz',
            role: 'admin',
            department: 'Mali İşler & Yönetim',
            phone: '0532 100 20 30',
            iban: 'TR33 0006 1005 1978 6457 8413 26',
            passwordHash: adminHash,
            monthlyBudgetLimit: 50000,
            isActive: true,
          },
          {
            uid: 'demo-ortak-uid',
            email: 'ortak@firma.com',
            fullName: 'Ayşe Demir',
            role: 'ortak',
            department: 'Yönetici Ortak',
            phone: '0533 210 45 60',
            iban: 'TR12 0006 2000 1234 5678 9012 34',
            passwordHash: ortakHash,
            monthlyBudgetLimit: 35000,
            isActive: true,
          },
          {
            uid: 'demo-calisan-uid',
            email: 'calisan@firma.com',
            fullName: 'Mehmet Kaya',
            role: 'calisan',
            department: 'Saha Satış',
            phone: '0544 320 78 90',
            iban: 'TR56 0004 6000 9876 5432 1098 76',
            passwordHash: calisanHash,
            monthlyBudgetLimit: 15000,
            isActive: true,
          },
        ]);

        const seededUsers = await db.select().from(users).orderBy(users.id);
        const adminUser = seededUsers.find((u) => u.email === 'admin@firma.com');
        const ortakUser = seededUsers.find((u) => u.email === 'ortak@firma.com');
        const calisanUser = seededUsers.find((u) => u.email === 'calisan@firma.com');

        if (adminUser && ortakUser && calisanUser) {
          const vat1 = calculateVatBreakdown(2460, 0);
          const vat2 = calculateVatBreakdown(1650, 0);
          const vat3 = calculateVatBreakdown(3840, 0);
          const vat4 = calculateVatBreakdown(890, 0);

          await db.insert(expenses).values([
            {
              userId: calisanUser.id,
              merchant: 'Anadolu Akaryakıt A.Ş.',
              merchantTaxId: '0123456789',
              receiptNumber: '0482',
              documentType: 'fis',
              category: 'Akaryakıt & Ulaşım',
              accountCode: '760',
              costCenter: 'Marmara Saha',
              paymentMethod: 'kisisel_kart',
              amount: vat1.grossAmount,
              vatRate: 0,
              vatAmount: 0,
              netAmount: vat1.grossAmount,
              expenseDate: '2026-11-17',
              description: 'Bursa müşteri ziyareti dizel yakıt fişi',
              voiceTranscript: '',
              latitude: 41.0082,
              longitude: 28.9784,
              locationAccuracy: 14,
              status: 'onaylandi',
              isDeleted: false,
            },
            {
              userId: ortakUser.id,
              merchant: 'Boğaziçi Restoran Ltd.',
              merchantTaxId: '9876543210',
              receiptNumber: 'FTR-2026-118',
              documentType: 'fatura',
              category: 'Yemek & Temsil',
              accountCode: '770',
              costCenter: 'Yönetim',
              paymentMethod: 'ortak_cari',
              amount: vat2.grossAmount,
              vatRate: 0,
              vatAmount: 0,
              netAmount: vat2.grossAmount,
              expenseDate: '2026-11-16',
              description: 'Tedarikçi sözleşme yemeği',
              voiceTranscript: '',
              latitude: 41.0422,
              longitude: 29.0067,
              locationAccuracy: 9,
              status: 'onaylandi',
              reviewedByUserId: adminUser.id,
              reviewedAt: new Date(),
              isDeleted: false,
            },
            {
              userId: ortakUser.id,
              merchant: 'Hilton Ankara Konaklama',
              merchantTaxId: '5544332211',
              receiptNumber: 'EF-99421',
              documentType: 'e-fatura',
              category: 'Konaklama',
              accountCode: '760',
              costCenter: 'Ankara Proje',
              paymentMethod: 'sirket_karti',
              amount: vat3.grossAmount,
              vatRate: 0,
              vatAmount: 0,
              netAmount: vat3.grossAmount,
              expenseDate: '2026-11-14',
              description: 'Bakanlık ihale toplantısı 1 gece konaklama',
              voiceTranscript: '',
              latitude: 39.9044,
              longitude: 32.8597,
              locationAccuracy: 18,
              status: 'onaylandi',
              reviewedByUserId: adminUser.id,
              reviewedAt: new Date(),
              isDeleted: false,
            },
            {
              userId: calisanUser.id,
              merchant: 'Hızlı Kafe & Bistro',
              merchantTaxId: '1122334455',
              receiptNumber: '0119',
              documentType: 'fis',
              category: 'Yemek & Temsil',
              accountCode: '770',
              costCenter: 'Marmara Saha',
              paymentMethod: 'kisisel_kart',
              amount: vat4.grossAmount,
              vatRate: 0,
              vatAmount: 0,
              netAmount: vat4.grossAmount,
              expenseDate: '2026-11-12',
              description: 'Yanlış tarihle girilen deneme fişi',
              voiceTranscript: '',
              latitude: 40.9912,
              longitude: 29.0275,
              locationAccuracy: 22,
              status: 'onaylandi',
              isDeleted: true,
              deletedAt: new Date(),
              deletedByUserId: calisanUser.id,
              deleteReason: 'Tutar hatalı girildi, yeniden yüklenecek',
            },
          ]);

          const deletedSamples = await db
            .select()
            .from(expenses)
            .where(eq(expenses.isDeleted, true))
            .orderBy(desc(expenses.id))
            .limit(1);
          const deletedSample = deletedSamples[0];
          if (deletedSample) {
            await db.insert(expenseAuditLogs).values({
              expenseId: deletedSample.id,
              action: 'deleted',
              actorUserId: calisanUser.id,
              actorName: calisanUser.fullName,
              actorRole: calisanUser.role,
              ownerUserId: calisanUser.id,
              ownerName: calisanUser.fullName,
              merchant: deletedSample.merchant,
              amount: deletedSample.amount,
              expenseDate: deletedSample.expenseDate,
              reason: 'Tutar hatalı girildi, yeniden yüklenecek',
              latitude: deletedSample.latitude,
              longitude: deletedSample.longitude,
              snapshotJson: JSON.stringify({
                receiptNumber: deletedSample.receiptNumber,
                category: deletedSample.category,
                vatRate: deletedSample.vatRate,
                paymentMethod: deletedSample.paymentMethod,
              }),
            });
          }

          await db.insert(payouts).values({
            userId: calisanUser.id,
            amount: 1000,
            payoutDate: '2026-11-17',
            paymentChannel: 'havale_eft',
            referenceNo: 'EFT-20261117',
            description: 'Saha masraf avansı / kısmi ödeme',
            createdByAdminId: adminUser.id,
          });
        }
      }
    } catch (error) {
      seedPromise = null;
      console.error('Seed data initialization failed:', error);
      throw new Error('Başlangıç verileri yüklenemedi.', { cause: error });
    }
  })();
  return seedPromise;
}

export async function getUserById(id: number): Promise<DbUser | null> {
  try {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database getUserById failed:', error);
    throw new Error('Kullanıcı bilgisi alınamadı.', { cause: error });
  }
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database getUserByEmail failed:', error);
    throw new Error('Kullanıcı sorgusu başarısız.', { cause: error });
  }
}

export async function getOrCreateUserByUid(
  uid: string,
  email: string,
  fullName: string
): Promise<DbUser> {
  try {
    const normEmail = email.trim().toLowerCase();
    const existingByEmail = await getUserByEmail(normEmail);
    if (existingByEmail) {
      await db
        .update(users)
        .set({ uid, updatedAt: new Date() })
        .where(eq(users.id, existingByEmail.id));
      return (await getUserById(existingByEmail.id))!;
    }

    const existingByUid = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existingByUid[0]) {
      await db
        .update(users)
        .set({ email: normEmail, updatedAt: new Date() })
        .where(eq(users.id, existingByUid[0].id));
      return (await getUserById(existingByUid[0].id))!;
    }

    const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
    const defaultRole: UserRole = Number(totalUsers[0]?.count ?? 0) === 0 ? 'admin' : 'calisan';

    return (await insertAndFetchById(users, {
      uid,
      email: normEmail,
      fullName,
      role: defaultRole,
    })) as DbUser;
  } catch (error) {
    console.error('Database getOrCreateUserByUid failed:', error);
    throw new Error('Kullanıcı profili senkronize edilemedi.', { cause: error });
  }
}

export async function listUsers(): Promise<DbUser[]> {
  try {
    return await db.select().from(users).orderBy(users.id);
  } catch (error) {
    console.error('Database listUsers failed:', error);
    throw new Error('Kullanıcı listesi alınamadı.', { cause: error });
  }
}

export async function createManagedUser(input: {
  email: string;
  fullName: string;
  role: UserRole;
  department: string;
  phone: string;
  iban: string;
  monthlyBudgetLimit: number;
  password: string;
}): Promise<DbUser> {
  try {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const uid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return (await insertAndFetchById(users, {
      uid,
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
      role: input.role,
      department: input.department.trim() || 'Genel',
      phone: input.phone.trim(),
      iban: input.iban.trim(),
      monthlyBudgetLimit: input.monthlyBudgetLimit,
      passwordHash,
      isActive: true,
    })) as DbUser;
  } catch (error) {
    console.error('Database createManagedUser failed:', error);
    throw new Error('Yeni kullanıcı oluşturulamadı (e-posta kayıtlı olabilir).', { cause: error });
  }
}

export async function updateUserProfile(
  userId: number,
  updates: {
    fullName?: string;
    department?: string;
    phone?: string;
    iban?: string;
    newPassword?: string;
    role?: UserRole;
    monthlyBudgetLimit?: number;
    isActive?: boolean;
  }
): Promise<DbUser> {
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.fullName !== undefined) patch.fullName = updates.fullName.trim();
    if (updates.department !== undefined) patch.department = updates.department.trim();
    if (updates.phone !== undefined) patch.phone = updates.phone.trim();
    if (updates.iban !== undefined) patch.iban = updates.iban.trim();
    if (updates.role !== undefined) patch.role = updates.role;
    if (updates.monthlyBudgetLimit !== undefined) patch.monthlyBudgetLimit = updates.monthlyBudgetLimit;
    if (updates.isActive !== undefined) patch.isActive = updates.isActive;
    if (updates.newPassword && updates.newPassword.length >= 6) {
      patch.passwordHash = await bcrypt.hash(updates.newPassword, 10);
    }

    await db.update(users).set(patch).where(eq(users.id, userId));
    const refreshed = await getUserById(userId);
    if (!refreshed) {
      throw new Error('Kullanıcı bulunamadı.');
    }
    return refreshed;
  } catch (error) {
    console.error('Database updateUserProfile failed:', error);
    throw new Error('Profil güncellenemedi.', { cause: error });
  }
}

export async function getCompanySettings(): Promise<DbCompanySettings> {
  try {
    await ensureSeedData();
    const rows = await db.select().from(companySettings).limit(1);
    return rows[0]!;
  } catch (error) {
    console.error('Database getCompanySettings failed:', error);
    throw new Error('Şirket ayarları alınamadı.', { cause: error });
  }
}

export async function updateCompanySettings(updates: {
  companyName?: string;
  shortName?: string;
  taxNumber?: string;
  taxOffice?: string;
  logoDataUrl?: string | null;
  pwaIconDataUrl?: string | null;
  monthlyCompanyBudget?: number;
  requireReceiptAboveAmount?: number;
  setupCompleted?: boolean;
}): Promise<DbCompanySettings> {
  try {
    const current = await getCompanySettings();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.companyName !== undefined) patch.companyName = updates.companyName.trim();
    if (updates.shortName !== undefined) patch.shortName = updates.shortName.trim().slice(0, 12);
    if (updates.taxNumber !== undefined) patch.taxNumber = updates.taxNumber.trim();
    if (updates.taxOffice !== undefined) patch.taxOffice = updates.taxOffice.trim();
    if (updates.logoDataUrl !== undefined) patch.logoDataUrl = updates.logoDataUrl;
    if (updates.pwaIconDataUrl !== undefined) patch.pwaIconDataUrl = updates.pwaIconDataUrl;
    if (updates.monthlyCompanyBudget !== undefined) patch.monthlyCompanyBudget = updates.monthlyCompanyBudget;
    if (updates.requireReceiptAboveAmount !== undefined) patch.requireReceiptAboveAmount = updates.requireReceiptAboveAmount;
    if (updates.setupCompleted !== undefined) patch.setupCompleted = updates.setupCompleted;

    await db.update(companySettings).set(patch).where(eq(companySettings.id, current.id));
    const rows = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.id, current.id))
      .limit(1);
    return rows[0]!;
  } catch (error) {
    console.error('Database updateCompanySettings failed:', error);
    throw new Error('Şirket ayarları güncellenemedi.', { cause: error });
  }
}

export async function listExpensesForUser(viewer: DbUser) {
  try {
    const baseQuery = db
      .select({
        expense: expenses,
        userName: users.fullName,
        userRole: users.role,
        userDepartment: users.department,
        userIban: users.iban,
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id));

    const rows =
      viewer.role === 'admin'
        ? await baseQuery
            .where(eq(expenses.isDeleted, false))
            .orderBy(desc(expenses.expenseDate), desc(expenses.id))
        : await baseQuery
            .where(and(eq(expenses.isDeleted, false), eq(expenses.userId, viewer.id)))
            .orderBy(desc(expenses.expenseDate), desc(expenses.id));

    return rows.map((r) => ({
      ...r.expense,
      userName: r.userName,
      userRole: r.userRole,
      userDepartment: r.userDepartment,
      userIban: r.userIban,
    }));
  } catch (error) {
    console.error('Database listExpensesForUser failed:', error);
    throw new Error('Masraflar listelenemedi.', { cause: error });
  }
}

export async function createExpenseRecord(
  actor: DbUser,
  input: {
    targetUserId?: number;
    merchant: string;
    merchantTaxId?: string;
    receiptNumber?: string;
    documentType?: string;
    category: string;
    accountCode?: string;
    costCenter?: string;
    paymentMethod?: string;
    amount: number;
    vatRate?: number;
    expenseDate: string;
    description?: string;
    receiptImageDataUrl?: string | null;
    voiceNoteDataUrl?: string | null;
    voiceTranscript?: string;
    latitude?: number | null;
    longitude?: number | null;
    locationAccuracy?: number | null;
    forceDuplicate?: boolean;
  }
) {
  try {
    let owner = actor;
    if (actor.role === 'admin' && input.targetUserId && input.targetUserId !== actor.id) {
      const target = await getUserById(input.targetUserId);
      if (target) {
        owner = target;
      }
    }

    const existingActive = await db
      .select()
      .from(expenses)
      .where(eq(expenses.isDeleted, false));

    const duplicate = findPotentialDuplicate(
      {
        merchant: input.merchant,
        receiptNumber: input.receiptNumber,
        amount: input.amount,
        expenseDate: input.expenseDate,
      },
      existingActive
    );

    if (duplicate && !input.forceDuplicate) {
      return { duplicateWarning: duplicate, created: null };
    }

    const breakdown = calculateVatBreakdown(input.amount, 0);
    const accountCode = input.accountCode || suggestAccountCodeForCategory(input.category);

    const created = (await insertAndFetchById(expenses, {
      userId: owner.id,
      merchant: input.merchant.trim(),
      merchantTaxId: (input.merchantTaxId || '').trim(),
      receiptNumber: (input.receiptNumber || '').trim(),
      documentType: input.documentType || 'fis',
      category: input.category,
      accountCode,
      costCenter: (input.costCenter || 'Merkez').trim(),
      paymentMethod: input.paymentMethod || (owner.role === 'ortak' ? 'ortak_cari' : 'kisisel_kart'),
      amount: breakdown.grossAmount,
      vatRate: 0,
      vatAmount: 0,
      netAmount: breakdown.grossAmount,
      currency: 'TRY',
      expenseDate: input.expenseDate,
      description: (input.description || '').trim(),
      receiptImageDataUrl: input.receiptImageDataUrl || null,
      voiceNoteDataUrl: input.voiceNoteDataUrl || null,
      voiceTranscript: (input.voiceTranscript || '').trim(),
      latitude: typeof input.latitude === 'number' ? input.latitude : null,
      longitude: typeof input.longitude === 'number' ? input.longitude : null,
      locationAccuracy: typeof input.locationAccuracy === 'number' ? input.locationAccuracy : null,
      status: 'onaylandi',
      isDeleted: false,
    })) as DbExpense;
    await db.insert(expenseAuditLogs).values({
      expenseId: created.id,
      action: 'created',
      actorUserId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      ownerUserId: owner.id,
      ownerName: owner.fullName,
      merchant: created.merchant,
      amount: created.amount,
      expenseDate: created.expenseDate,
      reason:
        actor.id !== owner.id
          ? `Admin (${actor.fullName}) tarafından ${owner.fullName} adına masraf girildi`
          : 'Yeni masraf kaydı eklendi',
      latitude: created.latitude,
      longitude: created.longitude,
      snapshotJson: JSON.stringify({
        receiptNumber: created.receiptNumber,
        category: created.category,
        paymentMethod: created.paymentMethod,
      }),
    });

    return { duplicateWarning: null, created };
  } catch (error) {
    console.error('Database createExpenseRecord failed:', error);
    throw new Error('Masraf kaydı oluşturulamadı.', { cause: error });
  }
}

export async function updateExpenseRecord(
  expenseId: number,
  actor: DbUser,
  updates: {
    targetUserId?: number;
    merchant?: string;
    receiptNumber?: string;
    category?: string;
    paymentMethod?: string;
    amount?: number;
    expenseDate?: string;
    description?: string;
    receiptImageDataUrl?: string | null;
    editReason?: string;
  }
) {
  try {
    const rows = await db
      .select({
        expense: expenses,
        ownerName: users.fullName,
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id))
      .where(and(eq(expenses.id, expenseId), eq(expenses.isDeleted, false)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { status: 'not_found' as const, updated: null };
    }
    if (row.expense.userId !== actor.id && actor.role !== 'admin') {
      return { status: 'forbidden' as const, updated: null };
    }

    const prev = row.expense;
    let nextOwnerId = prev.userId;
    let nextOwnerName = row.ownerName;

    if (actor.role === 'admin' && updates.targetUserId && updates.targetUserId !== prev.userId) {
      const target = await getUserById(updates.targetUserId);
      if (target) {
        nextOwnerId = target.id;
        nextOwnerName = target.fullName;
      }
    }

    const nextAmount =
      updates.amount !== undefined && updates.amount > 0
        ? calculateVatBreakdown(updates.amount, 0).grossAmount
        : prev.amount;
    const nextMerchant = updates.merchant !== undefined ? updates.merchant.trim() : prev.merchant;
    const nextCategory = updates.category !== undefined ? updates.category : prev.category;
    const nextDate = updates.expenseDate !== undefined ? updates.expenseDate : prev.expenseDate;
    const nextReceipt = updates.receiptNumber !== undefined ? updates.receiptNumber.trim() : prev.receiptNumber;
    const nextPayment = updates.paymentMethod !== undefined ? updates.paymentMethod : prev.paymentMethod;
    const nextDesc = updates.description !== undefined ? updates.description.trim() : prev.description;
    const nextReceiptImg =
      updates.receiptImageDataUrl !== undefined ? updates.receiptImageDataUrl : prev.receiptImageDataUrl;

    await db
      .update(expenses)
      .set({
        userId: nextOwnerId,
        merchant: nextMerchant,
        receiptNumber: nextReceipt,
        category: nextCategory,
        accountCode: suggestAccountCodeForCategory(nextCategory),
        paymentMethod: nextPayment,
        amount: nextAmount,
        vatRate: 0,
        vatAmount: 0,
        netAmount: nextAmount,
        expenseDate: nextDate,
        description: nextDesc,
        receiptImageDataUrl: nextReceiptImg,
      })
      .where(eq(expenses.id, expenseId));

    const updatedRows = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
    const updated = updatedRows[0]!;

    const changes: string[] = [];
    if (prev.merchant !== nextMerchant) changes.push(`Yer: ${prev.merchant} -> ${nextMerchant}`);
    if (Math.abs(prev.amount - nextAmount) > 0.001) {
      changes.push(`Tutar: ${prev.amount.toFixed(2)} TL -> ${nextAmount.toFixed(2)} TL`);
    }
    if (prev.expenseDate !== nextDate) changes.push(`Tarih: ${prev.expenseDate} -> ${nextDate}`);
    if (prev.category !== nextCategory) changes.push(`Kategori: ${prev.category} -> ${nextCategory}`);
    if (prev.userId !== nextOwnerId) changes.push(`Sahip: ${row.ownerName} -> ${nextOwnerName}`);

    const cleanReason = [updates.editReason?.trim(), changes.join(' | ')].filter(Boolean).join(' · ') || 'Masraf kaydı düzeltildi';

    await db.insert(expenseAuditLogs).values({
      expenseId: updated.id,
      action: 'updated',
      actorUserId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      ownerUserId: nextOwnerId,
      ownerName: nextOwnerName,
      merchant: updated.merchant,
      amount: updated.amount,
      expenseDate: updated.expenseDate,
      reason: cleanReason,
      latitude: updated.latitude,
      longitude: updated.longitude,
      snapshotJson: JSON.stringify({
        previous: {
          merchant: prev.merchant,
          amount: prev.amount,
          expenseDate: prev.expenseDate,
          category: prev.category,
          paymentMethod: prev.paymentMethod,
        },
        next: {
          merchant: updated.merchant,
          amount: updated.amount,
          expenseDate: updated.expenseDate,
          category: updated.category,
          paymentMethod: updated.paymentMethod,
        },
      }),
    });

    return { status: 'updated' as const, updated };
  } catch (error) {
    console.error('Database updateExpenseRecord failed:', error);
    throw new Error('Masraf kaydı güncellenemedi.', { cause: error });
  }
}

export async function softDeleteExpenseRecord(
  expenseId: number,
  actor: DbUser,
  reason: string
) {
  try {
    const rows = await db
      .select({
        expense: expenses,
        ownerName: users.fullName,
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id))
      .where(and(eq(expenses.id, expenseId), eq(expenses.isDeleted, false)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { status: 'not_found' as const };
    }
    if (row.expense.userId !== actor.id && actor.role !== 'admin') {
      return { status: 'forbidden' as const };
    }

    const cleanReason = reason.trim() || 'Kullanıcı tarafından silindi';

    await db
      .update(expenses)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUserId: actor.id,
        deleteReason: cleanReason,
      })
      .where(eq(expenses.id, expenseId));

    await db.insert(expenseAuditLogs).values({
      expenseId: row.expense.id,
      action: 'deleted',
      actorUserId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      ownerUserId: row.expense.userId,
      ownerName: row.ownerName,
      merchant: row.expense.merchant,
      amount: row.expense.amount,
      expenseDate: row.expense.expenseDate,
      reason: cleanReason,
      latitude: row.expense.latitude,
      longitude: row.expense.longitude,
      snapshotJson: JSON.stringify({
        receiptNumber: row.expense.receiptNumber,
        category: row.expense.category,
        paymentMethod: row.expense.paymentMethod,
        description: row.expense.description,
      }),
    });

    return { status: 'deleted' as const };
  } catch (error) {
    console.error('Database softDeleteExpenseRecord failed:', error);
    throw new Error('Masraf silinemedi.', { cause: error });
  }
}

export async function updateExpenseStatusRecord(
  expenseId: number,
  adminUser: DbUser,
  nextStatus: 'beklemede' | 'onaylandi' | 'odendi' | 'reddedildi',
  rejectionReason?: string
) {
  try {
    const rows = await db
      .select({
        expense: expenses,
        ownerName: users.fullName,
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id))
      .where(and(eq(expenses.id, expenseId), eq(expenses.isDeleted, false)))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    await db
      .update(expenses)
      .set({
        status: nextStatus,
        rejectionReason: nextStatus === 'reddedildi' ? (rejectionReason || '').trim() : '',
        reviewedByUserId: adminUser.id,
        reviewedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId));

    const updated = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);

    const actionMap: Record<string, string> = {
      onaylandi: 'approved',
      odendi: 'paid',
      reddedildi: 'rejected',
      beklemede: 'reopened',
    };

    await db.insert(expenseAuditLogs).values({
      expenseId: row.expense.id,
      action: actionMap[nextStatus] || nextStatus,
      actorUserId: adminUser.id,
      actorName: adminUser.fullName,
      actorRole: adminUser.role,
      ownerUserId: row.expense.userId,
      ownerName: row.ownerName,
      merchant: row.expense.merchant,
      amount: row.expense.amount,
      expenseDate: row.expense.expenseDate,
      reason: rejectionReason || `Durum güncellendi: ${nextStatus}`,
      latitude: row.expense.latitude,
      longitude: row.expense.longitude,
      snapshotJson: JSON.stringify({ status: nextStatus }),
    });

    return updated[0]!;
  } catch (error) {
    console.error('Database updateExpenseStatusRecord failed:', error);
    throw new Error('Masraf onay durumu güncellenemedi.', { cause: error });
  }
}

export async function listAuditLogs(onlyDeleted = false): Promise<DbAuditLog[]> {
  try {
    if (onlyDeleted) {
      return await db
        .select()
        .from(expenseAuditLogs)
        .where(eq(expenseAuditLogs.action, 'deleted'))
        .orderBy(desc(expenseAuditLogs.createdAt), desc(expenseAuditLogs.id));
    }
    return await db
      .select()
      .from(expenseAuditLogs)
      .orderBy(desc(expenseAuditLogs.createdAt), desc(expenseAuditLogs.id));
  } catch (error) {
    console.error('Database listAuditLogs failed:', error);
    throw new Error('Denetim kayıtları alınamadı.', { cause: error });
  }
}

export async function listPayoutsForUser(viewer: DbUser) {
  try {
    const baseQuery = db
      .select({
        payout: payouts,
        userName: users.fullName,
        userRole: users.role,
        userIban: users.iban,
      })
      .from(payouts)
      .innerJoin(users, eq(payouts.userId, users.id));

    const rows =
      viewer.role === 'admin'
        ? await baseQuery.orderBy(desc(payouts.payoutDate), desc(payouts.id))
        : await baseQuery
            .where(eq(payouts.userId, viewer.id))
            .orderBy(desc(payouts.payoutDate), desc(payouts.id));

    return rows.map((r) => ({
      ...r.payout,
      userName: r.userName,
      userRole: r.userRole,
      userIban: r.userIban,
    }));
  } catch (error) {
    console.error('Database listPayoutsForUser failed:', error);
    throw new Error('Ödeme kayıtları alınamadı.', { cause: error });
  }
}

export async function createPayoutRecord(
  adminUser: DbUser,
  input: {
    userId: number;
    amount: number;
    payoutDate: string;
    paymentChannel: 'havale_eft' | 'nakit' | 'cek';
    referenceNo?: string;
    description?: string;
  }
) {
  try {
    const recipient = await getUserById(input.userId);
    if (!recipient) {
      throw new Error('Ödeme yapılacak kullanıcı bulunamadı.');
    }

    const created = (await insertAndFetchById(payouts, {
      userId: recipient.id,
      amount: input.amount,
      payoutDate: input.payoutDate,
      paymentChannel: input.paymentChannel || 'havale_eft',
      referenceNo: (input.referenceNo || '').trim(),
      description: (input.description || '').trim(),
      createdByAdminId: adminUser.id,
    })) as DbPayout;

    await db.insert(expenseAuditLogs).values({
      expenseId: 0,
      action: 'paid',
      actorUserId: adminUser.id,
      actorName: adminUser.fullName,
      actorRole: adminUser.role,
      ownerUserId: recipient.id,
      ownerName: recipient.fullName,
      merchant: `Toplu Ödeme (${created.paymentChannel})`,
      amount: created.amount,
      expenseDate: created.payoutDate,
      reason: created.description || `Dekont #${created.referenceNo || created.id}`,
      snapshotJson: JSON.stringify({
        payoutId: created.id,
        referenceNo: created.referenceNo,
        paymentChannel: created.paymentChannel,
      }),
    });

    return {
      ...created,
      userName: recipient.fullName,
      userRole: recipient.role,
      userIban: recipient.iban,
    };
  } catch (error) {
    console.error('Database createPayoutRecord failed:', error);
    throw new Error('Toplu ödeme kaydedilemedi.', { cause: error });
  }
}

export async function deletePayoutRecord(payoutId: number) {
  try {
    const existing = await db.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
    if (!existing[0]) return null;
    await db.delete(payouts).where(eq(payouts.id, payoutId));
    return existing[0];
  } catch (error) {
    console.error('Database deletePayoutRecord failed:', error);
    throw new Error('Ödeme kaydı silinemedi.', { cause: error });
  }
}
