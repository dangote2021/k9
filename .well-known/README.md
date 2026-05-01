# /.well-known/ — Domain verification files

This directory contains files served by Vercel at well-known URIs for
domain verification (Android Trusted Web Activity, iOS Universal Links, etc.).

## Files

### `assetlinks.json` — Android TWA verification

Once you generate the Android `.aab` package via PWABuilder, you'll
receive a fingerprint hash. Replace `REPLACE_WITH_PWABUILDER_FINGERPRINT_AT_LAUNCH`
in `assetlinks.json` with the actual SHA256 fingerprint from the signing key.

The file format is documented at:
https://developer.android.com/training/app-links/verify-android-applinks

After replacement, push the change. Vercel will serve it at
`https://k9-one.vercel.app/.well-known/assetlinks.json` automatically.

You can verify it works by visiting that URL after the deploy.

## Testing the Android TWA verification

Once the app is on Google Play and the fingerprint is correct, you can verify
the Digital Asset Links with Google's tool:
https://developers.google.com/digital-asset-links/tools/generator

Enter:
- Hosting site: `https://k9-one.vercel.app`
- App package name: `app.k9.companion` (or whatever you used in PWABuilder)
- App package fingerprint: the SHA256 fingerprint from your signing key
