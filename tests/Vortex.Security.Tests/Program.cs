using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Vortex.Api.Authorization;
using Vortex.Api.Domain;
using Vortex.Api.Endpoints;
using Vortex.Api.Infrastructure;

var cases = new (string Name, Func<Task> Run)[]
{
    ("unauthenticated subject cannot launch", () => LaunchCase(User("alice", authenticated: false), "billing", 401)),
    ("missing subject cannot launch", () => LaunchCase(User(null), "billing", 401)),
    ("whitespace subject cannot launch", () => LaunchCase(User(" "), "billing", 401)),
    ("restricted app rejects ungranted user without audit", () => LaunchCase(User("alice"), "billing", 403)),
    ("missing app creates no audit", () => LaunchCase(User("alice"), "missing", 404)),
    ("disabled app rejects administrators without audit", () => LaunchCase(User("alice", "platform-admin"), "billing", 404, enabled: false)),
    ("public app accepts authenticated user", () => LaunchCase(User("alice"), "billing", 200, access: ApplicationAccessMode.Public)),
    ("user grant permits canonicalized key", () => LaunchCase(User("alice"), " BILLING ", 200, userGrant: "alice")),
    ("another user's grant is denied", () => LaunchCase(User("alice"), "billing", 403, userGrant: "bob")),
    ("matching role grant permits launch", () => LaunchCase(User("alice", "finance"), "billing", 200, roleGrant: "finance")),
    ("role grants retain case-sensitive matching", () => LaunchCase(User("alice", "FINANCE"), "billing", 403, roleGrant: "finance")),
    ("configured administrator permits launch", () => LaunchCase(User("alice", "CUSTOM-ADMIN"), "billing", 200)),
    ("platform administrator alias permits launch", () => LaunchCase(User("alice", "PLATFORM-ADMIN"), "billing", 200)),
    ("Authentik administrator alias permits launch", () => LaunchCase(User("alice", "authentik Admins"), "billing", 200)),
    ("revoked grant takes effect", RevokedGrant),
    ("untrusted proxy cannot replace address or scheme", () => ProxyCase("192.0.2.10", "203.0.113.15", "192.0.2.10", "http")),
    ("trusted gateway forwards address and scheme", () => ProxyCase("172.30.240.2", "203.0.113.15", "203.0.113.15", "https")),
    ("trusted gateway consumes only rightmost hop", () => ProxyCase("172.30.240.2", "198.51.100.99, 203.0.113.15", "203.0.113.15", "https")),
    ("IPv4 mapped trusted gateway works", () => ProxyCase("::ffff:172.30.240.2", "203.0.113.15", "203.0.113.15", "https")),
    ("IPv4 mapped untrusted proxy is ignored", () => ProxyCase("::ffff:192.0.2.10", "203.0.113.15", "::ffff:192.0.2.10", "http")),
    ("invalid configured proxy fails closed", InvalidProxy)
};
foreach (var test in cases)
{
    await test.Run();
    Console.WriteLine($"PASS {test.Name}");
}
Console.WriteLine($"{cases.Length} security regression checks passed.");

static ClaimsPrincipal User(string? subject, string? role = null, bool authenticated = true)
{
    var claims = new List<Claim> { new("name", "Alice") };
    if (subject is not null) claims.Add(new("sub", subject));
    if (role is not null) claims.Add(new(ClaimTypes.Role, role));
    return new(new ClaimsIdentity(claims, authenticated ? "test" : null, "name", ClaimTypes.Role));
}

static ServiceProvider Services()
{
    var services = new ServiceCollection();
    services.AddLogging();
    services.AddSingleton<IConfiguration>(new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?> { ["Identity:AdministratorRole"] = "custom-admin" }).Build());
    services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
    services.AddAuthorization();
    services.AddScoped<IAuthorizationHandler, ApplicationAccessHandler>();
    return services.BuildServiceProvider();
}

static async Task LaunchCase(ClaimsPrincipal user, string key, int expected,
    bool enabled = true, ApplicationAccessMode access = ApplicationAccessMode.Restricted,
    string? userGrant = null, string? roleGrant = null)
{
    using var services = Services();
    using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var application = new ClientApplication { Id = Guid.NewGuid(), Key = "billing", DisplayName = "Billing", LaunchUrl = "https://billing.example.com", IsEnabled = enabled, AccessMode = access };
    db.Add(application);
    if (userGrant is not null) db.Add(new ApplicationUserGrant { ClientApplicationId = application.Id, Subject = userGrant });
    if (roleGrant is not null) db.Add(new ApplicationRoleGrant { ClientApplicationId = application.Id, Role = roleGrant });
    await db.SaveChangesAsync();
    var result = await ApplicationLaunch.HandleAsync(key, user, new DefaultHttpContext(), db,
        scope.ServiceProvider.GetRequiredService<IAuthorizationService>());
    Assert(Status(result) == expected, $"Expected {expected}, got {Status(result)}");
    Assert(await db.UserAccessLogs.CountAsync() == (expected == 200 ? 1 : 0), "Audit insert mismatch");
    if (expected == 200)
    {
        var log = await db.UserAccessLogs.SingleAsync();
        Assert(log.ApplicationKey == "billing" && log.ApplicationName == "Billing" && log.Subject == "alice", "Audit must use authorized canonical app and signed subject");
    }
}

static async Task RevokedGrant()
{
    using var services = Services();using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var application = new ClientApplication { Id = Guid.NewGuid(), Key = "billing", DisplayName = "Billing", LaunchUrl = "https://billing.example.com", AccessMode = ApplicationAccessMode.Restricted };
    var grant = new ApplicationUserGrant { ClientApplicationId = application.Id, Subject = "alice" };
    db.Add(application);db.Add(grant);await db.SaveChangesAsync();
    var auth = scope.ServiceProvider.GetRequiredService<IAuthorizationService>();
    Assert(Status(await ApplicationLaunch.HandleAsync("billing", User("alice"), new DefaultHttpContext(), db, auth)) == 200, "Granted control failed");
    db.Remove(grant);await db.SaveChangesAsync();
    Assert(Status(await ApplicationLaunch.HandleAsync("billing", User("alice"), new DefaultHttpContext(), db, auth)) == 403, "Revoked grant accepted");
    Assert(await db.UserAccessLogs.CountAsync() == 1, "Revoked launch inserted audit");
}

static int Status(IResult result) => result switch
{
    ForbidHttpResult => 403,
    IStatusCodeHttpResult status => status.StatusCode ?? 200,
    _ => throw new Exception($"Unexpected result {result.GetType().Name}")
};

static async Task ProxyCase(string sender, string forwarded, string expectedIp, string expectedScheme)
{
    var configuration = new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?> { ["ReverseProxy:KnownProxies:0"] = "172.30.240.2" }).Build();
    var options = new ForwardedHeadersOptions();ProxyTrust.Configure(options, configuration);
    var context = new DefaultHttpContext();context.Connection.RemoteIpAddress = IPAddress.Parse(sender);
    context.Request.Scheme = "http";context.Request.Headers["X-Forwarded-For"] = forwarded;
    context.Request.Headers["X-Forwarded-Proto"] = "https";
    var middleware = new ForwardedHeadersMiddleware(_ => Task.CompletedTask, NullLoggerFactory.Instance, Options.Create(options));
    await middleware.Invoke(context);
    Assert(context.Connection.RemoteIpAddress?.ToString() == expectedIp, "Forwarded IP trust mismatch");
    Assert(context.Request.Scheme == expectedScheme, "Forwarded scheme trust mismatch");
}

static Task InvalidProxy()
{
    var configuration = new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?> { ["ReverseProxy:KnownProxies:0"] = "*" }).Build();
    try { ProxyTrust.Configure(new ForwardedHeadersOptions(), configuration); }
    catch (InvalidOperationException) { return Task.CompletedTask; }
    throw new Exception("Invalid proxy configuration accepted");
}

static void Assert(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}
