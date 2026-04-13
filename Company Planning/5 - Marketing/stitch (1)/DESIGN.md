# Design System Strategy: The Architectural Monolith

## 1. Overview & Creative North Star
This design system is built for Lewers Logic LLC to project the image of "The Architectural Monolith." In the world of enterprise .NET development, stability and precision are paramount. We are moving away from the "airy and ephemeral" SaaS aesthetic toward something more grounded, structural, and authoritative.

**The Creative North Star: Precision Engineering.**
The layout should feel like a well-documented blueprint: clean, high-contrast, and unapologetically structured. We achieve a "premium editorial" feel through intentional asymmetry—utilizing large, bold display typography offset against tight, technical data grids. We do not use borders to define space; we use mass and tone. Elements should feel carved out of the digital canvas rather than floating on top of it.

---

## 2. Colors & Tonal Logic
The palette is rooted in a deep, authoritative Navy (`primary_container`: #0d1a38) and a surgical, technical Teal (`secondary`: #006a67). 

### The "No-Line" Rule
To achieve a high-end signature look, **1px solid borders for sectioning are strictly prohibited.** Do not use lines to separate a sidebar from a main view or a header from a hero. 
*   **Boundaries are defined by background shifts.** A section defined by `surface-container-low` (#f2f3ff) sitting against a `surface` (#faf8ff) background creates a clean, sophisticated break.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical, interlocking layers. Use the hierarchy of `surface-container` tokens to denote importance:
*   **Base:** `surface` (#faf8ff)
*   **Secondary Content:** `surface-container-low` (#f2f3ff)
*   **Active/Interactive Components:** `surface-container-high` (#e2e7ff)
*   **The Focus Layer:** `surface-container-highest` (#dae2fd)

### Signature Textures
For hero sections and primary CTAs, avoid flat color. Use subtle linear gradients transitioning from `primary_container` (#0d1a38) to a deep Navy-Black to give the "Monolith" a sense of depth and soul. 

---

## 3. Typography
The system utilizes a dual-typeface approach to balance "High-End Editorial" with "Engineering Logic."

*   **Display & Headline (Space Grotesk):** This is our "Editorial" voice. Its geometric, slightly idiosyncratic letterforms suggest a firm that builds the future. Use `display-lg` (3.5rem) with tight letter-spacing for high-impact statements.
*   **Body & Title (Inter):** This is our "Functional" voice. It provides maximum readability for complex enterprise documentation.
*   **Labels & Accents:** For a "code-related vibe," use `label-md` for technical metadata.

**Hierarchy as Identity:**
Use extreme scale contrast. A `display-lg` headline should often be paired with a much smaller `body-md` description. This creates the "Monolith" effect—a massive anchor supported by precise details.

---

## 4. Elevation & Depth
In this system, depth is a function of light and material, not "drop shadows."

*   **The Layering Principle:** Depth is achieved through tonal stacking. A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural lift.
*   **Ambient Shadows:** Where floating elements (like Modals) are required, use a shadow with a 32px to 48px blur, set at 6% opacity using a tint of `on_surface` (#131b2e). It should look like an ambient occlusion glow, not a hard shadow.
*   **Glassmorphism:** For top navigation or floating toolbars, use `surface` at 80% opacity with a `backdrop-filter: blur(12px)`. This makes the layout feel integrated and architectural rather than layered haphazardly.
*   **The Ghost Border:** If a boundary is required for accessibility, use `outline_variant` at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary_container` (#0d1a38) with `on_primary` (#ffffff) text. Use `md` (0.375rem) roundedness. 
*   **Secondary:** A "Ghost" style. No fill, but a `secondary` (#006a67) text color. On hover, apply a `secondary_container` (#85f1ec) background at 20% opacity.
*   **Tertiary/Technical:** Use `label-md` typography with a small `secondary` (#006a67) accent icon.

### Cards & Lists
*   **Forbid Dividers:** Do not use 1px lines between list items. Use 16px or 24px of vertical whitespace (Gap) to separate content.
*   **Structure:** Cards should use `surface-container-lowest` (#ffffff) and no border. The "lift" comes from the contrast against the `surface` (#faf8ff) background.

### Input Fields
*   **State Logic:** Fields should be "Architectural." Use a `surface-container-high` background with a bottom-only accent line using `secondary` (#25A09C) only when focused.
*   **Error State:** Use `error` (#ba1a1a) for the helper text and a subtle `error_container` tint for the field background.

### Chips
*   **Style:** Small, square-ish (`sm` 0.125rem roundedness). Use `secondary_fixed` (#88f4ef) backgrounds with `on_secondary_fixed` (#00201f) text to denote "Technical Tags" or "Language: .NET".

---

## 6. Do's and Don'ts

### Do:
*   **Embrace Negative Space:** Let the typography breathe. Enterprise software doesn't have to be "cluttered" to be powerful.
*   **Align to the Grid:** Use a strict 8px spacing scale. Everything must feel like it was placed by an engineer.
*   **Use Subtle Tints:** When using neutrals, ensure they have a slight blue/navy tint to keep the "Monolith" feeling cohesive.

### Don't:
*   **No Rounded Pills:** Avoid the `full` (9999px) roundedness for buttons; it feels too "consumer/social." Stick to `md` (0.375rem) for a more professional, architectural feel.
*   **No Pure Greys:** Never use #000000 or #808080. Always use the system’s `on_surface` or `outline` tokens which are tinted with navy.
*   **No Default Shadows:** Never use the standard CSS `box-shadow: 0 2px 4px rgba(0,0,0,0.5)`. It breaks the high-end editorial illusion.