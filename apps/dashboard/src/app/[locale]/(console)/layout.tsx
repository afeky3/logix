import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

// TODO(S1): redirect to /login when there's no valid staff session.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
