# Impact Team Board

A Vite + React task board for posting team work, assigning an owner, setting a due date and priority, and tracking progress.

## Run locally

```sh
npm install
npm run dev
```

The current preview saves tasks in the browser's `localStorage`. It is useful for trying the workflow, but data is not shared between teammates or devices.

## Deploy a preview to Vercel

1. Push this project to a GitHub, GitLab, or Bitbucket repository.
2. In Vercel, choose **Add New Project** and import that repository.
3. Keep the detected Vite settings: build command `npm run build`, output directory `dist`.
4. Deploy. Vercel will build and publish the site on each push to the connected branch.

No `vercel.json` is needed for this single-page Vite app. The deployed preview still uses browser-local storage. To make posts visible to all team members, connect a shared database and authentication service (for example, Supabase) before treating it as the live team board.
