import TopNav from "@/components/TopNav";
import AssistantChat from "@/components/AssistantChat";
import { aiEnabled } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <div className="dms-bg">
      <TopNav active="assistant" />
      <main className="p-4 max-w-[1100px] mx-auto">
        <AssistantChat aiEnabled={aiEnabled()} />
      </main>
    </div>
  );
}
