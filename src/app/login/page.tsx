import { AuthForm } from "@/components/auth-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  return <AuthForm signup={(await searchParams).mode === "signup"} />;
}
