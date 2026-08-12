namespace Vortex.Api.Domain;

public enum ApplicationAccessMode
{
    Public = 0,
    Restricted = 1
}

public sealed class ClientApplication
{
    public Guid Id { get; set; }
    public required string Key { get; set; }
    public required string DisplayName { get; set; }
    public required string LaunchUrl { get; set; }
    public ApplicationAccessMode AccessMode { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public ICollection<ApplicationUserGrant> UserGrants { get; set; } = [];
    public ICollection<ApplicationRoleGrant> RoleGrants { get; set; } = [];
}

public sealed class ApplicationUserGrant
{
    public Guid ClientApplicationId { get; set; }
    public required string Subject { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public ClientApplication ClientApplication { get; set; } = null!;
}

public sealed class ApplicationRoleGrant
{
    public Guid ClientApplicationId { get; set; }
    public required string Role { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public ClientApplication ClientApplication { get; set; } = null!;
}
