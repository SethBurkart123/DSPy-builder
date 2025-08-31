import FlowsDashboard from "@/components/flows/FlowsDashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl p-6">
        <header className="flex items-center justify-between py-4">
          <h1 className="text-2xl font-semibold tracking-tight">DSPY Flows</h1>
        </header>
        <FlowsDashboard />
      </div>
    </div>
  );
}
