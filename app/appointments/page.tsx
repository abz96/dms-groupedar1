import TopNav from "@/components/TopNav";
import AppointmentsManager from "@/components/AppointmentsManager";

export const dynamic = "force-dynamic";

export default function AppointmentsPage() {
  return (
    <div className="dms-bg">
      <TopNav active="appointments" />
      <main className="p-4 max-w-[1600px] mx-auto">
        <AppointmentsManager />
      </main>
    </div>
  );
}
