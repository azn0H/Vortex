namespace Vortex.Api.Authorization;

public static class AdministratorRoles
{
    public static bool Matches(string role, string configuredRole) =>
        string.Equals(role, configuredRole, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(role, "platform-admin", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(role, "authentik Admins", StringComparison.OrdinalIgnoreCase);
}
