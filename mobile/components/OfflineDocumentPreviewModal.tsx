import React, { useMemo } from 'react';
import { Image, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { CachedDocPayload, VaultDoc } from '@/services/offlineDocuments';
import { Modal, PrimaryButton, SecondaryButton, StatusBadge } from '@/components/ui';

function dataUriToBlobUrl(dataUri: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const [header, b64] = dataUri.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function OfflineDocumentPreviewModal({
  doc,
  payload,
  onClose,
}: {
  doc: VaultDoc | null;
  payload: CachedDocPayload | null;
  onClose: () => void;
}) {
  const isImage = Boolean(payload?.mimeType?.startsWith('image/'));
  const isPdf = Boolean(payload?.mimeType?.includes('pdf'));

  const webBlobUrl = useMemo(() => {
    if (!payload?.dataUri || isImage) return null;
    return dataUriToBlobUrl(payload.dataUri);
  }, [payload?.dataUri, isImage]);

  function triggerDownloadOrOpen() {
    if (!payload) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = webBlobUrl || payload.dataUri;
      a.download = doc?.originalFilename || doc?.title || 'herway-document';
      a.target = '_blank';
      a.click();
      return;
    }
    void Linking.openURL(payload.dataUri);
  }

  return (
    <Modal
      visible={Boolean(doc && payload)}
      onClose={onClose}
      title={doc?.title || 'Document Preview'}
      subtitle={
        doc
          ? `${doc.documentType.replace(/_/g, ' ')} • Available Offline`
          : undefined
      }
      maxWidth={680}
      footer={
        <View style={styles.footerRow}>
          <SecondaryButton label="Close" onPress={onClose} style={{ flex: 1 }} />
          <PrimaryButton
            label={Platform.OS === 'web' ? 'Download Copy' : 'Open File'}
            icon="download"
            onPress={triggerDownloadOrOpen}
            style={{ flex: 1.4 }}
          />
        </View>
      }
    >
      <View style={styles.wrap}>
        <View style={styles.badgeBar}>
          <StatusBadge label="Cached Offline" tone="safe" icon="offline-pin" />
          {payload?.cachedAt && (
            <Text style={styles.metaText}>
              Saved {new Date(payload.cachedAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        {payload && isImage ? (
          <View style={styles.imageBox}>
            <Image
              source={{ uri: payload.dataUri }}
              style={styles.previewImage}
              resizeMode="contain"
              accessibilityLabel={doc?.title || 'Cached document preview'}
            />
          </View>
        ) : payload && isPdf && Platform.OS === 'web' && webBlobUrl ? (
          <View style={styles.pdfFrameWrap}>
            {React.createElement('iframe', {
              src: webBlobUrl,
              title: doc?.title || 'PDF Preview',
              style: { width: '100%', height: 380, border: 'none', borderRadius: 12 },
            })}
          </View>
        ) : (
          <View style={styles.fallbackBox}>
            <MaterialIcons name="description" size={32} color={HerwayColors.tealDark} />
            <Text style={styles.fallbackTitle}>Document Cached Offline</Text>
            <Text style={styles.metaText}>
              Tap "{Platform.OS === 'web' ? 'Download Copy' : 'Open File'}" below to view or save a local copy anytime, even without internet.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: HerwaySpacing.md },
  badgeBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  metaText: { fontSize: 12, fontWeight: '500', color: HerwayColors.muted },
  imageBox: {
    width: '100%',
    height: 360,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  pdfFrameWrap: {
    width: '100%',
    height: 380,
    borderRadius: HerwayRadii.input,
    overflow: 'hidden',
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: HerwaySpacing.xl,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.inputBg,
    gap: HerwaySpacing.sm,
  },
  fallbackTitle: { fontSize: 15, fontWeight: '700', color: HerwayColors.ink },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
  },
});
