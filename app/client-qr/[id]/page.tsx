import { redirect } from "next/navigation";

import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessAdmin } from "@/lib/auth/roles";

type ClientQrPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientQrPage({ params }: ClientQrPageProps) {
  const { id } = await params;
  const target = `/admin/sales?client=${encodeURIComponent(id)}`;
  const session = await getOptionalSession();

  if (session?.roleCode && canAccessAdmin(session.roleCode)) {
    redirect(target);
  }

  redirect(`/login?next=${encodeURIComponent(target)}`);
}
