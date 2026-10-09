import type { Kind, State } from "@/lib/model";
export function ProFields(_props: {
  kind: Kind;
  state: State;
  values: Record<string, string | number | boolean>;
  onChange: (values: Record<string, string | number | boolean>) => void;
}) {
  return null;
}
