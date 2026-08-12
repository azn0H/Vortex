using Vortex.Api.Domain;

namespace Vortex.Api.Contracts;

public sealed record CreateApplicationRequest(string Key, string DisplayName, string LaunchUrl, ApplicationAccessMode AccessMode);

public sealed record UpdateApplicationRequest(string DisplayName, string LaunchUrl, ApplicationAccessMode AccessMode, bool IsEnabled);

public sealed record ApplicationResponse(
    string Key,
    string DisplayName,
    string LaunchUrl,
    ApplicationAccessMode AccessMode,
    bool IsEnabled,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ApplicationDetailResponse(
    string Key,
    string DisplayName,
    string LaunchUrl,
    ApplicationAccessMode AccessMode,
    bool IsEnabled,
    IReadOnlyCollection<string> UserSubjects,
    IReadOnlyCollection<string> Roles,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record UserAccessLogResponse(
    Guid Id,
    string Subject,
    string? UserName,
    string? ApplicationKey,
    string? ApplicationName,
    string Action,
    IReadOnlyCollection<string> Roles,
    string? IpAddress,
    DateTimeOffset Timestamp);

public sealed record UserAccessMatrixResponse(
    string Subject,
    string? UserName,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> AccessibleApplicationKeys,
    DateTimeOffset LastActiveAt);

