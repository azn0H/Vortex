using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Vortex.Api.Domain;
using Vortex.Api.Infrastructure;

namespace Vortex.Api.Authorization;

public sealed class ApplicationAccessHandler(
    AppDbContext dbContext,
    IConfiguration configuration) : AuthorizationHandler<ApplicationAccessRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ApplicationAccessRequirement requirement)
    {
        var subject = context.User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(subject))
        {
            return;
        }

        var application = await dbContext.ClientApplications
            .AsNoTracking()
            .Where(x => x.Key == requirement.ApplicationKey && x.IsEnabled)
            .Select(x => new { x.Id, x.AccessMode })
            .SingleOrDefaultAsync();

        if (application is null)
        {
            return;
        }

        if (application.AccessMode == ApplicationAccessMode.Public)
        {
            context.Succeed(requirement);
            return;
        }

        var roles = context.User.FindAll(ClaimTypes.Role)
            .Select(x => x.Value)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var administratorRole = configuration["Identity:AdministratorRole"] ?? "platform-admin";

        if (roles.Contains(administratorRole, StringComparer.Ordinal))
        {
            context.Succeed(requirement);
            return;
        }

        var hasUserGrant = await dbContext.ApplicationUserGrants
            .AsNoTracking()
            .AnyAsync(x => x.ClientApplicationId == application.Id && x.Subject == subject);

        if (hasUserGrant)
        {
            context.Succeed(requirement);
            return;
        }

        if (roles.Length == 0)
        {
            return;
        }

        var hasRoleGrant = await dbContext.ApplicationRoleGrants
            .AsNoTracking()
            .AnyAsync(x => x.ClientApplicationId == application.Id && roles.Contains(x.Role));

        if (hasRoleGrant)
        {
            context.Succeed(requirement);
        }
    }
}
