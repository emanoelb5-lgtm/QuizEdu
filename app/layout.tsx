import type { Metadata, Viewport } from "next";
import { PlayerAppProvider } from "./ui/player-app";
import "./globals.css";
import "./player-app.css";

export const metadata: Metadata = {
  title: "QuizEdu · Sua turma entra no jogo",
  description: "Crie quizzes, convide sua turma por QR code e jogue ao vivo. Perguntas, cronômetro e classificação em cada rodada.",
  applicationName: "QuizEdu",
  manifest: "/api/app-manifest",
  appleWebApp: {capable:true,title:"QuizEdu",statusBarStyle:"default"},
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/app-icon-192.png",
  },
};
export const viewport: Viewport = {themeColor:"#3155ed",viewportFit:"cover"};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased"><PlayerAppProvider>{children}</PlayerAppProvider></body>
    </html>
  );
}
