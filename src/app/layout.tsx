import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gooner 5期 PLダッシュボード",
  description: "事業部別PL・個人PL・インセンティブ管理",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
