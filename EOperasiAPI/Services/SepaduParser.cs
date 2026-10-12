using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using EOperasiApi.Models;

namespace EOperasiApi.Services;

/// <summary>
/// Reads SEPADU "Maklumat Guru" exports (.txt pipe-separated, or .xlsx) and turns
/// them into Teacher / School / Subject entities, ready to be saved.
///
/// This is a C# port of clean_and_transform_teachers_data.ipynb, so an upload
/// through the Admin page gives the same result as running the notebooks.
/// No NuGet package is needed: .xlsx is just a zip of XML files.
/// </summary>
public static class SepaduParser
{
    // Without these the file is not a SEPADU teacher export (or the format changed).
    public static readonly string[] RequiredColumns =
    {
        "NO. KP", "NAMA", "NAMA SEKOLAH", "JENIS SEKOLAH", "JANTINA",
        "TARIKH LAHIR", "JAWATAN", "GRED HAKIKI", "TARIKH BERSARA",
    };

    // Used if present; a missing one only gives a warning (that field stays empty).
    public static readonly string[] OptionalColumns =
    {
        "STATUSKAHWIN", "KAUM", "AGAMA", "WARGANEGARA", "EMEL", "GAJI",
        "ALAMAT SEMASA 1", "ALAMAT SEMASA 2", "ALAMAT SEMASA 3",
        "POSKOD", "BANDAR", "NEGERI.1", "NO. TELEFON",
        "AKADEMIK TERTINGGI", "IKHTISAS", "OPSYEN 1", "OPSYEN 2",
        "SUBJEK AJAR1", "BIL WAKTU1", "SUBJEK AJAR2", "BIL WAKTU2", "SUBJEK AJAR3", "BIL WAKTU3",
        "GURU CEMERLANG", "BIDANG GURU CEMERLANG", "SAH PERKHIDMATAN", "STATUS INDUKSI",
        "GRED PENYANDANG", "PENGISIAN", "TARAF JAWATAN",
        "TUGAS KHAS 1", "TUGAS KHAS 2", "TUGAS KHAS 3", "TUGAS KHAS 4", "TUGAS KHAS 5",
        "KEDUDUKAN PERKHIDMATAN", "TARIKH LANTIKAN PERTAMA", "DAERAH SEMASA",
        "STATUS VAKSIN", "JENIS VAKSIN", "TARIKH DOS1", "TARIKH DOS2",
    };

    public static readonly string[] AllowedExtensions = { ".txt", ".xlsx" };

    // ------------------------------------------------------------------ result types

    public class Issue
    {
        public string Code { get; set; } = "";
        public string? File { get; set; }
        public int Count { get; set; }
        public List<string> Details { get; set; } = new();
    }

    public class FileSummary
    {
        public string FileName { get; set; } = "";
        public int Rows { get; set; }
        public Dictionary<string, int> SchoolTypes { get; set; } = new();
    }

    public class Result
    {
        public List<Teacher> Teachers { get; } = new();
        public List<School> Schools { get; } = new();
        public List<Subject> Subjects { get; } = new();
        public List<FileSummary> Files { get; } = new();
        /// <summary>Problems that stop the import.</summary>
        public List<Issue> Errors { get; } = new();
        /// <summary>Things the admin should know about, but the import can go ahead.</summary>
        public List<Issue> Warnings { get; } = new();
        /// <summary>Date taken from a file name like "20260902_sepadu_...txt", if any.</summary>
        public DateOnly? DetectedDataDate { get; set; }
        public bool Ok => Errors.Count == 0 && Teachers.Count > 0;
    }

    // ------------------------------------------------------------------ entry point

    public static Result Parse(IEnumerable<(string FileName, Stream Content)> files)
    {
        var result = new Result();
        var schools = new Dictionary<string, School>();
        var subjects = new Dictionary<string, Subject>();
        var seenIc = new HashSet<string>();
        int noIc = 0, noName = 0, noSchool = 0, dupIc = 0;
        var badDates = new Dictionary<string, int>();
        var missingOptional = new SortedSet<string>();

        foreach (var (fileName, content) in files)
        {
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
            {
                result.Errors.Add(new Issue { Code = "unsupportedType", File = fileName });
                continue;
            }

            result.DetectedDataDate ??= DateFromFileName(fileName);

            List<string?[]> rows;
            try
            {
                rows = ext == ".xlsx" ? ReadXlsx(content) : ReadPipeText(content);
            }
            catch (Exception)
            {
                result.Errors.Add(new Issue { Code = "unreadable", File = fileName });
                continue;
            }

            if (rows.Count < 2)
            {
                result.Errors.Add(new Issue { Code = "noRows", File = fileName });
                continue;
            }

            var col = BuildHeaderIndex(rows[0]);
            var missing = RequiredColumns.Where(c => !col.ContainsKey(c)).ToList();
            if (missing.Count > 0)
            {
                result.Errors.Add(new Issue { Code = "missingColumns", File = fileName, Count = missing.Count, Details = missing });
                continue;
            }
            foreach (var c in OptionalColumns.Where(c => !col.ContainsKey(c))) missingOptional.Add(c);

            var summary = new FileSummary { FileName = fileName };
            result.Files.Add(summary);

            for (int r = 1; r < rows.Count; r++)
            {
                var row = new Row(rows[r], col);
                if (row.IsEmpty) continue;
                summary.Rows++;

                var ic = FormatIc(row["NO. KP"]);
                var name = row["NAMA"];
                var schoolName = row["NAMA SEKOLAH"];
                if (string.IsNullOrEmpty(ic)) { noIc++; continue; }
                if (name == null) { noName++; continue; }
                if (schoolName == null) { noSchool++; continue; }
                if (!seenIc.Add(ic)) { dupIc++; continue; }

                var schoolType = row["JENIS SEKOLAH"] ?? "";
                summary.SchoolTypes[schoolType] = summary.SchoolTypes.GetValueOrDefault(schoolType) + 1;

                var schoolKey = Title(schoolName);
                if (!schools.TryGetValue(schoolKey, out var school))
                {
                    school = new School { Name = schoolKey, Type = schoolType, District = row["DAERAH SEMASA"] ?? "" };
                    schools[schoolKey] = school;
                    result.Schools.Add(school);
                }

                var teacher = BuildTeacher(row, ic, school, badDates);

                for (int i = 1; i <= 3; i++)
                {
                    var subj = row[$"SUBJEK AJAR{i}"];
                    if (subj == null) continue;
                    var subjName = Title(subj);
                    if (teacher.TeacherSubjects.Any(ts => ts.Subject.Name == subjName)) continue;
                    if (!subjects.TryGetValue(subjName, out var subject))
                    {
                        subject = new Subject { Name = subjName };
                        subjects[subjName] = subject;
                        result.Subjects.Add(subject);
                    }
                    teacher.TeacherSubjects.Add(new TeacherSubject
                    {
                        Teacher = teacher,
                        Subject = subject,
                        Hours = ParseInt(row[$"BIL WAKTU{i}"]),
                    });
                }

                result.Teachers.Add(teacher);
            }
        }

        if (result.Errors.Count == 0 && result.Teachers.Count == 0 && result.Files.Count > 0)
            result.Errors.Add(new Issue { Code = "noTeachers" });

        void Warn(string code, int count) { if (count > 0) result.Warnings.Add(new Issue { Code = code, Count = count }); }
        Warn("skippedNoIc", noIc);
        Warn("skippedNoName", noName);
        Warn("skippedNoSchool", noSchool);
        Warn("duplicateIc", dupIc);
        if (badDates.Count > 0)
            result.Warnings.Add(new Issue
            {
                Code = "badDates",
                Count = badDates.Values.Sum(),
                Details = badDates.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key} ({kv.Value})").ToList(),
            });
        if (missingOptional.Count > 0)
            result.Warnings.Add(new Issue { Code = "missingOptionalColumns", Count = missingOptional.Count, Details = missingOptional.ToList() });

        return result;
    }

    // ------------------------------------------------------------------ one teacher (build_teacher in the notebook)

    private static Teacher BuildTeacher(Row row, string ic, School school, Dictionary<string, int> badDates)
    {
        DateOnly? Date(string column)
        {
            var raw = row[column];
            var d = ParseDate(raw);
            if (raw != null && d == null) badDates[column] = badDates.GetValueOrDefault(column) + 1;
            return d;
        }

        var taraf = (row["TARAF JAWATAN"] ?? "").ToUpperInvariant();
        var employmentStatus = taraf.Contains("KONTRAK") ? "Kontrak"
            : taraf.Contains("COS") || taraf.Contains("SANDARAN") ? "Sandaran"
            : "Tetap";

        var induksi = row["STATUS INDUKSI"];
        var vaccinated = YesNo(row["STATUS VAKSIN"]);

        string? tugas = null;
        for (int i = 1; i <= 5 && tugas == null; i++)
        {
            var v = row[$"TUGAS KHAS {i}"];
            if (v != null) tugas = Title(v);
        }

        return new Teacher
        {
            IcNumber = ic,
            Name = Title(row["NAMA"]!),
            Gender = row["JANTINA"] ?? "",
            School = school,
            Position = TitleOrNull(row["JAWATAN"]),
            GredHakiki = row["GRED HAKIKI"],
            GredPenyandang = row["GRED PENYANDANG"],
            EmploymentStatus = employmentStatus,
            ServiceStatus = (row["KEDUDUKAN PERKHIDMATAN"] ?? "").ToUpperInvariant() == "BERKHIDMAT DI SEKOLAH" ? "Aktif" : "Tidak Aktif",
            DateOfBirth = Date("TARIKH LAHIR"),
            MaritalStatus = TitleOrNull(row["STATUSKAHWIN"]),
            Race = TitleOrNull(row["KAUM"]),
            Religion = TitleOrNull(row["AGAMA"]),
            Nationality = row["WARGANEGARA"],
            FirstAppointmentDate = Date("TARIKH LANTIKAN PERTAMA"),
            Qualification = row["IKHTISAS"] ?? row["AKADEMIK TERTINGGI"],
            Opsyen1 = row["OPSYEN 1"],
            Opsyen2 = row["OPSYEN 2"],
            Phone = CleanPhone(row["NO. TELEFON"] ?? row["NO. TELEFON.1"]),
            Email = row["EMEL"],
            Address = BuildAddress(row),
            Vaccinated = vaccinated,
            VaccineType = vaccinated ? row["JENIS VAKSIN"] : null,
            VaccineDose1 = vaccinated ? Date("TARIKH DOS1") : null,
            VaccineDose2 = vaccinated ? Date("TARIKH DOS2") : null,
            Salary = ParseSalary(row["GAJI"]),
            RetirementDate = Date("TARIKH BERSARA"),
            Ikhtisas = row["IKHTISAS"] is { } ik && ik.ToUpperInvariant() != "TIADA",
            StatusInduksi = induksi is "Telah Hadir Dan Lulus" or "Dikecualikan" ? "Selesai" : "Dalam Tempoh Induksi",
            SahPerkhidmatan = (row["SAH PERKHIDMATAN"] ?? "").ToUpperInvariant() == "YA" ? "Disahkan" : "Belum Disahkan",
            GuruCemerlang = YesNo(row["GURU CEMERLANG"]),
            GuruCemerlangBidang = row["BIDANG GURU CEMERLANG"] ?? "",
            TugasKhas = tugas ?? "Tiada",
            KodJawatanDiisi = row["PENGISIAN"] != null,
        };
    }

    private static string BuildAddress(Row row)
    {
        var line = string.Join(", ", new[] { row["ALAMAT SEMASA 1"], row["ALAMAT SEMASA 2"], row["ALAMAT SEMASA 3"] }
            .Where(p => p != null));
        var poskod = row["POSKOD"] ?? row["POSKOD.1"] ?? "";
        var bandar = row["BANDAR"] ?? row["BANDAR.1"] ?? "";
        var negeri = row["NEGERI.1"] ?? row["NEGERI"] ?? "";
        return $"{line}, {poskod} {bandar}, {negeri}".Trim(',', ' ');
    }

    // ------------------------------------------------------------------ small helpers (same rules as the notebook)

    /// <summary>Python's str.title(): first letter after any non-letter is upper case.</summary>
    public static string Title(string s)
    {
        var sb = new StringBuilder(s.Length);
        bool prevLetter = false;
        foreach (var ch in s)
        {
            if (char.IsLetter(ch))
            {
                sb.Append(prevLetter ? char.ToLowerInvariant(ch) : char.ToUpperInvariant(ch));
                prevLetter = true;
            }
            else
            {
                sb.Append(ch);
                prevLetter = false;
            }
        }
        return sb.ToString();
    }

    private static string? TitleOrNull(string? s) => s == null ? null : Title(s);

    private static bool YesNo(string? s) => (s ?? "").ToUpperInvariant() == "YA";

    /// <summary>"900101015555" -> "900101-01-5555".</summary>
    public static string FormatIc(string? s)
    {
        if (s == null) return "";
        var digits = Regex.Replace(s, @"\D", "");
        return digits.Length == 12 ? $"{digits[..6]}-{digits[6..8]}-{digits[8..]}" : s;
    }

    private static string CleanPhone(string? s)
    {
        if (s == null) return "";
        var digits = Regex.Replace(s, @"\D", "");
        return digits.Length >= 10 ? $"{digits[..3]}-{digits[3..7]} {digits[7..]}" : s;
    }

    private static decimal? ParseSalary(string? s)
    {
        if (s == null) return null;
        var m = Regex.Match(s.Replace(",", ""), @"[\d.]+");
        return m.Success && decimal.TryParse(m.Value, NumberStyles.Number, CultureInfo.InvariantCulture, out var v) ? v : null;
    }

    private static int ParseInt(string? s)
    {
        if (s == null) return 0;
        if (int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i)) return i;
        return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? (int)d : 0;
    }

    private static readonly string[] DateFormats = { "d/M/yyyy", "yyyy-MM-dd" };

    /// <summary>"08/04/1981" -> 1981-04-08. Also accepts an Excel date number.</summary>
    public static DateOnly? ParseDate(string? s)
    {
        if (s == null) return null;
        if (DateOnly.TryParseExact(s, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return d;
        if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var serial) && serial > 1 && serial < 80000)
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        return null;
    }

    /// <summary>"20260902_sepadu_maklumat_guru-SK.txt" -> 2026-09-02.</summary>
    public static DateOnly? DateFromFileName(string fileName)
    {
        var m = Regex.Match(Path.GetFileName(fileName), @"(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)");
        if (!m.Success) return null;
        return DateOnly.TryParseExact(m.Value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
    }

    // ------------------------------------------------------------------ table access

    /// <summary>
    /// Column name -> index. A repeated name gets ".1", ".2" like pandas does
    /// (SEPADU has two NEGERI / POSKOD / BANDAR / NO. TELEFON columns).
    /// </summary>
    private static Dictionary<string, int> BuildHeaderIndex(string?[] header)
    {
        var index = new Dictionary<string, int>();
        var seen = new Dictionary<string, int>();
        for (int i = 0; i < header.Length; i++)
        {
            var name = header[i]?.Trim();
            if (string.IsNullOrEmpty(name)) continue;
            var n = seen.GetValueOrDefault(name);
            seen[name] = n + 1;
            index[n == 0 ? name : $"{name}.{n}"] = i;
        }
        return index;
    }

    private readonly struct Row
    {
        private readonly string?[] _cells;
        private readonly Dictionary<string, int> _col;
        public Row(string?[] cells, Dictionary<string, int> col) { _cells = cells; _col = col; }

        /// <summary>Trimmed value, or null when empty / "TIADA MAKLUMAT" (basic_clean in the notebook).</summary>
        public string? this[string column]
        {
            get
            {
                if (!_col.TryGetValue(column, out var i) || i >= _cells.Length) return null;
                var v = _cells[i]?.Trim();
                return string.IsNullOrEmpty(v) || v == "TIADA MAKLUMAT" || v == "nan" || v == "None" ? null : v;
            }
        }

        public bool IsEmpty => _cells.All(c => string.IsNullOrWhiteSpace(c));
    }

    // ------------------------------------------------------------------ file readers

    /// <summary>SEPADU .txt export: one row per line, columns separated by "|".</summary>
    private static List<string?[]> ReadPipeText(Stream stream)
    {
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        var bytes = ms.ToArray();
        string text;
        try
        {
            text = new UTF8Encoding(false, true).GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            text = Encoding.Latin1.GetString(bytes); // older Windows exports
        }
        if (text.Length > 0 && text[0] == '﻿') text = text[1..];

        var rows = new List<string?[]>();
        foreach (var line in text.Split('\n'))
        {
            var l = line.TrimEnd('\r');
            if (l.Length == 0) continue;
            rows.Add(l.Split('|'));
        }
        if (rows.Count > 0 && rows[0].Length < 5) throw new InvalidDataException("Not a pipe-separated file");
        return rows;
    }

    private static readonly XmlReaderSettings XmlSettings = new() { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };
    private const string MainNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private const string RelNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    /// <summary>First worksheet of an .xlsx file as rows of text.</summary>
    private static List<string?[]> ReadXlsx(Stream stream)
    {
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);

        // Shared strings (most text cells point into this list).
        var shared = new List<string>();
        var ssEntry = zip.GetEntry("xl/sharedStrings.xml");
        if (ssEntry != null)
        {
            using var r = XmlReader.Create(ssEntry.Open(), XmlSettings);
            while (r.ReadToFollowing("si", MainNs))
                shared.Add(ReadText(r.ReadSubtree()));
        }

        var sheetEntry = zip.GetEntry(FirstSheetPath(zip)) ?? throw new InvalidDataException("No worksheet");
        var rows = new List<string?[]>();
        using (var r = XmlReader.Create(sheetEntry.Open(), XmlSettings))
        {
            while (r.ReadToFollowing("row", MainNs))
            {
                var rowIndex = int.TryParse(r.GetAttribute("r"), out var ri) ? ri - 1 : rows.Count;
                var cells = new List<string?>();
                using var row = r.ReadSubtree();
                while (row.ReadToFollowing("c", MainNs))
                {
                    var colIndex = ColumnIndex(row.GetAttribute("r")) ?? cells.Count;
                    var type = row.GetAttribute("t");
                    string? value = null;
                    using (var cell = row.ReadSubtree())
                    {
                        while (cell.Read())
                        {
                            if (cell.NodeType != XmlNodeType.Element) continue;
                            if (cell.LocalName == "v")
                            {
                                var raw = cell.ReadElementContentAsString();
                                value = type == "s" && int.TryParse(raw, out var si) && si < shared.Count ? shared[si] : raw;
                                break;
                            }
                            if (cell.LocalName == "is")
                            {
                                value = ReadText(cell.ReadSubtree());
                                break;
                            }
                        }
                    }
                    while (cells.Count < colIndex) cells.Add(null);
                    if (cells.Count == colIndex) cells.Add(value); else cells[colIndex] = value;
                }
                while (rows.Count < rowIndex) rows.Add(Array.Empty<string?>());
                rows.Add(cells.ToArray());
            }
        }
        return rows;
    }

    /// <summary>Concatenates every &lt;t&gt; inside a shared/inline string (skips phonetic hints).</summary>
    private static string ReadText(XmlReader r)
    {
        var sb = new StringBuilder();
        using (r)
        {
            while (r.Read())
            {
                if (r.NodeType != XmlNodeType.Element) continue;
                if (r.LocalName == "rPh") { r.Skip(); continue; }
                if (r.LocalName == "t") sb.Append(r.ReadElementContentAsString());
            }
        }
        return sb.ToString();
    }

    private static string FirstSheetPath(ZipArchive zip)
    {
        const string fallback = "xl/worksheets/sheet1.xml";
        var wb = zip.GetEntry("xl/workbook.xml");
        var rels = zip.GetEntry("xl/_rels/workbook.xml.rels");
        if (wb == null || rels == null) return fallback;

        string? relId = null;
        using (var r = XmlReader.Create(wb.Open(), XmlSettings))
            if (r.ReadToFollowing("sheet", MainNs)) relId = r.GetAttribute("id", RelNs);
        if (relId == null) return fallback;

        using (var r = XmlReader.Create(rels.Open(), XmlSettings))
            while (r.Read())
                if (r.NodeType == XmlNodeType.Element && r.LocalName == "Relationship" && r.GetAttribute("Id") == relId)
                {
                    var target = r.GetAttribute("Target") ?? "";
                    return target.StartsWith('/') ? target.TrimStart('/') : "xl/" + target;
                }
        return fallback;
    }

    /// <summary>"AB12" -> 27 (zero-based column).</summary>
    private static int? ColumnIndex(string? cellRef)
    {
        if (string.IsNullOrEmpty(cellRef)) return null;
        int n = 0, i = 0;
        for (; i < cellRef.Length && char.IsLetter(cellRef[i]); i++)
            n = n * 26 + (char.ToUpperInvariant(cellRef[i]) - 'A' + 1);
        return i == 0 ? null : n - 1;
    }
}
