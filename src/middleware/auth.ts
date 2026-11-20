import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import { ensureSeedData, getOrCreateUserByUid, getUserById, type DbUser } from '../db/repository.ts';

export interface AuthRequest extends Request {
  authUser?: DbUser;
}

const TOKEN_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`${firebaseConfig.projectId}:${firebaseConfig.apiKey}:masraf-session`)
    .digest('hex');

interface SessionPayload {
  userId: number;
  uid: string;
  role: string;
  exp: number;
}

export function signSessionToken(user: { id: number; uid: string; role: string }): string {
  const payload: SessionPayload = {
    userId: user.id,
    uid: user.uid,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `app.${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token.startsWith('app.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded.exp || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkisiz erişim: Oturum belirteci eksik.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    await ensureSeedData();

    if (token.startsWith('app.')) {
      const session = verifySessionToken(token);
      if (!session) {
        return res.status(401).json({ error: 'Oturum süresi doldu veya geçersiz.' });
      }
      const user = await getUserById(session.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Kullanıcı hesabı aktif değil.' });
      }
      req.authUser = user;
      return next();
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const user = await getOrCreateUserByUid(
      decodedToken.uid,
      decodedToken.email || `${decodedToken.uid}@firebase.local`,
      decodedToken.name || decodedToken.email?.split('@')[0] || 'Yeni Kullanıcı'
    );
    if (!user.isActive) {
      return res.status(403).json({ error: 'Hesabınız yönetici tarafından pasife alınmıştır.' });
    }
    req.authUser = user;
    return next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Kimlik doğrulama başarısız.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.authUser || req.authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem yalnızca Admin yetkisine sahip kullanıcılar içindir.' });
  }
  return next();
};
