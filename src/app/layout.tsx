import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Wasla · Votre commerce, plus proche",
    template: "%s · Wasla",
  },
  description:
    "L’espace des commerçants marocains : catalogue, commandes et assistant WhatsApp en Darija.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
