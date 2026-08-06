import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "昨日早报｜真正重要的事",
  description: "每日汇总昨日重要政界、行业、科技与知识讯息，过滤娱乐花边。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
