using Microsoft.AspNetCore.Authorization;

namespace Vortex.Api.Authorization;

public sealed record ApplicationAccessRequirement(string ApplicationKey) : IAuthorizationRequirement;

