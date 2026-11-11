import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
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
  CollectionPaginationFooter,
  PrimaryButton,
  SearchInput,
  SmallButton,
  StandardCard,
  StandardInput,
  StatusBadge,
} from '@/components/ui';

interface ContactItem {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  canReceiveTripUpdates: boolean;
  canViewLocation: boolean;
  canReceiveCheckIns: boolean;
  canReceiveSos: boolean;
}

export function TrustedContactsManager() {
  const { user } = useAuth();
  const layout = useResponsiveLayout();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(5);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    try {
      const list = await mobileApi<ContactItem[]>('/contacts');
      setContacts(list);
    } catch {
      // Handled when offline
    }
  }, [user]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  async function addContact() {
    if (saving) return;
    if (!user) {
      showFeedback({
        tone: 'info',
        title: 'Sign In Required',
        message: 'Please sign in to save trusted contacts.',
      });
      return;
    }
    if (!name.trim() || !phone.trim()) {
      showFeedback({
        tone: 'error',
        title: 'Missing Fields',
        message: 'Name and phone number are required.',
      });
      return;
    }
    setSaving(true);
    try {
      const created = await mobileApi<ContactItem>('/contacts', {
        method: 'POST',
        idempotencyKey: createIdempotencyKey('trusted-contact'),
        body: JSON.stringify({
          name: name.trim(),
          relationship: relationship.trim() || 'Family / Friend',
          phone: phone.trim(),
          canReceiveTripUpdates: false,
          canViewLocation: false,
          canReceiveCheckIns: true,
          canReceiveSos: true,
        }),
      });
      setContacts((prev) => [...prev, created]);
      setName('');
      setRelationship('');
      setPhone('');
      showFeedback({ tone: 'success', title: 'Trusted Contact Added ✓' });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function togglePerm(
    contact: ContactItem,
    key: keyof Pick<
      ContactItem,
      'canReceiveTripUpdates' | 'canViewLocation' | 'canReceiveCheckIns' | 'canReceiveSos'
    >,
  ) {
    const nextValue = !contact[key];
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, [key]: nextValue } : c)));
    try {
      const updated = await mobileApi<ContactItem>(`/contacts/${contact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [key]: nextValue }),
      });
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));
    } catch (err) {
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, [key]: !nextValue } : c)));
      showFeedback({ tone: 'error', title: 'Update Failed', message: (err as Error).message });
    }
  }

  async function removeContact(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    const prevList = contacts;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    try {
      await mobileApi(`/contacts/${id}`, { method: 'DELETE' });
      showFeedback({ tone: 'info', title: 'Contact Removed' });
    } catch (err) {
      setContacts(prevList);
      showFeedback({ tone: 'error', title: 'Delete Failed', message: (err as Error).message });
    } finally {
      setDeletingId(null);
    }
  }

  const singleColPerms = layout.isSmallMobile;
  const q = search.trim().toLowerCase();
  const filteredContacts = q
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.relationship.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q),
      )
    : contacts;
  const visibleContacts = filteredContacts.slice(0, visibleLimit);

  return (
    <StandardCard>
      <View style={styles.rowBetween}>
        <Text style={[layout.type.cardHeading, styles.title]}>Trusted Contacts</Text>
        <StatusBadge label={`${contacts.length} Saved`} tone="neutral" hideIcon />
      </View>

      {contacts.length > 4 && (
        <SearchInput
          placeholder="Search trusted contacts..."
          value={search}
          onChangeText={(txt) => {
            setSearch(txt);
            setVisibleLimit(5);
          }}
          onClear={() => setSearch('')}
        />
      )}

      {filteredContacts.length === 0 ? (
        <Text style={styles.meta}>
          {q ? 'No trusted contacts match your search.' : 'No trusted contacts added yet.'}
        </Text>
      ) : (
        <>
          {visibleContacts.map((c) => (
            <View key={c.id} style={styles.contactBox}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.contactName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {c.relationship} • {c.phone}
                  </Text>
                </View>
                <SmallButton
                  label={deletingId === c.id ? 'Removing...' : 'Remove'}
                  tone="danger"
                  loading={deletingId === c.id}
                  disabled={deletingId === c.id}
                  onPress={() => removeContact(c.id)}
                />
              </View>

              <View style={styles.permGrid}>
                <View style={[styles.permRow, singleColPerms && styles.permRowFull]}>
                  <Text style={styles.permLabel}>SOS Alerts</Text>
                  <Switch
                    value={c.canReceiveSos}
                    onValueChange={() => togglePerm(c, 'canReceiveSos')}
                    trackColor={{ false: HerwayColors.dotInactive, true: HerwayColors.teal }}
                    thumbColor={HerwayColors.white}
                  />
                </View>
                <View style={[styles.permRow, singleColPerms && styles.permRowFull]}>
                  <Text style={styles.permLabel}>Live Location</Text>
                  <Switch
                    value={c.canViewLocation}
                    onValueChange={() => togglePerm(c, 'canViewLocation')}
                    trackColor={{ false: HerwayColors.dotInactive, true: HerwayColors.teal }}
                    thumbColor={HerwayColors.white}
                  />
                </View>
                <View style={[styles.permRow, singleColPerms && styles.permRowFull]}>
                  <Text style={styles.permLabel}>Check-Ins</Text>
                  <Switch
                    value={c.canReceiveCheckIns}
                    onValueChange={() => togglePerm(c, 'canReceiveCheckIns')}
                    trackColor={{ false: HerwayColors.dotInactive, true: HerwayColors.teal }}
                    thumbColor={HerwayColors.white}
                  />
                </View>
                <View style={[styles.permRow, singleColPerms && styles.permRowFull]}>
                  <Text style={styles.permLabel}>Trip Updates</Text>
                  <Switch
                    value={c.canReceiveTripUpdates}
                    onValueChange={() => togglePerm(c, 'canReceiveTripUpdates')}
                    trackColor={{ false: HerwayColors.dotInactive, true: HerwayColors.teal }}
                    thumbColor={HerwayColors.white}
                  />
                </View>
              </View>
            </View>
          ))}

          <CollectionPaginationFooter
            visibleCount={visibleContacts.length}
            totalCount={filteredContacts.length}
            hasMore={visibleContacts.length < filteredContacts.length}
            noun="contacts"
            onLoadMore={() => setVisibleLimit((n) => n + 6)}
          />
        </>
      )}

      {user && (
        <View style={styles.addForm}>
          <StandardInput value={name} onChangeText={setName} placeholder="Contact name" />
          <StandardInput
            value={relationship}
            onChangeText={setRelationship}
            placeholder="Relationship (e.g. Sister, Mother)"
          />
          <StandardInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />
          <PrimaryButton
            label={saving ? 'Adding...' : '+ Add Contact'}
            tone="dark"
            loading={saving}
            disabled={saving}
            onPress={addContact}
            fullWidth
          />
        </View>
      )}
    </StandardCard>
  );
}

const styles = StyleSheet.create({
  title: { color: HerwayColors.ink },
  contactBox: {
    backgroundColor: HerwayColors.creamBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.borderSubtle,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
    gap: HerwaySpacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  contactName: { fontSize: 15, fontWeight: '700', color: HerwayColors.ink },
  meta: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted },
  permGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm },
  permRow: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
  },
  permRowFull: {
    width: '100%',
  },
  permLabel: { fontSize: 13, fontWeight: '600', color: HerwayColors.textSecondary, flex: 1 },
  addForm: { gap: HerwaySpacing.sm, marginTop: HerwaySpacing.xs },
});
