import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { AuthProvider } from '@/features/auth/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Herway — Admin, Safe Haven Partner Portal & Live Safety Tracking',
  description:
    'Operations dashboard, Safe Haven Partner management, and browser-based private live location tracking for the Herway women-focused travel safety platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAF9F4] text-[#131A20] antialiased">
        <AuthProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 tablet:px-6 tablet:py-8 laptop:px-8 wide:px-12">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
