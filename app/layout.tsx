import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const assetPrefix = process.env.GITHUB_ACTIONS === 'true' ? '/jiuling-nine-spirits' : '';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '九灵牌 · Nine Spirits',
  description: '一局即可上手的三行摆牌策略游戏。',
  openGraph: {
    title: '九灵牌 · Nine Spirits',
    description: '三波发牌，八张成阵。挑战五位 AI，摆出不炸牌的最强牌阵。',
    images: [{ url: `${assetPrefix}/social-preview.png`, width: 1200, height: 630, alt: '九灵牌游戏牌阵' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '九灵牌 · Nine Spirits',
    description: '三波发牌，八张成阵。',
    images: [`${assetPrefix}/social-preview.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
