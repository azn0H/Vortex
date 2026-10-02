import { getActiveUser } from "./auth";
import type {
  Application,
  ApplicationDetail,
  Profile,
  UserAccessLog,
  UserAccessMatrixItem,
} from "./types";

const apiUrl =
  window.__VORTEX_CONFIG__?.apiUrl ?? import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = await getActiveUser();

  if (!user) {
    throw new Error("Vaše relace vypršela. Přihlaste se znovu.");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${user.access_token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Požadavek se nepodařilo dokončit.");
  }

  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<Profile>("/api/me"),
  applications: () => request<Application[]>("/api/apps"),
  launchApp: (key: string) =>
    request<void>(`/api/apps/${key}/launch`, { method: "POST" }),
  adminApplications: () => request<Application[]>("/api/admin/apps/"),
  applicationDetail: (key: string) =>
    request<ApplicationDetail>(`/api/admin/apps/${key}`),
  createApplication: (payload: {
    key: string;
    displayName: string;
    launchUrl: string;
    accessMode: number;
  }) =>
    request<Application>("/api/admin/apps/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateApplication: (
    key: string,
    payload: {
      displayName: string;
      launchUrl: string;
      accessMode: number;
      isEnabled: boolean;
    },
  ) =>
    request<Application>(`/api/admin/apps/${key}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteApplication: (key: string) =>
    request<void>(`/api/admin/apps/${key}`, { method: "DELETE" }),
  grantUser: (key: string, subject: string) =>
    request<void>(
      `/api/admin/apps/${key}/users/${encodeURIComponent(subject)}`,
      { method: "PUT" },
    ),
  revokeUser: (key: string, subject: string) =>
    request<void>(
      `/api/admin/apps/${key}/users/${encodeURIComponent(subject)}`,
      { method: "DELETE" },
    ),
  grantRole: (key: string, role: string) =>
    request<void>(`/api/admin/apps/${key}/roles/${encodeURIComponent(role)}`, {
      method: "PUT",
    }),
  revokeRole: (key: string, role: string) =>
    request<void>(`/api/admin/apps/${key}/roles/${encodeURIComponent(role)}`, {
      method: "DELETE",
    }),
  adminAuditLogs: () => request<UserAccessLog[]>("/api/admin/audit"),
  adminUserMatrix: () =>
    request<UserAccessMatrixItem[]>("/api/admin/user-matrix"),
};
