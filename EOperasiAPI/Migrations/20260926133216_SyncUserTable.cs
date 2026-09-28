using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EOperasiApi.Migrations
{
    /// <inheritdoc />
    public partial class SyncUserTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Remove registration fields that were dropped from the User model
            migrationBuilder.DropColumn(name: "DateOfBirth", table: "Users");
            migrationBuilder.DropColumn(name: "IcNumber", table: "Users");
            migrationBuilder.DropColumn(name: "PayrollNumber", table: "Users");
            migrationBuilder.DropColumn(name: "SecurityAnswerHash", table: "Users");
            migrationBuilder.DropColumn(name: "SecurityQuestion", table: "Users");
            migrationBuilder.DropColumn(name: "UserType", table: "Users");

            // Add columns used by the forgot/reset password flow
            migrationBuilder.AddColumn<string>(
                name: "PasswordResetTokenHash",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordResetExpiresAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "PasswordResetExpiresAt", table: "Users");
            migrationBuilder.DropColumn(name: "PasswordResetTokenHash", table: "Users");

            migrationBuilder.AddColumn<string>(name: "DateOfBirth", table: "Users", type: "text", nullable: false, defaultValue: "");
            migrationBuilder.AddColumn<string>(name: "IcNumber", table: "Users", type: "text", nullable: false, defaultValue: "");
            migrationBuilder.AddColumn<string>(name: "PayrollNumber", table: "Users", type: "text", nullable: true);
            migrationBuilder.AddColumn<string>(name: "SecurityAnswerHash", table: "Users", type: "text", nullable: false, defaultValue: "");
            migrationBuilder.AddColumn<string>(name: "SecurityQuestion", table: "Users", type: "text", nullable: false, defaultValue: "");
            migrationBuilder.AddColumn<string>(name: "UserType", table: "Users", type: "text", nullable: false, defaultValue: "");
        }
    }
}