import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import { Shield, Radio, Activity, HardHat, LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'H2S-SafeTrack | Lead(II) Acetate Industrial Dosimeter Platform',
  description:
    'Production-grade optical colorimetric H2S dosimeter platform based strictly on Lead(II) Acetate chemocassette paper reaction.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080c14',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#080c14] text-slate-100">
        {/* Top Operational Header */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-400 group-hover:scale-105 transition">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-wider text-slate-100 font-mono">
                  H2S-SAFETRACK
                </span>
                <span className="text-[9px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                  Pb(Ac)2 Chemocassette
                </span>
              </div>
            </Link>

            {/* Quick-Switch Nav */}
            <nav className="flex items-center gap-2">
              <Link
                href="/worker"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-700 hover:border-sky-500 transition"
              >
                <HardHat className="w-3.5 h-3.5 text-amber-400" />
                <span>Worker PWA</span>
              </Link>

              <Link
                href="/supervisor"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-700 hover:border-emerald-500 transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>EHS Command</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Technical Footer */}
        <footer className="border-t border-slate-900 py-3 bg-slate-950/60 text-center text-[11px] text-slate-500 font-mono">
          <span>H2S-SafeTrack v2.0 • Lead(II) Acetate Monotonic Optical Metrology • OSHA 1910.1000 / ACGIH Standard</span>
        </footer>
      </body>
    </html>
  );
}
