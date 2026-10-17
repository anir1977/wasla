import { getWorkspace } from "@/lib/workspace";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initial = await getWorkspace();
  return (
    <WorkspaceProvider initial={initial}>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
