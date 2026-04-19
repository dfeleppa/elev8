import { Suspense } from "react";

import LoginClient from "./LoginClient";

export const metadata = {
  title: "Sign In — Lyfe Fitness",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
