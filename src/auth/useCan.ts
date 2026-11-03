import { can, type Capability } from "./roles";
import { useAuthStore } from "./store";

export function useCan(capability: Capability): boolean {
  const role = useAuthStore((state) => state.user?.role);
  return can(role, capability);
}
