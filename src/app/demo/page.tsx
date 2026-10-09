import { CrmApp } from "@/components/crm-app";
import { sampleState } from "@/lib/sample";
export const dynamic = "force-dynamic";
export default function Demo() {
  return <CrmApp initial={sampleState()} demo />;
}
