import assert from "node:assert/strict";
import test from "node:test";
import * as jsxRuntime from "react/jsx-runtime";
import enums from "../generated/prisma/index.js";
import { loadAction } from "./load-action.mjs";

const { RoleCode } = enums;
const roles = loadAction("../lib/auth/roles.ts", {
  "@/generated/prisma": enums,
});
function redirect(url) {
  throw new Error(`REDIRECT:${url}`);
}

test("staff directory exposes access controls for managers, never privileged accounts", async () => {
  const stubs = {
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": {},
    "@/app/admin/actions": {},
    "@/generated/prisma": enums,
    "@/lib/auth/roles": roles,
    "@/lib/db": { hasDatabaseUrl: () => true },
    "@/lib/server/loyalty-permissions": {
      getLoyaltyManagerIds: async () => new Set(),
    },
  };
  const components = {
    "@/app/admin/staff/cutting-manager-form": "CuttingManagerForm",
    "@/app/admin/staff/production-account-form": "ProductionAccountForm",
    "@/components/admin/admin-submit-button": "AdminSubmitButton",
    "@/components/admin/staff-access-button": "StaffAccessButton",
    "@/components/admin/setup-state": "SetupState",
    "@/components/admin/status-badge": "StatusBadge",
    "@/components/ui/button-link": "ButtonLink",
    "@/components/ui/button": "Button",
    "@/components/ui/input": "Input",
    "@/components/ui/pagination": "Pagination",
    "@/components/ui/section-heading": "SectionHeading",
    "@/components/ui/select": "Select",
    "@/components/ui/table": "DataTable",
  };
  for (const [path, name] of Object.entries(components)) {
    stubs[path] = { [name]: name };
  }
  const accounts = Object.values(RoleCode).map((code) => ({
    id: code,
    email: `${code}@example.test`,
    role: { code },
    isActive: code !== RoleCode.CUTTING_MANAGER,
    createdAt: new Date("2026-01-01"),
    hasPassword: true,
    _count: { managedOrders: 0, managedRequests: 0 },
  }));
  stubs["@/lib/server/staff-admin"] = {
    getStaffAccountDirectory: async () => ({
      accounts,
      roleCounts: [],
      scope: "staff",
      total: accounts.length,
      page: 1,
      totalPages: 1,
      query: "",
    }),
  };
  function find(node, type) {
    if (!node || typeof node !== "object") return undefined;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const match = find(child, type);
      if (match) return match;
    }
  }
  for (const actor of [RoleCode.ADMIN, RoleCode.SUPER_ADMIN]) {
    stubs["@/lib/auth/dal"] = {
      requireAdminSession: async () => ({ userId: actor, roleCode: actor }),
    };
    const { default: StaffPage } = loadAction(
      "../app/admin/staff/page.tsx",
      stubs,
    );
    const tree = await StaffPage({ searchParams: Promise.resolve({}) });
    const table = find(tree, "DataTable");
    assert.ok(table);
    for (const [index, account] of accounts.entries()) {
      const button = find(
        table.props.rows[index].management,
        "StaffAccessButton",
      );
      assert.equal(
        Boolean(button),
        roles.staffAccessRoleCodes.includes(account.role.code),
      );
      if (button) {
        assert.equal(button.props.id, account.id);
        assert.equal(button.props.isActive, account.isActive);
      }
    }
  }
});
function form(id = "employee", value = "false") {
  const data = new FormData();
  data.set("id", id);
  data.set("isActive", value);
  return data;
}

function fixture({
  actor = RoleCode.ADMIN,
  target = RoleCode.MANAGER,
  database = true,
  exists = true,
} = {}) {
  const state = { active: true, writes: [], invalidations: [], guards: [] };
  const { setStaffAccountAccessAction } = loadAction(
    "../app/admin/staff/actions.ts",
    {
      "next/navigation": { redirect },
      "next/cache": {
        revalidatePath: (path) => state.invalidations.push(path),
      },
      "@/lib/auth/dal": {
        requireAdminSession: async (...args) => {
          state.guards.push(args);
          return { userId: "admin", roleCode: actor };
        },
      },
      "@/lib/auth/roles": roles,
      "@/lib/db": {
        hasDatabaseUrl: () => database,
        getDb: () => ({
          user: {
            updateMany: async (query) => {
              state.writes.push(query);
              if (!exists || !query.where.role.code.in.includes(target))
                return { count: 0 };
              state.active = query.data.isActive;
              return { count: 1 };
            },
          },
        }),
      },
    },
  );
  return { state, action: setStaffAccountAccessAction };
}

test("admin and super-admin can block and restore all manager/operator roles", async () => {
  for (const actor of [RoleCode.ADMIN, RoleCode.SUPER_ADMIN]) {
    for (const target of roles.staffAccessRoleCodes) {
      assert.equal(roles.canManageStaffAccess(actor, target), true);
      const { action, state } = fixture({ actor, target });
      await assert.rejects(action(form()), /notice=disabled/);
      assert.equal(state.active, false);
      await assert.rejects(action(form()), /notice=disabled/);
      assert.equal(state.active, false);
      await assert.rejects(action(form("employee", "true")), /notice=enabled/);
      assert.equal(state.active, true);
      assert.deepEqual(state.writes[0].data, { isActive: false });
      assert.equal(state.writes[0].where.id, "employee");
      assert.deepEqual(state.guards[0], [
        "/login?next=/admin/staff",
        "/admin/staff",
      ]);
      assert.ok(state.invalidations.includes("/admin/staff"));
    }
  }
});

test("manager, operator and customer cannot invoke access changes directly", async () => {
  for (const actor of Object.values(RoleCode).filter(
    (role) => !roles.canManageStaff(role),
  )) {
    const { action, state } = fixture({ actor });
    await assert.rejects(action(form()), /notice=access-forbidden/);
    assert.equal(state.writes.length, 0);
    assert.equal(roles.canManageStaffAccess(actor, RoleCode.MANAGER), false);
  }
});

test("own account and malformed input never reach the database", async () => {
  const { action, state } = fixture();
  await assert.rejects(action(form("admin")), /notice=self-access/);
  for (const value of ["", "on", "FALSE", "0"]) {
    await assert.rejects(
      action(form("employee", value)),
      /notice=invalid-access/,
    );
  }
  await assert.rejects(action(form(" ")), /notice=invalid-access/);
  assert.equal(state.writes.length, 0);
});

test("privileged and customer accounts stay protected in the conditional write", async () => {
  for (const target of [
    RoleCode.ADMIN,
    RoleCode.SUPER_ADMIN,
    RoleCode.CUSTOMER,
    RoleCode.DEALER,
  ]) {
    const { action, state } = fixture({ actor: RoleCode.SUPER_ADMIN, target });
    await assert.rejects(action(form()), /notice=access-forbidden/);
    assert.equal(state.active, true);
    assert.equal(state.invalidations.length, 0);
    assert.equal(
      roles.canManageStaffAccess(RoleCode.SUPER_ADMIN, target),
      false,
    );
  }
});

test("missing account and database setup cannot report a successful block", async () => {
  const missing = fixture({ exists: false });
  await assert.rejects(missing.action(form()), /notice=access-forbidden/);
  const unavailable = fixture({ database: false });
  await assert.rejects(
    unavailable.action(form()),
    /notice=database-unavailable/,
  );
  assert.equal(unavailable.state.writes.length, 0);
});

function sessionFixture() {
  const state = {
    active: true,
    exists: true,
    role: RoleCode.MANAGER,
    reads: 0,
    comparisons: 0,
  };
  const dal = loadAction("../lib/auth/dal.ts", {
    "server-only": {},
    react: { cache: (fn) => fn },
    "next/navigation": { redirect },
    "@/generated/prisma": enums,
    "@/lib/auth/redirects": { getSafeRedirectPath: (path) => path },
    "@/lib/auth/session": {
      readSession: async () => ({
        userId: "employee",
        roleCode: RoleCode.MANAGER,
      }),
    },
    "@/lib/auth/roles": roles,
    "@/lib/db": {
      hasDatabaseUrl: () => true,
      getDb: () => ({
        siteSetting: { findUnique: async () => null },
        user: {
          findUnique: async () => {
            state.reads += 1;
            return state.exists
              ? {
                  id: "employee",
                  email: "employee@example.test",
                  isActive: state.active,
                  hashedPassword: "hash",
                  role: { code: state.role },
                }
              : null;
          },
        },
      }),
    },
    bcryptjs: {
      compare: async () => {
        state.comparisons += 1;
        return true;
      },
    },
  });
  return { dal, state };
}

test("blocking rejects an already-signed-in manager on the next access check", async () => {
  const { dal, state } = sessionFixture();
  assert.equal((await dal.requireAdminSession()).userId, "employee");
  state.active = false;
  assert.equal(await dal.getOptionalSession(), null);
  await assert.rejects(dal.requireAdminSession(), /REDIRECT:\/login/);
  assert.equal(
    await dal.verifyCredentials("employee@example.test", "password"),
    null,
  );
  assert.equal(state.comparisons, 0);
  state.active = true;
  assert.equal((await dal.requireAdminSession()).userId, "employee");
  assert.equal(
    (await dal.verifyCredentials("employee@example.test", "password")).userId,
    "employee",
  );
  assert.equal(state.comparisons, 1);
});

test("deleted accounts and current database roles override old signed cookies", async () => {
  const { dal, state } = sessionFixture();
  state.exists = false;
  assert.equal(await dal.getOptionalSession(), null);
  state.exists = true;
  state.role = RoleCode.CUSTOMER;
  await assert.rejects(dal.requireAdminSession(), /REDIRECT:\/account/);
});

test("stale cookie cannot redirect login/register back into a blocked workspace", async () => {
  const state = { session: { userId: "employee", roleCode: RoleCode.MANAGER } };
  const { proxy } = loadAction("../proxy.ts", {
    "next/server": {
      NextResponse: {
        next: () => ({ next: true }),
        redirect: (url) => ({ redirect: url.href }),
      },
    },
    "@/lib/auth/redirects": { getSafeRedirectPath: (path) => path },
    "@/lib/auth/roles": roles,
    "@/lib/auth/session": {
      sessionCookieName: "artisan-session",
      decryptSession: async () => state.session,
    },
  });
  const request = (path) => ({
    nextUrl: new URL(path, "https://example.test"),
    url: `https://example.test${path}`,
    cookies: { get: () => ({ value: "signed-cookie" }) },
  });
  for (const path of ["/login", "/register"])
    assert.deepEqual(await proxy(request(path)), { next: true });
  state.session = null;
  assert.match(
    (await proxy(request("/admin/staff"))).redirect,
    /\/login\?next=/,
  );
  state.session = { userId: "customer", roleCode: RoleCode.CUSTOMER };
  assert.equal(
    (await proxy(request("/admin/staff"))).redirect,
    "https://example.test/account",
  );
});
