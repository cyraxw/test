# CODM Attachments Hub — Netlify Edition

This version uses:

- Netlify static hosting for the frontend
- Netlify Functions for the API
- Netlify Blobs for persistent JSON data
- Environment variables for the admin password and session signing secret

Netlify Blobs is a key/value store, so this app stores the attachment collection and callout collection as JSON objects. This is appropriate for a small/simple database. For complex relational queries, Netlify recommends a structured database instead.

## Deploy to Netlify

### 1. Put this project in GitHub

Create a repository and upload this folder.

### 2. Import it into Netlify

In Netlify:

1. Add a new project/site.
2. Import the GitHub repository.
3. Netlify will use `netlify.toml`.
4. Deploy.

### 3. Add environment variables

In your Netlify project:

Project configuration → Environment variables

Create:

`ADMIN_PASSWORD`
A strong password for the admin panel.

`SESSION_SECRET`
A long random secret used to sign the admin cookie.

Example:

ADMIN_PASSWORD=MyVeryStrongPassword123!
SESSION_SECRET=generate-a-long-random-value-here

Do not put real values into GitHub.

### 4. Redeploy

After setting the variables, redeploy the site.

### 5. Open the site

Click the Netlify site URL.

Press **Admin** to log in.

## Admin features

The Admin Dashboard lets you:

- Add attachments
- Remove attachments
- Mark attachments as featured
- Add callouts
- Remove callouts
- Mark callouts as featured

All write/delete API routes require the signed admin cookie.

## Data

The app creates a Netlify Blobs site-wide store named:

`codm-attachments`

It stores two JSON objects:

- `attachments`
- `callouts`

Data persists across new deployments because this is a site-wide Netlify Blobs store.

## Local development

Install dependencies:

`npm install`

Install Netlify CLI if needed:

`npm install`

Set environment variables in your shell, then:

`npx netlify dev`

The Netlify CLI provides a local environment for Functions and other Netlify features.

## Important security notes

Use HTTPS in production, which Netlify provides for deployed sites.

Use a strong random `SESSION_SECRET`.

Use a strong unique `ADMIN_PASSWORD`.

For a larger application with many concurrent writes, advanced filtering, relationships, or thousands/millions of records, use a relational database rather than storing the entire collection as one JSON blob.
