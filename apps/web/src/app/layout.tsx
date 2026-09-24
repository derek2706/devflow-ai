import type { Metadata } from "next";
import { DevFlow } from "../components/devflow";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevFlow AI · Make room for great work",
  description:
    "Your team's workspace for projects, tasks, and thoughtful AI planning.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DevFlow />
        {children}
      </body>
    </html>
  );
}
