import { Kantumruy_Pro } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

// Kantumruy Pro supports Khmer + Latin — used app-wide so the Khmer voting
// text and English UI share one consistent font.
const kantumruyPro = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-kantumruy",
  display: "swap",
});

export const metadata = {
  title: "ACE Voting",
  description: "Vote on student poster works",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${kantumruyPro.variable} ${kantumruyPro.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
