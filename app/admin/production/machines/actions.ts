"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageProduction } from "@/lib/auth/roles";
import { maxMachineFolders } from "@/features/production/machine-folders";
import {
  resendGibLabOrder,
  saveGibLabOrderSettings,
} from "@/lib/server/giblab-orders";
import {
  linkMachineFile,
  regenerateWatcherKey,
  saveMachineFolders,
} from "@/lib/server/machine-folders";

const basePath = "/admin/production/machines";

async function managerSession() {
  const actor = await requireAdminSession(`/login?next=${basePath}`, basePath);
  if (!canManageProduction(actor.roleCode)) redirect("/admin/production");
  return actor;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function done(notice: string): never {
  revalidatePath(basePath);
  redirect(`${basePath}?notice=${notice}`);
}

export async function saveMachineFoldersAction(formData: FormData) {
  const actor = await managerSession();
  const folders = Array.from({ length: maxMachineFolders }, (_, index) => ({
    id: text(formData, `id-${index}`),
    name: text(formData, `name-${index}`),
    path: text(formData, `path-${index}`),
    stage: text(formData, `stage-${index}`),
    recurse: text(formData, `recurse-${index}`) === "on",
  }));
  const result = await saveMachineFolders(actor, folders);
  done(`folders-${result}`);
}

export async function regenerateWatcherKeyAction() {
  const actor = await managerSession();
  const result = await regenerateWatcherKey(actor);
  done(`key-${result}`);
}

export async function linkMachineFileAction(formData: FormData) {
  const actor = await managerSession();
  const result = await linkMachineFile({
    actor,
    fileId: text(formData, "fileId").slice(0, 64),
    requestNumber: text(formData, "requestNumber").slice(0, 20),
  });
  done(`link-${result}`);
}

export async function saveGibLabOrderSettingsAction(formData: FormData) {
  const actor = await managerSession();
  const result = await saveGibLabOrderSettings(actor, {
    enabled: text(formData, "enabled") === "on",
    root: text(formData, "root"),
    trigger: text(formData, "trigger"),
  });
  done(`orders-${result}`);
}

export async function resendGibLabOrderAction(formData: FormData) {
  const actor = await managerSession();
  const result = await resendGibLabOrder(
    actor,
    text(formData, "requestId").slice(0, 64),
  );
  done(`resend-${result}`);
}
