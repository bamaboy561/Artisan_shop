import { getOptionalSession } from "@/lib/auth/dal";
import {
  canAccessGeneralAdmin,
  isCuttingManager,
  isProductionManager,
} from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";

// Программой раскроя пользуются администраторы, менеджер распила и
// начальник производства — те же, кто ведёт заявки на распил.
export async function raskroySession() {
  const session = await getOptionalSession();
  if (
    !session?.userId ||
    !(
      canAccessGeneralAdmin(session.roleCode) ||
      isCuttingManager(session.roleCode) ||
      isProductionManager(session.roleCode)
    )
  )
    return null;
  return session;
}

export const denied = () => Response.json({ ok: false, error: "login" }, { status: 401 });
export const noDb = () => Response.json({ ok: false, error: "db" }, { status: 503 });
export { hasDatabaseUrl };
