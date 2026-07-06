import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

/**
 * Layout pour toutes les routes authentifiées (sous le groupe `(app)`).
 * Garantit côté serveur qu'un utilisateur est connecté ; sinon redirect.
 * (Le middleware — middleware.ts à la racine — fait déjà ce contrôle et
 * rafraîchit la session ; on garde ce double check en défense en
 * profondeur au cas où le matcher serait contourné.)
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar email={user.email ?? ""} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
