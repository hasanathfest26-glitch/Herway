import { PublicLiveMap } from '@/features/tracking/PublicLiveMap';

export default async function PublicTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicLiveMap token={token} />;
}
