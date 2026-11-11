'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Clock, Phone, PlusCircle, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import {
  EmptyState,
  FilterChipGroup,
  LoadingState,
  Modal,
  PageHeader,
  PaginationControls,
  PrimaryButton,
  SearchInput,
  StandardCard,
  StandardInput,
  Toast,
} from '@/components/ui';
import { apiFetch, createIdempotencyKey } from '@/features/api';
import { useWebAuth } from '@/features/auth/AuthProvider';

interface PartnerHaven {
  id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  contactEmail?: string | null;
  logoUrl?: string | null;
  responsiblePersonName?: string | null;
  responsiblePersonPhone?: string | null;
  operatingHoursJson: { display?: string };
  assistanceServices: string[];
  licenceNumber: string;
  approvalStatus: string;
  approvalNotes?: string | null;
  verifiedBadge: boolean;
  isActive: boolean;
  lastRecheckedAt?: string | null;
}

interface PaginatedHavens {
  items: PartnerHaven[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

export function PartnerPortal() {
  const { user, loading: authLoading } = useWebAuth();
  const [havens, setHavens] = useState<PartnerHaven[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newForm, setNewForm] = useState({
    name: '',
    category: 'HOTEL',
    address: '',
    city: 'Kochi',
    latitude: '9.9658',
    longitude: '76.2421',
    phone: '',
    contactEmail: '',
    logoUrl: '',
    responsiblePersonName: '',
    responsiblePersonPhone: '',
    operatingHoursDisplay: 'Open 24 Hours',
    servicesCsv: '24/7 Safe Waiting Lounge, Phone Charging, Verified Cab Calling',
    assistanceCommitments:
      'Provide a well-lit reception waiting space and assist in contacting 112/1515 on request.',
    licenceNumber: '',
    verificationDocRef: '',
    agreementAccepted: true,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadMine = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        paginated: 'true',
        page: String(page),
        limit: String(pageSize),
      });
      if (statusFilter !== 'ALL') qs.set('status', statusFilter);
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const res = await apiFetch<PaginatedHavens>(`/safe-havens/partner/mine?${qs.toString()}`);
      setHavens(res.items);
      setTotal(res.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (user) {
      void loadMine();
    }
  }, [user, loadMine]);

  if (authLoading) {
    return <LoadingState label="Loading Partner Portal..." />;
  }

  if (!user) {
    return (
      <div className="mx-auto mt-8 max-w-lg">
        <StandardCard className="flex flex-col items-center space-y-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C5EFF2] text-[#0099A8]">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-[20px] font-extrabold text-[#131A20]">
            Safe Haven Partner Sign-In Required
          </h1>
          <p className="text-[14px] font-medium text-[#646F78]">
            Sign in with your Safe Haven Partner account to register establishments, manage operating hours, update services, and control participation status.
          </p>
          <Link
            href="/login"
            className="inline-flex h-12 min-h-[48px] items-center justify-center rounded-[12px] bg-[#00B6C7] px-6 text-[15px] font-bold text-white shadow-teal-glow hover:bg-[#0099A8]"
          >
            Sign In to Partner Portal
          </Link>
        </StandardCard>
      </div>
    );
  }

  async function saveFacility(haven: PartnerHaven) {
    if (busyId) return;
    setBusyId(`save-${haven.id}`);
    setError(null);
    setNotice(null);
    try {
      const updated = await apiFetch<PartnerHaven>(`/safe-havens/${haven.id}/partner`, {
        method: 'PATCH',
        idempotencyKey: createIdempotencyKey(`partner-save-${haven.id}`),
        body: JSON.stringify({
          phone: haven.phone,
          responsiblePersonName: haven.responsiblePersonName,
          responsiblePersonPhone: haven.responsiblePersonPhone,
          operatingHoursJson: haven.operatingHoursJson,
          assistanceServices: haven.assistanceServices,
          isActive: haven.isActive,
        }),
      });
      setHavens((prev) => prev.map((h) => (h.id === haven.id ? { ...h, ...updated } : h)));
      setNotice(`Saved updates for ${haven.name} ✓`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function registerNewHaven(e: React.FormEvent) {
    e.preventDefault();
    if (busyId) return;
    setBusyId('register-haven');
    setError(null);
    setNotice(null);
    try {
      const created = await apiFetch<PartnerHaven>('/safe-havens/register', {
        method: 'POST',
        idempotencyKey: createIdempotencyKey('partner-register'),
        body: JSON.stringify({
          name: newForm.name,
          category: newForm.category,
          address: newForm.address,
          city: newForm.city,
          latitude: Number(newForm.latitude),
          longitude: Number(newForm.longitude),
          phone: newForm.phone,
          contactEmail: newForm.contactEmail || undefined,
          logoUrl: newForm.logoUrl || undefined,
          responsiblePersonName: newForm.responsiblePersonName,
          responsiblePersonPhone: newForm.responsiblePersonPhone,
          operatingHoursJson: { display: newForm.operatingHoursDisplay },
          assistanceServices: newForm.servicesCsv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          assistanceCommitments: newForm.assistanceCommitments,
          licenceNumber: newForm.licenceNumber,
          verificationDocumentsJson: newForm.verificationDocRef
            ? { reference: newForm.verificationDocRef }
            : undefined,
          partnershipAgreementJson: { accepted: newForm.agreementAccepted, version: '2026.1' },
          agreementAccepted: newForm.agreementAccepted,
        }),
      });
      setHavens((prev) => [created, ...prev]);
      setTotal((t) => t + 1);
      setShowRegister(false);
      setNotice('Application submitted – Pending review ✓');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <StandardCard>
        <PageHeader
          eyebrow="Safe Haven Network"
          title="Safe Haven Partner Portal"
          subtitle="Manage verified facilities, operating hours, agreed assistance services, and participation status."
          actions={
            <PrimaryButton tone="safe" onClick={() => setShowRegister(true)}>
              <PlusCircle className="h-4 w-4" />
              <span>Register Establishment</span>
            </PrimaryButton>
          }
        />
      </StandardCard>

      {error && <Toast tone="error" message={error} onDismiss={() => setError(null)} />}
      {notice && <Toast tone="success" message={notice} onDismiss={() => setNotice(null)} />}

      <StandardCard className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          placeholder="Search your venues by name, city, or licence..."
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          className="min-w-[240px] flex-1"
        />
        <FilterChipGroup
          value={statusFilter}
          onChange={(next) => {
            setStatusFilter(next);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
        />
      </StandardCard>

      <Modal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        title="Register Safe Haven"
        subtitle="Submit facility details for Herway safety team review"
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={registerNewHaven} className="grid gap-4 tablet:grid-cols-2">
          <StandardInput
            label="Establishment Name"
            required
            placeholder="Name"
            value={newForm.name}
            onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#131A20]">Category</label>
            <select
              value={newForm.category}
              onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
              className="h-[50px] w-full rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] px-4 text-[15px] font-medium text-[#131A20] focus:border-[#00B6C7] focus:bg-white focus:outline-none"
            >
              <option value="HOTEL">Hotel</option>
              <option value="HOSTEL">Hostel</option>
              <option value="HOSPITAL">Hospital</option>
              <option value="CLINIC">Clinic</option>
              <option value="PHARMACY">Pharmacy</option>
              <option value="TOURIST_ASSISTANCE_CENTRE">Tourist Assistance Centre</option>
            </select>
          </div>

          <div className="tablet:col-span-2">
            <StandardInput
              label="Street Address"
              required
              placeholder="Address"
              value={newForm.address}
              onChange={(e) => setNewForm({ ...newForm, address: e.target.value })}
            />
          </div>

          <StandardInput
            label="City"
            required
            placeholder="City"
            value={newForm.city}
            onChange={(e) => setNewForm({ ...newForm, city: e.target.value })}
          />
          <StandardInput
            label="Licence Number"
            required
            placeholder="Licence number"
            value={newForm.licenceNumber}
            onChange={(e) => setNewForm({ ...newForm, licenceNumber: e.target.value })}
          />
          <StandardInput
            label="Assistance Phone"
            required
            placeholder="Phone"
            value={newForm.phone}
            onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
          />
          <StandardInput
            label="Contact Email"
            type="email"
            placeholder="Email"
            value={newForm.contactEmail}
            onChange={(e) => setNewForm({ ...newForm, contactEmail: e.target.value })}
          />
          <StandardInput
            label="Logo / Image URL"
            placeholder="Image URL"
            value={newForm.logoUrl}
            onChange={(e) => setNewForm({ ...newForm, logoUrl: e.target.value })}
          />
          <StandardInput
            label="Verification Document URL"
            placeholder="Document URL"
            value={newForm.verificationDocRef}
            onChange={(e) => setNewForm({ ...newForm, verificationDocRef: e.target.value })}
          />
          <StandardInput
            label="Operating Hours"
            required
            placeholder="Open 24 Hours"
            value={newForm.operatingHoursDisplay}
            onChange={(e) => setNewForm({ ...newForm, operatingHoursDisplay: e.target.value })}
          />
          <StandardInput
            label="Responsible Person Name"
            required
            placeholder="Contact person"
            value={newForm.responsiblePersonName}
            onChange={(e) => setNewForm({ ...newForm, responsiblePersonName: e.target.value })}
          />
          <StandardInput
            label="Responsible Person Phone"
            required
            placeholder="Contact phone"
            value={newForm.responsiblePersonPhone}
            onChange={(e) => setNewForm({ ...newForm, responsiblePersonPhone: e.target.value })}
          />

          <div className="tablet:col-span-2">
            <StandardInput
              label="Assistance Services (comma-separated)"
              placeholder="Services"
              value={newForm.servicesCsv}
              onChange={(e) => setNewForm({ ...newForm, servicesCsv: e.target.value })}
            />
          </div>

          <div className="space-y-1.5 tablet:col-span-2">
            <label className="block text-[13px] font-semibold text-[#131A20]">
              Assistance Commitments
            </label>
            <textarea
              rows={2}
              placeholder="Assistance notes"
              value={newForm.assistanceCommitments}
              onChange={(e) => setNewForm({ ...newForm, assistanceCommitments: e.target.value })}
              className="w-full rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] p-3 text-[14px] font-medium text-[#131A20] focus:border-[#00B6C7] focus:bg-white focus:outline-none"
            />
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-[#131A20] tablet:col-span-2">
            <input
              type="checkbox"
              checked={newForm.agreementAccepted}
              onChange={(e) => setNewForm({ ...newForm, agreementAccepted: e.target.checked })}
              className="h-4 w-4 accent-[#059669]"
            />
            <span>I accept the Safe Haven Partner terms and 24/7 assistance guidelines.</span>
          </label>

          <div className="tablet:col-span-2">
            <PrimaryButton
              type="submit"
              tone="safe"
              loading={busyId === 'register-haven'}
              disabled={busyId === 'register-haven'}
              className="w-full"
            >
              {busyId === 'register-haven' ? 'Submitting...' : 'Submit Application'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {loading && havens.length === 0 ? (
        <LoadingState label="Loading registered establishments..." />
      ) : havens.length === 0 ? (
        <EmptyState
          title="No establishments matched"
          description="Register your hotel, hostel, clinic, pharmacy, or tourist assistance centre to join the Herway Safe Haven network."
        />
      ) : (
        <div className="space-y-6">
          {havens.map((haven) => (
            <StandardCard key={haven.id} className="space-y-5">
              <div className="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="line-clamp-2 break-words text-[18px] font-extrabold leading-[24px] text-[#131A20] tablet:text-[20px]" title={haven.name}>
                    {haven.name}
                  </h2>
                  <p className="line-clamp-2 break-words text-[13px] font-medium text-[#646F78]">
                    {haven.address} • Licence: {haven.licenceNumber}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {haven.verifiedBadge && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#059669] px-3 py-1 text-[12px] font-bold text-white">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verified Safe Haven</span>
                    </span>
                  )}
                  <StatusBadge status={haven.approvalStatus} />
                </div>
              </div>

              <div className="grid gap-4 tablet:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#131A20]">
                    <Phone className="h-3.5 w-3.5 text-[#0099A8]" />
                    <span>Assistance Desk Phone</span>
                  </label>
                  <StandardInput
                    value={haven.phone}
                    onChange={(e) =>
                      setHavens((prev) =>
                        prev.map((h) => (h.id === haven.id ? { ...h, phone: e.target.value } : h)),
                      )
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[13px] font-semibold text-[#131A20]">
                    <Clock className="h-3.5 w-3.5 text-[#0099A8]" />
                    <span>Operating Hours</span>
                  </label>
                  <StandardInput
                    value={haven.operatingHoursJson?.display || ''}
                    onChange={(e) =>
                      setHavens((prev) =>
                        prev.map((h) =>
                          h.id === haven.id
                            ? {
                                ...h,
                                operatingHoursJson: {
                                  ...h.operatingHoursJson,
                                  display: e.target.value,
                                },
                              }
                            : h,
                        ),
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#131A20]">
                    Active Participation Status
                  </p>
                  <p className="text-[13px] font-medium text-[#646F78]">
                    Toggle off temporarily if closed or undergoing maintenance.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={haven.isActive}
                  aria-label={`Active status for ${haven.name}`}
                  onChange={(e) =>
                    setHavens((prev) =>
                      prev.map((h) => (h.id === haven.id ? { ...h, isActive: e.target.checked } : h)),
                    )
                  }
                  className="h-5 w-5 cursor-pointer accent-[#059669]"
                />
              </div>

              <PrimaryButton
                tone="safe"
                loading={busyId === `save-${haven.id}`}
                disabled={busyId === `save-${haven.id}`}
                onClick={() => saveFacility(haven)}
              >
                {busyId === `save-${haven.id}` ? 'Saving...' : 'Save Facility Updates'}
              </PrimaryButton>
            </StandardCard>
          ))}

          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={total}
            loading={loading}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
