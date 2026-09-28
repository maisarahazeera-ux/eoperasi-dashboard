using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EOperasiApi.Migrations
{
    /// <inheritdoc />
    public partial class AddOpsyenColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Opsyen1",
                table: "Teachers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Opsyen2",
                table: "Teachers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Opsyen1",
                table: "Teachers");

            migrationBuilder.DropColumn(
                name: "Opsyen2",
                table: "Teachers");
        }
    }
}
