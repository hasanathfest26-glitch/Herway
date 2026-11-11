import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, getAccessToken } from '@/services/apiClient';

export type DocCategory =
  | 'PASSPORT'
  | 'VISA'
  | 'GOVERNMENT_ID'
  | 'TICKET'
  | 'ACCOMMODATION'
  | 'INSURANCE';

export interface VaultDoc {
  id: string;
  documentType: DocCategory;
  title: string;
  originalFilename?: string | null;
  storageProvider: string;
  mimeType: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CachedDocPayload {
  mimeType: string;
  dataUri: string;
  cachedAt: string;
}

const MAX_OFFLINE_DOC_BYTES = 2.5 * 1024 * 1024; // ~2.5 MB limit per cached document
const metaKey = (userId: string) => `herway_offline_docs_meta_v1_${userId}`;
const dataKey = (userId: string, docId: string) => `herway_offline_doc_data_v1_${userId}_${docId}`;

export async function saveCachedDocList(userId: string, docs: VaultDoc[]): Promise<void> {
  try {
    await AsyncStorage.setItem(metaKey(userId), JSON.stringify(docs));
  } catch {
    // Best effort cache persistence
  }
}

export async function loadCachedDocList(userId: string): Promise<VaultDoc[]> {
  try {
    const raw = await AsyncStorage.getItem(metaKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VaultDoc[]) : [];
  } catch {
    return [];
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (blob.size > MAX_OFFLINE_DOC_BYTES) {
      reject(new Error('File exceeds 2.5 MB offline browser cache limit.'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unable to read document data for offline storage.'));
    };
    reader.onerror = () => reject(new Error('Failed to encode document for offline cache.'));
    reader.readAsDataURL(blob);
  });
}

export async function cacheDocBlobOffline(
  userId: string,
  docId: string,
  blob: Blob,
  mimeType: string,
): Promise<CachedDocPayload | null> {
  try {
    const dataUri = await blobToDataUrl(blob);
    const payload: CachedDocPayload = {
      mimeType,
      dataUri,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(dataKey(userId, docId), JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

export async function loadCachedDocPayload(
  userId: string,
  docId: string,
): Promise<CachedDocPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(dataKey(userId, docId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedDocPayload;
  } catch {
    return null;
  }
}

export async function getCachedDocIdSet(userId: string, docs: VaultDoc[]): Promise<Set<string>> {
  const cached = new Set<string>();
  await Promise.all(
    docs.map(async (d) => {
      const existing = await AsyncStorage.getItem(dataKey(userId, d.id));
      if (existing) cached.add(d.id);
    }),
  );
  return cached;
}

export async function removeCachedDoc(userId: string, docId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(dataKey(userId, docId));
    const current = await loadCachedDocList(userId);
    await saveCachedDocList(
      userId,
      current.filter((d) => d.id !== docId),
    );
  } catch {
    // Ignore storage cleanup failures
  }
}

export async function downloadAndCacheDocument(
  userId: string,
  doc: VaultDoc,
): Promise<CachedDocPayload> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sign in while online to download this document for offline access.');
  }

  const res = await fetch(`${API_URL}/documents/${doc.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Unable to download decrypted document right now.');
  }
  const blob = await res.blob();
  const payload = await cacheDocBlobOffline(
    userId,
    doc.id,
    blob,
    blob.type || doc.mimeType || 'application/octet-stream',
  );
  if (!payload) {
    throw new Error('Document is too large to store in local offline cache.');
  }
  return payload;
}

export async function syncAllDocumentsOffline(userId: string): Promise<VaultDoc[]> {
  const token = await getAccessToken();
  if (!token) return loadCachedDocList(userId);

  const res = await fetch(`${API_URL}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return loadCachedDocList(userId);

  const list = (await res.json()) as VaultDoc[];
  await saveCachedDocList(userId, list);
  await Promise.allSettled(
    list.map(async (doc) => {
      const existing = await loadCachedDocPayload(userId, doc.id);
      if (!existing) {
        await downloadAndCacheDocument(userId, doc);
      }
    }),
  );
  return list;
}
