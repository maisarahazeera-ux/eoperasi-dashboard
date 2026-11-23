using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace EOperasiApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDataImports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DataImports",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DataDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ImportedBy = table.Column<string>(type: "text", nullable: false),
                    ImportedByName = table.Column<string>(type: "text", nullable: false),
                    FileNames = table.Column<string>(type: "text", nullable: false),
                    TeacherCount = table.Column<int>(type: "integer", nullable: false),
                    SchoolCount = table.Column<int>(type: "integer", nullable: false),
                    SubjectCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataImports", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DataImports");
        }
    }
}
