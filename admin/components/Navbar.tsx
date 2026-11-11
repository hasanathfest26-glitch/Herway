'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Shield,
  X,
} from 'lucide-react';
import { useWebAuth } from '@/features/auth/AuthProvider';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useWebAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Overview', icon: Shield },
    { href: '/admin', label: 'Admin Console', icon: LayoutDashboard },
    { href: '/partner', label: 'Partner Portal', icon: Building2 },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E6E9] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] w-full max-w-[1400px] items-center justify-between gap-3 px-4 tablet:px-6 laptop:gap-4 laptop:px-8 wide:px-12">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl focus-visible:outline-2 laptop:gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#00B6C7] text-white shadow-teal-glow">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[20px] font-extrabold tracking-tight text-[#131A20]">
              herway
            </span>
            <span className="hidden rounded-full border border-[#C5EFF2] bg-[#E9F7F7] px-2.5 py-0.5 text-[11px] font-bold text-[#0099A8] xs:inline-block tablet:hidden laptop:inline-block">
              Operations
            </span>
          </div>
        </Link>

        {/* Desktop & Tablet Navigation (>= 768px) */}
        <nav
          aria-label="Primary navigation"
          className="hidden shrink-0 items-center gap-1 tablet:flex laptop:gap-1.5"
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[12px] px-2.5 text-[14px] font-semibold transition laptop:gap-2 laptop:px-3.5 ${
                  active
                    ? 'bg-[#C5EFF2] text-[#0099A8] font-bold'
                    : 'text-[#525D66] hover:bg-[#F5F4EE] hover:text-[#131A20]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop Right Account Actions + Mobile Menu Button */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden shrink-0 items-center gap-3 tablet:flex">
            {user ? (
              <>
                <span className="hidden rounded-full border border-[#E5E4DD] bg-[#F5F4EE] px-3 py-1.5 text-[13px] font-semibold text-[#131A20] laptop:inline-block">
                  {user.fullName}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    router.push('/login');
                  }}
                  className="inline-flex h-11 min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[12px] border border-[#E2E6E9] bg-white px-3.5 text-[14px] font-semibold text-[#131A20] hover:bg-[#F5F4EE] laptop:px-4"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-11 min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[12px] bg-[#00B6C7] px-4 text-[14px] font-bold text-white shadow-teal-glow hover:bg-[#0099A8] laptop:px-5"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>Sign In</span>
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] border border-[#E2E6E9] bg-white text-[#131A20] hover:bg-[#F5F4EE] tablet:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer (< 768px) */}
      {mobileMenuOpen && (
        <div className="border-t border-[#E2E6E9] bg-white px-4 py-4 tablet:hidden">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[48px] items-center gap-3 rounded-[12px] px-4 text-[15px] font-semibold ${
                    active
                      ? 'bg-[#C5EFF2] text-[#0099A8] font-bold'
                      : 'text-[#131A20] hover:bg-[#F5F4EE]'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}

            <div className="mt-2 border-t border-[#ECEEF0] pt-3">
              {user ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[14px] font-semibold text-[#131A20]">
                    {user.fullName}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await logout();
                      router.push('/login');
                    }}
                    className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-[12px] border border-[#E2E6E9] bg-[#F5F4EE] px-4 text-[14px] font-semibold text-[#131A20]"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-12 min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#00B6C7] text-[15px] font-bold text-white shadow-teal-glow"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
