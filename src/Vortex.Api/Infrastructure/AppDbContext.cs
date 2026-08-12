using Microsoft.EntityFrameworkCore;
using Vortex.Api.Domain;

namespace Vortex.Api.Infrastructure;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<ClientApplication> ClientApplications => Set<ClientApplication>();
    public DbSet<ApplicationUserGrant> ApplicationUserGrants => Set<ApplicationUserGrant>();
    public DbSet<ApplicationRoleGrant> ApplicationRoleGrants => Set<ApplicationRoleGrant>();
    public DbSet<UserAccessLog> UserAccessLogs => Set<UserAccessLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ClientApplication>(entity =>
        {
            entity.ToTable("client_applications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Key).HasMaxLength(100);
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.Property(x => x.LaunchUrl).HasMaxLength(2048);
            entity.HasIndex(x => x.Key).IsUnique();
        });

        modelBuilder.Entity<ApplicationUserGrant>(entity =>
        {
            entity.ToTable("application_user_grants");
            entity.HasKey(x => new { x.ClientApplicationId, x.Subject });
            entity.Property(x => x.Subject).HasMaxLength(255);
            entity.HasOne(x => x.ClientApplication)
                .WithMany(x => x.UserGrants)
                .HasForeignKey(x => x.ClientApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicationRoleGrant>(entity =>
        {
            entity.ToTable("application_role_grants");
            entity.HasKey(x => new { x.ClientApplicationId, x.Role });
            entity.Property(x => x.Role).HasMaxLength(255);
            entity.HasOne(x => x.ClientApplication)
                .WithMany(x => x.RoleGrants)
                .HasForeignKey(x => x.ClientApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserAccessLog>(entity =>
        {
            entity.ToTable("user_access_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Subject).HasMaxLength(255);
            entity.Property(x => x.UserName).HasMaxLength(255);
            entity.Property(x => x.ApplicationKey).HasMaxLength(100);
            entity.Property(x => x.ApplicationName).HasMaxLength(200);
            entity.Property(x => x.Action).HasMaxLength(50);
            entity.Property(x => x.IpAddress).HasMaxLength(100);
            entity.HasIndex(x => x.Timestamp);
            entity.HasIndex(x => x.Subject);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<ClientApplication>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.UpdatedAt = now;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }

        foreach (var entry in ChangeTracker.Entries<ApplicationUserGrant>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
            }
        }

        foreach (var entry in ChangeTracker.Entries<ApplicationRoleGrant>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
