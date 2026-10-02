import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { beginSignIn, getActiveUser, signOut } from "./auth";
import type { Application, ApplicationDetail, Profile, UserAccessLog, UserAccessMatrixItem } from "./types";

const administratorRole = "platform-admin";

function accessModeLabel(mode: Application["accessMode"]): string {
  return mode === 1 || mode === "Restricted" ? "Omezená" : "Veřejná";
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return isoString;
  }
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function App() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeView, setActiveView] = useState<"portal" | "admin">("portal");
  const [error, setError] = useState<string | null>(null);

  const loadPortal = useCallback(async () => {
    const [nextProfile, nextApplications] = await Promise.all([api.me(), api.applications()]);
    setProfile(nextProfile);
    setApplications(nextApplications);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const user = await getActiveUser();
        setIsAuthenticated(user !== null);

        if (user) {
          await loadPortal();
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Nespravilo sa načítanie vášho pracovného priestoru.");
      } finally {
        setIsReady(true);
      }
    })();
  }, [loadPortal]);

  if (!isReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0e0f12] text-slate-400">
        <div className="flex items-center gap-3 font-mono-code text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-ping" />
          Načítání portálu Vortex...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  const isAdministrator = profile?.roles.some(role =>
    role.toLowerCase() === administratorRole.toLowerCase() ||
    role.toLowerCase() === "authentik admins"
  ) ?? false;

  return (
    <main className="min-h-screen bg-[#0e0f12] text-slate-100">
      {/* Swiss Minimal Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0e0f12]/95 px-6 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <button className="flex items-center gap-2.5 text-left group" onClick={() => setActiveView("portal")}>
            <div className="grid h-7 w-7 place-items-center rounded border border-slate-700 bg-slate-800 font-mono-code font-bold text-xs text-white">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-sm text-slate-100">VORTEX</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Aktivní relace" />
              </div>
            </div>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-200">{profile?.name ?? profile?.subject ?? "Uživatel"}</p>
              <p className="text-[11px] font-mono-code text-slate-400">{profile?.roles.length ?? 0} přiřazených rolí</p>
            </div>
            <button className="button-secondary" onClick={() => void signOut().catch(() => {
              setError("Odhlášení u poskytovatele identity se nezdařilo. Pro ukončení SSO relace se odhlaste přímo v Authentiku.");
            })}>
              Odhlásit se
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <nav className="mb-6 flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex gap-1.5">
            <button
              className={activeView === "portal" ? "tab tab-active" : "tab"}
              onClick={() => setActiveView("portal")}
            >
              Moje aplikace
            </button>
            {isAdministrator && (
              <button
                className={activeView === "admin" ? "tab tab-active" : "tab"}
                onClick={() => setActiveView("admin")}
              >
                Administrace
              </button>
            )}
          </div>

          <div className="hidden items-center gap-2 font-mono-code text-[11px] text-slate-400 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            OIDC / PKCE Relace
          </div>
        </nav>

        {error && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
            <span>{error}</span>
            <button className="font-mono-code text-[11px] underline hover:text-white" onClick={() => setError(null)}>Zavřít</button>
          </div>
        )}

        {activeView === "portal" && <Portal applications={applications} />}
        {activeView === "admin" && isAdministrator && <Administration onError={setError} />}
      </section>
    </main>
  );
}

function SignIn() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#0e0f12] px-6 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-xl border border-slate-800/90 bg-[#14151b] p-8 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded border border-slate-700 bg-slate-800 font-mono-code font-bold text-xs text-white">
              V
            </div>
            <span className="font-bold text-sm text-white tracking-tight">Vortex Access</span>
          </div>
          <span className="rounded border border-slate-800 bg-[#191b22] px-2 py-0.5 font-mono-code text-[10px] text-slate-400">
            OIDC / PKCE
          </span>
        </div>
        
        <h1 className="text-xl font-bold text-white tracking-tight">Přihlášení k aplikacím</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Jednotné přihlášení (SSO) pro přístup k interním službám a vyhrazeným rozhraním.
        </p>

        <button className="button-primary mt-8 w-full font-semibold py-2.5" onClick={() => void beginSignIn()}>
          Pokračovat přes SSO
        </button>

        <div className="mt-8 border-t border-slate-800/80 pt-4 text-center">
          <span className="font-mono-code text-[11px] text-slate-500">
            Authentik & Zitadel Identity Provider
          </span>
        </div>
      </section>
    </main>
  );
}

function Portal({ applications }: { applications: Application[] }) {
  const [filter, setFilter] = useState("");

  const filteredApps = applications.filter(
    (app) =>
      app.displayName.toLowerCase().includes(filter.toLowerCase()) ||
      app.key.toLowerCase().includes(filter.toLowerCase())
  );

  async function handleLaunch(key: string) {
    try {
      await api.launchApp(key);
    } catch (e) {
      console.warn("Could not log application launch", e);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Vaše aplikace</h1>
          <p className="text-xs text-slate-400">Seznam dostupných aplikací přiřazených k vašemu účtu</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            className="input w-56 font-mono-code text-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtr název nebo klíč..."
          />
          <span className="shrink-0 rounded border border-slate-800 bg-[#16181f] px-2.5 py-1 font-mono-code text-xs text-slate-400">
            {filteredApps.length} / {applications.length}
          </span>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-[#121318] p-10 text-center font-mono-code text-xs text-slate-500">
          Vašemu účtu zatím nebyly přiřazeny žádné aplikace.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-[#14151b]">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_140px_110px] items-center gap-4 border-b border-slate-800/80 px-4 py-2.5 font-mono-code text-[11px] font-semibold text-slate-400">
            <span>NÁZEV APLIKACE A KLÍČ</span>
            <span>REŽIM PŘÍSTUPU</span>
            <span className="text-right">AKCE</span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {filteredApps.map((application) => (
              <div
                key={application.key}
                className="grid grid-cols-[1fr_140px_110px] items-center gap-4 px-4 py-3 transition hover:bg-[#181a22]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded border border-slate-800 bg-[#191b22] font-mono-code font-bold text-xs text-slate-300">
                    {application.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-xs text-slate-200">{application.displayName}</span>
                    <span className="block truncate font-mono-code text-[11px] text-slate-500">{application.key}</span>
                  </div>
                </div>

                <div>
                  <span className={accessModeLabel(application.accessMode) === "Veřejná" ? "badge badge-public" : "badge badge-restricted"}>
                    <span className={`h-1.5 w-1.5 rounded-full ${accessModeLabel(application.accessMode) === "Veřejná" ? "bg-emerald-400" : "bg-amber-400"}`} />
                    {accessModeLabel(application.accessMode)}
                  </span>
                </div>

                <div className="text-right">
                  <a
                    className="button-secondary text-[11px] py-1 px-2.5"
                    href={application.launchUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => void handleLaunch(application.key)}
                  >
                    Otevřít
                    <span className="font-mono-code text-[10px]">→</span>
                  </a>
                </div>
              </div>
            ))}

            {filteredApps.length === 0 && (
              <div className="p-6 text-center font-mono-code text-xs text-slate-500">
                Žádná aplikace neodpovídá zadanému filtru.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Administration({ onError }: { onError: (message: string | null) => void }) {
  const [adminTab, setAdminTab] = useState<"apps" | "audit">("apps");
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [showIntegrationGuide, setShowIntegrationGuide] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newLaunchUrl, setNewLaunchUrl] = useState("");
  const [newMode, setNewMode] = useState(0);
  const [subject, setSubject] = useState("");
  const [role, setRole] = useState("");

  const [auditLogs, setAuditLogs] = useState<UserAccessLog[]>([]);
  const [userMatrix, setUserMatrix] = useState<UserAccessMatrixItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const refresh = useCallback(async () => {
    const items = await api.adminApplications();
    setApplications(items);
  }, []);

  const refreshAudit = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const [logs, matrix] = await Promise.all([api.adminAuditLogs(), api.adminUserMatrix()]);
      setAuditLogs(logs);
      setUserMatrix(matrix);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Nespravilo sa načítanie auditu.");
    } finally {
      setIsLoadingAudit(false);
    }
  }, [onError]);

  const select = useCallback(async (key: string) => {
    const nextDetail = await api.applicationDetail(key);
    setSelectedKey(key);
    setDetail(nextDetail);
  }, []);

  useEffect(() => {
    void refresh().catch((reason) => onError(reason instanceof Error ? reason.message : "Nespravilo sa načítanie aplikácií."));
  }, [onError, refresh]);

  const handleNewNameChange = (val: string) => {
    const oldSlug = generateSlug(newName);
    setNewName(val);
    if (!newKey || newKey === oldSlug) {
      setNewKey(generateSlug(val));
    }
  };

  useEffect(() => {
    if (adminTab === "audit") {
      void refreshAudit();
    }
  }, [adminTab, refreshAudit]);

  async function createApplication(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await api.createApplication({ key: newKey, displayName: newName, launchUrl: newLaunchUrl, accessMode: newMode });
      setNewKey("");
      setNewName("");
      setNewLaunchUrl("");
      await refresh();
      await select(created.key);
      onError(null);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Nespravilo sa vytvorenie aplikácie.");
    }
  }

  async function deleteApp(key: string) {
    if (!window.confirm(`Opravdu chcete smazat aplikaci "${key}"?`)) return;
    try {
      await api.deleteApplication(key);
      setSelectedKey(null);
      setDetail(null);
      await refresh();
      onError(null);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Nespravilo sa smazání aplikace.");
    }
  }

  async function saveApplication(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    try {
      await api.updateApplication(detail.key, {
        displayName: detail.displayName,
        launchUrl: detail.launchUrl,
        accessMode: detail.accessMode === "Restricted" || detail.accessMode === 1 ? 1 : 0,
        isEnabled: detail.isEnabled
      });
      await refresh();
      await select(detail.key);
      onError(null);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Nespravilo sa uloženie konfigurácie.");
    }
  }

  async function mutate(action: () => Promise<void>) {
    if (!detail) return;
    try {
      await action();
      await select(detail.key);
      onError(null);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Nespravila sa úprava oprávnení.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Správa přístupu & Audit</h1>
          <p className="text-xs text-slate-400">Registrace aplikací, matice oprávnění a sledování přihlášení</p>
        </div>

        <div className="flex gap-1.5">
          <button
            className={adminTab === "apps" ? "tab tab-active" : "tab"}
            onClick={() => setAdminTab("apps")}
          >
            Aplikace & Práva
          </button>
          <button
            className={adminTab === "audit" ? "tab tab-active" : "tab"}
            onClick={() => setAdminTab("audit")}
          >
            Uživatelé & Audit přihlášení
          </button>
        </div>
      </div>

      {adminTab === "apps" && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <form className="panel space-y-3" onSubmit={createApplication}>
              <h2 className="font-mono-code text-xs font-bold uppercase tracking-wider text-slate-300">Registrovat aplikaci</h2>
              <input className="input" value={newName} onChange={(event) => handleNewNameChange(event.target.value)} placeholder="Zobrazovaný název" required />
              <input className="input font-mono-code" value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="app-klic" pattern="[a-z0-9][a-z0-9-]{1,98}" required />
              <input className="input font-mono-code" type="url" value={newLaunchUrl} onChange={(event) => setNewLaunchUrl(event.target.value)} placeholder="https://app.example.com" required />
              <select className="input font-mono-code" value={newMode} onChange={(event) => setNewMode(Number(event.target.value))}>
                <option value={0}>Veřejná</option>
                <option value={1}>Omezená</option>
              </select>
              <button className="button-primary w-full text-xs font-bold">Vytvořit aplikaci</button>
            </form>

            <div className="panel p-2 space-y-1">
              <div className="px-2 py-1.5 font-mono-code text-[10px] text-slate-500 border-b border-slate-800/80 mb-1">
                REGISTROVANÉ APLIKACE ({applications.length})
              </div>
              {applications.map((application) => (
                <button
                  key={application.key}
                  className={selectedKey === application.key ? "app-row app-row-active" : "app-row"}
                  onClick={() => void select(application.key)}
                >
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-xs font-semibold">{application.displayName}</span>
                    <span className="block truncate font-mono-code text-[10px] text-slate-500">{application.key}</span>
                  </span>
                  <span className={application.isEnabled ? "h-1.5 w-1.5 rounded-full bg-emerald-400" : "h-1.5 w-1.5 rounded-full bg-slate-600"} />
                </button>
              ))}
            </div>
          </aside>

          <section className="panel min-h-96">
            {!detail ? (
              <div className="grid min-h-80 place-items-center font-mono-code text-xs text-slate-500">
                Vyberte aplikaci ze seznamu vlevo pro úpravu konfigurace.
              </div>
            ) : (
              <div className="space-y-6">
                <form className="grid gap-4 md:grid-cols-2" onSubmit={saveApplication}>
                  <label className="field">
                    <span>Zobrazovaný název</span>
                    <input className="input" value={detail.displayName} onChange={(event) => setDetail({ ...detail, displayName: event.target.value })} required />
                  </label>
                  <label className="field">
                    <span>Cílová URL adresa</span>
                    <input className="input font-mono-code" type="url" value={detail.launchUrl} onChange={(event) => setDetail({ ...detail, launchUrl: event.target.value })} required />
                  </label>
                  <label className="field">
                    <span>Režim přístupu</span>
                    <select className="input font-mono-code" value={detail.accessMode === "Restricted" || detail.accessMode === 1 ? 1 : 0} onChange={(event) => setDetail({ ...detail, accessMode: Number(event.target.value) as 0 | 1 })}>
                      <option value={0}>Veřejná</option>
                      <option value={1}>Omezená</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs font-medium text-slate-300">
                    <input className="h-3.5 w-3.5 accent-slate-200 rounded border-slate-700" type="checkbox" checked={detail.isEnabled} onChange={(event) => setDetail({ ...detail, isEnabled: event.target.checked })} />
                    Povoleno pro uživatelský přístup
                  </label>
                  <div className="md:col-span-2 flex items-center justify-between border-t border-slate-800/80 pt-4">
                    <div className="flex gap-3">
                      <button className="button-danger" type="button" onClick={() => void deleteApp(detail.key)}>
                        Smazat aplikaci
                      </button>
                      <button className="button-secondary" type="button" onClick={() => setShowIntegrationGuide(true)}>
                        Návod na integraci
                      </button>
                    </div>
                    <button className="button-primary">Uložit konfiguraci</button>
                  </div>
                </form>

                <AccessList
                  title="Explicitní uživatelská oprávnění"
                  items={detail.userSubjects}
                  input={subject}
                  setInput={setSubject}
                  placeholder="OIDC subject (např. usr_12345)"
                  onAdd={() => mutate(async () => { await api.grantUser(detail.key, subject); setSubject(""); })}
                  onRemove={(value) => mutate(() => api.revokeUser(detail.key, value))}
                />
                <AccessList
                  title="Autorizované IdP role"
                  items={detail.roles}
                  input={role}
                  setInput={setRole}
                  placeholder="Název role (např. platform-admin)"
                  onAdd={() => mutate(async () => { await api.grantRole(detail.key, role); setRole(""); })}
                  onRemove={(value) => mutate(() => api.revokeRole(detail.key, value))}
                />
              </div>
            )}
          </section>
        </div>
      )}

      {adminTab === "audit" && (
        <section className="space-y-6">
          {/* User Matrix Panel */}
          <div className="panel space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="font-bold text-sm text-white">Přehled uživatelů & přístupné aplikace</h2>
                <p className="text-xs text-slate-400">Matice aktivních uživatelů a aplikací, ke kterým mají oprávnění</p>
              </div>
              <button className="button-secondary text-xs" onClick={() => void refreshAudit()} disabled={isLoadingAudit}>
                {isLoadingAudit ? "Obnovování..." : "Obnovit přehled"}
              </button>
            </div>

            {userMatrix.length === 0 ? (
              <p className="font-mono-code text-xs text-slate-500 py-4 text-center">Žádní uživatelé zatím neprovedli žádnou aktivitu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono-code text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Uživatel / Subject</th>
                      <th className="py-2.5 px-3">IdP Role</th>
                      <th className="py-2.5 px-3">Přístupné aplikace</th>
                      <th className="py-2.5 px-3 text-right">Poslední aktivita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {userMatrix.map((item) => (
                      <tr key={item.subject} className="hover:bg-[#181a22] transition">
                        <td className="py-3 px-3">
                          <span className="block font-semibold text-slate-200">{item.userName ?? item.subject}</span>
                          <span className="block text-[11px] text-slate-500">{item.subject}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {item.roles.map((r) => (
                              <span key={r} className="rounded border border-slate-800 bg-[#181a24] px-2 py-0.5 text-[10px] text-slate-300">
                                {r}
                              </span>
                            ))}
                            {item.roles.length === 0 && <span className="text-slate-500 text-[11px]">—</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {item.accessibleApplicationKeys.map((appKey) => (
                              <span key={appKey} className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                                {appKey}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-[11px] text-slate-400">
                          {formatDate(item.lastActiveAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Audit Log Stream */}
          <div className="panel space-y-4">
            <div className="border-b border-slate-800/80 pb-3">
              <h2 className="font-bold text-sm text-white">Audit log přihlášení a akcí</h2>
              <p className="text-xs text-slate-400">Reálný časový záznam přístupů uživatelů k aplikacím</p>
            </div>

            {auditLogs.length === 0 ? (
              <p className="font-mono-code text-xs text-slate-500 py-4 text-center">Zatím nebyly zaznamenány žádné události auditu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono-code text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Čas záznamu</th>
                      <th className="py-2.5 px-3">Uživatel</th>
                      <th className="py-2.5 px-3">Akce</th>
                      <th className="py-2.5 px-3">Cílová aplikace</th>
                      <th className="py-2.5 px-3 text-right">IP adresa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#181a22] transition">
                        <td className="py-2.5 px-3 text-[11px] text-slate-400">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="block font-semibold text-slate-200">{log.userName ?? log.subject}</span>
                          <span className="block text-[10px] text-slate-500">{log.subject}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-slate-200 font-semibold">{log.applicationName ?? log.applicationKey ?? "—"}</span>
                          {log.applicationKey && <span className="block text-[10px] text-slate-500">{log.applicationKey}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[11px] text-slate-400">
                          {log.ipAddress ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {showIntegrationGuide && detail && (
        <IntegrationGuideModal appKey={detail.key} onClose={() => setShowIntegrationGuide(false)} />
      )}
    </section>
  );
}

function AccessList({
  title,
  items,
  input,
  setInput,
  placeholder,
  onAdd,
  onRemove
}: {
  title: string;
  items: string[];
  input: string;
  setInput: (value: string) => void;
  placeholder: string;
  onAdd: () => void;
  onRemove: (value: string) => void;
}) {
  return (
    <section className="border-t border-slate-800/80 pt-5">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="font-mono-code text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h2>
        <span className="rounded border border-slate-800 bg-[#16181f] px-2 py-0.5 font-mono-code text-[10px] text-slate-400">{items.length}</span>
      </div>
      <div className="flex gap-2">
        <input className="input font-mono-code" value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} />
        <button className="button-secondary shrink-0" type="button" onClick={onAdd} disabled={!input.trim()}>
          Přidat oprávnění
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="font-mono-code text-[11px] text-slate-500">Žádná přiřazená oprávnění.</span>}
        {items.map((item) => (
          <span className="assignment" key={item}>
            {item}
            <button type="button" onClick={() => onRemove(item)} aria-label={`Odstranit ${item}`}>
              ×
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}

function IntegrationGuideModal({ appKey, onClose }: { appKey: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0e0f12]/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-800 bg-[#14151b] p-8 shadow-2xl">
        <button onClick={onClose} className="absolute right-5 top-5 text-slate-500 hover:text-white transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          Integrace aplikace: <span className="text-emerald-400 font-mono-code">{appKey}</span>
        </h2>
        
        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <p>
            Vortex zajišťuje autorizaci (ověření práv) pomocí OIDC a vlastního API. K vaší aplikaci <strong className="text-slate-100">{appKey}</strong> lze přistupovat přes SSO.
          </p>

          <div className="space-y-3">
            <h3 className="font-bold text-white">1. Možnost: Konfigurace OIDC klienta (Frontend / Plná integrace)</h3>
            <p className="text-slate-400 text-xs">Pokud vaše aplikace podporuje přihlašování přes OpenID Connect, nastavte tyto hodnoty:</p>
            <div className="bg-[#0e0f12] border border-slate-800 rounded-lg p-4 font-mono-code text-xs space-y-3">
              <div>
                <span className="text-slate-500 block mb-1">OIDC Authority (Issuer):</span> 
                <span className="text-emerald-300 select-all">{window.location.origin}/application/o/vortex-portal/</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Doporučené Scopes:</span> 
                <span className="text-white select-all">openid profile email vortex-api</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Po získání tokenu můžete ověřit přístup zkoumáním claimu <code className="bg-slate-800 px-1 py-0.5 rounded text-white">roles</code>.
            </p>
          </div>

          <div className="space-y-3 border-t border-slate-800/80 pt-6">
            <h3 className="font-bold text-white">2. Možnost: Autorizace přes Vortex API (Backend)</h3>
            <p className="text-slate-400 text-xs">
              Pokud tvoříte backendové API a chcete ověřit, zda má daný uživatel (s jeho access tokenem) právo přistoupit k této aplikaci:
            </p>
            <div className="bg-[#0e0f12] border border-slate-800 rounded-lg p-4 font-mono-code text-xs leading-relaxed">
              <span className="text-emerald-400 font-bold">POST</span> {window.__VORTEX_CONFIG__?.apiUrl || window.location.origin}/api/apps/<span className="text-emerald-300">{appKey}</span>/launch<br/>
              <span className="text-slate-500">Authorization:</span> Bearer &lt;access_token&gt;
            </div>
            <ul className="list-disc pl-5 text-xs text-slate-400 space-y-1">
              <li><strong className="text-emerald-400">200 OK</strong> – Uživatel má povolený přístup (zapsáno do auditu).</li>
              <li><strong className="text-rose-400">403 Forbidden</strong> – Přístup odepřen.</li>
              <li><strong className="text-rose-400">401 Unauthorized</strong> – Neplatný token.</li>
              <li><strong className="text-rose-400">404 Not Found</strong> – Aplikace neexistuje nebo je vypnutá.</li>
            </ul>
          </div>

        </div>
        
        <div className="mt-10 flex justify-end">
          <button className="button-secondary" onClick={onClose}>Rozumím, zavřít</button>
        </div>
      </div>
    </div>
  );
}
