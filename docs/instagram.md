# Instagram strip

The band shows real posts from
[@shrinkless](https://www.instagram.com/shrinkless/) — high on the homepage,
above New arrivals; last before the footer on every other page. It needs one environment
variable. Without it the band renders as a plain invitation to follow, which is
the deliberate fallback — it never shows stock photography dressed up as posts.

```
INSTAGRAM_ACCESS_TOKEN="IGAA..."
```

## Why a token is unavoidable

There is no public way to read a profile's grid. Instagram stopped serving
media to unauthenticated requests, and the public oEmbed endpoint has needed an
app token since 2020. Fetching `instagram.com/shrinkless` returns the bio, the
follower count and no posts at all — this was measured, not assumed.

So the only routes are a token, or pasting post URLs in by hand. The code takes
the token.

## Getting the token

Fifteen minutes, all on Meta's side. **You have to do steps 1–4** — they need
the Instagram account password and a Meta developer login, neither of which
belongs in a repository.

1. **Make the account Professional.** Instagram app → Settings and privacy →
   Account type and tools → Switch to professional account. Creator is fine;
   Business is fine. A personal account cannot issue a token at all.

2. **Create a Meta app.** [developers.facebook.com/apps](https://developers.facebook.com/apps)
   → Create app → use case **"Other"** → type **Business** → give it a name.

3. **Add the Instagram product.** In the app dashboard, find **Instagram** in
   the product list and click Set up. Choose **API setup with Instagram
   login**.

4. **Generate the token.** In that same panel, step 1 is "Generate access
   tokens". Click **Add account**, log into the Shrinkless Instagram account,
   and grant access. Meta hands back a long-lived user access token — a long
   string starting `IGAA`. Copy it.

   The scope you need is `instagram_business_basic`. It is included by default;
   nothing needs submitting for App Review, because reading your own account's
   media does not require it.

5. **Give it to the app.** Two places:

   ```bash
   # locally
   echo 'INSTAGRAM_ACCESS_TOKEN="IGAA..."' >> .env.local

   # and on Vercel, for Production and Preview
   vercel env add INSTAGRAM_ACCESS_TOKEN production
   vercel env add INSTAGRAM_ACCESS_TOKEN preview
   ```

   Or paste it into Vercel → Project → Settings → Environment Variables. Then
   redeploy — environment variables are read at build and request time, and an
   existing deployment will not pick it up on its own.

That is the whole job. No code changes: `lib/brand/instagram.ts` reads the
variable, and the component renders posts the moment there are posts to render.

## Expiry

Long-lived tokens last **60 days**. `refreshInstagramToken()` in
`lib/brand/instagram.ts` exchanges one for a fresh 60 days, and Meta allows the
exchange any time after the token is 24 hours old.

Nothing calls it on a schedule yet. Until something does, the strip will quietly
fall back to the follow band roughly two months after the token is issued, and
the fix is to generate a new one from the same panel. Wiring a cron route to
call the refresh — and to write the result back — is the obvious next step and
is deliberately not done here, because it needs somewhere to persist the new
token that is not an environment variable.

## What is cached

Posts are fetched server-side with `revalidate: 3600`, so at most one call to
Meta per hour per region, and a new post appears within the hour. A failure of
any kind — no token, revoked token, Meta outage — returns an empty list rather
than throwing, because a footer strip is not worth a 500 on every page of the
store.

## Checking it works

```bash
curl -s "https://graph.instagram.com/v23.0/me/media?fields=id,permalink&limit=3&access_token=$INSTAGRAM_ACCESS_TOKEN"
```

A JSON array of posts means the token is good. An `error` object with code 190
means it has expired or been revoked; generate a new one.
