import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

import Navbar from "@/components/layout/navbar"
import Footer from "@/components/layout/Footer"
import { ToastProvider } from "@/components/providers/toast-provider"
import { LoginModal } from "@/components/auth/LoginModal"
import { Toaster } from "@/components/ui/sonner"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Trodec",
  description: "Expert-led community commerce — trusted recommendations, community-driven buying decisions, trust before commerce.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Navbar />

        <ToastProvider>
          {children}
        </ToastProvider>

        <LoginModal />
        <Toaster richColors position="top-right" />

        <Footer />
      </body>
    </html>
  )
}
