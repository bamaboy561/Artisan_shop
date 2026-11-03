"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  productionBoardPath,
  safeProductionReturn,
} from "@/features/production/queue";
import { parseCuttingProblemReason } from "@/features/production/workflow-flags";
import {
  reportCuttingProblem,
  resolveCuttingProblem,
  setCuttingUrgent,
  type WorkflowResult,
} from "@/lib/server/cutting-workflow";
import { saveProductionPlan } from "@/lib/server/production-planning";

export async function saveProductionDeadlineAction(formData: FormData) {
  const actor = await requireAdminSession(
    "/login?next=/admin/production",
    "/admin/production",
  );
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const id = get("requestId");
  if (!id || id.length > 128)
    redirect("/admin/production?notice=request-missing");
  let result: string;
  try {
    result = await saveProductionPlan({
      requestId: id,
      dueDate: get("dueDate"),
      expectedVersion: /^\d+$/.test(get("version"))
        ? Number(get("version"))
        : -1,
      actor,
    });
  } catch (error) {
    console.error("Production deadline save failed", error);
    result = "unavailable";
  }
  if (result === "saved") {
    revalidatePath("/admin/production");
    revalidatePath(`/admin/production/${id}`);
  }
  const params = new URLSearchParams({
    notice: `deadline-${result}`,
    returnTo: safeProductionReturn(get("returnTo")),
  });
  redirect(`/admin/production/${encodeURIComponent(id)}?${params}`);
}

function workflowReturn(formData: FormData, id: string, notice: string) {
  const raw = formData.get("returnTo");
  const returnTo = safeProductionReturn(typeof raw === "string" ? raw : "");
  return `/admin/production/${encodeURIComponent(id)}?${new URLSearchParams({ notice, returnTo })}`;
}

async function workflowActor(formData: FormData) {
  const actor = await requireAdminSession(
    "/login?next=/admin/production",
    "/admin/production",
  );
  const raw = formData.get("requestId");
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || id.length > 128)
    redirect("/admin/production?notice=request-missing");
  return { actor, id };
}

function revalidateWorkflow(id: string) {
  revalidatePath("/admin/production");
  revalidatePath(productionBoardPath);
  revalidatePath(`/admin/production/${id}`);
}

async function runWorkflow(
  id: string,
  task: () => Promise<WorkflowResult>,
): Promise<WorkflowResult> {
  try {
    const result = await task();
    if (result === "saved") revalidateWorkflow(id);
    return result;
  } catch (error) {
    console.error("[cutting-workflow] save failed", error);
    return "unavailable";
  }
}

export async function setCuttingUrgentAction(formData: FormData) {
  const { actor, id } = await workflowActor(formData);
  const urgent = formData.get("urgent") === "1";
  const result = await runWorkflow(id, () =>
    setCuttingUrgent({ requestId: id, urgent, actor }),
  );
  redirect(
    workflowReturn(
      formData,
      id,
      result === "saved"
        ? urgent
          ? "urgent-on"
          : "urgent-off"
        : `flag-${result}`,
    ),
  );
}

export async function reportCuttingProblemAction(formData: FormData) {
  const { actor, id } = await workflowActor(formData);
  const rawReason = formData.get("reason");
  const reason = parseCuttingProblemReason(
    typeof rawReason === "string" ? rawReason : "",
  );
  if (!reason) redirect(workflowReturn(formData, id, "problem-reason"));
  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" ? rawNote.trim() : "";
  const result = await runWorkflow(id, () =>
    reportCuttingProblem({ requestId: id, reason, note: note || null, actor }),
  );
  redirect(
    workflowReturn(
      formData,
      id,
      result === "saved" ? "problem-saved" : `flag-${result}`,
    ),
  );
}

export async function resolveCuttingProblemAction(formData: FormData) {
  const { actor, id } = await workflowActor(formData);
  const result = await runWorkflow(id, () =>
    resolveCuttingProblem({ requestId: id, actor }),
  );
  redirect(
    workflowReturn(
      formData,
      id,
      result === "saved" ? "problem-resolved" : `flag-${result}`,
    ),
  );
}
