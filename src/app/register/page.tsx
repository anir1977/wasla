import { AuthForm } from "@/components/auth-form";
import { isDemo, supabaseConfigured } from "@/lib/config";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <AuthForm register demo={isDemo()} configured={supabaseConfigured()} />
  );
}
