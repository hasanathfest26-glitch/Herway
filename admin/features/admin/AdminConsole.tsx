'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Eye,
  FileText,
  RefreshCw,
  Settings,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import {
  DataTable,
  DataTableColumn,
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  Modal,
  PageHeader,
  PaginationControls,
  PrimaryButton,
  SearchInput,
  SecondaryButton,
  SmallButton,
  StandardCard,
  StandardInput,
  Toast,
} from '@/components/ui';
import { apiFetch } from '@/features/api';
import { useWebAuth } from '@/features/auth/AuthProvider';

type AdminTab =
  | 'verifications'
  | 'safe-havens'
  | 'emergency'
  | 'users'
  | 'bookings'
  | 'reports'
  | 'notifications'
  | 'settings'
  | 'audit';

interface PaginatedMeta {
  pendingCount?: number;
  activeCount?: number;
  openDisputeCount?: number;
  openCount?: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  meta?: PaginatedMeta;
}

interface VerificationItem {
  id: string;
  role: string;
  ageVerified18Plus: boolean;
  liveSelfiePath?: string | null;
  idDocumentPath?: string | null;
  licenceReference?: string | null;
  notes?: string | null;
  reviewNotes?: string | null;
  status: string;
  createdAt: string;
  user: { fullName: string; email: string; homeCity?: string | null; gender: string };
}

interface SafeHavenItem {
  id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  contactEmail?: string | null;
  logoUrl?: string | null;
  operatingHoursJson?: { display?: string };
  licenceNumber: string;
  assistanceServices: string[];
  approvalStatus: string;
  approvalNotes?: string | null;
  verifiedBadge: boolean;
  isDemoData?: boolean;
  isActive: boolean;
  approvedAt?: string | null;
  lastRecheckedAt?: string | null;
  _count?: { reports: number };
}

interface SafeHavenReportItem {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  safeHaven: { name: string; city: string };
  reporter: { fullName: string; email: string };
}

interface SosIncidentItem {
  id: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  message?: string | null;
  triggeredAt: string;
  user: { fullName: string; email: string; homeCity?: string | null };
  deliveries: Array<{ id: string; recipientLabel: string; deliveryStatus: string }>;
}

interface AdminUserItem {
  id: string;
  fullName: string;
  email: string;
  homeCity?: string | null;
  roles: string[];
  status: string;
  emailVerifiedAt?: string | null;
}

interface AdminBookingItem {
  id: string;
  activitySummary: string;
  status: string;
  disputeStatus: string;
  disputeNotes?: string | null;
  meetingPointName?: string | null;
  startAt?: string;
  traveller: { fullName: string };
  buddy: { fullName: string };
}

interface UserReportItem {
  id: string;
  actionType: string;
  reason: string;
  details?: string | null;
  status: string;
  reporter: { fullName: string };
  targetUser: { fullName: string };
}

interface SettingItem {
  key: string;
  valueJson: Record<string, unknown>;
  description?: string | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  detailsJson?: Record<string, unknown> | null;
  createdAt: string;
  actor?: { fullName: string; email: string } | null;
}

function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function AdminConsole() {
  const { user, loading: authLoading } = useWebAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('verifications');
  const [loadingTab, setLoadingTab] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Badge counts fetched quietly
  const [counts, setCounts] = useState({
    verificationsPending: 0,
    havensPending: 0,
    incidentsActive: 0,
    usersTotal: 0,
    openDisputes: 0,
    openReports: 0,
  });

  // Tab states with server-side search, status filter, and pagination
  const [verifSearch, setVerifSearch] = useState('');
  const debouncedVerifSearch = useDebouncedValue(verifSearch);
  const [verifFilter, setVerifFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [verifPage, setVerifPage] = useState(1);
  const [verifPageSize, setVerifPageSize] = useState(10);
  const [verifData, setVerifData] = useState<PaginatedResult<VerificationItem>>({
    items: [],
    total: 0,
    limit: 10,
    skip: 0,
    hasMore: false,
  });
  const [inspectVerif, setInspectVerif] = useState<VerificationItem | null>(null);

  const [havenSearch, setHavenSearch] = useState('');
  const debouncedHavenSearch = useDebouncedValue(havenSearch);
  const [havenFilter, setHavenFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED_OR_SUSPENDED'>('ALL');
  const [havenPage, setHavenPage] = useState(1);
  const [havenPageSize, setHavenPageSize] = useState(10);
  const [havenData, setHavenData] = useState<PaginatedResult<SafeHavenItem>>({
    items: [],
    total: 0,
    limit: 10,
    skip: 0,
    hasMore: false,
  });
  const [safeHavenReports, setSafeHavenReports] = useState<SafeHavenReportItem[]>([]);
  const [havenReasonMap, setHavenReasonMap] = useState<Record<string, string>>({});
  const [inspectHaven, setInspectHaven] = useState<SafeHavenItem | null>(null);

  const [incSearch, setIncSearch] = useState('');
  const debouncedIncSearch = useDebouncedValue(incSearch);
  const [incStatus, setIncStatus] = useState<'ALL' | 'ACTIVE' | 'RESOLVED' | 'FALSE_ALARM'>('ALL');
  const [incPage, setIncPage] = useState(1);
  const [incPageSize, setIncPageSize] = useState(10);
  const [incData, setIncData] = useState<PaginatedResult<SosIncidentItem>>({
    items: [],
    total: 0,
    limit: 10,
    skip: 0,
    hasMore: false,
  });
  const [inspectIncident, setInspectIncident] = useState<SosIncidentItem | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const debouncedUserSearch = useDebouncedValue(userSearch);
  const [userStatus, setUserStatus] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [userRole, setUserRole] = useState<string>('ALL');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [userData, setUserData] = useState<PaginatedResult<AdminUserItem>>({
    items: [],
    total: 0,
    limit: 10,
    skip: 0,
    hasMore: false,
  });

  const [bookingSearch, setBookingSearch] = useState('');
  const debouncedBookingSearch = useDebouncedValue(bookingSearch);
  const [bookingStatus, setBookingStatus] = useState<string>('ALL');
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingPageSize, setBookingPageSize] = useState(10);
  const [bookingData, setBookingData] = useState<PaginatedResult<AdminBookingItem>>({
    items: [],
    total: 0,
    limit: 10,
    skip: 0,
    hasMore: false,
  });
  const [inspectBooking, setInspectBooking] = useState<AdminBookingItem | null>(null);

  const [reportSearch, setReportSearch] = useState('');
  const debouncedReportSearch = useDebouncedValue(reportSearch);
  const [reportStatus, setReportStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'DISMISSED'>('ALL');
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);
  const [reportData, setReportData] = useState<PaginatedResult<UserReportItem>>({
    items: [],
    total: 0,
    limit: 10,
    skip: 0,
    hasMore: false,
  });

  const [auditSearch, setAuditSearch] = useState('');
  const debouncedAuditSearch = useDebouncedValue(auditSearch);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);
  const [auditData, setAuditData] = useState<PaginatedResult<AuditLogItem>>({
    items: [],
    total: 0,
    limit: 20,
    skip: 0,
    hasMore: false,
  });
  const [inspectAudit, setInspectAudit] = useState<AuditLogItem | null>(null);

  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [settingKey, setSettingKey] = useState('default_checkin_grace_minutes');
  const [settingValue, setSettingValue] = useState('{"minutes": 20}');

  const loadSummaryCounts = useCallback(async () => {
    try {
      const [v, sh, inc, u, b, r] = await Promise.all([
        apiFetch<PaginatedResult<VerificationItem>>('/verification/admin/all?paginated=true&limit=1'),
        apiFetch<PaginatedResult<SafeHavenItem>>('/safe-havens/admin/all?paginated=true&limit=1'),
        apiFetch<PaginatedResult<SosIncidentItem>>('/emergency/admin/incidents?paginated=true&limit=1'),
        apiFetch<PaginatedResult<AdminUserItem>>('/users/admin/all?paginated=true&limit=1'),
        apiFetch<PaginatedResult<AdminBookingItem>>('/bookings/admin/all?paginated=true&limit=1'),
        apiFetch<PaginatedResult<UserReportItem>>('/users/admin/reports?paginated=true&limit=1'),
      ]);
      setCounts({
        verificationsPending: v.meta?.pendingCount ?? 0,
        havensPending: sh.meta?.pendingCount ?? 0,
        incidentsActive: inc.meta?.activeCount ?? 0,
        usersTotal: u.total,
        openDisputes: b.meta?.openDisputeCount ?? 0,
        openReports: r.meta?.openCount ?? 0,
      });
    } catch {
      // Tab fetch surfaces explicit error state if backend is down
    }
  }, []);

  const loadActiveTabData = useCallback(async () => {
    if (!user?.roles.includes('ADMIN')) return;
    setLoadingTab(true);
    setErrorMessage(null);
    try {
      if (activeTab === 'verifications') {
        const qs = new URLSearchParams({
          paginated: 'true',
          page: String(verifPage),
          limit: String(verifPageSize),
        });
        if (verifFilter !== 'ALL') qs.set('status', verifFilter);
        if (debouncedVerifSearch.trim()) qs.set('search', debouncedVerifSearch.trim());
        const res = await apiFetch<PaginatedResult<VerificationItem>>(
          `/verification/admin/all?${qs.toString()}`,
        );
        setVerifData(res);
        setCounts((c) => ({ ...c, verificationsPending: res.meta?.pendingCount ?? c.verificationsPending }));
      } else if (activeTab === 'safe-havens') {
        const qs = new URLSearchParams({
          paginated: 'true',
          page: String(havenPage),
          limit: String(havenPageSize),
        });
        if (havenFilter !== 'ALL') qs.set('status', havenFilter);
        if (debouncedHavenSearch.trim()) qs.set('search', debouncedHavenSearch.trim());
        const [res, repRes] = await Promise.all([
          apiFetch<PaginatedResult<SafeHavenItem>>(`/safe-havens/admin/all?${qs.toString()}`),
          apiFetch<PaginatedResult<SafeHavenReportItem>>('/safe-havens/admin/reports?paginated=true&limit=10'),
        ]);
        setHavenData(res);
        setSafeHavenReports(repRes.items);
        setCounts((c) => ({ ...c, havensPending: res.meta?.pendingCount ?? c.havensPending }));
      } else if (activeTab === 'emergency') {
        const qs = new URLSearchParams({
          paginated: 'true',
          page: String(incPage),
          limit: String(incPageSize),
        });
        if (incStatus !== 'ALL') qs.set('status', incStatus);
        if (debouncedIncSearch.trim()) qs.set('search', debouncedIncSearch.trim());
        const res = await apiFetch<PaginatedResult<SosIncidentItem>>(
          `/emergency/admin/incidents?${qs.toString()}`,
        );
        setIncData(res);
        setCounts((c) => ({ ...c, incidentsActive: res.meta?.activeCount ?? c.incidentsActive }));
      } else if (activeTab === 'users') {
        const qs = new URLSearchParams({
          paginated: 'true',
          page: String(userPage),
          limit: String(userPageSize),
        });
        if (userStatus !== 'ALL') qs.set('status', userStatus);
        if (userRole !== 'ALL') qs.set('role', userRole);
        if (debouncedUserSearch.trim()) qs.set('search', debouncedUserSearch.trim());
        const res = await apiFetch<PaginatedResult<AdminUserItem>>(
          `/users/admin/all?${qs.toString()}`,
        );
        setUserData(res);
        setCounts((c) => ({ ...c, usersTotal: res.total }));
      } else if (activeTab === 'bookings') {
        const qs = new URLSearchParams({
          paginated: 'true',
          page: String(bookingPage),
          limit: String(bookingPageSize),
        });
        if (bookingStatus === 'DISPUTE_OPEN') {
          qs.set('disputeStatus', 'OPEN');
        } else if (bookingStatus !== 'ALL') {
          qs.set('status', bookingStatus);
        }
        if (debouncedBookingSearch.trim()) qs.set('search', debouncedBookingSearch.trim());
        const res = await apiFetch<PaginatedResult<AdminBookingItem>>(
          `/bookings/admin/all?${qs.toString()}`,
        );
        setBookingData(res);
        setCounts((c) => ({ ...c, openDisputes: res.meta?.openDisputeCount ?? c.openDisputes }));
      } else if (activeTab === 'reports') {
        const qs = new URLSearchParams({
          paginated: 'true',
          page: String(reportPage),
          limit: String(reportPageSize),
        });
        if (reportStatus !== 'ALL') qs.set('status', reportStatus);
        if (debouncedReportSearch.trim()) qs.set('search', debouncedReportSearch.trim());
        const res = await apiFetch<PaginatedResult<UserReportItem>>(
          `/users/admin/reports?${qs.toString()}`,
        );
        setReportData(res);
        setCounts((c) => ({ ...c, openReports: res.meta?.openCount ?? c.openReports }));
      } else if (activeTab === 'settings') {
        const list = await apiFetch<SettingItem[]>('/users/admin/settings');
        setSettings(list);
      } else if (activeTab === 'audit') {
        const qs = new URLSearchParams({
          paginated: 'true',
          page: String(auditPage),
          limit: String(auditPageSize),
        });
        if (debouncedAuditSearch.trim()) qs.set('search', debouncedAuditSearch.trim());
        const res = await apiFetch<PaginatedResult<AuditLogItem>>(
          `/users/admin/audit-logs?${qs.toString()}`,
        );
        setAuditData(res);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoadingTab(false);
    }
  }, [
    user,
    activeTab,
    verifPage,
    verifPageSize,
    verifFilter,
    debouncedVerifSearch,
    havenPage,
    havenPageSize,
    havenFilter,
    debouncedHavenSearch,
    incPage,
    incPageSize,
    incStatus,
    debouncedIncSearch,
    userPage,
    userPageSize,
    userStatus,
    userRole,
    debouncedUserSearch,
    bookingPage,
    bookingPageSize,
    bookingStatus,
    debouncedBookingSearch,
    reportPage,
    reportPageSize,
    reportStatus,
    debouncedReportSearch,
    auditPage,
    auditPageSize,
    debouncedAuditSearch,
  ]);

  useEffect(() => {
    if (user?.roles.includes('ADMIN')) {
      void loadSummaryCounts();
    }
  }, [user, loadSummaryCounts]);

  useEffect(() => {
    if (user?.roles.includes('ADMIN')) {
      void loadActiveTabData();
    }
  }, [user, loadActiveTabData]);

  if (authLoading) {
    return <LoadingState label="Checking administrator session..." />;
  }

  if (!user || !user.roles.includes('ADMIN')) {
    return (
      <div className="mx-auto mt-8 max-w-lg">
        <StandardCard className="flex flex-col items-center space-y-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C5EFF2] text-[#0099A8]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-[20px] font-extrabold text-[#131A20]">
            Administrator Authentication Required
          </h1>
          <p className="text-[14px] font-medium text-[#646F78]">
            Only authorised platform administrators can access sensitive user verifications, Safe Haven approvals, safety reports, and SOS incident logs.
          </p>
          <Link
            href="/login"
            className="inline-flex h-12 min-h-[48px] items-center justify-center rounded-[12px] bg-[#00B6C7] px-6 text-[15px] font-bold text-white shadow-teal-glow hover:bg-[#0099A8]"
          >
            Sign in with Admin Account
          </Link>
        </StandardCard>
      </div>
    );
  }

  async function handleVerificationDecision(id: string, decision: 'APPROVED' | 'REJECTED') {
    if (busyId === id) return;
    setBusyId(id);
    setErrorMessage(null);
    try {
      await apiFetch(`/verification/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status: decision, reviewNotes: `Reviewed by ${user?.fullName}` }),
      });
      setVerifData((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === id ? { ...item, status: decision } : item)),
      }));
      if (inspectVerif?.id === id) {
        setInspectVerif((prev) => (prev ? { ...prev, status: decision } : null));
      }
      setStatusMessage(`Verification marked ${decision}.`);
      void loadSummaryCounts();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSafeHavenDecision(
    id: string,
    approvalStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  ) {
    if (busyId === id) return;
    setBusyId(id);
    setErrorMessage(null);
    try {
      const approvalNotes =
        havenReasonMap[id]?.trim() || `Marked ${approvalStatus} by ${user?.fullName}`;
      const updated = await apiFetch<SafeHavenItem>(`/safe-havens/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus, approvalNotes }),
      });
      setHavenData((prev) => ({
        ...prev,
        items: prev.items.map((h) => (h.id === id ? { ...h, ...updated } : h)),
      }));
      if (inspectHaven?.id === id) {
        setInspectHaven((prev) => (prev ? { ...prev, ...updated } : null));
      }
      setStatusMessage(`Safe Haven updated to ${approvalStatus}.`);
      void loadSummaryCounts();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRecheckSafeHaven(id: string) {
    if (busyId === id) return;
    setBusyId(id);
    try {
      const updated = await apiFetch<SafeHavenItem>(`/safe-havens/${id}/recheck`, {
        method: 'PATCH',
        body: JSON.stringify({
          notes: `Periodic verification recheck completed by ${user?.fullName}`,
        }),
      });
      setHavenData((prev) => ({
        ...prev,
        items: prev.items.map((h) => (h.id === id ? { ...h, ...updated } : h)),
      }));
      setStatusMessage('Safe Haven periodic recheck recorded (next check in 90 days).');
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteSafeHaven(id: string, name: string) {
    if (busyId === id) return;
    setBusyId(id);
    setErrorMessage(null);
    try {
      await apiFetch(`/safe-havens/${id}`, { method: 'DELETE' });
      setHavenData((prev) => ({
        ...prev,
        items: prev.items.filter((h) => h.id !== id),
        total: Math.max(0, prev.total - 1),
      }));
      if (inspectHaven?.id === id) setInspectHaven(null);
      setStatusMessage(`Removed "${name}" from database.`);
      void loadSummaryCounts();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleUserRole(targetUser: AdminUserItem, role: string) {
    if (busyId === targetUser.id) return;
    setBusyId(targetUser.id);
    setErrorMessage(null);
    try {
      const exists = targetUser.roles.includes(role);
      const nextRoles = exists
        ? targetUser.roles.filter((r) => r !== role)
        : [...targetUser.roles, role];
      const finalRoles = nextRoles.length > 0 ? nextRoles : ['TRAVELLER'];
      await apiFetch(`/users/admin/${targetUser.id}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles: finalRoles }),
      });
      setUserData((prev) => ({
        ...prev,
        items: prev.items.map((u) => (u.id === targetUser.id ? { ...u, roles: finalRoles } : u)),
      }));
      setStatusMessage(`Updated roles for ${targetUser.fullName}.`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUserStatus(targetId: string, status: 'ACTIVE' | 'SUSPENDED') {
    if (busyId === targetId) return;
    setBusyId(targetId);
    try {
      await apiFetch(`/users/admin/${targetId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setUserData((prev) => ({
        ...prev,
        items: prev.items.map((u) => (u.id === targetId ? { ...u, status } : u)),
      }));
      setStatusMessage(`User status updated to ${status}.`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleBookingStatus(
    bookingId: string,
    status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
  ) {
    if (busyId === bookingId) return;
    setBusyId(bookingId);
    setErrorMessage(null);
    try {
      await apiFetch(`/bookings/admin/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setBookingData((prev) => ({
        ...prev,
        items: prev.items.map((b) => (b.id === bookingId ? { ...b, status } : b)),
      }));
      setStatusMessage(`Booking status updated to ${status}.`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolveDispute(bookingId: string) {
    if (busyId === bookingId) return;
    setBusyId(bookingId);
    try {
      await apiFetch(`/bookings/${bookingId}/dispute/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: `Resolved by admin ${user?.fullName}` }),
      });
      setBookingData((prev) => ({
        ...prev,
        items: prev.items.map((b) =>
          b.id === bookingId ? { ...b, disputeStatus: 'RESOLVED' } : b,
        ),
      }));
      setStatusMessage('Booking dispute marked resolved.');
      void loadSummaryCounts();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolveReport(reportId: string, status: 'RESOLVED' | 'DISMISSED') {
    if (busyId === reportId) return;
    setBusyId(reportId);
    try {
      await apiFetch(`/users/admin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNotes: `Reviewed by ${user?.fullName}` }),
      });
      setReportData((prev) => ({
        ...prev,
        items: prev.items.map((r) => (r.id === reportId ? { ...r, status } : r)),
      }));
      setStatusMessage(`Report marked ${status}.`);
      void loadSummaryCounts();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolveIncident(id: string) {
    if (busyId === id) return;
    setBusyId(id);
    try {
      await apiFetch(`/emergency/sos/${id}/resolve`, { method: 'PATCH' });
      setIncData((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === id ? { ...i, status: 'RESOLVED' } : i)),
      }));
      if (inspectIncident?.id === id) {
        setInspectIncident((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
      }
      setStatusMessage('SOS Incident marked resolved.');
      void loadSummaryCounts();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (busyId === 'broadcast') return;
    setBusyId('broadcast');
    try {
      const res = await apiFetch<{ deliveredCount?: number; sentCount?: number }>(
        '/notifications/admin/broadcast',
        {
          method: 'POST',
          body: JSON.stringify({ title: broadcastTitle, body: broadcastBody }),
        },
      );
      setBroadcastTitle('');
      setBroadcastBody('');
      setStatusMessage(
        `Broadcast delivered to ${res.deliveredCount ?? res.sentCount ?? 0} active user(s).`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveSetting(e: React.FormEvent) {
    e.preventDefault();
    if (busyId === 'save-setting') return;
    setBusyId('save-setting');
    try {
      const parsed = JSON.parse(settingValue) as Record<string, unknown>;
      const saved = await apiFetch<SettingItem>('/users/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: settingKey, valueJson: parsed }),
      });
      setSettings((prev) => {
        const exists = prev.some((s) => s.key === saved.key);
        return exists ? prev.map((s) => (s.key === saved.key ? saved : s)) : [saved, ...prev];
      });
      setStatusMessage(`Platform setting "${settingKey}" saved.`);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof UserCheck; count?: number }> = [
    { id: 'verifications', label: 'Verifications', icon: UserCheck, count: counts.verificationsPending },
    { id: 'safe-havens', label: 'Safe Havens', icon: Building2, count: counts.havensPending },
    { id: 'emergency', label: 'SOS Incidents', icon: ShieldAlert, count: counts.incidentsActive },
    { id: 'users', label: 'Users', icon: Users, count: counts.usersTotal },
    { id: 'bookings', label: 'Bookings & Disputes', icon: CalendarCheck, count: counts.openDisputes },
    { id: 'reports', label: 'Safety Reports', icon: AlertTriangle, count: counts.openReports },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
  ];

  const userColumns: DataTableColumn<AdminUserItem>[] = [
    {
      key: 'user',
      header: 'User',
      minWidthClass: 'min-w-[220px]',
      render: (u) => (
        <div className="min-w-0 max-w-[260px]">
          <div className="truncate font-bold text-[#131A20]" title={u.fullName}>
            {u.fullName}
          </div>
          <div className="truncate text-[12px] text-[#646F78]" title={u.email}>
            {u.email}
          </div>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'City',
      minWidthClass: 'min-w-[120px]',
      render: (u) => (
        <span className="line-clamp-1 text-[#525D66]">{u.homeCity || '-'}</span>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      minWidthClass: 'min-w-[250px]',
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          {(['TRAVELLER', 'TRAVEL_BUDDY', 'SAFE_HAVEN_PARTNER', 'ADMIN'] as const).map((role) => {
            const active = u.roles.includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => handleToggleUserRole(u, role)}
                disabled={busyId === u.id}
                title={`Toggle ${role}`}
                className={`min-h-[28px] rounded-[8px] px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-55 ${
                  active
                    ? 'bg-[#00B6C7] text-white'
                    : 'bg-[#F5F4EE] text-[#525D66] hover:bg-[#E2E6E9]'
                }`}
              >
                {role.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      minWidthClass: 'min-w-[110px]',
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      minWidthClass: 'min-w-[120px]',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end">
          {u.status === 'ACTIVE' ? (
            <SmallButton
              tone="danger"
              disabled={busyId === u.id}
              loading={busyId === u.id}
              onClick={() => handleUserStatus(u.id, 'SUSPENDED')}
            >
              Suspend
            </SmallButton>
          ) : (
            <SmallButton
              tone="safe"
              disabled={busyId === u.id}
              loading={busyId === u.id}
              onClick={() => handleUserStatus(u.id, 'ACTIVE')}
            >
              Activate
            </SmallButton>
          )}
        </div>
      ),
    },
  ];

  const bookingColumns: DataTableColumn<AdminBookingItem>[] = [
    {
      key: 'activity',
      header: 'Booking Activity',
      minWidthClass: 'min-w-[240px]',
      render: (b) => (
        <div className="min-w-0 max-w-[300px] space-y-1">
          <div className="line-clamp-2 font-bold text-[#131A20]">{b.activitySummary}</div>
          <div className="truncate text-[12px] text-[#646F78]">
            Spot: {b.meetingPointName || 'Pending'}
          </div>
          {b.disputeNotes && (
            <div className="line-clamp-1 text-[12px] font-semibold text-[#DC2626]">
              Dispute: {b.disputeNotes}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'participants',
      header: 'Participants',
      minWidthClass: 'min-w-[200px]',
      render: (b) => (
        <div className="min-w-0 max-w-[220px] space-y-0.5 text-[13px]">
          <div className="truncate text-[#131A20]">Traveller: {b.traveller.fullName}</div>
          <div className="truncate text-[#646F78]">Buddy: {b.buddy.fullName}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      minWidthClass: 'min-w-[140px]',
      render: (b) => (
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={b.status} />
          {b.disputeStatus && b.disputeStatus !== 'NONE' && (
            <StatusBadge status={b.disputeStatus} />
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      minWidthClass: 'min-w-[260px]',
      align: 'right',
      render: (b) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <SmallButton onClick={() => setInspectBooking(b)}>
            <Eye className="h-3.5 w-3.5" />
            <span>Details</span>
          </SmallButton>
          {b.status === 'REQUESTED' && (
            <SmallButton
              tone="safe"
              disabled={busyId === b.id}
              onClick={() => handleBookingStatus(b.id, 'CONFIRMED')}
            >
              Confirm
            </SmallButton>
          )}
          {(b.status === 'CONFIRMED' || b.status === 'ACCEPTED') && (
            <SmallButton
              tone="primary"
              disabled={busyId === b.id}
              onClick={() => handleBookingStatus(b.id, 'COMPLETED')}
            >
              Complete
            </SmallButton>
          )}
          {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
            <SmallButton
              tone="danger"
              disabled={busyId === b.id}
              onClick={() => handleBookingStatus(b.id, 'CANCELLED')}
            >
              Cancel
            </SmallButton>
          )}
          {b.disputeStatus === 'OPEN' && (
            <SmallButton
              tone="dark"
              disabled={busyId === b.id}
              onClick={() => handleResolveDispute(b.id)}
            >
              Resolve
            </SmallButton>
          )}
        </div>
      ),
    },
  ];

  const reportColumns: DataTableColumn<UserReportItem>[] = [
    {
      key: 'type',
      header: 'Type',
      minWidthClass: 'min-w-[100px]',
      render: (r) => (
        <span className="text-[12px] font-bold uppercase text-[#DC2626]">{r.actionType}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason & Parties',
      minWidthClass: 'min-w-[280px]',
      render: (r) => (
        <div className="max-w-[360px] space-y-0.5">
          <div className="line-clamp-2 font-bold text-[#131A20]">{r.reason}</div>
          <div className="truncate text-[12px] text-[#646F78]">
            By {r.reporter.fullName} against {r.targetUser.fullName}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      minWidthClass: 'min-w-[110px]',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      minWidthClass: 'min-w-[170px]',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.status === 'OPEN' ? (
            <>
              <SmallButton
                tone="safe"
                disabled={busyId === r.id}
                onClick={() => handleResolveReport(r.id, 'RESOLVED')}
              >
                Resolve
              </SmallButton>
              <SmallButton
                disabled={busyId === r.id}
                onClick={() => handleResolveReport(r.id, 'DISMISSED')}
              >
                Dismiss
              </SmallButton>
            </>
          ) : (
            <span className="text-[12px] text-[#646F78]">Closed</span>
          )}
        </div>
      ),
    },
  ];

  const auditColumns: DataTableColumn<AuditLogItem>[] = [
    {
      key: 'action',
      header: 'Action',
      minWidthClass: 'min-w-[220px]',
      render: (log) => (
        <span className="font-mono text-[12px] font-bold text-[#131A20] break-all">
          {log.action}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      minWidthClass: 'min-w-[180px]',
      render: (log) => (
        <span className="text-[13px] text-[#525D66]">{log.actor?.fullName || 'System'}</span>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      minWidthClass: 'min-w-[140px]',
      render: (log) => <span className="text-[12px] font-semibold text-[#646F78]">{log.targetType}</span>,
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      minWidthClass: 'min-w-[180px]',
      render: (log) => (
        <span className="whitespace-nowrap text-[12px] text-[#646F78]">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Payload',
      minWidthClass: 'min-w-[100px]',
      align: 'right',
      render: (log) => (
        <div className="flex justify-end">
          <SmallButton onClick={() => setInspectAudit(log)}>Inspect</SmallButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <StandardCard>
        <PageHeader
          eyebrow="Operations"
          title="Admin Console"
          subtitle={`Signed in as ${user.fullName}`}
          actions={
            <PrimaryButton
              onClick={() => {
                void loadSummaryCounts();
                void loadActiveTabData();
              }}
              disabled={loadingTab}
              loading={loadingTab}
            >
              <RefreshCw className={`h-4 w-4 ${loadingTab ? 'animate-spin' : ''}`} />
              <span>{loadingTab ? 'Refreshing...' : 'Refresh'}</span>
            </PrimaryButton>
          }
        />
      </StandardCard>

      {errorMessage && (
        <Toast tone="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}
      {statusMessage && (
        <Toast tone="success" message={statusMessage} onDismiss={() => setStatusMessage(null)} />
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
        {tabs.map(({ id, label, icon: Icon, count }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(id)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border px-3.5 py-2 text-[13px] font-semibold transition ${
                active
                  ? 'border-[#00B6C7] bg-[#00B6C7] text-white shadow-teal-glow'
                  : 'border-[#E2E6E9] bg-white text-[#525D66] hover:bg-[#F5F4EE] hover:text-[#131A20]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    active ? 'bg-white/25 text-white' : 'bg-[#E9F7F7] text-[#0099A8]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'verifications' && (
        <div className="space-y-4">
          <StandardCard className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SearchInput
                placeholder="Search applicant name, email, city, or licence..."
                value={verifSearch}
                onChange={(val) => {
                  setVerifSearch(val);
                  setVerifPage(1);
                }}
                className="min-w-[240px] flex-1"
              />
              <FilterChipGroup
                value={verifFilter}
                onChange={(next) => {
                  setVerifFilter(next);
                  setVerifPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'PENDING', label: 'Pending', count: counts.verificationsPending },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
              />
            </div>
          </StandardCard>

          {errorMessage ? (
            <ErrorState message={errorMessage} onRetry={loadActiveTabData} />
          ) : loadingTab && verifData.items.length === 0 ? (
            <LoadingState label="Loading verification applications..." />
          ) : verifData.items.length === 0 ? (
            <EmptyState
              title="No verification applications matched"
              description="Adjust your search or status filter."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
                {verifData.items.map((item) => (
                  <StandardCard key={item.id} className="flex flex-col justify-between gap-4">
                    <div className="min-w-0 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[12px] font-bold uppercase tracking-wide text-[#0099A8]">
                            {item.role.replace(/_/g, ' ')}
                          </span>
                          <h3 className="truncate text-[18px] font-bold text-[#131A20]" title={item.user.fullName}>
                            {item.user.fullName}
                          </h3>
                          <p className="truncate text-[13px] font-medium text-[#646F78]" title={item.user.email}>
                            {item.user.email} • {item.user.homeCity || 'Kerala'}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      <div className="space-y-1 rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] p-3 text-[13px] text-[#131A20]">
                        <p>
                          18+ Eligibility: {item.ageVerified18Plus ? 'Verified (18+)' : 'Unverified'}
                        </p>
                        <p className="truncate">Selfie Ref: {item.liveSelfiePath || 'Missing'}</p>
                        <p className="truncate">ID Ref: {item.idDocumentPath || 'Missing'}</p>
                        {item.notes && (
                          <p className="line-clamp-2 italic text-[#525D66]">&quot;{item.notes}&quot;</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SmallButton
                        tone="safe"
                        disabled={busyId === item.id}
                        loading={busyId === item.id}
                        onClick={() => handleVerificationDecision(item.id, 'APPROVED')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Approve Role</span>
                      </SmallButton>
                      <SmallButton
                        tone="danger"
                        disabled={busyId === item.id}
                        onClick={() => handleVerificationDecision(item.id, 'REJECTED')}
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject</span>
                      </SmallButton>
                      <SmallButton onClick={() => setInspectVerif(item)}>
                        <Eye className="h-4 w-4" />
                        <span>Inspect</span>
                      </SmallButton>
                    </div>
                  </StandardCard>
                ))}
              </div>

              <PaginationControls
                page={verifPage}
                pageSize={verifPageSize}
                total={verifData.total}
                loading={loadingTab}
                onPageChange={setVerifPage}
                onPageSizeChange={(s) => {
                  setVerifPageSize(s);
                  setVerifPage(1);
                }}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'safe-havens' && (
        <div className="space-y-5">
          <StandardCard className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SearchInput
                placeholder="Search venue name, city, street, or licence..."
                value={havenSearch}
                onChange={(val) => {
                  setHavenSearch(val);
                  setHavenPage(1);
                }}
                className="min-w-[240px] flex-1"
              />
              <FilterChipGroup
                value={havenFilter}
                onChange={(next) => {
                  setHavenFilter(next);
                  setHavenPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'PENDING', label: 'Pending', count: counts.havensPending },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED_OR_SUSPENDED', label: 'Rejected / Suspended' },
                ]}
              />
            </div>
          </StandardCard>

          {loadingTab && havenData.items.length === 0 ? (
            <LoadingState label="Loading Safe Havens..." />
          ) : havenData.items.length === 0 ? (
            <EmptyState title="No Safe Havens found" description="Try another search or status filter." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
                {havenData.items.map((haven) => (
                  <StandardCard key={haven.id} className="flex flex-col justify-between gap-4">
                    <div className="min-w-0 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {haven.logoUrl && (
                            <img
                              src={haven.logoUrl}
                              alt={haven.name}
                              className="h-12 w-12 shrink-0 rounded-[12px] border border-[#E2E6E9] object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[12px] font-bold uppercase text-[#646F78]">
                                {haven.category}
                              </span>
                              {haven.isDemoData && (
                                <span className="rounded-full border border-[#FCD34D] bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-bold text-[#92400E]">
                                  DEMO DATA
                                </span>
                              )}
                              {haven.verifiedBadge && haven.approvalStatus === 'APPROVED' && (
                                <span className="rounded-full bg-[#059669] px-2 py-0.5 text-[11px] font-bold text-white">
                                  Verified Badge
                                </span>
                              )}
                            </div>
                            <h3 className="mt-1 truncate text-[18px] font-bold text-[#131A20]" title={haven.name}>
                              {haven.name}
                            </h3>
                            <p className="line-clamp-2 text-[13px] font-medium text-[#525D66]">
                              {haven.city} — {haven.address}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={haven.approvalStatus} />
                      </div>

                      <div className="space-y-1 rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] p-3 text-[12px] text-[#131A20]">
                        <p className="truncate">
                          Licence: <span className="font-mono font-semibold">{haven.licenceNumber}</span>{' '}
                          • Phone: {haven.phone}
                        </p>
                        <p className="line-clamp-1">
                          Services: {haven.assistanceServices.join(' • ') || 'Standard'}
                        </p>
                        {haven.approvalNotes && (
                          <p className="line-clamp-1 font-semibold">Note: {haven.approvalNotes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SmallButton
                        tone="safe"
                        disabled={busyId === haven.id}
                        loading={busyId === haven.id}
                        onClick={() => handleSafeHavenDecision(haven.id, 'APPROVED')}
                      >
                        Approve &amp; Badge
                      </SmallButton>
                      <SmallButton
                        tone="danger"
                        disabled={busyId === haven.id}
                        onClick={() => handleSafeHavenDecision(haven.id, 'REJECTED')}
                      >
                        Reject
                      </SmallButton>
                      <SmallButton onClick={() => setInspectHaven(haven)}>
                        <Eye className="h-3.5 w-3.5" />
                        <span>Manage</span>
                      </SmallButton>
                    </div>
                  </StandardCard>
                ))}
              </div>

              <PaginationControls
                page={havenPage}
                pageSize={havenPageSize}
                total={havenData.total}
                loading={loadingTab}
                onPageChange={setHavenPage}
                onPageSizeChange={(s) => {
                  setHavenPageSize(s);
                  setHavenPage(1);
                }}
              />
            </>
          )}

          {safeHavenReports.length > 0 && (
            <StandardCard className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#131A20]">
                Recent Safe Haven Accuracy Reports
              </h3>
              <div className="space-y-2">
                {safeHavenReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] px-3.5 py-2.5 text-[13px]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-[#131A20]">{rep.safeHaven.name}</span> —{' '}
                      <span className="text-[#525D66]">{rep.reason}</span>
                    </div>
                    <StatusBadge status={rep.status} />
                  </div>
                ))}
              </div>
            </StandardCard>
          )}
        </div>
      )}

      {activeTab === 'emergency' && (
        <div className="space-y-4">
          <StandardCard className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              placeholder="Search SOS user name, city, or alert note..."
              value={incSearch}
              onChange={(val) => {
                setIncSearch(val);
                setIncPage(1);
              }}
              className="min-w-[240px] flex-1"
            />
            <FilterChipGroup
              value={incStatus}
              onChange={(next) => {
                setIncStatus(next);
                setIncPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'ACTIVE', label: 'Active', count: counts.incidentsActive },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'FALSE_ALARM', label: 'Accidental' },
              ]}
            />
          </StandardCard>

          {loadingTab && incData.items.length === 0 ? (
            <LoadingState label="Loading SOS incidents..." />
          ) : incData.items.length === 0 ? (
            <EmptyState
              title="No SOS incidents recorded"
              description="Active and historical SOS alerts matching your filters will appear here."
            />
          ) : (
            <>
              {incData.items.map((inc) => (
                <StandardCard key={inc.id} tone="danger" className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ShieldAlert className="h-5 w-5 shrink-0 text-[#DC2626]" />
                        <h3 className="text-[18px] font-bold text-[#131A20]">{inc.user.fullName}</h3>
                        <StatusBadge status={inc.status} />
                      </div>
                      <p className="line-clamp-2 text-[14px] font-medium text-[#131A20]">
                        {inc.message || 'SOS Emergency Triggered'}
                      </p>
                      <p className="text-[13px] text-[#646F78]">
                        Triggered: {new Date(inc.triggeredAt).toLocaleString()} • Coordinates:{' '}
                        {inc.latitude ?? 'N/A'}, {inc.longitude ?? 'N/A'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {inc.deliveries.length > 0 && (
                        <SmallButton onClick={() => setInspectIncident(inc)}>
                          Deliveries ({inc.deliveries.length})
                        </SmallButton>
                      )}
                      {inc.status !== 'RESOLVED' && inc.status !== 'FALSE_ALARM' && (
                        <SmallButton
                          tone="dark"
                          disabled={busyId === inc.id}
                          loading={busyId === inc.id}
                          onClick={() => handleResolveIncident(inc.id)}
                        >
                          Mark Resolved
                        </SmallButton>
                      )}
                    </div>
                  </div>

                  {inc.deliveries.length > 0 && (
                    <div className="grid gap-2 tablet:grid-cols-2">
                      {inc.deliveries.slice(0, 4).map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-2 rounded-[12px] border border-[#FECACA] bg-white px-3.5 py-2.5 text-[13px]"
                        >
                          <span className="truncate font-semibold text-[#131A20]">
                            {d.recipientLabel}
                          </span>
                          <StatusBadge status={d.deliveryStatus} />
                        </div>
                      ))}
                    </div>
                  )}
                </StandardCard>
              ))}

              <PaginationControls
                page={incPage}
                pageSize={incPageSize}
                total={incData.total}
                loading={loadingTab}
                onPageChange={setIncPage}
                onPageSizeChange={(s) => {
                  setIncPageSize(s);
                  setIncPage(1);
                }}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <StandardCard className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              placeholder="Search user name, email, or city..."
              value={userSearch}
              onChange={(val) => {
                setUserSearch(val);
                setUserPage(1);
              }}
              className="min-w-[240px] flex-1"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={userRole}
                onChange={(e) => {
                  setUserRole(e.target.value);
                  setUserPage(1);
                }}
                aria-label="Filter by role"
                className="h-9 rounded-[10px] border border-[#E2E6E9] bg-[#F5F4EE] px-3 text-[12px] font-bold text-[#131A20]"
              >
                <option value="ALL">All Roles</option>
                <option value="TRAVELLER">Traveller</option>
                <option value="TRAVEL_BUDDY">Travel Buddy</option>
                <option value="SAFE_HAVEN_PARTNER">Safe Haven Partner</option>
                <option value="ADMIN">Admin</option>
              </select>
              <FilterChipGroup
                value={userStatus}
                onChange={(next) => {
                  setUserStatus(next);
                  setUserPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                ]}
              />
            </div>
          </StandardCard>

          <DataTable
            columns={userColumns}
            rows={userData.items}
            rowKey={(u) => u.id}
            loading={loadingTab}
            error={errorMessage}
            onRetry={loadActiveTabData}
            emptyTitle="No matching users"
            emptyDescription="Try clearing the search query or role/status filter."
          />

          <PaginationControls
            page={userPage}
            pageSize={userPageSize}
            total={userData.total}
            loading={loadingTab}
            onPageChange={setUserPage}
            onPageSizeChange={(s) => {
              setUserPageSize(s);
              setUserPage(1);
            }}
          />
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <StandardCard className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              placeholder="Search booking activity, traveller, buddy, or meeting spot..."
              value={bookingSearch}
              onChange={(val) => {
                setBookingSearch(val);
                setBookingPage(1);
              }}
              className="min-w-[240px] flex-1"
            />
            <FilterChipGroup
              value={bookingStatus}
              onChange={(next) => {
                setBookingStatus(next);
                setBookingPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'REQUESTED', label: 'Requested' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'DISPUTE_OPEN', label: 'Open Disputes', count: counts.openDisputes },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
            />
          </StandardCard>

          <DataTable
            columns={bookingColumns}
            rows={bookingData.items}
            rowKey={(b) => b.id}
            loading={loadingTab}
            error={errorMessage}
            onRetry={loadActiveTabData}
            emptyTitle="No bookings recorded yet"
          />

          <PaginationControls
            page={bookingPage}
            pageSize={bookingPageSize}
            total={bookingData.total}
            loading={loadingTab}
            onPageChange={setBookingPage}
            onPageSizeChange={(s) => {
              setBookingPageSize(s);
              setBookingPage(1);
            }}
          />
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <StandardCard className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              placeholder="Search safety reports or user names..."
              value={reportSearch}
              onChange={(val) => {
                setReportSearch(val);
                setReportPage(1);
              }}
              className="min-w-[240px] flex-1"
            />
            <FilterChipGroup
              value={reportStatus}
              onChange={(next) => {
                setReportStatus(next);
                setReportPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'OPEN', label: 'Open', count: counts.openReports },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'DISMISSED', label: 'Dismissed' },
              ]}
            />
          </StandardCard>

          <DataTable
            columns={reportColumns}
            rows={reportData.items}
            rowKey={(r) => r.id}
            loading={loadingTab}
            error={errorMessage}
            onRetry={loadActiveTabData}
            emptyTitle="No user reports or safety blocks filed"
          />

          <PaginationControls
            page={reportPage}
            pageSize={reportPageSize}
            total={reportData.total}
            loading={loadingTab}
            onPageChange={setReportPage}
            onPageSizeChange={(s) => {
              setReportPageSize(s);
              setReportPage(1);
            }}
          />
        </div>
      )}

      {activeTab === 'notifications' && (
        <StandardCard className="max-w-xl">
          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <h3 className="text-[18px] font-bold text-[#131A20]">
              Send Safety &amp; Platform Advisory
            </h3>
            <StandardInput
              label="Title"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              required
              placeholder="Advisory title"
            />
            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-[#131A20]">Message</label>
              <textarea
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                rows={3}
                required
                placeholder="Write clear safety advisory..."
                className="w-full rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] p-3 text-[14px] font-medium text-[#131A20] focus:border-[#00B6C7] focus:bg-white focus:outline-none"
              />
            </div>
            <PrimaryButton
              type="submit"
              loading={busyId === 'broadcast'}
              disabled={busyId === 'broadcast'}
            >
              {busyId === 'broadcast' ? 'Broadcasting...' : 'Broadcast Notification'}
            </PrimaryButton>
          </form>
        </StandardCard>
      )}

      {activeTab === 'settings' && (
        <div className="grid gap-6 tablet:grid-cols-2">
          <StandardCard>
            <form onSubmit={handleSaveSetting} className="space-y-4">
              <h3 className="text-[18px] font-bold text-[#131A20]">
                Platform Governance Setting
              </h3>
              <StandardInput
                label="Setting Key"
                value={settingKey}
                onChange={(e) => setSettingKey(e.target.value)}
                className="font-mono"
                required
              />
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-[#131A20]">
                  JSON Value
                </label>
                <textarea
                  value={settingValue}
                  onChange={(e) => setSettingValue(e.target.value)}
                  rows={3}
                  required
                  className="w-full rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] p-3 font-mono text-[13px] text-[#131A20] focus:border-[#00B6C7] focus:bg-white focus:outline-none"
                />
              </div>
              <PrimaryButton
                type="submit"
                tone="dark"
                loading={busyId === 'save-setting'}
                disabled={busyId === 'save-setting'}
              >
                {busyId === 'save-setting' ? 'Saving...' : 'Save Setting'}
              </PrimaryButton>
            </form>
          </StandardCard>

          <StandardCard className="space-y-3">
            <h3 className="text-[18px] font-bold text-[#131A20]">Active Settings</h3>
            {settings.length === 0 ? (
              <p className="text-[14px] text-[#646F78]">No custom overrides stored yet.</p>
            ) : (
              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {settings.map((s) => (
                  <div
                    key={s.key}
                    className="rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] p-3 text-[13px]"
                  >
                    <div className="font-mono font-bold text-[#131A20]">{s.key}</div>
                    <div className="mt-0.5 break-all font-mono text-[#525D66]">
                      {JSON.stringify(s.valueJson)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </StandardCard>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <StandardCard>
            <SearchInput
              placeholder="Search audit action, target type, or administrator name..."
              value={auditSearch}
              onChange={(val) => {
                setAuditSearch(val);
                setAuditPage(1);
              }}
            />
          </StandardCard>

          <DataTable
            columns={auditColumns}
            rows={auditData.items}
            rowKey={(l) => l.id}
            loading={loadingTab}
            error={errorMessage}
            onRetry={loadActiveTabData}
            emptyTitle="No audit logs found"
          />

          <PaginationControls
            page={auditPage}
            pageSize={auditPageSize}
            total={auditData.total}
            loading={loadingTab}
            onPageChange={setAuditPage}
            onPageSizeChange={(s) => {
              setAuditPageSize(s);
              setAuditPage(1);
            }}
          />
        </div>
      )}

      {/* Inspection Modals with scrollable bodies */}
      <Modal
        open={Boolean(inspectVerif)}
        onClose={() => setInspectVerif(null)}
        title={inspectVerif?.user.fullName}
        subtitle={inspectVerif ? `${inspectVerif.role.replace(/_/g, ' ')} • ${inspectVerif.user.email}` : undefined}
        maxWidthClass="max-w-xl"
        footer={
          inspectVerif && (
            <div className="flex flex-wrap justify-end gap-2">
              <SmallButton
                tone="safe"
                disabled={busyId === inspectVerif.id}
                onClick={() => handleVerificationDecision(inspectVerif.id, 'APPROVED')}
              >
                Approve Role
              </SmallButton>
              <SmallButton
                tone="danger"
                disabled={busyId === inspectVerif.id}
                onClick={() => handleVerificationDecision(inspectVerif.id, 'REJECTED')}
              >
                Reject
              </SmallButton>
            </div>
          )
        }
      >
        {inspectVerif && (
          <div className="space-y-3 text-[13px] text-[#131A20]">
            <StatusBadge status={inspectVerif.status} />
            <p><strong>City:</strong> {inspectVerif.user.homeCity || 'Kerala'}</p>
            <p><strong>Gender:</strong> {inspectVerif.user.gender}</p>
            <p><strong>18+ Eligibility:</strong> {inspectVerif.ageVerified18Plus ? 'Verified (18+)' : 'Unverified'}</p>
            <p className="break-all"><strong>Selfie Ref:</strong> {inspectVerif.liveSelfiePath || 'Missing'}</p>
            <p className="break-all"><strong>ID Document Ref:</strong> {inspectVerif.idDocumentPath || 'Missing'}</p>
            {inspectVerif.licenceReference && (
              <p><strong>Licence Ref:</strong> {inspectVerif.licenceReference}</p>
            )}
            {inspectVerif.notes && (
              <p className="rounded-[12px] bg-[#F5F4EE] p-3">{inspectVerif.notes}</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(inspectHaven)}
        onClose={() => setInspectHaven(null)}
        title={inspectHaven?.name}
        subtitle={inspectHaven ? `${inspectHaven.category} • ${inspectHaven.city}` : undefined}
        maxWidthClass="max-w-xl"
        footer={
          inspectHaven && (
            <div className="flex flex-wrap gap-2">
              <SmallButton
                tone="safe"
                disabled={busyId === inspectHaven.id}
                onClick={() => handleSafeHavenDecision(inspectHaven.id, 'APPROVED')}
              >
                Approve &amp; Badge
              </SmallButton>
              <SmallButton
                disabled={busyId === inspectHaven.id}
                onClick={() => handleRecheckSafeHaven(inspectHaven.id)}
              >
                Mark Rechecked
              </SmallButton>
              <SmallButton
                tone="warn"
                disabled={busyId === inspectHaven.id}
                onClick={() => handleSafeHavenDecision(inspectHaven.id, 'SUSPENDED')}
              >
                Suspend
              </SmallButton>
              <SmallButton
                tone="danger"
                disabled={busyId === inspectHaven.id}
                onClick={() => handleSafeHavenDecision(inspectHaven.id, 'REJECTED')}
              >
                Reject
              </SmallButton>
              <SmallButton
                disabled={busyId === inspectHaven.id}
                onClick={() => handleDeleteSafeHaven(inspectHaven.id, inspectHaven.name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </SmallButton>
            </div>
          )
        }
      >
        {inspectHaven && (
          <div className="space-y-3 text-[13px] text-[#131A20]">
            <StatusBadge status={inspectHaven.approvalStatus} />
            <p><strong>Address:</strong> {inspectHaven.address}</p>
            <p>
              <strong>Coordinates:</strong> {inspectHaven.latitude.toFixed(4)},{' '}
              {inspectHaven.longitude.toFixed(4)}
            </p>
            <p><strong>Phone:</strong> {inspectHaven.phone}</p>
            {inspectHaven.contactEmail && <p><strong>Email:</strong> {inspectHaven.contactEmail}</p>}
            <p><strong>Hours:</strong> {inspectHaven.operatingHoursJson?.display || 'See schedule'}</p>
            <p><strong>Licence:</strong> <span className="font-mono">{inspectHaven.licenceNumber}</span></p>
            <p><strong>Services:</strong> {inspectHaven.assistanceServices.join(' • ') || 'Standard'}</p>
            {inspectHaven.approvalNotes && (
              <p className="rounded-[12px] bg-[#F5F4EE] p-3">
                <strong>Review Note:</strong> {inspectHaven.approvalNotes}
              </p>
            )}
            <StandardInput
              label="Review Note / Decision Reason"
              value={havenReasonMap[inspectHaven.id] ?? ''}
              onChange={(e) =>
                setHavenReasonMap((prev) => ({ ...prev, [inspectHaven.id]: e.target.value }))
              }
              placeholder="Optional note recorded in audit log..."
            />
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(inspectIncident)}
        onClose={() => setInspectIncident(null)}
        title={inspectIncident ? `SOS Incident: ${inspectIncident.user.fullName}` : undefined}
        subtitle={inspectIncident ? new Date(inspectIncident.triggeredAt).toLocaleString() : undefined}
        maxWidthClass="max-w-lg"
        footer={
          inspectIncident &&
          inspectIncident.status !== 'RESOLVED' &&
          inspectIncident.status !== 'FALSE_ALARM' ? (
            <PrimaryButton
              tone="dark"
              disabled={busyId === inspectIncident.id}
              onClick={() => handleResolveIncident(inspectIncident.id)}
              className="w-full"
            >
              Mark Incident Resolved
            </PrimaryButton>
          ) : null
        }
      >
        {inspectIncident && (
          <div className="space-y-3 text-[13px] text-[#131A20]">
            <StatusBadge status={inspectIncident.status} />
            <p>{inspectIncident.message}</p>
            <div className="space-y-2">
              {inspectIncident.deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-[#FECACA] bg-[#FEE2E2]/40 px-3 py-2"
                >
                  <span className="font-semibold">{d.recipientLabel}</span>
                  <StatusBadge status={d.deliveryStatus} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(inspectBooking)}
        onClose={() => setInspectBooking(null)}
        title="Booking Inspection"
        subtitle={inspectBooking?.activitySummary}
      >
        {inspectBooking && (
          <div className="space-y-2.5 text-[13px] text-[#131A20]">
            <StatusBadge status={inspectBooking.status} />
            <p><strong>Traveller:</strong> {inspectBooking.traveller.fullName}</p>
            <p><strong>Travel Buddy:</strong> {inspectBooking.buddy.fullName}</p>
            <p><strong>Meeting Point:</strong> {inspectBooking.meetingPointName || 'Pending'}</p>
            <p><strong>Dispute Status:</strong> {inspectBooking.disputeStatus}</p>
            {inspectBooking.disputeNotes && (
              <p className="rounded-[12px] bg-[#FEE2E2] p-3 text-[#991B1B]">
                {inspectBooking.disputeNotes}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(inspectAudit)}
        onClose={() => setInspectAudit(null)}
        title={inspectAudit?.action}
        subtitle={inspectAudit ? `${inspectAudit.targetType} • ${new Date(inspectAudit.createdAt).toLocaleString()}` : undefined}
      >
        {inspectAudit && (
          <pre className="overflow-x-auto rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] p-3 font-mono text-[12px] text-[#131A20]">
            {JSON.stringify(
              {
                id: inspectAudit.id,
                actor: inspectAudit.actor,
                targetId: inspectAudit.targetId,
                details: inspectAudit.detailsJson,
              },
              null,
              2,
            )}
          </pre>
        )}
      </Modal>
    </div>
  );
}
