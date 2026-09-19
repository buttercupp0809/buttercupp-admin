import { redirect } from "next/navigation";
import { getAdminEmail } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await getAdminEmail();
  if (!email) redirect("/login");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 pt-16 lg:pt-6 lg:px-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
