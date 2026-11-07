import type { Metadata, Viewport } from "next";
import { PlayerAppProvider } from "./ui/player-app";
import { INSTALL_BOOTSTRAP } from "@/lib/app-install";
import "./globals.css";
import "./player-app.css";
import "./presentation.css";
import "./presentation-workspace.css";
import "./word-cloud.css";
import "./poll.css";
import "./presentation-display.css";
import "./lesson-catalog.css";
import "./home.css";
import "./account.css";

export const metadata: Metadata = {
  title: "Prativerso · Metodologia ativa na prática",
  description: "Metodologia ativa na prática: apresentações interativas, quizzes, enquetes e nuvens de palavras. Entre na sua conta ou participe de uma sala por código ou QR code.",
  applicationName: "Prativerso",
  manifest: "/api/app-manifest",
  appleWebApp: {capable:true,title:"Prativerso",statusBarStyle:"default"},
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/app-icon-192.png",
  },
};
export const viewport: Viewport = {themeColor:"#6546d7",viewportFit:"cover"};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head><script id="qe-install-bootstrap" dangerouslySetInnerHTML={{__html:INSTALL_BOOTSTRAP}} /></head>
      <body className="antialiased"><PlayerAppProvider>{children}</PlayerAppProvider></body>
    </html>
  );
}
