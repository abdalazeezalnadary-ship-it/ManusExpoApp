import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export function usePermissions() {
  const { user } = useAuth();
  const query = trpc.auth.permissions.useQuery(undefined as never, { enabled: Boolean(user), retry: false });
  const permissions = query.data?.permissions ?? [];
  return {
    permissions: permissions as readonly string[],
    loading: query.isLoading,
    error: query.isError,
    can: (permission: string) => permissions.includes(permission as never),
  };
}
