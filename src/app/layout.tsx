import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RWA Dashboard",
  description: "基于 O(1) 复杂度算法的链上房产收益协议",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* 用 Providers 包裹住整个网页的内容 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}