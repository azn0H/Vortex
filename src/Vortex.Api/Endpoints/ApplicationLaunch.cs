using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Vortex.Api.Authorization;
using Vortex.Api.Domain;
using Vortex.Api.Infrastructure;

namespace Vortex.Api.Endpoints;

public static class ApplicationLaunch
{
    public static async Task<IResult> HandleAsync(string key, ClaimsPrincipal user,
        HttpContext httpContext, AppDbContext dbContext, IAuthorizationService authorization)
    {
        var subject = user.FindFirstValue("sub");
        if (user.Identity?.IsAuthenticated != true || string.IsNullOrWhiteSpace(subject))
        {
            return Results.Unauthorized();
        }

        var normalizedKey = key.Trim().ToLowerInvariant();
        var application = await dbContext.ClientApplications.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Key == normalizedKey && x.IsEnabled);
        if (application is null)
        {
            return Results.NotFound();
        }

        var access = await authorization.AuthorizeAsync(user, null,
            new ApplicationAccessRequirement(normalizedKey));
        if (!access.Succeeded)
        {
            return Results.Forbid();
        }

        dbContext.UserAccessLogs.Add(new UserAccessLog
        {
            Subject = subject,
            UserName = UserProfile.DisplayName(user),
            ApplicationKey = application.Key,
            ApplicationName = application.DisplayName,
            Action = "Spuštění aplikace",
            Roles = user.FindAll(ClaimTypes.Role).Select(x => x.Value).Distinct().ToArray(),
            IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
            Timestamp = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();
        return Results.Ok(new { status = "logged" });
    }
}
