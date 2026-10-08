import type { Metadata, Viewport } from "next";
import { PlayerAppProvider } from "./ui/player-app";
import { INSTALL_BOOTSTRAP } from "@/lib/app-install";
import "./globals.css";
import "./player-app.css";
import "./presentation.css";
import "./home.css";

export const metadata: Metadata = {
  title: "Prativerso · Conhecimento em prática",
  description: "Apresentações interativas e quizzes ao vivo para aprender participando. Crie sua aula, convide a turma por QR code e acompanhe cada resposta.",
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
