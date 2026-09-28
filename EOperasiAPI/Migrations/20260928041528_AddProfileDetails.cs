using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EOperasiApi.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "JabatanBahagian",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Jawatan",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastLoginAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PreviousLoginAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProfilePhotoFile",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Sektor",
                table: "Users",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "JabatanBahagian",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Jawatan",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLoginAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PreviousLoginAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ProfilePhotoFile",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Sektor",
                table: "Users");
        }
    }
}
