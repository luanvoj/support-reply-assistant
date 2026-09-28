import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";

import "./tokens.css";
import "./ui-components.css";
import "./bento-layout.css";
import "./chat-styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trợ lý phản hồi khách hàng",
  description: "Trợ lý tri thức nội bộ cho phản hồi khách hàng có căn cứ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
