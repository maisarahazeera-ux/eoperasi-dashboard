using System.Text;
using System.Threading.RateLimiting;
using EOperasiApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var isDev = builder.Environment.IsDevelopment();

// ------------------------------------------------------------------ settings check
// Stop at startup with a clear message instead of running with unsafe settings.
// Secrets come from appsettings.{Environment}.json or environment variables
// (e.g. Jwt__Key, ConnectionStrings__Default, Smtp__Password). See DEPLOYMENT.md.
var jwtKey = builder.Configuration["Jwt:Key"] ?? "";
var connectionString = builder.Configuration.GetConnectionString("Default") ?? "";
{
    var problems = new List<string>();
    if (string.IsNullOrWhiteSpace(connectionString)) problems.Add("ConnectionStrings:Default is empty.");
    if (jwtKey.Length < 32) problems.Add("Jwt:Key must be at least 32 characters.");
    if (!isDev)
    {
        if (jwtKey.Contains("CHANGE_ME") || jwtKey.Contains("temporary-dev-secret"))
            problems.Add("Jwt:Key is still the example/development key. Generate a new random key for this server.");
        if (string.IsNullOrWhiteSpace(builder.Configuration["FrontendUrl"]))
            problems.Add("FrontendUrl is empty (used for the links in emails).");
    }
    if (problems.Count > 0)
        throw new InvalidOperationException("e-Operasi cannot start:\n - " + string.Join("\n - ", problems));
}

// ------------------------------------------------------------------ services
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        if (isDev)
        {
            // Development: the dashboard can be opened from any computer on the
            // office network (http://<laptop-ip>:8443 or :5173).
            policy.SetIsOriginAllowed(origin =>
                Uri.TryCreate(origin, UriKind.Absolute, out var uri) && (uri.Port == 8443 || uri.Port == 5173));
        }
        else
        {
            // Production: only the addresses listed in Cors:AllowedOrigins (plus FrontendUrl).
            var origins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>())
                .Append(builder.Configuration["FrontendUrl"] ?? "")
                .Where(o => !string.IsNullOrWhiteSpace(o))
                .Select(o => o.TrimEnd('/'))
                .Distinct()
                .ToArray();
            policy.WithOrigins(origins);
        }
        policy.AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<EOperasiApi.Services.IEmailSender, EOperasiApi.Services.SmtpEmailSender>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<EOperasiApi.Services.ActivityLogger>();
builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddProblemDetails();

// Behind IIS / nginx (which handles HTTPS), use the real visitor IP and https scheme.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

// Slows down password guessing: at most 10 login/register/reset requests
// per minute from one IP address. Extra requests get "429 Too Many Requests".
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };

        // A login token lasts 8 hours. Check the account on every request so a
        // deactivated user, or an admin changed back to staff, loses access at once
        // instead of when the token expires. The role always comes from the database.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async ctx =>
            {
                var username = ctx.Principal?.Identity?.Name;
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var account = username == null ? null : await db.Users
                    .Where(u => u.Username == username)
                    .Select(u => new { u.Status, u.Role })
                    .FirstOrDefaultAsync();
                if (account == null || account.Status != UserStatus.Active)
                {
                    ctx.Fail("Account is not active");
                    return;
                }
                var identity = (System.Security.Claims.ClaimsIdentity)ctx.Principal!.Identity!;
                foreach (var c in identity.FindAll(System.Security.Claims.ClaimTypes.Role).ToList()) identity.RemoveClaim(c);
                identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, account.Role));
            },
        };
    });
builder.Services.AddAuthorization();

// ------------------------------------------------------------------ pipeline
var app = builder.Build();

app.UseForwardedHeaders();

if (isDev)
{
    app.MapOpenApi();
}
else
{
    // Errors return a short JSON message, never the stack trace.
    app.UseExceptionHandler();
    if (app.Configuration.GetValue("Https:Enabled", false))
    {
        app.UseHsts();
        app.UseHttpsRedirection();
    }
}

// Optional: serve the built dashboard from wwwroot (npm run build:server),
// so the whole system runs from one address.
var hasFrontend = app.Environment.WebRootPath != null && File.Exists(Path.Combine(app.Environment.WebRootPath, "index.html"));
if (hasFrontend)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

// Routing must come after the static files, otherwise the catch-all route below
// would also answer requests for .js/.css files with index.html.
app.UseRouting();
app.UseCors("AllowFrontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

if (hasFrontend)
{
    // Any non-API address (e.g. a refreshed page) gets the dashboard.
    app.MapFallbackToFile("{*path:regex(^(?!api/).*$)}", "index.html");
}

app.Run();
