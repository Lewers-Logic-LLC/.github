# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **WordPress website** for Lewers Logic LLC (lewerslogic.com). It's not a traditional Node/npm project — it's manual WordPress content with pre-built HTML, CSS, and JavaScript assets that are copy-pasted into WordPress via the admin panel.

The repository contains:
- **HTML preview files** for local testing/iteration
- **WordPress source assets** (CSS, JS, HTML content blocks) ready to copy into WordPress
- **Images and logos** for the site
- **Setup guide** with step-by-step WordPress deployment instructions

## Architecture & File Structure

```
website/
├── LewersLogic-Preview.html          ← HTML preview for local testing
├── LewersLogic-Preview-Original.html ← Backup of original preview
├── wordpress/
│   └── src/
│       ├── css/
│       │   ├── lewerslogic-landing.css       ← Landing page + contact page styles
│       │   └── lewerslogic-landing-Original.css ← Backup
│       ├── js/
│       │   └── lewerslogic-landing.js        ← Smooth scroll, mobile nav
│       ├── images/
│       │   ├── lewers-logic-llc-logomark*.{png,svg}  ← Logo icon variants
│       │   ├── lewers-logic-llc-software-development-logo*.{png,svg} ← Full logo
│       │   └── lewers-logic-llc-favicon*.png ← Favicon/PWA icon
│       ├── lewerslogic-landing-content.html  ← Home page HTML (copy to WordPress)
│       ├── lewerslogic-contact-content.html  ← Contact page HTML (copy to WordPress)
│       └── WORDPRESS_SETUP_GUIDE.md          ← Deployment instructions
```

## Key Concepts

### CSS Architecture
- CSS is split into **two layers** in WordPress:
  1. **Base CSS** (from branding folder): `lewers-logic-wordpress.css` and `lewers-logic-wpforms.css`
  2. **Landing page CSS** (from this project): `lewerslogic-landing.css`
- CSS uses **CSS custom properties** (variables) from the Lewers Logic branding system:
  - `--ll-font`, `--ll-blue`, `--ll-teal`, `--ll-white`, `--ll-transition`, etc.
- All landing page styles are scoped to `.ll-landing` container to avoid conflicts with WordPress theme

### JavaScript
- `lewerslogic-landing.js` provides:
  - Smooth scroll navigation for anchor links (`#ll-services`, `#ll-products`)
  - Mobile responsive navigation menu
- Must be added to a Custom HTML block at the bottom of the landing page in WordPress

### HTML Content Blocks
- Both landing and contact pages are delivered as **HTML snippets** (not WordPress blocks)
- They use custom HTML elements with `.ll-*` class selectors
- Placeholders like `YOUR_LOGOMARK_URL` and `YOUR_WPFORMS_ID` must be replaced before posting to WordPress
- Content is wrapped in `.ll-landing` div for CSS scoping

### Dependencies
- **Branding assets**: Located in `../../1 - Branding/` (parent folder)
  - Brand colors, typography, spacing system
  - Base WordPress CSS files (`lewers-logic-wordpress.css`, `lewers-logic-wpforms.css`)
- **WPForms plugin**: Required for contact form functionality
- **WordPress theme**: Should support custom CSS and full-width page templates

## Development Workflow

### To Edit the Website

1. **Edit source files** locally in `wordpress/src/`:
   - Edit `lewerslogic-landing-content.html` for home page content
   - Edit `lewerslogic-contact-content.html` for contact page content
   - Edit `lewerslogic-landing.css` for styling
   - Edit `lewerslogic-landing.js` for behavior

2. **Preview changes** in `LewersLogic-Preview.html`:
   - Open the HTML file in a browser
   - The preview includes base CSS + landing CSS + JS
   - Verify layout, styling, and interactivity
   - Check mobile responsiveness (browser dev tools)

3. **Deploy to WordPress**:
   - Follow the numbered steps in `WORDPRESS_SETUP_GUIDE.md`
   - Steps 1–9 cover: image upload, CSS injection, form creation, page setup, navigation, SEO
   - Key steps:
     - Upload all images to Media Library and note their URLs
     - Add CSS to WPAdmin > Appearance > Customize > Additional CSS
     - Create WPForms contact form (Step 4) and note the form ID
     - Create Home and Contact pages with Custom HTML blocks
     - Replace placeholders (`YOUR_LOGOMARK_URL`, `YOUR_WPFORMS_ID`)
     - Set up navigation menu and homepage

## Common Tasks

### Update the Landing Page Copy
1. Edit `lewerslogic-landing-content.html`
2. Update text in the appropriate `.ll-*` section
3. Preview in `LewersLogic-Preview.html`
4. Paste the updated content into the WordPress page (Home)

### Update Styling
1. Edit `lewerslogic-landing.css`
2. Preview in `LewersLogic-Preview.html` (reload browser)
3. Paste updated CSS into WPAdmin > Appearance > Customize > Additional CSS

### Add a New Section
1. Add HTML to `lewerslogic-landing-content.html` (follow `.ll-*` naming pattern)
2. Add CSS to `lewerslogic-landing.css` (scoped to `.ll-landing`)
3. Add navigation link to `<nav>` with an anchor ID (e.g., `#ll-newsection`)
4. Test in preview, then update WordPress

### Update Images/Logos
1. Replace files in `wordpress/src/images/`
2. Upload new versions to WordPress Media Library
3. Update the image URL placeholders in HTML content
4. Ensure file naming follows the existing pattern for SEO

## Important Notes

- **No git for WordPress**: WordPress content (pages, forms, menus) is managed directly in the WPAdmin interface, not in version control
- **Only source files are versioned**: HTML, CSS, JS, and images in `wordpress/src/` are version-controlled; the WordPress database is not
- **CSS Scoping**: All styles must use `.ll-landing` prefix to avoid bleeding into WordPress theme styles
- **Placeholder References**: The setup guide lists all placeholders (image URLs, form IDs) — ensure every placeholder is replaced before publishing
- **Image Sizing**: The guide specifies dimensions for each logo variant (header, footer, favicon) — follow these to maintain visual consistency
- **Base CSS Dependency**: The landing page CSS assumes `lewers-logic-wordpress.css` and `lewers-logic-wpforms.css` are already loaded in WordPress

## Deployment Checklist

Before marking the website as live, verify:
- [ ] All images uploaded to Media Library
- [ ] Favicon set (WPAdmin > Appearance > Customize > Site Identity)
- [ ] CSS pasted into Additional CSS (after base CSS)
- [ ] Contact form created with correct fields and notification email
- [ ] Landing page created with correct content + placeholder replacements
- [ ] Contact page created with correct form ID
- [ ] Navigation menu created and assigned to Primary Menu location
- [ ] Homepage set to static page (Settings > Reading)
- [ ] Mobile responsive (test in browser dev tools)
- [ ] Links tested (nav, anchor links, form)
