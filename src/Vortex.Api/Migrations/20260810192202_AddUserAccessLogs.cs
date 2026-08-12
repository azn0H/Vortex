using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vortex.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAccessLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_access_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Subject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    UserName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ApplicationKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApplicationName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Action = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Roles = table.Column<string[]>(type: "text[]", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_access_logs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_access_logs_Subject",
                table: "user_access_logs",
                column: "Subject");

            migrationBuilder.CreateIndex(
                name: "IX_user_access_logs_Timestamp",
                table: "user_access_logs",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_access_logs");
        }
    }
}
