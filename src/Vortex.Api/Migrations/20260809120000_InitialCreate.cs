using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vortex.Api.Migrations;

[DbContext(typeof(Infrastructure.AppDbContext))]
[Migration("20260809120000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "client_applications",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                LaunchUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                AccessMode = table.Column<int>(type: "integer", nullable: false),
                IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_client_applications", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "application_role_grants",
            columns: table => new
            {
                ClientApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                Role = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_application_role_grants", x => new { x.ClientApplicationId, x.Role });
                table.ForeignKey(
                    name: "FK_application_role_grants_client_applications_ClientApplicationId",
                    column: x => x.ClientApplicationId,
                    principalTable: "client_applications",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "application_user_grants",
            columns: table => new
            {
                ClientApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                Subject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_application_user_grants", x => new { x.ClientApplicationId, x.Subject });
                table.ForeignKey(
                    name: "FK_application_user_grants_client_applications_ClientApplicationId",
                    column: x => x.ClientApplicationId,
                    principalTable: "client_applications",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_client_applications_Key",
            table: "client_applications",
            column: "Key",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "application_role_grants");
        migrationBuilder.DropTable(name: "application_user_grants");
        migrationBuilder.DropTable(name: "client_applications");
    }
}
