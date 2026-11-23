using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EOperasiApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSchoolCodeAndServiceDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "TarikhKhidmatSekolahSemasa",
                table: "Teachers",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "TarikhLantikanJawatanSemasa",
                table: "Teachers",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "Schools",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TarikhKhidmatSekolahSemasa",
                table: "Teachers");

            migrationBuilder.DropColumn(
                name: "TarikhLantikanJawatanSemasa",
                table: "Teachers");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "Schools");
        }
    }
}
