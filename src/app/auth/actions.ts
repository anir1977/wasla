"use server";
import { serverClient } from "@/lib/supabase/server";
import { supabaseConfigured, isDemo } from "@/lib/config";
import { redirect } from "next/navigation";
import { z } from "zod";

const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email()),
  password: z.string().trim().min(10).max(128),
});

export async function authenticate(
  form: FormData,
): Promise<{ error?: string; success?: string; redirect?: string }> {
  if (isDemo())
    return {
      error:
        "Le mode démonstration ne crée pas de comptes. Configurez Supabase pour activer la connexion.",
    };
  if (!supabaseConfigured())
    return {
      error: "Supabase n’est pas configuré. Consultez le guide de démarrage.",
    };
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "Email valide et mot de passe de 10 caractères minimum requis.",
    };
  const client = await serverClient();
  const register = form.get("mode") === "register";
  const response = register
    ? await client.auth.signUp({
        ...parsed.data,
        options: {
          emailRedirectTo:
            (process.env.APP_URL || "http://localhost:3000") + "/auth/confirm",
        },
      })
    : await client.auth.signInWithPassword(parsed.data);
  if (response.error)
    return {
      error:
        response.error.message ||
        (register
          ? "Inscription impossible. Vérifiez vos informations et réessayez."
          : "Connexion impossible. Vérifiez vos identifiants et la confirmation de votre email."),
    };
  if (register && !response.data.session)
    return {
      success:
        "Consultez votre email pour confirmer votre compte, puis connectez-vous.",
    };
  return { redirect: "/" };
}

export async function signOut() {
  if (!isDemo() && supabaseConfigured())
    await (await serverClient()).auth.signOut();
  redirect("/login");
}
