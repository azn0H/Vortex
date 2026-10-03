import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "./api";
import { beginSignIn, getActiveUser, signOut } from "./auth";
import type {
  Application,
  ApplicationDetail,
  Profile,
  UserAccessLog,
  UserAccessMatrixItem,
} from "./types";

type View = "portal" | "admin" | "audit";
type NewApplication = {
  key: string;
  displayName: string;
  launchUrl: string;
  accessMode: number;
};
const isRestricted = (mode: Application["accessMode"]) =>
  mode === 1 || mode === "Restricted";
const messageFrom = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("cs-CZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function Brand({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <span className="brand-word">Vortex</span>
      <span className="brand-manager">By Metafra</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="brand"
      onClick={onClick}
      aria-label="Vortex — moje aplikace"
    >
      {content}
    </button>
  ) : (
    <div className="brand">{content}</div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <span>
        Vortex
      </span>
      <span>web by <a href="https://aznoh.cz">aznoh.cz</a></span>
    </footer>
  );
}

function ErrorNotice({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="error-notice" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss}>
          Zavřít
        </button>
      )}
    </div>
  );
}

function Poster() {
  return (
    <aside className="portal-poster" aria-label="Vortex — váš vstup k práci">
      <div>
        <h2>
          Váš vstup
          <br /> k práci.
        </h2>
      </div>
      <span className="poster-signature">
        Vortex
      </span>
    </aside>
  );
}

export function App() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeView, setActiveView] = useState<View>("portal");
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const loadPortal = useCallback(async () => {
    const [nextProfile, nextApplications] = await Promise.all([
      api.me(),
      api.applications(),
    ]);
    setProfile(nextProfile);
    setApplications(nextApplications);
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const user = await getActiveUser();
        if (disposed) return;
        setIsAuthenticated(user !== null);
        if (user) await loadPortal();
      } catch (reason) {
        if (!disposed)
          setError(
            messageFrom(reason, "Pracovní prostor se nepodařilo načíst."),
          );
      } finally {
        if (!disposed) setIsReady(true);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [loadPortal]);

  function navigate(view: View) {
    setActiveView(view);
    setError(null);
    if (view === "portal")
      void loadPortal().catch((reason) =>
        setError(messageFrom(reason, "Aplikace se nepodařilo načíst.")),
      );
  }
  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setIsAuthenticated(false);
      setProfile(null);
      setApplications([]);
      setError(
        "Odhlášení u poskytovatele identity se nezdařilo. Pro ukončení SSO relace se odhlaste přímo v Authentiku.",
      );
      setIsSigningOut(false);
    }
  }

  if (!isReady)
    return (
      <div className="app-shell">
        <header className="site-header">
          <Brand />
        </header>
        <main className="loading-page" aria-busy="true">
          <span className="eyebrow">Pracovní prostor</span>
          <h1>Vortex se připravuje.</h1>
          <p role="status">Načítání vašich aplikací…</p>
        </main>
        <Footer />
      </div>
    );
  if (!isAuthenticated) return <SignIn error={error} />;
  const isAdministrator =
    profile?.roles.some((role) =>
      ["platform-admin", "authentik admins"].includes(role.toLowerCase()),
    ) ?? false;
  const name = profile?.name ?? "Uživatel";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Přejít k obsahu
      </a>
      <header className="site-header">
        <Brand onClick={() => navigate("portal")} />
        <nav className="main-nav" aria-label="Hlavní navigace">
          <button
            type="button"
            aria-current={activeView === "portal" ? "page" : undefined}
            onClick={() => navigate("portal")}
          >
            Aplikace
          </button>
          {isAdministrator && (
            <>
              <button
                type="button"
                aria-current={activeView === "admin" ? "page" : undefined}
                onClick={() => navigate("admin")}
              >
                Správa
              </button>
              <button
                type="button"
                aria-current={activeView === "audit" ? "page" : undefined}
                onClick={() => navigate("audit")}
              >
                Aktivita
              </button>
            </>
          )}
        </nav>
        <div className="account">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="account-name">{name}</span>
          <button
            type="button"
            className="text-button signout-button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
          >
            {isSigningOut ? "Odhlášení…" : "Odhlásit se"}
          </button>
        </div>
      </header>
      <ErrorNotice message={error} onDismiss={() => setError(null)} />
      <main
        id="main-content"
        className={
          activeView === "portal" ? "portal-layout" : "workspace-layout"
        }
      >
        {activeView === "portal" ? (
          <>
            <Poster />
            <Portal applications={applications} onError={setError} />
          </>
        ) : (
          isAdministrator && (
            <Administration view={activeView} onError={setError} />
          )
        )}
      </main>
      <Footer />
    </div>
  );
}

function SignIn({ error }: { error: string | null }) {
  const [isPending, setIsPending] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  async function signIn() {
    setIsPending(true);
    setSignInError(null);
    try {
      await beginSignIn();
    } catch {
      setSignInError("Přihlášení se nepodařilo zahájit. Zkuste to znovu.");
      setIsPending(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <Brand />
      </header>
      <main className="portal-layout signin-layout">
        <Poster />
        <section className="signin-content">
          <span className="eyebrow">SSO</span>
          <h1>Přihlášení.</h1>
          <p>
            Pokračujte se svým účtem.
          </p>
          <ErrorNotice message={signInError ?? error} />
          <button
            type="button"
            className="button-primary signin-action"
            onClick={() => void signIn()}
            disabled={isPending}
          >
            {isPending ? "Přesměrování…" : "Pokračovat k přihlášení"}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="signin-footnote">
            Přístup k aplikacím se řídí oprávněními vašeho účtu.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Portal({
  applications,
  onError,
}: {
  applications: Application[];
  onError: (message: string | null) => void;
}) {
  const [filter, setFilter] = useState("");
  const filteredApps = applications.filter((app) =>
    `${app.displayName} ${app.key}`
      .toLocaleLowerCase("cs")
      .includes(filter.toLocaleLowerCase("cs")),
  );
  async function handleLaunch(key: string) {
    try {
      await api.launchApp(key);
    } catch {
      onError(
        "Záznam spuštění se nepodařilo uložit. Přístup k otevřené aplikaci ověřuje její vlastní přihlášení.",
      );
    }
  }
  return (
    <section className="portal-content" aria-labelledby="portal-title">
      <h1 id="portal-title">Moje aplikace</h1>
      <label className="search-field">
        <span className="sr-only">Hledat aplikaci podle názvu nebo klíče</span>
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Hledat aplikaci"
        />
      </label>
      <div className="list-heading">
        <span aria-live="polite">
          Aplikace /{" "}
          {filter
            ? `${filteredApps.length} z ${applications.length}`
            : applications.length}
        </span>
        <span>Přístup</span>
      </div>
      <div className="application-list">
        {filteredApps.map((application, index) => (
          <a
            className="application-row"
            key={application.key}
            href={application.launchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void handleLaunch(application.key)}
            aria-label={`Otevřít ${application.displayName} v nové kartě`}
          >
            <span className="row-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="row-content">
              <span className="application-name">
                {application.displayName}
              </span>
              <span className="application-access">
                {isRestricted(application.accessMode)
                  ? "Omezený přístup"
                  : "Všichni přihlášení"}
              </span>
            </span>
            <span className="row-arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
        {filteredApps.length === 0 && (
          <div className="empty-state">
            <h2>
              {applications.length
                ? "Nic jsme nenašli."
                : "Prozatím bez aplikací."}
            </h2>
            <p>
              {applications.length
                ? "Zkuste jiný název nebo klíč aplikace."
                : "Vašemu účtu zatím nebyly přiřazeny žádné aplikace. Obraťte se na správce."}
            </p>
            {filter && (
              <button
                type="button"
                className="text-button"
                onClick={() => setFilter("")}
              >
                Vymazat hledání
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Administration({
  view,
  onError,
}: {
  view: "admin" | "audit";
  onError: (message: string | null) => void;
}) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showIntegration, setShowIntegration] = useState(false);
  const [auditLogs, setAuditLogs] = useState<UserAccessLog[]>([]);
  const [userMatrix, setUserMatrix] = useState<UserAccessMatrixItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const selectionSequence = useRef(0);
  const refresh = useCallback(async () => {
    const items = await api.adminApplications();
    setApplications(items);
    return items;
  }, []);
  const select = useCallback(
    async (key: string) => {
      const sequence = ++selectionSequence.current;
      setSelectedKey(key);
      setDetail(null);
      setStatus("");
      setShowIntegration(false);
      setIsLoadingDetail(true);
      try {
        const nextDetail = await api.applicationDetail(key);
        if (sequence === selectionSequence.current) {
          setDetail(nextDetail);
          onError(null);
        }
      } catch (reason) {
        if (sequence === selectionSequence.current)
          onError(
            messageFrom(reason, "Nastavení aplikace se nepodařilo načíst."),
          );
      } finally {
        if (sequence === selectionSequence.current) setIsLoadingDetail(false);
      }
    },
    [onError],
  );
  useEffect(() => {
    let disposed = false;
    void refresh()
      .then((items) => {
        if (!disposed && selectionSequence.current === 0 && items[0])
          void select(items[0].key);
      })
      .catch((reason) => {
        if (!disposed)
          onError(messageFrom(reason, "Aplikace se nepodařilo načíst."));
      })
      .finally(() => {
        if (!disposed) setIsLoadingApps(false);
      });
    return () => {
      disposed = true;
    };
  }, [onError, refresh, select]);
  const refreshAudit = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const [logs, matrix] = await Promise.all([
        api.adminAuditLogs(),
        api.adminUserMatrix(),
      ]);
      setAuditLogs(logs);
      setUserMatrix(matrix);
      onError(null);
    } catch (reason) {
      onError(messageFrom(reason, "Aktivitu se nepodařilo načíst."));
    } finally {
      setIsLoadingAudit(false);
    }
  }, [onError]);
  useEffect(() => {
    if (view === "audit") void refreshAudit();
  }, [view, refreshAudit]);

  async function createApplication(payload: NewApplication) {
    try {
      const created = await api.createApplication(payload);
      await refresh();
      await select(created.key);
      setShowCreate(false);
      setStatus("Aplikace byla vytvořena.");
    } catch (reason) {
      throw new Error(messageFrom(reason, "Aplikaci se nepodařilo vytvořit."));
    }
  }
  async function saveApplication(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setIsSaving(true);
    setStatus("");
    try {
      await api.updateApplication(detail.key, {
        displayName: detail.displayName,
        launchUrl: detail.launchUrl,
        accessMode: isRestricted(detail.accessMode) ? 1 : 0,
        isEnabled: detail.isEnabled,
      });
      await refresh();
      await select(detail.key);
      setStatus("Změny byly uloženy.");
    } catch (reason) {
      onError(messageFrom(reason, "Změny se nepodařilo uložit."));
    } finally {
      setIsSaving(false);
    }
  }
  async function deleteApp(key: string) {
    if (!window.confirm(`Opravdu chcete smazat aplikaci „${key}“?`)) return;
    setIsSaving(true);
    try {
      await api.deleteApplication(key);
      ++selectionSequence.current;
      setSelectedKey(null);
      setDetail(null);
      const remaining = await refresh();
      if (remaining[0]) await select(remaining[0].key);
      setStatus("Aplikace byla smazána.");
      if (!remaining[0]) onError(null);
    } catch (reason) {
      onError(messageFrom(reason, "Aplikaci se nepodařilo smazat."));
    } finally {
      setIsSaving(false);
    }
  }
  async function mutate(action: () => Promise<void>): Promise<boolean> {
    if (!detail) return false;
    setIsSaving(true);
    setStatus("");
    try {
      await action();
      await select(detail.key);
      setStatus("Oprávnění byla aktualizována.");
      return true;
    } catch (reason) {
      onError(messageFrom(reason, "Oprávnění se nepodařilo změnit."));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  if (view === "audit")
    return (
      <section className="workspace" aria-labelledby="audit-title">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">Správa / přehled</span>
            <h1 id="audit-title">Aktivita</h1>
            <p>Přihlášení, přístupy a záznamy o spuštění aplikací.</p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void refreshAudit()}
            disabled={isLoadingAudit}
          >
            {isLoadingAudit ? "Obnovování…" : "Obnovit přehled"}
            <span aria-hidden="true">↻</span>
          </button>
        </div>
        <section
          className="audit-section"
          aria-labelledby="matrix-title"
          aria-busy={isLoadingAudit}
        >
          <div className="section-heading">
            <h2 id="matrix-title">Uživatelé a přístupy</h2>
            <span className="count-label">{userMatrix.length} uživatelů</span>
          </div>
          {userMatrix.length === 0 ? (
            <p className="empty-message">
              {isLoadingAudit
                ? "Načítání uživatelů…"
                : "Zatím nemáme žádné údaje o uživatelích."}
            </p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Uživatel</th>
                    <th>Role</th>
                    <th>Přístupné aplikace</th>
                    <th>Poslední aktivita</th>
                  </tr>
                </thead>
                <tbody>
                  {userMatrix.map((item) => (
                    <tr key={item.subject}>
                      <td>
                        <span className="cell-name">
                          {item.userName ?? item.subject}
                        </span>
                        <span className="cell-secondary mono">
                          {item.subject}
                        </span>
                      </td>
                      <td>
                        <Tags items={item.roles} />
                      </td>
                      <td>
                        <Tags items={item.accessibleApplicationKeys} />
                      </td>
                      <td className="date-cell">
                        {formatDate(item.lastActiveAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section
          className="audit-section"
          aria-labelledby="events-title"
          aria-busy={isLoadingAudit}
        >
          <div className="section-heading">
            <h2 id="events-title">Poslední události</h2>
            <span className="count-label">{auditLogs.length} záznamů</span>
          </div>
          {auditLogs.length === 0 ? (
            <p className="empty-message">
              {isLoadingAudit
                ? "Načítání událostí…"
                : "Zatím nebyly zaznamenány žádné události."}
            </p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Čas</th>
                    <th>Uživatel</th>
                    <th>Událost</th>
                    <th>Aplikace</th>
                    <th>IP adresa</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="date-cell">{formatDate(log.timestamp)}</td>
                      <td>
                        <span className="cell-name">
                          {log.userName ?? log.subject}
                        </span>
                        <span className="cell-secondary mono">
                          {log.subject}
                        </span>
                      </td>
                      <td>{log.action}</td>
                      <td>
                        <span className="cell-name">
                          {log.applicationName ?? log.applicationKey ?? "—"}
                        </span>
                        {log.applicationKey && (
                          <span className="cell-secondary mono">
                            {log.applicationKey}
                          </span>
                        )}
                      </td>
                      <td className="mono">{log.ipAddress ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    );

  return (
    <section className="workspace" aria-labelledby="admin-title">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">Správa / aplikace</span>
          <h1 id="admin-title">Správa aplikací</h1>
          <p>Nastavení aplikací a pravidel přístupu.</p>
        </div>
        <button
          type="button"
          className="button-primary"
          onClick={() => setShowCreate(true)}
        >
          Nová aplikace<span aria-hidden="true">+</span>
        </button>
      </div>
      <div className="admin-layout">
        <aside
          className="application-picker"
          aria-label="Registrované aplikace"
        >
          <div className="list-heading">
            <span>Aplikace / {applications.length}</span>
          </div>
          {isLoadingApps && <p className="empty-message">Načítání aplikací…</p>}
          {!isLoadingApps && applications.length === 0 && (
            <p className="empty-message">Přidejte první aplikaci.</p>
          )}
          {applications.map((application, index) => (
            <button
              type="button"
              key={application.key}
              className="picker-row"
              aria-pressed={selectedKey === application.key}
              disabled={isSaving}
              onClick={() => void select(application.key)}
            >
              <span className="row-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="picker-name">{application.displayName}</span>
                <span className="cell-secondary mono">{application.key}</span>
                {!application.isEnabled && (
                  <span className="disabled-label">Vypnuto</span>
                )}
              </span>
              <span className="picker-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </aside>
        <section
          className="application-editor"
          aria-busy={isLoadingDetail || isSaving}
        >
          {!detail ? (
            <div className="empty-state">
              <span className="eyebrow">Nastavení aplikace</span>
              <h2>{isLoadingDetail ? "Načítání…" : "Vyberte aplikaci."}</h2>
              <p>
                {isLoadingDetail
                  ? "Připravujeme aktuální nastavení."
                  : "Její nastavení a oprávnění najdete tady."}
              </p>
            </div>
          ) : (
            <>
              <div className="editor-heading">
                <div>
                  <span className="eyebrow mono">{detail.key}</span>
                  <h2>{detail.displayName}</h2>
                </div>
                <span className="state-label">
                  {detail.isEnabled ? "Zapnuto" : "Vypnuto"}
                </span>
              </div>
              <form className="editor-form" onSubmit={saveApplication}>
                <fieldset disabled={isSaving} className="form-grid">
                  <label className="field">
                    <span>Název aplikace</span>
                    <input
                      className="input"
                      value={detail.displayName}
                      onChange={(event) =>
                        setDetail({
                          ...detail,
                          displayName: event.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Adresa aplikace</span>
                    <input
                      className="input"
                      type="url"
                      value={detail.launchUrl}
                      onChange={(event) =>
                        setDetail({ ...detail, launchUrl: event.target.value })
                      }
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Přístup</span>
                    <select
                      className="input"
                      value={isRestricted(detail.accessMode) ? 1 : 0}
                      onChange={(event) =>
                        setDetail({
                          ...detail,
                          accessMode: Number(event.target.value) as 0 | 1,
                        })
                      }
                    >
                      <option value={0}>Všichni přihlášení</option>
                      <option value={1}>Vybraní uživatelé a role</option>
                    </select>
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={detail.isEnabled}
                      onChange={(event) =>
                        setDetail({
                          ...detail,
                          isEnabled: event.target.checked,
                        })
                      }
                    />
                    <span>Aplikace je dostupná uživatelům</span>
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setShowIntegration(true)}
                    >
                      Návod na integraci<span aria-hidden="true">↗</span>
                    </button>
                    <button type="submit" className="button-primary">
                      {isSaving ? "Ukládání…" : "Uložit změny"}
                    </button>
                  </div>
                </fieldset>
              </form>
              <AccessList
                key={`${detail.key}-users`}
                title="Uživatelé"
                description="Přístup podle jedinečného identifikátoru účtu."
                items={detail.userSubjects}
                label="Identifikátor uživatele"
                placeholder="Např. usr_12345"
                disabled={isSaving}
                onAdd={(value) =>
                  mutate(() => api.grantUser(detail.key, value))
                }
                onRemove={(value) =>
                  void mutate(() => api.revokeUser(detail.key, value))
                }
              />
              <AccessList
                key={`${detail.key}-roles`}
                title="Role"
                description="Přístup podle role přiřazené účtu."
                items={detail.roles}
                label="Název role"
                placeholder="Např. finance"
                disabled={isSaving}
                onAdd={(value) =>
                  mutate(() => api.grantRole(detail.key, value))
                }
                onRemove={(value) =>
                  void mutate(() => api.revokeRole(detail.key, value))
                }
              />
              <div className="editor-bottom">
                <button
                  type="button"
                  className="text-button danger-text"
                  disabled={isSaving}
                  onClick={() => void deleteApp(detail.key)}
                >
                  Smazat aplikaci
                </button>
              </div>
            </>
          )}
          <p className="save-status" role="status">
            {status}
          </p>
        </section>
      </div>
      {showCreate && (
        <CreateApplicationDialog
          onClose={() => setShowCreate(false)}
          onCreate={createApplication}
        />
      )}
      {showIntegration && detail && (
        <IntegrationGuide
          appKey={detail.key}
          onClose={() => setShowIntegration(false)}
        />
      )}
    </section>
  );
}

function Tags({ items }: { items: string[] }) {
  return items.length ? (
    <span className="tag-list">
      {items.map((item) => (
        <span className="tag" key={item}>
          {item}
        </span>
      ))}
    </span>
  ) : (
    <span className="muted">—</span>
  );
}

function AccessList({
  title,
  description,
  items,
  label,
  placeholder,
  disabled,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  items: string[];
  label: string;
  placeholder: string;
  disabled: boolean;
  onAdd: (value: string) => Promise<boolean>;
  onRemove: (value: string) => void;
}) {
  const [input, setInput] = useState("");
  return (
    <section className="access-section">
      <div className="section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="count-label">{items.length}</span>
      </div>
      <form
        className="grant-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim())
            void onAdd(input.trim()).then((succeeded) => {
              if (succeeded) setInput("");
            });
        }}
      >
        <label className="field">
          <span className="sr-only">{label}</span>
          <input
            className="input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
        </label>
        <button
          type="submit"
          className="button-secondary"
          disabled={disabled || !input.trim()}
        >
          Přidat
        </button>
      </form>
      <div className="assignment-list">
        {items.length === 0 && (
          <p className="empty-message">Zatím bez přiřazených oprávnění.</p>
        )}
        {items.map((item) => (
          <span className="assignment" key={item}>
            <span>{item}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(item)}
              aria-label={`Odstranit oprávnění ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="dialog-close"
          aria-label="Zavřít dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

function CreateApplicationDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (payload: NewApplication) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      await onCreate({
        key,
        displayName: name,
        launchUrl: url,
        accessMode: mode,
      });
    } catch (reason) {
      setError(messageFrom(reason, "Aplikaci se nepodařilo vytvořit."));
      setIsPending(false);
    }
  }
  return (
    <Dialog title="Nová aplikace" onClose={onClose}>
      <p className="dialog-intro">Přidejte aplikaci do pracovního prostoru.</p>
      <ErrorNotice message={error} />
      <form onSubmit={submit}>
        <fieldset className="dialog-form" disabled={isPending}>
          <label className="field">
            <span>Název aplikace</span>
            <input
              className="input"
              value={name}
              onChange={(event) => {
                const value = event.target.value;
                if (!key || key === generateSlug(name))
                  setKey(generateSlug(value));
                setName(value);
              }}
              required
              autoFocus
            />
          </label>
          <div className="field">
            <label htmlFor="new-application-key">Klíč aplikace</label>
            <input
              id="new-application-key"
              aria-describedby="new-application-key-help"
              className="input mono"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              pattern="[a-z0-9][a-z0-9-]{1,98}"
              required
            />
            <small id="new-application-key-help">2–99 znaků: malá písmena, číslice a pomlčky.</small>
          </div>
          <label className="field">
            <span>Adresa aplikace</span>
            <input
              className="input"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://app.example.com"
              required
            />
          </label>
          <label className="field">
            <span>Přístup</span>
            <select
              className="input"
              value={mode}
              onChange={(event) => setMode(Number(event.target.value))}
            >
              <option value={0}>Všichni přihlášení</option>
              <option value={1}>Vybraní uživatelé a role</option>
            </select>
          </label>
          <div className="dialog-actions">
            <button type="button" className="text-button" onClick={onClose}>
              Zrušit
            </button>
            <button type="submit" className="button-primary">
              {isPending ? "Vytváření…" : "Vytvořit aplikaci"}
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

function IntegrationGuide({
  appKey,
  onClose,
}: {
  appKey: string;
  onClose: () => void;
}) {
  const runtime = window.__VORTEX_CONFIG__;
  const authority =
    runtime?.oidcAuthority ?? import.meta.env.VITE_OIDC_AUTHORITY;
  const scope =
    runtime?.oidcScope ??
    import.meta.env.VITE_OIDC_SCOPE ??
    "openid profile email";
  return (
    <Dialog title={`Integrace / ${appKey}`} onClose={onClose}>
      <div className="integration-guide">
        <p>
          Aplikace musí ověřit přihlášení i oprávnění ke každému chráněnému
          požadavku.
        </p>
        <section>
          <span className="eyebrow">01 / Přihlášení</span>
          <h3>OpenID Connect</h3>
          <p>
            Vlastní aplikaci zaregistrujte jako samostatného OIDC klienta u
            poskytovatele identity.
          </p>
          <dl>
            <dt>Authority / issuer</dt>
            <dd>
              <code>{authority}</code>
            </dd>
            <dt>Scopes portálu</dt>
            <dd>
              <code>{scope}</code>
            </dd>
          </dl>
        </section>
        <section>
          <span className="eyebrow">02 / Přístup</span>
          <h3>Autorizace přes API</h3>
          <p>
            Na backendu ověřte přístup pomocí access tokenu. Úspěšný požadavek
            se také zapíše do auditu.
          </p>
          <pre>
            <code>
              POST {runtime?.apiUrl || window.location.origin}/api/apps/{appKey}
              /launch{"\n"}Authorization: Bearer &lt;access_token&gt;
            </code>
          </pre>
          <dl className="response-codes">
            <dt>200</dt>
            <dd>Přístup povolen, spuštění zaznamenáno.</dd>
            <dt>401</dt>
            <dd>Chybí platné přihlášení.</dd>
            <dt>403</dt>
            <dd>Uživatel nemá oprávnění.</dd>
            <dt>404</dt>
            <dd>Aplikace neexistuje nebo je vypnutá.</dd>
          </dl>
        </section>
        <div className="dialog-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Zavřít návod
          </button>
        </div>
      </div>
    </Dialog>
  );
}
