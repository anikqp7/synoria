import { Poppins } from "next/font/google";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";
import AuthSessionProvider from "@/components/sessionProvider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata = {
  title: "Synoria | Project & Thesis Supervision",
  icons: { icon: "/brand/synoriaLogo.png", apple: "/brand/synoriaLogo.png" },
  description: "Your department’s workspace for final year projects and thesis supervision.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("synoria.theme")==="dark"?"dark":"light"}catch{document.documentElement.dataset.theme="light"}` }} />
      </head>
      <body><AuthSessionProvider>{children}</AuthSessionProvider></body>
    </html>
  );
}