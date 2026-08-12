namespace Vortex.Api.Domain;

public sealed class UserAccessLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Subject { get; set; }
    public string? UserName { get; set; }
    public string? ApplicationKey { get; set; }
    public string? ApplicationName { get; set; }
    public required string Action { get; set; }
    public string[] Roles { get; set; } = [];
    public string? IpAddress { get; set; }
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
