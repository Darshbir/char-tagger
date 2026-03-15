import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — TripTag",
  description:
    "How TripTag handles your data. Photos stay in your browser; optional Google sign-in is only for Drive export.",
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
