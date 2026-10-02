using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace Vortex.Api.Infrastructure;

public static class ProxyTrust
{
    public static void Configure(ForwardedHeadersOptions options, IConfiguration configuration)
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = 1;
        // Keep the framework's loopback defaults. Never trust arbitrary senders.
        foreach (var value in configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [])
        {
            if (!IPAddress.TryParse(value, out var address))
            {
                throw new InvalidOperationException("ReverseProxy:KnownProxies must contain IP addresses.");
            }

            options.KnownProxies.Add(address);
            if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
            {
                options.KnownProxies.Add(address.MapToIPv6());
            }
        }
    }
}
