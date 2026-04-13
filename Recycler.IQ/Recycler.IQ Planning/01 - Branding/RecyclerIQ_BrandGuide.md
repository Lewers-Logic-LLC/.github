# Recycler.IQ — Brand & Theme Guide

**Company:** Lewers Logic LLC

**Version 1.0 | March 2026**

---

## Brand Overview

Recycler.IQ is a centralized, hardware-agnostic software platform designed to optimize retail cash operations. The brand identity reflects intelligence, trust, and modern technology through a monochromatic blue palette that conveys reliability and forward-thinking innovation.

### Brand Personality

- **Intelligent** — Predictive analytics and ML-driven insights power smarter cash operations.
- **Reliable** — Local-first architecture ensures 100% uptime even when connectivity drops.
- **Modern** — Built on .NET 10, Azure, and cutting-edge cloud/edge hybrid patterns.
- **Trustworthy** — Enterprise-grade security with hardware-bound licensing and immutable audit logs.

---

## Color Palette

The Recycler.IQ palette is a monochromatic blue system progressing from deep navy to sky blue. This creates a cohesive, professional look across documents, presentations, UI, and marketing.

### Primary Palette

| Color | Hex | Usage |
|-------|-----|-------|
| **Deep Navy (Darkest)** | `#0F084B` | Cover backgrounds, hero sections, navigation bars, footer backgrounds |
| **Dark Blue (Primary Dark)** | `#26408B` | Primary headings (H1), table headers, strong emphasis, sidebar backgrounds |
| **Medium Blue (Brand Primary)** | `#3D60A7` | Primary brand color: CTAs, links, H2 headings, key accents, active states |
| **Light Blue (Secondary)** | `#81B1D5` | H3 headings, borders, dividers, chart fills, secondary buttons, icons |
| **Pale Blue (Background)** | `#A0D2E7` | Page tints, card backgrounds, table row striping, subtle highlights |

### Supporting Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Body Text** | `#2C3E50` | Primary body text color — neutral dark for readability |
| **Light Text** | `#5A7A9B` | Captions, metadata, timestamps, secondary labels |
| **Background Tint** | `#E8F2F9` | Very light tint for alternating table rows, card backgrounds |
| **White** | `#FFFFFF` | Page backgrounds, text on dark backgrounds, clean contrast |

---

## Typography

Recycler.IQ uses **Arial** as its primary typeface — universally available across all platforms ensuring consistent rendering everywhere.

### Type Scale

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Document Title | 28pt | Bold | Deep Navy (`#0F084B`) |
| Heading 1 | 20pt | Bold | Dark Blue (`#26408B`) |
| Heading 2 | 15pt | Bold | Medium Blue (`#3D60A7`) |
| Heading 3 | 13pt | Bold | Light Blue (`#81B1D5`) |
| Body Text | 11pt | Regular | Body (`#2C3E50`) |
| Caption / Meta | 9pt | Regular | Light Text (`#5A7A9B`) |

---

## Usage Guidelines

### Document Styling

Headers and footers use Medium Blue (`#3D60A7`) with a thin bottom border. Page numbers centered in Light Text color. Table headers use Dark Blue (`#26408B`) background with white text. Alternating rows use Background Tint (`#E8F2F9`).

### UI Application

Primary CTAs use Medium Blue (`#3D60A7`). Hover states darken to Dark Blue (`#26408B`). Navigation sidebars use Deep Navy (`#0F084B`) background with white text. Active items highlighted with Medium Blue. Secondary buttons use Light Blue (`#81B1D5`) outlines.

### Charts & Data Visualization

- **Primary series:** Medium Blue (`#3D60A7`)
- **Secondary:** Light Blue (`#81B1D5`)
- **Tertiary:** Pale Blue (`#A0D2E7`)
- **Emphasis/totals:** Dark Blue (`#26408B`)
- **Grid lines:** Background Tint (`#E8F2F9`)

---

## Blazor / .NET UI Token Mapping

For use in CSS variables or Blazor component theming:

```css
:root {
  --riq-deep-navy:     #0F084B;
  --riq-dark-blue:     #26408B;
  --riq-medium-blue:   #3D60A7;
  --riq-light-blue:    #81B1D5;
  --riq-pale-blue:     #A0D2E7;
  --riq-body-text:     #2C3E50;
  --riq-light-text:    #5A7A9B;
  --riq-bg-tint:       #E8F2F9;
  --riq-white:         #FFFFFF;

  /* Semantic tokens */
  --riq-primary:       var(--riq-medium-blue);
  --riq-primary-hover: var(--riq-dark-blue);
  --riq-nav-bg:        var(--riq-deep-navy);
  --riq-nav-text:      var(--riq-white);
  --riq-heading-h1:    var(--riq-dark-blue);
  --riq-heading-h2:    var(--riq-medium-blue);
  --riq-heading-h3:    var(--riq-light-blue);
  --riq-border:        var(--riq-light-blue);
  --riq-table-header:  var(--riq-dark-blue);
  --riq-table-stripe:  var(--riq-bg-tint);
  --riq-cta:           var(--riq-medium-blue);
  --riq-cta-hover:     var(--riq-dark-blue);
}
```

## MudBlazor Theme

```csharp
// MudBlazor theme palette
var palette = new PaletteLight()
{
    Primary       = "#3D60A7",  // Medium Blue
    PrimaryDarken = "#26408B",  // Dark Blue
    Secondary     = "#81B1D5",  // Light Blue
    Background    = "#FFFFFF",
    Surface       = "#E8F2F9",  // Bg Tint
    AppbarBackground = "#0F084B",  // Deep Navy
    AppbarText    = "#FFFFFF",
    TextPrimary   = "#2C3E50",  // Body Text
    TextSecondary = "#5A7A9B",  // Light Text
};
```

---

## Blazor / Razor Component Theming

### Brand Constants

Create a static class for type-safe access across all Razor components:

```csharp
namespace RecyclerIQ.UI.Theme;

public static class RiqBrand
{
    // Primary palette
    public const string DeepNavy    = "#0F084B";
    public const string DarkBlue    = "#26408B";
    public const string MediumBlue  = "#3D60A7";
    public const string LightBlue   = "#81B1D5";
    public const string PaleBlue    = "#A0D2E7";

    // Supporting
    public const string BodyText    = "#2C3E50";
    public const string LightText   = "#5A7A9B";
    public const string BgTint      = "#E8F2F9";
    public const string White       = "#FFFFFF";

    // Semantic aliases
    public const string Primary     = MediumBlue;
    public const string PrimaryHover = DarkBlue;
    public const string NavBg       = DeepNavy;
    public const string CTA         = MediumBlue;
    public const string Border      = LightBlue;
    public const string TableHeader = DarkBlue;
    public const string TableStripe = BgTint;
}
```

### Cascading Theme Provider

Use the `CascadingValue` component (per [ASP.NET Core docs](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/cascading-values-and-parameters)) to flow theme data down the component hierarchy. Any descendant component can receive it via `[CascadingParameter]`.

```csharp
// RiqTheme.cs — the theme object that flows through the tree
namespace RecyclerIQ.UI.Theme;

public record RiqTheme
{
    public string Primary      { get; init; } = RiqBrand.MediumBlue;
    public string PrimaryDark  { get; init; } = RiqBrand.DarkBlue;
    public string Secondary    { get; init; } = RiqBrand.LightBlue;
    public string NavBg        { get; init; } = RiqBrand.DeepNavy;
    public string Surface      { get; init; } = RiqBrand.BgTint;
    public string TextPrimary  { get; init; } = RiqBrand.BodyText;
    public string TextMuted    { get; init; } = RiqBrand.LightText;
    public string Border       { get; init; } = RiqBrand.LightBlue;

    // Semantic helpers for inline style binding
    public string BtnPrimaryStyle  => $"background:{Primary};color:#FFFFFF;border:none;";
    public string BtnSecondaryStyle => $"background:transparent;color:{Primary};border:1px solid {Border};";
    public string NavStyle         => $"background:{NavBg};color:#FFFFFF;";
    public string TableHeaderStyle => $"background:{PrimaryDark};color:#FFFFFF;";
    public string TableStripeStyle => $"background:{Surface};";
}
```

```razor
@* MainLayout.razor — provide theme to all descendants *@
@inherits LayoutComponentBase

<div class="page">
    <nav style="@_theme.NavStyle">
        <span class="brand">RECYCLER.IQ</span>
    </nav>

    <CascadingValue Value="@_theme">
        <main class="content px-4">
            @Body
        </main>
    </CascadingValue>

    <button @onclick="ToggleDarkMode">Toggle Mode</button>
</div>

@code {
    private RiqTheme _theme = new();

    private void ToggleDarkMode()
    {
        // Swap to a dark variant (example)
        _theme = new RiqTheme
        {
            Primary     = RiqBrand.LightBlue,
            PrimaryDark = RiqBrand.MediumBlue,
            NavBg       = RiqBrand.DarkBlue,
            Surface     = RiqBrand.DeepNavy,
            TextPrimary = RiqBrand.PaleBlue,
            TextMuted   = RiqBrand.LightBlue,
            Border      = RiqBrand.MediumBlue
        };
    }
}
```

```razor
@* Any child component — consume the cascading theme *@
<div style="border: 1px solid @Theme.Border; background: @Theme.Surface;">
    <h2 style="color: @Theme.PrimaryDark;">Dashboard</h2>
    <p style="color: @Theme.TextPrimary;">Content here</p>
</div>

@code {
    [CascadingParameter] private RiqTheme Theme { get; set; } = default!;
}
```

### Component CSS Isolation

Blazor scoped CSS (`Component.razor.css`) is bundled at build time into `{ASSEMBLY_NAME}.styles.css`. Each component gets a unique `b-{hash}` attribute appended to its rendered HTML so styles don't leak. Reference the bundle in your `App.razor` or `_Host.cshtml`:

```html
<link href="RecyclerIQ.Client.styles.css" rel="stylesheet" />
```

Use scoped CSS files with the brand CSS custom properties:

```css
/* RiqCard.razor.css — scoped to RiqCard only */
.riq-card {
    background: var(--riq-white);
    border: 1px solid var(--riq-light-blue);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(15, 8, 75, 0.08);
}

.riq-card-header {
    color: var(--riq-dark-blue);
    font-weight: 700;
    font-size: 1.125rem;
    border-bottom: 2px solid var(--riq-pale-blue);
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
}
```

Use the `::deep` combinator to apply scoped styles to child component markup:

```css
/* ParentComponent.razor.css — styles reach into child components */
::deep .riq-card-header {
    font-size: 1.25rem;
    color: var(--riq-deep-navy);
}
```

### Reusable Styled Components

```razor
@* RiqButton.razor *@
<button class="riq-btn @CssClass" style="@_style" @onclick="OnClick" @attributes="AdditionalAttributes">
    @ChildContent
</button>

@code {
    [CascadingParameter] private RiqTheme Theme { get; set; } = default!;

    [Parameter] public RenderFragment? ChildContent { get; set; }
    [Parameter] public EventCallback<MouseEventArgs> OnClick { get; set; }
    [Parameter] public RiqButtonVariant Variant { get; set; } = RiqButtonVariant.Primary;
    [Parameter] public string CssClass { get; set; } = "";
    [Parameter(CaptureUnmatchedValues = true)]
    public Dictionary<string, object>? AdditionalAttributes { get; set; }

    private string _style => Variant switch
    {
        RiqButtonVariant.Primary   => Theme.BtnPrimaryStyle,
        RiqButtonVariant.Secondary => Theme.BtnSecondaryStyle,
        RiqButtonVariant.Nav       => Theme.NavStyle,
        _ => ""
    };
}

public enum RiqButtonVariant { Primary, Secondary, Nav }
```

```css
/* RiqButton.razor.css */
.riq-btn {
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: opacity 0.15s ease;
}
.riq-btn:hover { opacity: 0.88; }
.riq-btn:active { transform: scale(0.98); }
```

```razor
@* RiqDataTable.razor — generic branded data table *@
@typeparam TItem

<table class="riq-table">
    <thead>
        <tr style="@Theme.TableHeaderStyle">
            @HeaderContent
        </tr>
    </thead>
    <tbody>
        @for (int i = 0; i < Items.Count; i++)
        {
            var rowStyle = i % 2 == 0 ? "" : Theme.TableStripeStyle;
            <tr style="@rowStyle">
                @RowTemplate(Items[i])
            </tr>
        }
    </tbody>
</table>

@code {
    [CascadingParameter] private RiqTheme Theme { get; set; } = default!;

    [Parameter] public RenderFragment? HeaderContent { get; set; }
    [Parameter] public RenderFragment<TItem> RowTemplate { get; set; } = default!;
    [Parameter] public IReadOnlyList<TItem> Items { get; set; } = [];
}
```

```css
/* RiqDataTable.razor.css */
.riq-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
}
.riq-table th, .riq-table td {
    padding: 0.625rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--riq-light-blue);
}
```

### MAUI Blazor Hybrid Notes

For the MAUI Blazor Hybrid app (Link.Service desktop), the same CSS variables and Razor components work identically. Ensure `wwwroot/css/app.css` includes the `:root` variables from the CSS section above. For platform-specific styling (title bar, status bar):

```csharp
// MauiProgram.cs — set native title bar color on Windows
#if WINDOWS
builder.ConfigureLifecycleEvents(events =>
{
    events.AddWindows(w => w.OnWindowCreated(window =>
    {
        var titleBar = window.AppWindow.TitleBar;
        titleBar.BackgroundColor = Windows.UI.Color.FromArgb(255, 15, 8, 75); // Deep Navy
        titleBar.ForegroundColor = Windows.UI.Color.FromArgb(255, 255, 255, 255);
    }));
});
#endif
```

---

## Quick Reference Card

| Token | Value |
|-------|-------|
| Primary Font | Arial |
| Brand Color | `#3D60A7` |
| Deep Navy | `#0F084B` |
| Dark Blue | `#26408B` |
| Light Blue | `#81B1D5` |
| Pale Blue | `#A0D2E7` |
