# Lewers Logic LLC — Website WordPress Setup Guide

## Prerequisites

- WordPress site on hosting.com with WPAdmin access
- WPForms plugin installed and activated
- Base CSS already loaded: `lewers-logic-wordpress.css` and `lewers-logic-wpforms.css` (from `1 - Branding/wordpress/`)

---

## File Structure

```
src/
├── css/
│   └── lewerslogic-landing.css              ← Page styles (landing + contact)
├── js/
│   └── lewerslogic-landing.js               ← Smooth scroll + mobile nav
├── images/
│   ├── lewers-logic-llc-software-development-logo-white.png      ← Header/footer logo (880x640)
│   ├── lewers-logic-llc-software-development-logo-white-2x.png   ← Retina header logo
│   ├── lewers-logic-llc-software-development-logo.png             ← Color logo (for light bgs)
│   ├── lewers-logic-llc-software-development-logo-2x.png          ← Retina color logo
│   ├── lewers-logic-llc-software-development-logo-white.svg       ← Vector white logo
│   ├── lewers-logic-llc-software-development-logo.svg             ← Vector color logo
│   ├── lewers-logic-llc-logomark.png                              ← Logomark icon (640x480)
│   ├── lewers-logic-llc-logomark-2x.png                           ← Retina logomark
│   ├── lewers-logic-llc-favicon-32x32.png                         ← Browser favicon
│   └── lewers-logic-llc-favicon-192x192.png                       ← Large favicon / PWA icon
├── lewerslogic-landing-content.html         ← Home page body
├── lewerslogic-contact-content.html         ← Contact page body
└── WORDPRESS_SETUP_GUIDE.md                 ← This file
```

---

## Step 1: Upload Images to Media Library

1. Go to **WPAdmin > Media > Add New**
2. Upload **all files** from `src/images/`
3. After upload, click each image and note the **File URL** — you'll need these for the HTML placeholders

**SEO tip:** WordPress auto-generates alt text from filenames. These filenames are already SEO-optimized, but verify the alt text after upload and adjust if needed.

### Image Reference Table

| File | Purpose | Placeholder in HTML |
|------|---------|-------------------|
| `lewers-logic-llc-logomark-white-web-2x.png` | Header + footer icon (retina, 160x120) | `YOUR_LOGOMARK_URL` |
| `lewers-logic-llc-favicon-32x32.png` | Browser tab icon | Set in Site Identity |
| `lewers-logic-llc-favicon-192x192.png` | App icon / large favicon | Set in Site Identity |

> **Note:** The brand name "LEWERS LOGIC" is rendered as HTML text next to the logomark icon (same approach as the Recycler.IQ landing page). This ensures it's readable at any size and is SEO-crawlable.

---

## Step 2: Set Favicon / Site Icon

1. Go to **WPAdmin > Appearance > Customize > Site Identity**
2. Under **Site Icon**, upload `lewers-logic-llc-favicon-192x192.png`
3. WordPress will auto-crop for smaller sizes
4. Click **Publish**

---

## Step 3: Add the Landing Page CSS

1. Go to **WPAdmin > Appearance > Customize > Additional CSS**
2. Paste the entire contents of `src/css/lewerslogic-landing.css` **after** the existing base CSS
3. Click **Publish**

> This CSS covers both the landing page and the contact page.

---

## Step 4: Create the WPForms Contact Form

1. Go to **WPAdmin > WPForms > Add New**
2. Start with a **Blank Form**, name it "Contact Us"
3. Add these fields:

| Field | Type | Required |
|-------|------|----------|
| Name | Name (First / Last) | Yes |
| Email | Email | Yes |
| Phone | Phone | No |
| Subject | Dropdown | Yes |
| Message | Paragraph Text | Yes |

4. For the **Subject** dropdown, add:
   - `General Inquiry`
   - `New Project / Quote`
   - `Existing Project Support`
   - `Partnership`
   - `Other`

5. Go to **Settings > Notifications**
   - Set **Send To Email Address** to `info@lewerslogic.com`

6. Go to **Settings > Confirmations**
   - Type: **Message**
   - Message: `Thanks for reaching out! We'll get back to you within one business day.`

7. Click **Save**
8. Note the **Form ID** from the URL: `form_id=XXX`

---

## Step 5: Create the Landing Page (Home)

1. Go to **WPAdmin > Pages > Add New**
2. Set the page title to "Home" (or leave blank if your theme hides it)
3. Set the template to **Full Width** (no sidebar)
4. Add a **Custom HTML** block
5. Paste the contents of `src/lewerslogic-landing-content.html`
6. **Find and replace** these placeholders:

| Placeholder | Replace with |
|-------------|-------------|
| `YOUR_LOGOMARK_URL` | Media URL for `lewers-logic-llc-logomark-white-web-2x.png` (appears 2x — header and footer) |

7. Add **another Custom HTML** block at the bottom of the page
8. Paste:

```html
<script>
// Paste the contents of src/js/lewerslogic-landing.js here
</script>
```

9. Click **Publish**

---

## Step 6: Create the Contact Page

1. Go to **WPAdmin > Pages > Add New**
2. Set the page title to "Contact"
3. Set the slug to `contact`
4. Set the template to **Full Width**
5. Add a **Custom HTML** block
6. Paste the contents of `src/lewerslogic-contact-content.html`
7. **Find and replace:**

| Placeholder | Replace with |
|-------------|-------------|
| `YOUR_WPFORMS_ID` | Form ID from Step 4 |

8. Click **Publish**

---

## Step 7: Set Up Navigation

1. Go to **WPAdmin > Appearance > Menus** (or Editor for block themes)
2. Create or edit the primary menu with:

| Label | Link |
|-------|------|
| Home | Page: Home |
| Services | Custom Link: `/#ll-services` |
| Products | Custom Link: `/#ll-products` |
| Contact Us | Page: Contact |

3. Assign to **Primary Menu** location
4. Click **Save Menu**

---

## Step 8: Set as Homepage

1. Go to **WPAdmin > Settings > Reading**
2. Select **A static page**
3. Set **Homepage** to your "Home" page
4. Click **Save Changes**

---

## Step 9: SEO Setup (Recommended)

If you have an SEO plugin (Yoast, Rank Math, etc.):

### Landing Page

- **Title:** `Lewers Logic LLC — Enterprise .NET Software Development`
- **Meta Description:** `Custom enterprise applications, SaaS platforms, and system integrations built on .NET Core and Azure. Lewers Logic LLC — Structured Logic. Engineered Solutions.`
- **Focus Keyphrase:** `.NET enterprise software development`

### Contact Page

- **Title:** `Contact Us — Lewers Logic LLC`
- **Meta Description:** `Get in touch with Lewers Logic LLC for custom .NET software development, SaaS platforms, and system integrations. Senatobia, MS.`

### Structured Data (JSON-LD)

Add this in a Custom HTML block at the **very top** of the landing page (before the content block):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Lewers Logic LLC",
  "url": "https://lewerslogic.com",
  "logo": "YOUR_LOGOMARK_URL",
  "description": "Enterprise software development specializing in .NET Core applications, SaaS platforms, and custom integrations.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "981 HWY 305 N",
    "addressLocality": "Senatobia",
    "addressRegion": "MS",
    "postalCode": "38668",
    "addressCountry": "US"
  },
  "email": "info@lewerslogic.com",
  "sameAs": []
}
</script>
```

Replace `YOUR_LOGOMARK_URL` with the actual media URL.

---

## Quick Reference: All Placeholders

| Placeholder | Count | Where |
|-------------|-------|-------|
| `YOUR_LOGOMARK_URL` | 3 | Landing page (header, footer) + JSON-LD |
| `YOUR_WPFORMS_ID` | 1 | Contact page |
