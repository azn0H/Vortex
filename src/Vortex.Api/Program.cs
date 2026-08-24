using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Vortex.Api.Authorization;
using Vortex.Api.Contracts;
using Vortex.Api.Domain;
using Vortex.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
var rolesClaimType = builder.Configuration["Identity:RolesClaimType"] ?? "roles";
var administratorRole = builder.Configuration["Identity:AdministratorRole"] ?? "platform-admin";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var authority = builder.Configuration["Identity:Authority"];
        var metadataAddress = builder.Configuration["Identity:MetadataAddress"];
        options.Authority = authority;
        options.MapInboundClaims = false;
        options.RequireHttpsMetadata = bool.TryParse(builder.Configuration["Identity:RequireHttpsMetadata"], out var https) && https;

        if (!string.IsNullOrEmpty(metadataAddress))
        {
            options.MetadataAddress = metadataAddress;
        }

        var validIssuers = new List<string>();
        if (!string.IsNullOrEmpty(authority))
        {
            validIssuers.Add(authority.TrimEnd('/'));
            validIssuers.Add(authority.TrimEnd('/') + "/");
        }
        var extraIssuer = builder.Configuration["Identity:ExternalIssuer"];
        if (!string.IsNullOrEmpty(extraIssuer))
        {
            validIssuers.Add(extraIssuer.TrimEnd('/'));
            validIssuers.Add(extraIssuer.TrimEnd('/') + "/");
        }

        var validAudiences = new List<string>();
        var apiAudience = builder.Configuration["Identity:ApiAudience"];
        var clientId = builder.Configuration["Identity:ClientId"];
        if (!string.IsNullOrEmpty(apiAudience)) validAudiences.Add(apiAudience);
        if (!string.IsNullOrEmpty(clientId) && !validAudiences.Contains(clientId)) validAudiences.Add(clientId);

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuers = validIssuers.Count > 0 ? validIssuers : null,
            ValidateAudience = validAudiences.Count > 0,
            ValidAudiences = validAudiences.Count > 0 ? validAudiences : null,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            NameClaimType = "name",
            RoleClaimType = ClaimTypes.Role,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var identity = context.Principal?.Identity as ClaimsIdentity;

                if (identity is null || context.Principal is null)
                {
                    return Task.CompletedTask;
                }

                var roleClaimNames = new[] { rolesClaimType, "roles", "role", "groups", "ak_groups", ClaimTypes.Role };

                var roles = context.Principal.Claims
                    .Where(c => roleClaimNames.Contains(c.Type, StringComparer.OrdinalIgnoreCase))
                    .SelectMany(claim => ExpandRoles(claim.Value))
                    .Distinct(StringComparer.Ordinal)
                    .ToList();

                foreach (var role in roles)
                {
                    if (!identity.HasClaim(ClaimTypes.Role, role))
                    {
                        identity.AddClaim(new Claim(ClaimTypes.Role, role));
                    }
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();
    options.AddPolicy("PlatformAdministrator", policy =>
        policy.RequireAssertion(ctx => ctx.User.Claims.Any(c => c.Type == ClaimTypes.Role && IsAdminRole(c.Value))));
});

builder.Services.AddSingleton<IAuthorizationPolicyProvider, ApplicationAccessPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, ApplicationAccessHandler>();

var app = builder.Build();

app.UseCors("frontend");
app.UseForwardedHeaders();
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.MapGet("/health", () => Results.Ok(new { status = "healthy" })).AllowAnonymous();

app.MapGet("/api/me", async (ClaimsPrincipal user, HttpContext httpContext, AppDbContext dbContext) =>
{
    var subject = user.FindFirstValue("sub");
    var name = user.Identity?.Name;
    var roles = user.FindAll(ClaimTypes.Role).Select(x => x.Value).Distinct().Order().ToArray();

    if (!string.IsNullOrEmpty(subject))
    {
        var recent = await dbContext.UserAccessLogs
            .AnyAsync(x => x.Subject == subject && x.Action == "Přihlášení / Relace" && x.Timestamp > DateTimeOffset.UtcNow.AddMinutes(-5));

        if (!recent)
        {
            dbContext.UserAccessLogs.Add(new UserAccessLog
            {
                Subject = subject,
                UserName = name,
                Action = "Přihlášení / Relace",
                Roles = roles,
                IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
                Timestamp = DateTimeOffset.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }
    }

    return Results.Ok(new
    {
        subject,
        name,
        roles
    });
});

app.MapGet("/api/apps", async (ClaimsPrincipal user, AppDbContext dbContext) =>
{
    var subject = user.FindFirstValue("sub");
    var roles = user.FindAll(ClaimTypes.Role).Select(x => x.Value).Distinct().ToArray();
    var isAdministrator = roles.Any(IsAdminRole);

    var applications = await dbContext.ClientApplications
        .AsNoTracking()
        .Where(x => x.IsEnabled)
        .Where(x => isAdministrator ||
            x.AccessMode == ApplicationAccessMode.Public ||
            (subject != null && x.UserGrants.Any(g => g.Subject == subject)) ||
            (roles.Length > 0 && x.RoleGrants.Any(g => roles.Contains(g.Role))))
        .OrderBy(x => x.DisplayName)
        .Select(x => new ApplicationResponse(
            x.Key,
            x.DisplayName,
            x.LaunchUrl,
            x.AccessMode,
            x.IsEnabled,
            x.CreatedAt,
            x.UpdatedAt))
        .ToListAsync();

    return Results.Ok(applications);
});

app.MapGet("/api/modules/billing", () => Results.Ok(new { module = "billing" }))
    .RequireAuthorization("app-access:billing");

app.MapGet("/api/modules/support", () => Results.Ok(new { module = "support" }))
    .RequireAuthorization("app-access:support");

var admin = app.MapGroup("/api/admin/apps").RequireAuthorization("PlatformAdministrator");

admin.MapGet("/", async (AppDbContext dbContext) =>
{
    var applications = await dbContext.ClientApplications
        .AsNoTracking()
        .OrderBy(x => x.DisplayName)
        .Select(x => new ApplicationResponse(
            x.Key,
            x.DisplayName,
            x.LaunchUrl,
            x.AccessMode,
            x.IsEnabled,
            x.CreatedAt,
            x.UpdatedAt))
        .ToListAsync();

    return Results.Ok(applications);
});

admin.MapPost("/", async (CreateApplicationRequest request, AppDbContext dbContext) =>
{
    var key = request.Key.Trim().ToLowerInvariant();
    var displayName = request.DisplayName.Trim();

    if (!IsValidApplicationKey(key) || string.IsNullOrWhiteSpace(displayName) || !IsValidLaunchUrl(request.LaunchUrl))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["application"] = ["Provide a lowercase application key, display name, and absolute HTTP or HTTPS launch URL."]
        });
    }

    var exists = await dbContext.ClientApplications.AnyAsync(x => x.Key == key);

    if (exists)
    {
        return Results.Conflict(new { message = "An application with this key already exists." });
    }

    var application = new ClientApplication
    {
        Id = Guid.NewGuid(),
        Key = key,
        DisplayName = displayName,
        LaunchUrl = request.LaunchUrl.Trim(),
        AccessMode = request.AccessMode
    };

    dbContext.ClientApplications.Add(application);
    await dbContext.SaveChangesAsync();

    return Results.Created($"/api/admin/apps/{application.Key}", ToResponse(application));
});

admin.MapGet("/{appKey}", async (string appKey, AppDbContext dbContext) =>
{
    var application = await dbContext.ClientApplications
        .AsNoTracking()
        .Include(x => x.UserGrants)
        .Include(x => x.RoleGrants)
        .SingleOrDefaultAsync(x => x.Key == appKey.ToLower());

    return application is null ? Results.NotFound() : Results.Ok(new ApplicationDetailResponse(
        application.Key,
        application.DisplayName,
        application.LaunchUrl,
        application.AccessMode,
        application.IsEnabled,
        application.UserGrants.Select(x => x.Subject).Order().ToArray(),
        application.RoleGrants.Select(x => x.Role).Order().ToArray(),
        application.CreatedAt,
        application.UpdatedAt));
});

admin.MapPut("/{appKey}", async (string appKey, UpdateApplicationRequest request, AppDbContext dbContext) =>
{
    var application = await dbContext.ClientApplications
        .SingleOrDefaultAsync(x => x.Key == appKey.ToLower());

    if (application is null)
    {
        return Results.NotFound();
    }

    var displayName = request.DisplayName.Trim();

    if (string.IsNullOrWhiteSpace(displayName) || !IsValidLaunchUrl(request.LaunchUrl))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["application"] = ["Display name and an absolute HTTP or HTTPS launch URL are required."]
        });
    }

    application.DisplayName = displayName;
    application.LaunchUrl = request.LaunchUrl.Trim();
    application.AccessMode = request.AccessMode;
    application.IsEnabled = request.IsEnabled;
    await dbContext.SaveChangesAsync();

    return Results.Ok(ToResponse(application));
});

admin.MapDelete("/{appKey}", async (string appKey, AppDbContext dbContext) =>
{
    var application = await dbContext.ClientApplications
        .SingleOrDefaultAsync(x => x.Key == appKey.ToLower());

    if (application is null)
    {
        return Results.NotFound();
    }

    dbContext.ClientApplications.Remove(application);
    await dbContext.SaveChangesAsync();

    return Results.NoContent();
});

admin.MapPut("/{appKey}/users/{subject}", async (string appKey, string subject, AppDbContext dbContext) =>
{
    var application = await dbContext.ClientApplications
        .SingleOrDefaultAsync(x => x.Key == appKey.ToLower());

    if (application is null)
    {
        return Results.NotFound();
    }

    var normalizedSubject = subject.Trim();

    if (string.IsNullOrWhiteSpace(normalizedSubject))
    {
        return Results.BadRequest(new { message = "Subject is required." });
    }

    var exists = await dbContext.ApplicationUserGrants.AnyAsync(x =>
        x.ClientApplicationId == application.Id && x.Subject == normalizedSubject);

    if (!exists)
    {
        dbContext.ApplicationUserGrants.Add(new ApplicationUserGrant
        {
            ClientApplicationId = application.Id,
            Subject = normalizedSubject
        });
        await dbContext.SaveChangesAsync();
    }

    return Results.NoContent();
});

admin.MapDelete("/{appKey}/users/{subject}", async (string appKey, string subject, AppDbContext dbContext) =>
{
    var deleted = await dbContext.ApplicationUserGrants
        .Where(x => x.ClientApplication.Key == appKey.ToLower() && x.Subject == subject)
        .ExecuteDeleteAsync();

    return deleted == 0 ? Results.NotFound() : Results.NoContent();
});

admin.MapPut("/{appKey}/roles/{role}", async (string appKey, string role, AppDbContext dbContext) =>
{
    var application = await dbContext.ClientApplications
        .SingleOrDefaultAsync(x => x.Key == appKey.ToLower());

    if (application is null)
    {
        return Results.NotFound();
    }

    var normalizedRole = role.Trim();

    if (string.IsNullOrWhiteSpace(normalizedRole))
    {
        return Results.BadRequest(new { message = "Role is required." });
    }

    var exists = await dbContext.ApplicationRoleGrants.AnyAsync(x =>
        x.ClientApplicationId == application.Id && x.Role == normalizedRole);

    if (!exists)
    {
        dbContext.ApplicationRoleGrants.Add(new ApplicationRoleGrant
        {
            ClientApplicationId = application.Id,
            Role = normalizedRole
        });
        await dbContext.SaveChangesAsync();
    }

    return Results.NoContent();
});

admin.MapDelete("/{appKey}/roles/{role}", async (string appKey, string role, AppDbContext dbContext) =>
{
    var deleted = await dbContext.ApplicationRoleGrants
        .Where(x => x.ClientApplication.Key == appKey.ToLower() && x.Role == role)
        .ExecuteDeleteAsync();

    return deleted == 0 ? Results.NotFound() : Results.NoContent();
});

app.MapPost("/api/apps/{key}/launch", async (string key, ClaimsPrincipal user, HttpContext httpContext, AppDbContext dbContext) =>
{
    var subject = user.FindFirstValue("sub");
    if (string.IsNullOrEmpty(subject)) return Results.Unauthorized();

    var app = await dbContext.ClientApplications.FirstOrDefaultAsync(x => x.Key == key.ToLower());
    var userName = user.Identity?.Name;
    var roles = user.FindAll(ClaimTypes.Role).Select(x => x.Value).Distinct().ToArray();
    var ip = httpContext.Connection.RemoteIpAddress?.ToString();

    dbContext.UserAccessLogs.Add(new UserAccessLog
    {
        Subject = subject,
        UserName = userName,
        ApplicationKey = app?.Key ?? key,
        ApplicationName = app?.DisplayName ?? key,
        Action = "Spuštění aplikace",
        Roles = roles,
        IpAddress = ip,
        Timestamp = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(new { status = "logged" });
});

app.MapGet("/api/admin/audit", async (AppDbContext dbContext) =>
{
    var logs = await dbContext.UserAccessLogs
        .AsNoTracking()
        .OrderByDescending(x => x.Timestamp)
        .Take(100)
        .Select(x => new UserAccessLogResponse(
            x.Id,
            x.Subject,
            x.UserName,
            x.ApplicationKey,
            x.ApplicationName,
            x.Action,
            x.Roles,
            x.IpAddress,
            x.Timestamp))
        .ToListAsync();

    return Results.Ok(logs);
}).RequireAuthorization("PlatformAdministrator");

app.MapGet("/api/admin/user-matrix", async (ClaimsPrincipal user, AppDbContext dbContext) =>
{
    var logs = await dbContext.UserAccessLogs.AsNoTracking().ToListAsync();
    var allApps = await dbContext.ClientApplications.AsNoTracking().Include(x => x.UserGrants).Include(x => x.RoleGrants).ToListAsync();
    var userGrants = await dbContext.ApplicationUserGrants.AsNoTracking().ToListAsync();

    var currentSub = user.FindFirstValue("sub");
    var currentName = user.Identity?.Name;
    var currentRoles = user.FindAll(ClaimTypes.Role).Select(x => x.Value).Distinct().ToArray();

    var allSubjects = logs.Select(x => x.Subject)
        .Concat(userGrants.Select(x => x.Subject))
        .Concat(currentSub != null ? new[] { currentSub } : Array.Empty<string>())
        .Distinct()
        .ToList();

    var matrix = allSubjects.Select(subj =>
    {
        var userLogs = logs.Where(x => x.Subject == subj).OrderByDescending(x => x.Timestamp).ToList();
        var lastLog = userLogs.FirstOrDefault();
        var name = lastLog?.UserName ?? (subj == currentSub ? currentName : subj);
        var roles = lastLog?.Roles ?? (subj == currentSub ? currentRoles : Array.Empty<string>());
        var lastActiveAt = lastLog?.Timestamp ?? DateTimeOffset.UtcNow;
        var isAdministrator = roles.Any(IsAdminRole);

        var accessibleApps = allApps
            .Where(x => isAdministrator ||
                        x.AccessMode == ApplicationAccessMode.Public ||
                        x.UserGrants.Any(ug => ug.Subject == subj) ||
                        x.RoleGrants.Any(rg => roles.Contains(rg.Role)))
            .Select(x => x.Key)
            .Distinct()
            .ToArray();

        return new UserAccessMatrixResponse(
            subj,
            name,
            roles,
            accessibleApps,
            lastActiveAt);
    })
    .OrderByDescending(x => x.LastActiveAt)
    .ToList();

    return Results.Ok(matrix);
}).RequireAuthorization("PlatformAdministrator");

app.Run();

static ApplicationResponse ToResponse(ClientApplication application) => new(
    application.Key,
    application.DisplayName,
    application.LaunchUrl,
    application.AccessMode,
    application.IsEnabled,
    application.CreatedAt,
    application.UpdatedAt);

static bool IsValidApplicationKey(string key) => Regex.IsMatch(key, "^[a-z0-9][a-z0-9-]{1,98}$");

static bool IsValidLaunchUrl(string value) => Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) &&
    (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

static IEnumerable<string> ExpandRoles(string value)
{
    if (!value.StartsWith("[", StringComparison.Ordinal))
    {
        return [value];
    }

    return JsonSerializer.Deserialize<string[]>(value) ?? [];
}

bool IsAdminRole(string role) =>
    string.Equals(role, administratorRole, StringComparison.OrdinalIgnoreCase) ||
    string.Equals(role, "platform-admin", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(role, "authentik Admins", StringComparison.OrdinalIgnoreCase);
