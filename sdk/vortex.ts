/**
 * Vortex Access SDK
 * 
 * Jednoduchý klient pro integraci Vortex SSO a autorizace do vaší aplikace.
 * Lze použít na backendu (Node.js/Bun) i na frontendu (Browser).
 * Nevyžaduje žádné externí závislosti, používá nativní fetch API.
 */

export interface VortexConfig {
  /** URL adresa Vortex API (např. http://localhost:5000) */
  apiUrl: string;
}

export class VortexClient {
  private apiUrl: string;

  constructor(config: VortexConfig) {
    // Odstraní lomítko na konci URL, pokud tam je
    this.apiUrl = config.apiUrl.replace(/\/$/, "");
  }

  /**
   * Ověří, zda má uživatel (s daným access tokenem) právo přistoupit k aplikaci.
   * Zároveň zaloguje přístup (audit log) ve Vortexu.
   * 
   * @param appKey Unikátní klíč aplikace (např. 'moje-aplikace')
   * @param accessToken OIDC Access Token získaný při přihlášení
   * @returns true pokud má uživatel přístup, false pokud ne.
   */
  async authorize(appKey: string, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/apps/${appKey}/launch`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json"
        }
      });

      return response.status === 200;
    } catch (error) {
      console.error("[VortexClient] Chyba při ověřování autorizace:", error);
      return false;
    }
  }

  /**
   * Získá profil aktuálně přihlášeného uživatele (role, subject, atd.).
   * 
   * @param accessToken OIDC Access Token
   */
  async getProfile(accessToken: string): Promise<{ subject: string; name: string; roles: string[] } | null> {
    try {
      const response = await fetch(`${this.apiUrl}/api/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json"
        }
      });

      if (response.status === 200) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error("[VortexClient] Chyba při získávání profilu:", error);
      return null;
    }
  }

  /**
   * Middleware helper pro Express.js / Polka (Node.js backend)
   * Automaticky ověří Bearer token z hlavičky Authorization.
   */
  expressMiddleware(appKey: string) {
    return async (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Chybí nebo je neplatný autorizační token" });
      }

      const token = authHeader.split(" ")[1];
      const hasAccess = await this.authorize(appKey, token);

      if (!hasAccess) {
        return res.status(403).json({ error: "Forbidden: Nemáte oprávnění k této aplikaci" });
      }

      next();
    };
  }
}
