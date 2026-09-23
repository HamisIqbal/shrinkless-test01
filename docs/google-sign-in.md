# Google sign-in

The "Continue with Google" button on `/login` and `/register` appears only once
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set. The same button signs in and
signs up: the first visit makes the account, and a Google address that already
has a password account lands in that account.

Admin accounts cannot sign in with Google; they keep their password.

## Setting it up

1. Open <https://console.cloud.google.com/>, and create or pick a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the
   app name (Shrinkless), support email and logo, and add the scopes
   `openid`, `email` and `profile`. Then **Publish app** so that anyone can sign
   in, not only test users.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: *Web application*
   - Authorised JavaScript origins: `https://<your-domain>` and
     `http://localhost:3000`
   - Authorised redirect URIs:
     - `https://<your-domain>/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`

     Add the `*.vercel.app` address too if you sign in on it.
4. Copy the client ID and secret into:
   - `.env.local`, for local development
   - Vercel → Project → Settings → Environment Variables (Production and
     Preview), then redeploy

   ```
   AUTH_GOOGLE_ID="…apps.googleusercontent.com"
   AUTH_GOOGLE_SECRET="GOCSPX-…"
   ```
