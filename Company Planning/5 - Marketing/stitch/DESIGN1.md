# Design System Specification: Tech-Forward Edge

## 1. Overview & Creative North Star: "The Kinetic Terminal"
This design system is not a static interface; it is a high-performance environment. The Creative North Star is **"The Kinetic Terminal"**—an aesthetic that bridges the gap between raw engineering power and editorial sophistication.

To move beyond the "standard dark mode" template, this system rejects traditional boundaries. We break the grid through **intentional asymmetry** (e.g., placing technical metadata in unexpected margins) and **tonal depth**. Instead of flat boxes, we treat the UI as a layered stack of obsidian glass, illuminated by the "glow" of active data. It is precise, surgical, and unapologetically premium.

---

## 2. Colors & Surface Architecture
The palette is rooted in the deep void of `#000c2b`, punctuated by high-energy teals and cybernetic cyans.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Layouts must be articulated through background shifts or light-source simulation.
*   **Transitioning Zones:** Use `surface_container_low` against `surface` to define a sidebar.
*   **Data Density:** Use `surface_container_highest` for code blocks or data tables to pull them into the foreground without a single stroke.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of depth:
*   **Base:** `surface` (#000c2b) — The infinite canvas.
*   **Sub-level:** `surface_container_lowest` (#000000) — Used for "recessed" areas like terminal inputs or inactive wells.
*   **Elevated:** `surface_container` (#05183c) through `surface_container_highest` (#0f244f) — Use these to "stack" cards. An inner container should always be at least one tier higher than its parent to signify importance.

### The "Glass & Glow" Rule
To achieve the premium "Edge" feel, use **Glassmorphism** for floating overlays (Modals, Popovers).
*   **Implementation:** Use `surface_variant` at 60% opacity with a `20px` backdrop-blur. 
*   **Signature Glow:** Apply a subtle `0 0 15px` outer glow using `primary_container` (#3db1ac) to active elements or "Primary" CTAs to simulate a high-energy LED emission.

---

## 3. Typography: Technical Authority
We pair the geometric confidence of **Space Grotesk** with the functional precision of **JetBrains Mono**.

*   **The Display Scale (Space Grotesk):** Headings should feel like architectural statements. Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) to create an authoritative, editorial impact.
*   **The Technical Accents (JetBrains Mono):** Use JetBrains Mono for all `label-md`, `label-sm`, and any data-driven strings. This font represents "The Machine"—use it for timestamps, coordinates, and status codes.
*   **The Body (Inter):** To ensure maximum readability against dark backgrounds, use `body-lg` (Inter) with a slightly increased line-height (1.6) to prevent "halting" (the visual bleed of light text on dark).

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows have no place in a digital-first terminal. We use light and tone to define z-index.

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface_container_high` element sitting on a `surface_dim` background provides all the separation required.
*   **Ambient Shadows:** If a floating element requires a shadow, it must be tinted. Use the `on_surface` color at 4% opacity with a `48px` blur. It should feel like a soft atmospheric occlusion, not a "drop shadow."
*   **Ghost Borders:** When accessibility demands a container edge, use the `outline_variant` token (#3b4768) at **15% opacity**. This creates a "glint" on the edge of the glass rather than a rigid cage.

---

## 5. Components

### Buttons: High-Energy Triggers
*   **Primary:** Background: `primary` (#7fece7). Text: `on_primary` (#005654). Shape: `4px` (Sharp). Add a `primary_dim` outer glow on hover.
*   **Secondary:** Background: Transparent. Border: `Ghost Border` (15% opacity `outline`). Text: `primary`.
*   **Tertiary:** JetBrains Mono, all caps, `label-md`. No background. Use for utility actions.

### Cards & Lists: The No-Divider Standard
*   **Cards:** Never use dividers. Separate content using `surface_container` transitions and the **Spacing Scale** (e.g., 24px vertical padding).
*   **Lists:** Hover states should use a subtle shift to `surface_bright` (#142a59) rather than a line separator.

### Input Fields: The Terminal Look
*   **Base:** `surface_container_lowest` (#000000).
*   **Active State:** The bottom edge glows with a 1px `primary` line and a 4px blur of the same color. 
*   **Font:** Always use JetBrains Mono for user input to reinforce the engineering aesthetic.

### Additional Component: "The Status Beacon"
*   A small 4x4px square (Radius: `none`) using `secondary` (#17eefa) or `error` (#ff716c) with a pulsing `20px` glow to indicate live system status or critical alerts.

---

## 6. Do’s and Don'ts

### Do:
*   **Do** use extreme contrast. A `display-lg` headline should feel massive compared to a `label-sm` technical tag.
*   **Do** embrace negative space. Let the `surface` color breathe to emphasize the premium nature of the content.
*   **Do** use "Teal-to-Cyan" gradients (`primary` to `secondary`) for data visualizations and progress bars.

### Don't:
*   **Don't** use standard 8px or 16px border radii. This system is defined by its `4px` (Small) and `0px` (None) edges.
*   **Don't** use pure white (#FFFFFF) for text. Use `on_surface` (#dee5ff) to reduce eye strain and maintain the navy tonal harmony.
*   **Don't** use dividers. If you feel you need a line, use a 24px gap instead. Space is your separator.