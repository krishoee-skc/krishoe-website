import { getAdminSession } from "@/lib/admin-auth";
import {
  getSessionAdminRole,
} from "@/lib/admin-role-permissions";
import { canAccessFactoryApi, getFactoryApiPolicy } from "@/lib/factory-api-policy";

export { canAccessFactoryApi, getFactoryApiPolicy } from "@/lib/factory-api-policy";

export async function authorizeFactoryApi(pathname: string, method: string) {
  const policy = getFactoryApiPolicy(pathname, method);

  // Factory APIs are private by default. A newly added handler must be placed
  // in the policy map before it can read or mutate business data.
  if (!policy) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getAdminSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getSessionAdminRole(session);

  if (!canAccessFactoryApi(role, policy)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
