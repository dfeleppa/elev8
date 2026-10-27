import RegisterClient from "./RegisterClient";

export const metadata = {
  title: "Create Account — Lyfe Fitness",
};

export default function RegisterPage() {
  return <RegisterClient appleEnabled={Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)} />;
}
