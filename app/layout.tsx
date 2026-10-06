import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizEdu · Sua turma entra no jogo",
  description: "Crie quizzes, convide sua turma por QR code e jogue ao vivo. Perguntas, cronômetro e classificação em cada rodada.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
