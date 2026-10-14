# Impact Team Board

A Vite + React task board for posting team work, assigning an owner, setting a due date and priority, and tracking progress.

## Run locally

```sh
npm install
npm run dev
```

## Deployment status

The app is wired to Neon Managed Better Auth and the Neon Data API. It uses shared Neon task storage, team profiles, completion attribution, and an admin-only account-creation flow. It shows a connection setup screen until the Neon endpoint URLs are configured. Live database behavior cannot be verified until you create/configure your Neon project.

## Deploy the current app to Vercel

The GitHub repository is `SlayerK15/ImpactNoticeBoard`, and its production branch is `main`.

1. Sign in to [Vercel](https://vercel.com/) with GitHub and authorize access to the repository.
2. Choose **Add New Project**, then import `SlayerK15/ImpactNoticeBoard`.
3. Use the project root and the Vite defaults:
	- Framework preset: **Vite**
	- Build command: `npm run build`
	- Output directory: `dist`
	- Install command: `npm install`
4. Follow **Connect Neon to the app** below and add the two Neon endpoint URLs in Vercel. If you deploy before doing this, the site will show its connection setup screen instead of the sign-in page.
5. Select **Deploy**. Vercel will build the app and provide a `vercel.app` URL.

Pushes to `main` will trigger production deployments. Pull requests can get Vercel preview deployments. No `vercel.json` is required for this app.

## Create or connect a Neon project

Choose one route:

- **Create Neon through Vercel:** In the Vercel project, open **Storage** or the Marketplace, choose Neon Postgres, and follow the prompts. This is convenient if you want to manage the integration through Vercel.
- **Connect an existing Neon project:** Follow [Neon's Vercel integration guide](https://neon.com/docs/guides/vercel) and choose the Neon-managed integration to keep Neon billing in your Neon account.

Create the Neon project in a region close to your Vercel deployment. This app uses Neon Managed Better Auth and Neon Data API, so it does not need a Postgres connection string in the browser. The two `VITE_NEON_*` values below are endpoint URLs, not database credentials.

## Connect Neon to the app

1. In Neon, open the project and enable **Managed Better Auth**. Copy its Auth URL.
2. Open **Postgres database → Data API**, enable the Data API for the database and branch, and select **Use Neon Auth** as the authentication provider. Copy the Data API URL.
3. Run [`db/schema.sql`](db/schema.sql) in the Neon SQL Editor for the same database and branch. This creates team profiles and shared tasks, enables RLS, and records who created/completed each task.
4. Add the two endpoint URLs to Vercel under **Project → Settings → Environment Variables**:
	- `VITE_NEON_AUTH_URL`: the Auth URL from step 1
	- `VITE_NEON_DATA_API_URL`: the Data API URL from step 2
	Set them for Production and Preview, then redeploy.
5. For local development, copy `.env.example` to `.env.local`, paste the same URLs, then restart `npm run dev`. `.env.local` is ignored by Git.
6. In Neon Auth, add the local origin `http://localhost:5173` and the deployed Vercel origin (for example, `https://your-project.vercel.app`) to trusted origins.

## Create the first administrator

Neon requires an initial account before it can be promoted to admin:

1. Use the Auth API reference at `<your-auth-url>/reference` to create your own first account with `POST /sign-up/email`.
2. In the Neon Console, open **Auth → Users** and promote that account to **admin**.
3. In the SQL Editor, add that admin to the invite table so their first sign-in can join the board:

	```sql
	INSERT INTO public.team_invites (user_id, email)
	SELECT id, email
	FROM neon_auth."user"
	WHERE lower(email) = lower('you@example.com') AND role = 'admin'
	ON CONFLICT (user_id) DO NOTHING;
	```

4. Sign in to the deployed app. Admins will see **Add teammate** and can create member accounts. Have each new member sign in once so their profile is added to the assignee list.

The app has no public sign-up screen. More importantly, RLS only grants board access to a user ID that an admin has invited; an uninvited account cannot read or change team profiles or tasks, even if it is created through the Auth endpoint.

New tasks, assignments, status changes, and completion attribution are stored in Neon and visible to signed-in team members. The database trigger stamps the completing user's ID when a task is marked done; reopening a task clears its completion record. The app provides a manual refresh button for changes made by other team members.

If browser sign-in fails, check the Neon Auth trusted origins and the exact endpoint URLs. Neon Managed Auth relies on browser cookies; Safari privacy settings can block third-party cookies when the app and Auth are on unrelated domains. See [Neon's Auth cross-domain notes](https://neon.com/docs/auth/guides/plugins/jwt#retrieve-a-token).

Never put a Postgres connection string, Neon API key, or service credential in a `VITE_*` variable. Only the public Auth and Data API endpoint URLs belong in the Vite environment.
