import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  LayoutDashboard,
  Lock,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { MotionReveal } from '@/components/MotionReveal';
import { StandardCard } from '@/components/ui';

export default function HomePage() {
  const portals = [
    {
      href: '/admin',
      badge: 'ADMIN',
      title: 'Admin Operations',
      desc: 'Review Buddy & Safe Haven applications, manage users, and monitor SOS incidents.',
      icon: LayoutDashboard,
    },
    {
      href: '/partner',
      badge: 'SAFE HAVEN',
      title: 'Safe Haven Portal',
      desc: 'Manage facility hours, assistance services, and active participation status.',
      icon: Building2,
    },
    {
      href: '/login',
      badge: 'AUTH',
      title: 'Portal Sign-In',
      desc: 'Sign in as an administrator or verified Safe Haven partner.',
      icon: Lock,
    },
  ];

  return (
    <div className="space-y-8">
      <StandardCard className="bg-gradient-to-br from-[#D3F3F5]/65 via-white to-[#E9F7F7]/50 p-6 tablet:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#C5EFF2] bg-white px-3.5 py-1.5 text-[12px] font-bold tracking-wide text-[#0099A8]">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>VERIFIED NETWORK • KERALA PILOT</span>
        </div>

        <MotionReveal>
          <h1 className="mt-5 text-[26px] font-extrabold leading-[32px] tracking-[-0.02em] text-[#131A20] tablet:text-[32px] tablet:leading-[40px]">
            Herway Operations Portal
          </h1>
        </MotionReveal>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-[#525D66]">
          <MapPin className="h-4 w-4 shrink-0 text-[#0099A8]" />
          <span>Kochi • Munnar • Kozhikode • Wayanad</span>
        </div>

        <MotionReveal delayMs={60}>
          <p className="mt-4 max-w-2xl text-[15px] font-normal leading-[22px] text-[#525D66] tablet:text-[16px] tablet:leading-[24px]">
            Verify Travel Buddies, approve Safe Haven partner venues, and coordinate live SOS safety alerts across Kerala.
          </p>
        </MotionReveal>
      </StandardCard>

      <section aria-label="Operations workspaces" className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3 laptop:gap-6">
        {portals.map(({ href, badge, title, desc, icon: Icon }, idx) => (
          <MotionReveal key={href} delayMs={idx * 60} mask={false} className="h-full">
            <Link
              href={href}
              className="herway-interactive group flex h-full flex-col justify-between rounded-[20px] border border-[#E2E6E9] bg-white p-6 shadow-card hover:border-[#00B6C7]"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#00B6C7] text-white shadow-teal-glow">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-[#C5EFF2] bg-[#E9F7F7] px-3 py-1 text-[11px] font-bold text-[#0099A8]">
                    {badge}
                  </span>
                </div>

                <h2 className="mt-5 text-[18px] font-bold leading-[24px] text-[#131A20] group-hover:text-[#0099A8]">
                  {title}
                </h2>
                <p className="mt-2 text-[14px] font-medium leading-[20px] text-[#646F78]">
                  {desc}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#ECEEF0] pt-4">
                <span className="text-[13px] font-semibold text-[#525D66]">Open workspace</span>
                <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#0099A8]">
                  View <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </MotionReveal>
        ))}
      </section>
    </div>
  );
}
