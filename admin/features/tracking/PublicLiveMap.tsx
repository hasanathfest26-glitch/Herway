'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  MapPin,
  PauseCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { StatusBadge } from '@/components/StatusBadge';
import { StandardCard } from '@/components/ui';
import { API_BASE_URL } from '@/features/api';

interface PublicSharePayload {
  status: string;
  label: string;
  travellerName?: string;
  travellerFirstName?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  lastUpdatedAt?: string | null;
  secondsSinceLastUpdate?: number | null;
  isUpdating: boolean;
  staleWarning?: string | null;
  expiresAt?: string | null;
  coordinatesVisible: boolean;
  message?: string;
  trip?: {
    title: string;
    destinationCity: string;
    status?: string;
  } | null;
}

export function PublicLiveMap({ token }: { token: string }) {
  const [data, setData] = useState<PublicSharePayload>({
    status: 'LOADING',
    label: 'Verifying private tracking link...',
    coordinatesVisible: false,
    isUpdating: false,
  });

  useEffect(() => {
    let active = true;

    async function fetchLatest() {
      try {
        const res = await fetch(`${API_BASE_URL}/locations/public/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Invalid or expired link');
        const payload = (await res.json()) as PublicSharePayload;
        if (active) setData(payload);
      } catch {
        if (active) {
          setData({
            status: 'REVOKED',
            label: 'Private Location Link',
            coordinatesVisible: false,
            isUpdating: false,
            message: 'This tracking link is invalid, expired, or has been revoked by the traveller.',
          });
        }
      }
    }

    fetchLatest();
    const pollId = setInterval(fetchLatest, 30_000);

    const wsUrl = API_BASE_URL.replace('/api/v1', '');
    const socket = io(`${wsUrl}/realtime`, { transports: ['websocket'] });
    socket.emit('location:watch', { shareToken: token });
    socket.on(
      'location:update',
      (update: {
        latitude: number;
        longitude: number;
        accuracyMeters?: number;
        lastUpdatedAt: string;
        isUpdating?: boolean;
      }) => {
        setData((prev) => ({
          ...prev,
          latitude: update.latitude,
          longitude: update.longitude,
          accuracyMeters: update.accuracyMeters ?? prev.accuracyMeters,
          lastUpdatedAt: update.lastUpdatedAt,
          secondsSinceLastUpdate: 0,
          isUpdating: prev.status === 'ACTIVE',
          staleWarning: null,
          coordinatesVisible: prev.status === 'ACTIVE',
        }));
      },
    );

    return () => {
      active = false;
      clearInterval(pollId);
      socket.disconnect();
    };
  }, [token]);

  const mapsUrl =
    data.latitude != null && data.longitude != null
      ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}`
      : null;

  const embedUrl =
    data.latitude != null && data.longitude != null
      ? `https://maps.google.com/maps?q=${data.latitude},${data.longitude}&z=15&output=embed`
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <StandardCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#0099A8]" />
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#0099A8]">
                Herway Private Location Share (No App or Account Required)
              </span>
            </div>
            <h1 className="text-[22px] font-extrabold leading-[28px] text-[#131A20] tablet:text-[26px] tablet:leading-[32px]">
              {data.travellerName || data.travellerFirstName || 'Traveller'} — {data.label}
            </h1>
            {data.trip && (
              <p className="text-[14px] font-medium text-[#525D66]">
                Trip: {data.trip.title} • Destination: {data.trip.destinationCity} ({data.trip.status || 'ACTIVE'})
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            {data.status === 'ACTIVE' && (
              <StatusBadge status={data.isUpdating ? 'LIVE_UPDATING' : 'NOT_UPDATING'} />
            )}
          </div>
        </div>

        {data.staleWarning && data.status === 'ACTIVE' && (
          <div className="flex items-center gap-3 rounded-[12px] border border-[#FCD34D] bg-[#FEF3C7] px-4 py-3 text-[14px] font-medium text-[#92400E]">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#D97706]" />
            <span>{data.staleWarning}</span>
          </div>
        )}

        {data.coordinatesVisible && mapsUrl ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] px-4 py-3 text-[13px] font-medium text-[#131A20]">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-[#059669]" />
              <span className="break-words">
                Last known position: {data.latitude?.toFixed(5)}, {data.longitude?.toFixed(5)}
                {data.accuracyMeters ? ` (±${Math.round(data.accuracyMeters)}m)` : ''} • Last update:{' '}
                {data.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : 'Unknown'}
              </span>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-[12px] bg-[#059669] px-4 text-[13px] font-bold text-white hover:bg-[#047857]"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[12px] border border-[#FCD34D] bg-[#FEF3C7] px-4 py-3 text-[14px] font-medium text-[#92400E]">
            {data.status === 'PAUSED' ? (
              <PauseCircle className="h-5 w-5 shrink-0 text-[#D97706]" />
            ) : (
              <ShieldAlert className="h-5 w-5 shrink-0 text-[#D97706]" />
            )}
            <span>{data.message || 'Location coordinates are currently unavailable.'}</span>
          </div>
        )}
      </StandardCard>

      {data.coordinatesVisible && embedUrl && (
        <div className="overflow-hidden rounded-[20px] border border-[#E2E6E9] bg-white shadow-card">
          <iframe
            title="Live Location Google Map"
            src={embedUrl}
            className="h-[380px] w-full border-0 tablet:h-[460px]"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
