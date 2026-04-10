import { PersistenceUnavailable } from "@/components/internal/PersistenceUnavailable";
import { InternalEngineView } from "@/components/internal/InternalEngineView";
import { getInternalDiagnostics } from "@/lib/server/odds/internalDiagnostics";
import { buildInternalDiagnosticsViewModel } from "@/lib/ui/view-models/internalDiagnosticsViewModel";

export const runtime = "nodejs";

export default async function InternalEnginePage() {
  const diagnostics = await getInternalDiagnostics(500);

  if (!diagnostics.ok) {
    return <PersistenceUnavailable reason={diagnostics.unavailableReason || "Durable persistence is not configured."} />;
  }

  const viewModel = buildInternalDiagnosticsViewModel(diagnostics);
  return <InternalEngineView viewModel={viewModel} />;
}
