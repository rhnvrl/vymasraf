import { GoogleGenAI, Type } from '@google/genai';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY tanımlı değil. Lütfen Secrets panelinden API anahtarını ekleyin.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ParsedReceiptData {
  merchant: string;
  merchantTaxId: string;
  receiptNumber: string;
  documentType: 'fis' | 'fatura' | 'e-fatura' | 'diger';
  category: string;
  expenseDate: string;
  amount: number;
  vatRate: number;
  description: string;
}

const RECEIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    merchant: { type: Type.STRING, description: 'Satıcı / İşletme adı' },
    merchantTaxId: { type: Type.STRING, description: 'VKN veya TCKN varsa, yoksa boş string' },
    receiptNumber: { type: Type.STRING, description: 'Fiş no veya fatura numarası' },
    documentType: {
      type: Type.STRING,
      description: 'Belge türü: fis, fatura, e-fatura veya diger',
    },
    category: {
      type: Type.STRING,
      description:
        'Şunlardan biri: Yemek & Temsil, Akaryakıt & Ulaşım, Konaklama, Ofis & Kırtasiye, Yazılım & İletişim, Bakım & Onarım, Diğer',
    },
    expenseDate: { type: Type.STRING, description: 'YYYY-MM-DD formatında tarih' },
    amount: { type: Type.NUMBER, description: 'Fişin en altındaki dip toplam / genel toplam tutar (sayı)' },
    description: { type: Type.STRING, description: 'Kısa masraf açıklaması' },
  },
  required: ['merchant', 'category', 'expenseDate', 'amount', 'description'],
};

export async function parseReceiptImageWithGemini(dataUrl: string): Promise<ParsedReceiptData> {
  const ai = getGeminiClient();
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Geçersiz görsel formatı (base64 data URL bekleniyor).');
  }
  const [, mimeType, base64Data] = match;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text:
            'Bu fiş veya fatura görselini oku ve bilgileri JSON olarak çıkar. ' +
            'Sadece fişin en altındaki genel toplam (dip toplam) tutarını amount alanına yaz; KDV ayrımı yapma. ' +
            'Tarih bulunamazsa bugünün tarihini (YYYY-MM-DD) kullan.',
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: RECEIPT_SCHEMA,
    },
  });

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Fiş görseli çözümlenemedi.');
  }
  const parsed = JSON.parse(rawText) as ParsedReceiptData;
  return {
    merchant: parsed.merchant || 'Bilinmeyen Satıcı',
    merchantTaxId: parsed.merchantTaxId || '',
    receiptNumber: parsed.receiptNumber || '',
    documentType: (['fis', 'fatura', 'e-fatura', 'diger'].includes(parsed.documentType)
      ? parsed.documentType
      : 'fis') as ParsedReceiptData['documentType'],
    category: parsed.category || 'Diğer',
    expenseDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.expenseDate)
      ? parsed.expenseDate
      : new Date().toISOString().slice(0, 10),
    amount: Number(parsed.amount) || 0,
    vatRate: 0,
    description: parsed.description || '',
  };
}

export async function parseVoiceExpenseWithGemini(input: {
  audioDataUrl?: string;
  transcriptText?: string;
}): Promise<ParsedReceiptData & { transcript: string }> {
  const ai = getGeminiClient();
  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

  if (input.audioDataUrl) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(input.audioDataUrl);
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    }
  }

  parts.push({
    text:
      `Kullanıcının sesli masraf kaydını veya metnini basit Türkçe masraf kaydına dönüştür.\n` +
      (input.transcriptText ? `Metin: "${input.transcriptText}"\n` : '') +
      `Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}.`,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ...RECEIPT_SCHEMA.properties,
          transcript: { type: Type.STRING, description: 'Ses kaydının Türkçe metin dökümü' },
        },
        required: ['merchant', 'category', 'expenseDate', 'amount', 'description', 'transcript'],
      },
    },
  });

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Sesli masraf kaydı çözümlenemedi.');
  }
  const parsed = JSON.parse(rawText) as ParsedReceiptData & { transcript: string };
  return {
    merchant: parsed.merchant || 'Sesli Masraf Girişi',
    merchantTaxId: parsed.merchantTaxId || '',
    receiptNumber: parsed.receiptNumber || '',
    documentType: 'fis',
    category: parsed.category || 'Diğer',
    expenseDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.expenseDate)
      ? parsed.expenseDate
      : new Date().toISOString().slice(0, 10),
    amount: Number(parsed.amount) || 0,
    vatRate: 0,
    description: parsed.description || parsed.transcript || '',
    transcript: parsed.transcript || input.transcriptText || '',
  };
}
