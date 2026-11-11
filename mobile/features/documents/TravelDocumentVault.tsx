import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import * as DocumentPicker from 'expo-document-picker';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { showFeedback } from '@/services/feedback';
import {
  CachedDocPayload,
  DocCategory,
  VaultDoc,
  cacheDocBlobOffline,
  downloadAndCacheDocument,
  getCachedDocIdSet,
  loadCachedDocList,
  loadCachedDocPayload,
  removeCachedDoc,
  saveCachedDocList,
} from '@/services/offlineDocuments';
import { OfflineDocumentPreviewModal } from '@/components/OfflineDocumentPreviewModal';
import {
  CollectionPaginationFooter,
  PrimaryButton,
  SearchInput,
  SecondaryButton,
  SmallButton,
  StandardCard,
  StatusBadge,
} from '@/components/ui';

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function resolveMimeType(fileName: string, pickedMime?: string | null): string {
  if (pickedMime && pickedMime !== 'application/octet-stream') return pickedMime;
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXT[ext] || pickedMime || 'application/pdf';
}

export function TravelDocumentVault() {
  const { user } = useAuth();
  const layout = useResponsiveLayout();
  const [selectedType, setSelectedType] = useState<DocCategory>('GOVERNMENT_ID');
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<VaultDoc | null>(null);
  const [previewPayload, setPreviewPayload] = useState<CachedDocPayload | null>(null);
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(6);

  const refreshCachedFlags = useCallback(
    async (list: VaultDoc[]) => {
      if (!user) return;
      const set = await getCachedDocIdSet(user.id, list);
      setCachedIds(set);
    },
    [user],
  );

  const loadDocs = useCallback(async () => {
    if (!user) return;
    // Load local offline list first so vault stays accessible without network
    const offlineList = await loadCachedDocList(user.id);
    if (offlineList.length > 0) {
      setDocs(offlineList);
      await refreshCachedFlags(offlineList);
    }

    try {
      const list = await mobileApi<VaultDoc[]>('/documents');
      setDocs(list);
      await saveCachedDocList(user.id, list);
      await refreshCachedFlags(list);
    } catch {
      // Offline: continue showing locally cached metadata & files cleanly
    }
  }, [user, refreshCachedFlags]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function uploadDocument() {
    if (uploading) return;
    if (!user) {
      showFeedback({
        tone: 'info',
        title: 'Sign In Required',
        message: 'Please sign in to upload encrypted documents.',
      });
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    const mimeType = resolveMimeType(file.name, file.mimeType);

    setUploading(true);
    try {
      let offlineBlob: Blob | null = null;
      const form = new FormData();
      form.append('documentType', selectedType);
      form.append('title', file.name);

      if (Platform.OS === 'web') {
        const webFile = (file as { file?: File }).file;
        if (webFile instanceof Blob) {
          offlineBlob =
            webFile.type && webFile.type !== 'application/octet-stream'
              ? webFile
              : new Blob([webFile], { type: mimeType });
          form.append('file', offlineBlob, file.name);
        } else {
          const fetched = await fetch(file.uri);
          const rawBlob = await fetched.blob();
          offlineBlob =
            rawBlob.type && rawBlob.type !== 'application/octet-stream'
              ? rawBlob
              : new Blob([rawBlob], { type: mimeType });
          form.append('file', offlineBlob, file.name);
        }
      } else {
        form.append('file', {
          uri: file.uri,
          name: file.name,
          type: mimeType,
        } as unknown as Blob);
        try {
          const fetched = await fetch(file.uri);
          offlineBlob = await fetched.blob();
        } catch {
          offlineBlob = null;
        }
      }

      const savedDoc = await mobileApi<VaultDoc>('/documents', {
        method: 'POST',
        idempotencyKey: createIdempotencyKey('doc-upload'),
        body: form,
      });

      const nextList = [savedDoc, ...docs];
      setDocs(nextList);
      await saveCachedDocList(user.id, nextList);

      if (offlineBlob) {
        const cached = await cacheDocBlobOffline(user.id, savedDoc.id, offlineBlob, mimeType);
        if (cached) {
          setCachedIds((prev) => new Set(prev).add(savedDoc.id));
        }
      }

      showFeedback({
        tone: 'success',
        title: 'Encrypted & Saved Offline',
        message: `${file.name} uploaded and cached on this device for offline viewing.`,
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Upload Failed', message: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function viewDocument(doc: VaultDoc) {
    if (!user || busyDocId) return;
    setBusyDocId(doc.id);
    try {
      let payload = await loadCachedDocPayload(user.id, doc.id);
      if (!payload) {
        payload = await downloadAndCacheDocument(user.id, doc);
        setCachedIds((prev) => new Set(prev).add(doc.id));
      }
      setPreviewDoc(doc);
      setPreviewPayload(payload);
    } catch (err) {
      showFeedback({
        tone: 'error',
        title: 'Offline Copy Unavailable',
        message: (err as Error).message,
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function cacheForOffline(doc: VaultDoc) {
    if (!user || busyDocId) return;
    setBusyDocId(doc.id);
    try {
      await downloadAndCacheDocument(user.id, doc);
      setCachedIds((prev) => new Set(prev).add(doc.id));
      showFeedback({
        tone: 'success',
        title: 'Saved for Offline Mode',
        message: `${doc.title} can now be opened without internet.`,
      });
    } catch (err) {
      showFeedback({
        tone: 'error',
        title: 'Offline Save Failed',
        message: (err as Error).message,
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function deleteDoc(id: string) {
    if (deletingId || !user) return;
    setDeletingId(id);
    try {
      await mobileApi(`/documents/${id}`, { method: 'DELETE' });
      const next = docs.filter((d) => d.id !== id);
      setDocs(next);
      await removeCachedDoc(user.id, id);
      setCachedIds((prev) => {
        const clone = new Set(prev);
        clone.delete(id);
        return clone;
      });
      showFeedback({ tone: 'info', title: 'Document Deleted' });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Delete Failed', message: (err as Error).message });
    } finally {
      setDeletingId(null);
    }
  }

  const q = search.trim().toLowerCase();
  const filteredDocs = q
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.documentType.toLowerCase().includes(q),
      )
    : docs;
  const visibleDocs = filteredDocs.slice(0, visibleLimit);

  return (
    <StandardCard>
      <OfflineDocumentPreviewModal
        doc={previewDoc}
        payload={previewPayload}
        onClose={() => {
          setPreviewDoc(null);
          setPreviewPayload(null);
        }}
      />

      <View style={styles.rowBetween}>
        <Text style={[layout.type.cardHeading, styles.title]}>
          Document Vault ({docs.length})
        </Text>
        <StatusBadge label="Offline Ready" tone="safe" icon="offline-pin" />
      </View>

      <Text style={styles.docMeta}>
        Uploaded files are encrypted in your account and cached on this device so you can view them anytime in Offline Mode or via Offline Safety Pack.
      </Text>

      <View style={styles.chips}>
        {(['PASSPORT', 'VISA', 'GOVERNMENT_ID', 'TICKET', 'ACCOMMODATION', 'INSURANCE'] as DocCategory[]).map(
          (cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedType(cat)}
              style={[styles.chip, selectedType === cat && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedType === cat && styles.chipTextActive]}>
                {cat.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          ),
        )}
      </View>

      <PrimaryButton
        label={uploading ? 'Uploading...' : `+ Upload ${selectedType.replace(/_/g, ' ')}`}
        tone="dark"
        loading={uploading}
        disabled={uploading}
        onPress={uploadDocument}
        fullWidth
      />

      {docs.length > 4 && (
        <SearchInput
          placeholder="Search saved documents..."
          value={search}
          onChangeText={(txt) => {
            setSearch(txt);
            setVisibleLimit(6);
          }}
          onClear={() => setSearch('')}
        />
      )}

      {filteredDocs.length === 0 ? (
        <Text style={styles.docMeta}>
          {q ? 'No documents matched your search.' : 'No documents saved yet.'}
        </Text>
      ) : (
        <>
          {visibleDocs.map((doc) => {
            const ts = doc.updatedAt || doc.createdAt;
            const isCached = cachedIds.has(doc.id);
            const isBusy = busyDocId === doc.id;
            return (
              <View key={doc.id} style={styles.docCard}>
                <View style={styles.docTopRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.docTitle} numberOfLines={2}>
                      {doc.title}
                    </Text>
                    <Text style={styles.docMeta} numberOfLines={1}>
                      {doc.documentType.replace(/_/g, ' ')}
                      {ts ? ` • ${new Date(ts).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  <StatusBadge
                    label={isCached ? 'Cached' : 'Cloud'}
                    tone={isCached ? 'safe' : 'info'}
                  />
                </View>

                <View style={styles.docActions}>
                  <SmallButton
                    label={isBusy ? 'Opening...' : isCached ? 'View Offline' : 'View'}
                    icon="visibility"
                    tone="primary"
                    loading={isBusy}
                    disabled={isBusy || deletingId === doc.id}
                    onPress={() => viewDocument(doc)}
                  />
                  {!isCached && (
                    <SecondaryButton
                      label="Save Offline"
                      icon="offline-pin"
                      tone="tealSoft"
                      disabled={isBusy || deletingId === doc.id}
                      onPress={() => cacheForOffline(doc)}
                      style={styles.compactSecondary}
                    />
                  )}
                  <SecondaryButton
                    label={deletingId === doc.id ? 'Deleting...' : 'Delete'}
                    tone="danger"
                    disabled={deletingId === doc.id || isBusy}
                    onPress={() => deleteDoc(doc.id)}
                    style={styles.compactSecondary}
                  />
                </View>
              </View>
            );
          })}

          <CollectionPaginationFooter
            visibleCount={visibleDocs.length}
            totalCount={filteredDocs.length}
            hasMore={visibleDocs.length < filteredDocs.length}
            noun="documents"
            onLoadMore={() => setVisibleLimit((n) => n + 6)}
          />
        </>
      )}
    </StandardCard>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  title: { color: HerwayColors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm },
  chip: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    borderRadius: HerwayRadii.pill,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
  },
  chipActive: { backgroundColor: HerwayColors.teal, borderColor: HerwayColors.teal },
  chipText: { fontSize: 12, fontWeight: '600', color: HerwayColors.ink },
  chipTextActive: { color: HerwayColors.white, fontWeight: '700' },
  docCard: {
    gap: HerwaySpacing.sm,
    backgroundColor: HerwayColors.inputBg,
    padding: HerwaySpacing.md,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.borderSubtle,
  },
  docTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  docActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  compactSecondary: {
    minHeight: HerwaySizes.buttonSmall,
    paddingVertical: 6,
    paddingHorizontal: HerwaySpacing.md,
  },
  docTitle: { fontSize: 14, fontWeight: '600', color: HerwayColors.ink },
  docMeta: { fontSize: 12, color: HerwayColors.muted, lineHeight: 17 },
});
