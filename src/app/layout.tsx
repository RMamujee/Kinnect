import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kinnect — GPS-Verified Family Tree',
  description: 'Build your family tree with verified sources following the Genealogical Proof Standard. Auto-populate relatives from FamilySearch, WikiTree, and public records.',
  keywords: ['genealogy', 'family tree', 'ancestors', 'FamilySearch', 'genealogical proof standard'],
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Kinnect',
    description: 'GPS-verified genealogy with auto-populated public records.',
    type: 'website',
    images: [{ url: '/logo.png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
