import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "PRAANA | Supporting life beyond surgery", template: "%s · PRAANA" },
  description:
    "A recovery companion for people having cancer surgery, their families, and their care team. Recovery happens between visits.",
  applicationName: "PRAANA",
};

export const viewport: Viewport = {
  themeColor: "#0E8A7A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${devanagari.variable} min-h-dvh antialiased`}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
