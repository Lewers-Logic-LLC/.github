# **Lewers Logic LLC: Master Brand Guidelines**

**Version:** 3.0 (The Architectural Monolith)

**Last Updated:** April 2026

**Status:** Active Master

## **1\. Brand Identity & Creative North Star**

Lewers Logic LLC is the parent architecture. It is a technology-forward, business-focused brand that balances uncompromising engineering precision with corporate trust.

**The Creative North Star: "Precision Engineering & High-Stakes Logic"**

The layout should feel like a well-documented blueprint: clean, high-contrast, and unapologetically structured. We achieve a "premium editorial" feel through intentional asymmetry and structural mass.

### **Core Brand Pillars**

* **Engineering Excellence:** Precision, logic, and technical sophistication.  
* **Premium Authority:** Trust, professionalism, and established industry dominance.  
* **Disruptive Clarity:** Dismantling inefficiency through intelligent, accessible SaaS interfaces.

## **2\. Logo and Visual Identity**

### **Logo Description**

The Lewers Logic mark is the anchor of the brand:

* **Proportions:** Golden ratio alignment, geometric precision.  
* **Usage:** Always includes the accompanying wordmark in primary applications. The standalone "L" mark is reserved only for constrained UI environments (e.g., favicons, avatars).

### **Logo Variations**

* **Primary (Full Color):** Gold accent \+ Deep Logic Blue text (Preferred for light backgrounds).  
* **Monochrome (Dark):** All Deep Logic Blue (\#081634).  
* **Reverse (Light):** All Soft Gray (\#E9F0EF) or pure White on dark backgrounds.

### **Clear Space & Sizing**

* **Minimum clear space:** Must be equal to 0.5x the height of the "L" mark on all sides. No other elements or typography may enter this zone.  
* **Minimum Size:** Do not scale the primary logo below 48px wide to maintain legibility.

### **Logo Do's and Don'ts**

* **Do:** Use the primary full-color version on light backgrounds.  
* **Do:** Apply monochrome versions for single-color print contexts.  
* **Don't:** Stretch, compress, or distort the mark.  
* **Don't:** Change the Gold accent to Teal (Teal is reserved for the Recycler.IQ child brand).  
* **Don't:** Add drop shadows, gradients, or effects directly to the logo file.

## **3\. Typography System**

*This system actively rejects generic "AI defaults" (e.g., Inter, Arial, Roboto). Our typography is structural, highly characterful, and engineered.*

### **1\. Headline & Display: Bricolage Grotesque**

Used for mass, structure, and establishing immediate authority. It is raw, structural, and unapologetically heavy.

* **Roles:** Display-lg, H1, H2.  
* **Weights:** Bold (700), ExtraBold (800).  
* **Tracking:** Must be tracked tightly (-2% to \-4% letter-spacing) to create a sense of architectural solidity.  
* **Case:** Sentence case.

### **2\. Body & UI Text: Plus Jakarta Sans**

Used for standard paragraph text, documentation, and UI components. Highly legible but features sharp, geometric terminals that feel meticulously engineered.

* **Roles:** Paragraphs, H3, H4, Button Labels, Navigation.  
* **Weights:** Regular (400), Medium (500), SemiBold (600).  
* **Tracking:** Normal (0%).

### **3\. Technical & Data Accent: Azeret Mono**

Used to provide a brutalist, machine-code aesthetic. Breaks the grid to create intentional, tech-forward asymmetry.

* **Roles:** Small labels, system metadata, serial numbers, code snippets, timestamps.  
* **Weights:** Regular (400), Bold (700).  
* **Case:** UPPERCASE preferred for UI tags.

## **4\. Color Architecture: "The Monolith"**

### **The Anchor Palette (Base)**

* **Deep Logic Blue (\#081634)**: The structural foundation. Used for primary text, massive dark-mode hero backgrounds, and foundational UI elements.  
* **Soft Gray (\#E9F0EF)**: The canvas. Used as the primary background for light-mode sections to reduce eye strain and provide a premium, editorial feel compared to pure white.  
* **Obsidian / Void (\#000C2B)**: Used strictly for "Terminal" or deep-tech data visualization backgrounds.

### **The Trust Signal (Accent)**

* **Premium Gold (\#C4962C)**:  
  * *Usage Rule:* Gold is reserved *strictly* for the parent company. It is used sparingly to signify absolute authority, executive trust, verified status, and primary calls-to-action on the master site.  
  * *Restriction:* Never combine Gold and Teal (the Recycler.IQ accent) in the same immediate UI component to avoid brand muddying.

## **5\. Grid, Layout & Spatial Logic**

### **The "No-Line" Rule (Critical)**

* **1px solid borders for sectioning are strictly prohibited.**  
* Do not use lines to separate a sidebar from a main view or a header from a hero.  
* Boundaries are defined by background shifts (e.g., \#E9F0EF sitting against a \#FFFFFF container) and the usage of structural typography.

### **Spacing System (The 8px Grid)**

All padding, margins, and layout elements must snap to a strict 8px scale. Everything must feel like it was placed by an engineer.

* xs: 4px (Sub-component spacing)  
* sm: 8px (Component internal padding)  
* md: 16px (Standard padding, default spacing)  
* lg: 24px (Heading spacing, standard gaps)  
* xl: 32px (Major layout gaps)  
* xxl: 64px+ (Macro section breaks)

### **Shadows and Elevation**

We use mass and shadow to create hierarchy, not strokes.

* **Elevation 1 (Hover):** 0 4px 12px rgba(8,22,52,0.06) \- Subtle lift for interactive cards.  
* **Elevation 2 (Floating):** 0 8px 24px rgba(8,22,52,0.12) \- Dropdowns, popovers, active UI elements.  
* **Elevation 3 (Modals):** 0 16px 48px rgba(8,22,52,0.20) \- Maximum emphasis for critical overlays.

## **6\. Voice, Tone & Messaging**

* **Precise:** Clear, logical, unambiguous language. We do not use fluffy marketing jargon.  
* **Confident:** Assured without arrogance. We speak like the subject matter experts we are.  
* **Approachable:** Not cold; we provide warm professionalism. We are the trusted partner.  
* **Action-Oriented:** We focus on the result (e.g., "Check the Pulse," "Ask Lewis").  
* **Master Tagline:** *"High-Stakes Logic for High-Pressure Industries."*

## **7\. Implementation Checklist**

Before launching a new brand application, verify the following:

* \[ \] Logo clear space is respected (0.5x "L" height).  
* \[ \] Bricolage Grotesque is used for H1/H2 and tracked tightly.  
* \[ \] Generic fonts (Inter, Arial, Space Grotesk) have been completely removed from the CSS/Style guide.  
* \[ \] The "No-Line" rule is enforced; sections are separated by background color shifts or spacing, not 1px borders.  
* \[ \] Gold accent (\#C4962C) is used only for premium/verified context and primary CTAs.  
* \[ \] All spacing adheres strictly to the 8px grid system.  
* \[ \] All text meets WCAG AA contrast (4.5:1 minimum) against its background container.