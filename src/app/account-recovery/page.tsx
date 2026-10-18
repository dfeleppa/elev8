import type { Metadata } from "next";
import RecoveryClient from "./RecoveryClient";

export const metadata: Metadata = {
  title: "Set your password — Lyfe Fitness",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AccountRecoveryPage() {
  return <RecoveryClient />;
}
