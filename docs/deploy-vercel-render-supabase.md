# Deploy: Vercel + Render + Supabase

This project deploys as three services:

```text
Vercel (Next.js) -> Render (NestJS API) -> Supabase (PostgreSQL)
```

## 1. Create the Supabase database

1. Create a Supabase project in the region closest to your users.
2. In **Connect**, copy the PostgreSQL connection string for server applications.
3. In Render, set that value as `DATABASE_URL`.

Do not expose `DATABASE_URL` or any Supabase service key in Vercel's browser-visible variables.

## 2. Deploy the API on Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository. Render reads `render.yaml` and creates the `wholesalex-api` service.
3. Add the values marked `sync: false` in the Render environment-variable screen:

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL server connection string |
| `FRONTEND_URL` | Vercel site URL, for example `https://shop.example.com` |
| `ADMIN_URL` | Same Vercel URL unless the admin is deployed separately |
| `PUBLIC_API_URL` | Render API URL, for example `https://wholesalex-api.onrender.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials, if Google sign-in is enabled |
| `GOOGLE_CALLBACK_URL` | `https://wholesalex-api.onrender.com/api/v1/auth/google/callback` |
| SMTP and payment-gateway variables | Only for the providers you enable |

The Docker image runs `prisma migrate deploy` before the API starts. It does **not** seed demo data. For a brand-new database, run the seed locally once with the production `DATABASE_URL`, or add production catalog data through the admin UI.

## 3. Deploy the frontend on Vercel

1. Import the same GitHub repository into Vercel with the root directory set to the repository root.
2. Set these Vercel environment variables for **Production** and redeploy:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Render origin only, for example `https://wholesalex-api.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | Public frontend URL, for example `https://shop.example.com` |

`NEXT_PUBLIC_API_URL` is used at build time by `next.config.mjs` to proxy browser requests from `/api/*` to Render's `/api/v1/*` endpoint. Do not include `/api/v1` at the end of this variable.

## 4. Complete external-provider configuration

- Add the Render callback URL to Google OAuth's authorized redirect URIs.
- Replace payment-provider webhook/callback URLs with the Render API URL.
- Point the Hostinger-managed domain DNS records to Vercel, then set the final custom domain in Vercel.
- After the final Vercel domain exists, update Render's `FRONTEND_URL` and redeploy it.

## Free-tier limits to plan around

- Render Free spins the API down after 15 minutes without traffic; the next API request can take about a minute.
- Render Free has an ephemeral filesystem. Product, banner, setting, and bulk-order uploads written to `apps/backend/uploads` disappear on a restart or spin-down. Do not rely on in-app uploads until an object-storage provider is configured. Remote image URLs and catalog data in Supabase are unaffected.
- Supabase Free pauses only after a week with no activity. Keep a database export before making production changes.
- Vercel Hobby is suitable for testing. Upgrade to Vercel Pro for commercial usage; upgrade Render to Starter to keep the API always on.

## Smoke test

After both deployments finish, verify:

1. `https://<render-api>/` returns API status JSON.
2. `https://<render-api>/api/docs` opens Swagger.
3. The Vercel site loads products and categories.
4. Register, log in, and place a test COD order.
