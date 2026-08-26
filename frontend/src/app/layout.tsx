import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Run-down — Video Converter',
  description:
    'Convert video files to different formats and codecs with ease. Supports MP4, WebM, MOV with libx264, libx265, and VP9.',
  keywords: ['video converter', 'ffmpeg', 'mp4', 'webm', 'codec converter'],
  openGraph: {
    title: 'Run-down — Video Converter',
    description: 'Fast, free video conversion. Upload, convert, download.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-[#0a0a0f] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
