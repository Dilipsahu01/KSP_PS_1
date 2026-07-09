import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KSP Crime Intelligence Command Center',
  description: 'Karnataka State Police — Intelligent Conversational AI & Crime Analytics Platform. Secure, auditable, real-time crime intelligence for law enforcement.',
  keywords: ['KSP', 'Crime Database', 'AI', 'Law Enforcement', 'Karnataka Police'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0e1a] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
