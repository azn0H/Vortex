using System.Security.Claims;

namespace Vortex.Api.Infrastructure;

public static class UserProfile
{
    public static string DisplayName(ClaimsPrincipal user)
    {
        // Self-registered Authentik accounts can have an empty name claim.
        var name = user.Identity?.Name;
        if (!string.IsNullOrWhiteSpace(name)) return name.Trim();

        var username = user.FindFirstValue("preferred_username");
        return string.IsNullOrWhiteSpace(username) ? "Uživatel" : username.Trim();
    }
}
