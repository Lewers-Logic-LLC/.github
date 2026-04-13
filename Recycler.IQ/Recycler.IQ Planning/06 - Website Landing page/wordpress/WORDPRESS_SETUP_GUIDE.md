# Recycler.IQ Landing Page — WordPress Setup Guide

**Company:** Lewers Logic LLC

## Prerequisites

- WordPress site on hosting.com with WPAdmin access
- WPForms plugin installed and activated
- The white icon file: `RecyclerIQ_Icon_white_web_2x.png`

---

## Step 1: Upload the Icon

1. Go to **WPAdmin → Media → Add New**
2. Upload `RecyclerIQ_Icon_white_web_2x.png`
3. Click on the uploaded image and **copy the URL** (you'll need it in Step 4)

---

## Step 2: Create the WPForms Form

1. Go to **WPAdmin → WPForms → Add New**
2. Start with a **Blank Form**, name it "Demo Request"
3. Add these fields (drag from the left panel):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| First Name | Single Line Text | Yes | |
| Last Name | Single Line Text | Yes | |
| Email | Email | Yes | |
| Company | Single Line Text | Yes | |
| Phone | Phone | No | Format: US or International |
| Demo Type | Dropdown | Yes | Choices: `Retail Demo`, `Tax Authority Demo` |

4. Click **Save**
5. Note the **Form ID** — visible in the URL bar: `admin.php?page=wpforms-builder&view=fields&form_id=XXX`

### Configure Conditional Redirect

1. In the form builder, go to **Settings → Confirmations**
2. Delete the default confirmation
3. Create **two** confirmations:

**Confirmation 1 — Retail:**
- Name: `Retail Redirect`
- Type: **Go to URL (Redirect)**
- URL: `https://app.recycler-iq.com/retail-demo`
- Enable **Conditional Logic**:
  - Process this confirmation if: `Demo Type` **is** `Retail Demo`

**Confirmation 2 — Tax Authority:**
- Name: `Tax Authority Redirect`
- Type: **Go to URL (Redirect)**
- URL: `https://app.recycler-iq.com/tax-demo`
- Enable **Conditional Logic**:
  - Process this confirmation if: `Demo Type` **is** `Tax Authority Demo`

4. Click **Save**

---

## Step 3: Add the CSS

1. Go to **WPAdmin → Appearance → Customize → Additional CSS**
2. Paste the entire contents of `recycleriq-landing.css`
3. Click **Publish**

---

## Step 4: Create the Landing Page

1. Go to **WPAdmin → Pages → Add New**
2. Set the page title (e.g., "Recycler.IQ" or leave blank if your theme hides it)
3. Set the template to **Full Width** (or your theme's no-sidebar template)
4. Add a **Custom HTML** block
5. Paste the contents of `recycleriq-landing-content.html`
6. **Find and replace** these placeholders:
   - `YOUR_ICON_URL` → the media URL from Step 1
   - `YOUR_WPFORMS_ID` → the form ID from Step 2
7. Add **another Custom HTML** block at the bottom of the page
8. Paste the following (wrapping the JS file contents):

```html
<script>
// Paste the contents of recycleriq-landing.js here
</script>
```

9. Click **Publish**

---

## Step 5: SEO Setup (Optional but Recommended)

If you have an SEO plugin (Yoast, Rank Math, etc.):

1. Edit the landing page
2. In the SEO plugin panel, set:
   - **Title**: `Recycler.IQ — Intelligent Cash Recycler Management Platform`
   - **Meta Description**: `Monitor, optimize, and secure your entire cash recycler fleet from one platform. Hardware-agnostic, real-time analytics, and regulatory compliance built in.`
   - **Focus Keyphrase**: `cash recycler management`

### Structured Data (JSON-LD)

Add this in a Custom HTML block at the top of the page (before the landing content):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Recycler.IQ",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, Windows, iOS, Android",
  "description": "Centralized, hardware-agnostic platform for cash recycler fleet management with real-time monitoring, predictive analytics, and regulatory compliance.",
  "url": "https://recycler-iq.com",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Request a demo"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Recycler.IQ",
    "url": "https://recycler-iq.com"
  }
}
</script>
```

---

## Step 6: Set as Homepage (Optional)

1. Go to **WPAdmin → Settings → Reading**
2. Select **A static page**
3. Set **Homepage** to your new Recycler.IQ page
4. Click **Save Changes**

---

## Enabling the Countdown Timer

When you have a launch date:

1. Edit the landing page content HTML block
2. **Uncomment** the countdown HTML (remove `<!--` and `-->` around the countdown div)
3. In the JS script block, uncomment and set the launch date:
   ```js
   var riqLaunchDate = new Date('2026-07-01T00:00:00');
   ```
4. Update/Publish the page

---

## File Reference

| File | Where It Goes |
|------|---------------|
| `recycleriq-landing.css` | Appearance → Customize → Additional CSS |
| `recycleriq-landing-content.html` | Custom HTML block (page body) |
| `recycleriq-landing.js` | Custom HTML block with `<script>` tags (bottom of page) |
| `RecyclerIQ_Icon_white_web_2x.png` | Media Library → referenced in content HTML |
