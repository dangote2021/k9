# K9 — Templates email Supabase Auth (FR + EN)

Les emails par défaut de Supabase sont génériques et donnent zéro envie
("Confirm your signup. Follow this link to confirm your user.").
Ces templates K9 sont chaleureux, orientés "compagnon de poils", avec
un wording qui donne envie d'ouvrir l'app immédiatement.

> ⚠️ **Auth est partagé avec ravito.**
> Et K9 est bilingue (FR/EN) → un anglophone doit recevoir l'email en EN.
>
> Stratégie de routing dans chaque template :
> 1. Si `{{ .RedirectTo }}` ne contient PAS `k9-one` → template **ravito** (existant)
> 2. Sinon, si `{{ .RedirectTo }}` contient `lang=en` → template **K9 EN**
> 3. Sinon → template **K9 FR** (par défaut)
>
> Le client K9 ajoute automatiquement `?lang=fr` ou `?lang=en` dans le
> `emailRedirectTo` selon la langue active de l'app (cf. `K9Auth.signIn()`
> dans `index.html`).
>
> Avant de coller ces templates, **copie le HTML ravito existant** et
> remplace les `<!-- TEMPLATE RAVITO ICI -->` ci-dessous par le HTML actuel.

---

## Où coller les templates

Dashboard `ravito` → **Authentication** → **Emails** → onglet **Templates**.

Pour chaque template, tu peux modifier :
- **Subject** (l'objet de l'email — c'est lui qui fait ouvrir)
- **Message body** (le HTML)

**⚠️ IMPORTANT pour le subject** : Supabase ne supporte pas le templating
conditionnel dans le subject. Donc on garde un sujet bilingue mixte
(`🐾 Ton lien magique K9 / Your K9 magic link`) qui fonctionne pour les
deux langues. Alternative plus propre : voir section "SMTP custom" en
fin de doc — avec Resend tu peux router le subject par langue côté API.

Une fois collés → **Save**. Pas besoin de redéployer ; les emails suivants
prennent les nouveaux templates immédiatement.

---

## 1. Magic Link (le plus important — ☆☆☆☆☆)

C'est l'email envoyé quand un utilisateur K9 active "Activer le cloud".
**Variables Supabase** : `{{ .ConfirmationURL }}`, `{{ .Token }}`,
`{{ .Email }}`, `{{ .RedirectTo }}`.

### Subject (bilingue par défaut)

```
🐾 Ton lien magique K9 / Your K9 magic link (1h)
```

> Astuce : l'emoji 🐾 dans l'objet booste de ~15-20% l'open rate sur Gmail
> mobile. Le mix FR/EN reste lisible. Si tu actives un SMTP custom (Resend),
> tu pourras router le subject par langue côté API.

### Message body (HTML)

```html
{{ if (contains .RedirectTo "k9-one") }}
{{ if (contains .RedirectTo "lang=en") }}
<!-- ============== TEMPLATE K9 — EN ============== -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 20px rgba(244,162,97,0.12);" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
                <div style="font-size:48px; line-height:1;">🐾</div>
                <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800; letter-spacing:-0.3px;">
                  Welcome to K9
                </h1>
                <p style="margin:6px 0 0 0; color:rgba(255,255,255,0.92); font-size:14px;">
                  The app for dog companions
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 24px 28px;">
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.5;">
                  Hi 👋
                </p>
                <p style="margin:0 0 22px 0; font-size:16px; line-height:1.55;">
                  Here's your magic link to enter K9. <strong>One click and you're in</strong> — no password to remember, no form to fill out.
                </p>
                <p style="margin:0 0 28px 0; text-align:center;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px; box-shadow:0 4px 14px rgba(231,111,81,0.35);">
                    🦴 Open K9
                  </a>
                </p>
                <p style="margin:0 0 8px 0; font-size:13px; color:#7a7570; text-align:center;">
                  Link valid for 1 hour.
                </p>
                <hr style="border:none; border-top:1px solid #f0e6db; margin:28px 0 22px 0;" />
                <p style="margin:0 0 12px 0; font-size:15px; line-height:1.55; color:#4a4540;">
                  Once signed in, you'll be able to:
                </p>
                <ul style="margin:0 0 0 0; padding:0 0 0 20px; font-size:14px; line-height:1.7; color:#4a4540;">
                  <li>📱 <strong>Sync</strong> your dog across all your devices</li>
                  <li>📸 <strong>Scan their health record</strong> with AI</li>
                  <li>🩺 <strong>Share</strong> their file with your vet via 1 link</li>
                  <li>🐶 <strong>Find a lost dog</strong> near you</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td style="background:#fff8f0; padding:20px 28px; border-top:1px solid #f0e6db;">
                <p style="margin:0; font-size:12px; color:#9a948e; line-height:1.5;">
                  Didn't request this link? You can ignore this email — nobody can access your account without clicking it.
                </p>
                <p style="margin:12px 0 0 0; font-size:12px; color:#9a948e; line-height:1.5;">
                  — The K9 team 🐾<br/>
                  <a href="https://k9-one.vercel.app" style="color:#e76f51; text-decoration:none;">k9-one.vercel.app</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
{{ else }}
<!-- ============== TEMPLATE K9 — FR (défaut) ============== -->
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 20px rgba(244,162,97,0.12);" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
                <div style="font-size:48px; line-height:1;">🐾</div>
                <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800; letter-spacing:-0.3px;">
                  Bienvenue chez K9
                </h1>
                <p style="margin:6px 0 0 0; color:rgba(255,255,255,0.92); font-size:14px;">
                  L'app pour les compagnons de chiens
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 24px 28px;">
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.5;">
                  Salut 👋
                </p>
                <p style="margin:0 0 22px 0; font-size:16px; line-height:1.55;">
                  Voici ton lien magique pour entrer dans K9. <strong>Un clic et c'est bon</strong> — pas de mot de passe à retenir, pas de formulaire à remplir.
                </p>
                <p style="margin:0 0 28px 0; text-align:center;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px; box-shadow:0 4px 14px rgba(231,111,81,0.35);">
                    🦴 Ouvrir K9
                  </a>
                </p>
                <p style="margin:0 0 8px 0; font-size:13px; color:#7a7570; text-align:center;">
                  Lien valide pendant 1 heure.
                </p>
                <hr style="border:none; border-top:1px solid #f0e6db; margin:28px 0 22px 0;" />
                <p style="margin:0 0 12px 0; font-size:15px; line-height:1.55; color:#4a4540;">
                  Une fois connecté, tu pourras :
                </p>
                <ul style="margin:0 0 0 0; padding:0 0 0 20px; font-size:14px; line-height:1.7; color:#4a4540;">
                  <li>📱 <strong>Synchroniser</strong> ton chien sur tous tes appareils</li>
                  <li>📸 <strong>Scanner son carnet de santé</strong> avec l'IA</li>
                  <li>🩺 <strong>Partager</strong> son dossier avec ton véto en 1 lien</li>
                  <li>🐶 <strong>Retrouver un chien perdu</strong> près de chez toi</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td style="background:#fff8f0; padding:20px 28px; border-top:1px solid #f0e6db;">
                <p style="margin:0; font-size:12px; color:#9a948e; line-height:1.5;">
                  Tu n'as pas demandé ce lien ? Tu peux ignorer cet email — personne ne pourra accéder à ton compte sans cliquer dessus.
                </p>
                <p style="margin:12px 0 0 0; font-size:12px; color:#9a948e; line-height:1.5;">
                  — L'équipe K9 🐾<br/>
                  <a href="https://k9-one.vercel.app" style="color:#e76f51; text-decoration:none;">k9-one.vercel.app</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
{{ end }}
{{ else }}
<!-- ============== TEMPLATE RAVITO (existant) ============== -->
<!-- TEMPLATE RAVITO ICI : copier-coller le HTML actuel du dashboard avant modification -->
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
{{ end }}
```

---

## 2. Confirm signup

K9 ne devrait jamais déclencher celui-ci (full magic link), mais
au cas où.

### Subject

```
🐾 Confirme ton inscription K9 / Confirm your K9 signup
```

### Message body (HTML)

```html
{{ if (contains .RedirectTo "k9-one") }}
{{ if (contains .RedirectTo "lang=en") }}
<!-- K9 EN -->
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 20px rgba(244,162,97,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
              <div style="font-size:48px;">🐶</div>
              <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800;">One more click!</h1>
              <p style="margin:6px 0 0 0; color:rgba(255,255,255,0.92); font-size:14px;">Confirm your email to activate your K9 account</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 18px 0; font-size:16px; line-height:1.55;">
                Hey 👋, your dog is going to love this — you just signed up on K9.
              </p>
              <p style="margin:0 0 28px 0; font-size:16px; line-height:1.55;">
                We just need to verify this email is yours. One click on the button and we're done.
              </p>
              <p style="margin:0 0 24px 0; text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px;">
                  ✓ Confirm my email
                </a>
              </p>
              <p style="margin:0; font-size:13px; color:#7a7570; text-align:center;">
                Link valid 24h. If this wasn't you, just ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fff8f0; padding:20px 28px; border-top:1px solid #f0e6db; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9a948e;">— The K9 team 🐾</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
{{ else }}
<!-- K9 FR -->
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 20px rgba(244,162,97,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
              <div style="font-size:48px;">🐶</div>
              <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800;">Plus qu'un clic !</h1>
              <p style="margin:6px 0 0 0; color:rgba(255,255,255,0.92); font-size:14px;">Confirme ton email pour activer ton compte K9</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 18px 0; font-size:16px; line-height:1.55;">
                Hello 👋, ton chien va être ravi : tu viens de t'inscrire sur K9.
              </p>
              <p style="margin:0 0 28px 0; font-size:16px; line-height:1.55;">
                On a juste besoin de vérifier que cette adresse email est bien la tienne. Un clic sur le bouton et c'est réglé.
              </p>
              <p style="margin:0 0 24px 0; text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px;">
                  ✓ Confirmer mon email
                </a>
              </p>
              <p style="margin:0; font-size:13px; color:#7a7570; text-align:center;">
                Lien valide 24h. Si ce n'est pas toi, ignore simplement cet email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fff8f0; padding:20px 28px; border-top:1px solid #f0e6db; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9a948e;">— L'équipe K9 🐾</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
{{ end }}
{{ else }}
<!-- TEMPLATE RAVITO ICI : copier-coller l'existant -->
{{ end }}
```

---

## 3. Reset password

### Subject

```
🐾 Nouveau mot de passe K9 / Reset your K9 password
```

### Message body (HTML)

```html
{{ if (contains .RedirectTo "k9-one") }}
{{ if (contains .RedirectTo "lang=en") }}
<!-- K9 EN -->
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 20px rgba(244,162,97,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
              <div style="font-size:48px;">🔑</div>
              <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800;">Reset your password</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.55;">
                You requested a password reset for your K9 account. Click here:
              </p>
              <p style="margin:0 0 24px 0; text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px;">
                  Choose a new password
                </a>
              </p>
              <p style="margin:0; font-size:13px; color:#7a7570; text-align:center;">
                Link valid 1h. If this wasn't you, ignore this email — your current password remains valid.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fff8f0; padding:20px 28px; border-top:1px solid #f0e6db; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9a948e;">— The K9 team 🐾</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
{{ else }}
<!-- K9 FR -->
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 20px rgba(244,162,97,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
              <div style="font-size:48px;">🔑</div>
              <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800;">On change le mot de passe</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.55;">
                Tu as demandé à réinitialiser ton mot de passe K9. C'est par ici :
              </p>
              <p style="margin:0 0 24px 0; text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px;">
                  Choisir un nouveau mot de passe
                </a>
              </p>
              <p style="margin:0; font-size:13px; color:#7a7570; text-align:center;">
                Lien valide 1h. Si ce n'est pas toi, ignore cet email — ton mot de passe actuel reste valable.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fff8f0; padding:20px 28px; border-top:1px solid #f0e6db; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9a948e;">— L'équipe K9 🐾</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
{{ end }}
{{ else }}
<!-- TEMPLATE RAVITO ICI -->
{{ end }}
```

---

## 4. Change email address

### Subject

```
🐾 Confirme ta nouvelle adresse K9 / Confirm your new K9 email
```

### Message body (HTML)

```html
{{ if (contains .RedirectTo "k9-one") }}
{{ if (contains .RedirectTo "lang=en") }}
<!-- K9 EN -->
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 20px rgba(244,162,97,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
              <div style="font-size:48px;">✉️</div>
              <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800;">New email address</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.55;">
                You want to use <strong>{{ .NewEmail }}</strong> for your K9 account. Confirm this address by clicking here:
              </p>
              <p style="margin:0 0 24px 0; text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px;">
                  Confirm change
                </a>
              </p>
              <p style="margin:0; font-size:13px; color:#7a7570; text-align:center;">
                If this wasn't you, ignore this email and change your password as a precaution.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fff8f0; padding:20px 28px; border-top:1px solid #f0e6db; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9a948e;">— The K9 team 🐾</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
{{ else }}
<!-- K9 FR -->
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 20px rgba(244,162,97,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
              <div style="font-size:48px;">✉️</div>
              <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800;">Nouvelle adresse</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.55;">
                Tu veux utiliser <strong>{{ .NewEmail }}</strong> pour ton compte K9. Confirme cette adresse en cliquant ici :
              </p>
              <p style="margin:0 0 24px 0; text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px;">
                  Confirmer le changement
                </a>
              </p>
              <p style="margin:0; font-size:13px; color:#7a7570; text-align:center;">
                Si ce n'est pas toi, ignore cet email et change ton mot de passe par sécurité.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fff8f0; padding:20px 28px; border-top:1px solid #f0e6db; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9a948e;">— L'équipe K9 🐾</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
{{ end }}
{{ else }}
<!-- TEMPLATE RAVITO ICI -->
{{ end }}
```

---

## 5. Invite user

### Subject

```
🐾 K9 t'invite à rejoindre / You're invited to K9
```

```html
{{ if (contains .RedirectTo "k9-one") }}
{{ if (contains .RedirectTo "lang=en") }}
<!-- K9 EN -->
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
              <div style="font-size:48px;">🎉</div>
              <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800;">You're invited to K9</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.55;">
                Someone thinks you'll like K9. It's the app for dog companions: vet records, reminders, walks, community.
              </p>
              <p style="margin:0 0 24px 0; text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px;">
                  🦴 Accept invitation
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
{{ else }}
<!-- K9 FR -->
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0; padding:0; background:#fff8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#2e2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0; padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" style="max-width:520px; background:#ffffff; border-radius:18px; overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg, #f4a261 0%, #e76f51 100%); padding:32px 24px; text-align:center;">
              <div style="font-size:48px;">🎉</div>
              <h1 style="margin:12px 0 0 0; color:#fff; font-size:24px; font-weight:800;">Tu es invité sur K9</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 22px 0; font-size:16px; line-height:1.55;">
                Quelqu'un pense que K9 va te plaire. C'est l'app pour les compagnons de chiens : carnet véto, rappels, balades, communauté.
              </p>
              <p style="margin:0 0 24px 0; text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; background:#e76f51; color:#fff; text-decoration:none; padding:16px 36px; border-radius:999px; font-weight:700; font-size:16px;">
                  🦴 Accepter l'invitation
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
{{ end }}
{{ else }}
<!-- TEMPLATE RAVITO ICI -->
{{ end }}
```

---

## Comment marche le routing FR/EN

Le client K9 (`K9Auth.signIn()` dans `index.html`) lit la variable `currentLang`
(qui est synchronisée avec le sélecteur de langue côté UI) et l'injecte dans
le `redirectTo` :

```javascript
const lang = (currentLang === "en") ? "en" : "fr";
const redirectTo = window.location.origin + "/?lang=" + lang;
```

Côté template Supabase, la cascade conditionnelle prend la décision :

```
{{ if (contains .RedirectTo "k9-one") }}
  {{ if (contains .RedirectTo "lang=en") }}
    [HTML EN]
  {{ else }}
    [HTML FR]   ← défaut K9 si lang=fr ou si lang absent
  {{ end }}
{{ else }}
  [HTML RAVITO]
{{ end }}
```

C'est entièrement basé sur l'URL → pas besoin de variables custom côté
Supabase Auth. Robuste et simple à debugger.

---

## Tester avant de déployer

1. Dashboard `ravito` → **Authentication** → **Emails** → **Templates** →
   coller chaque template + sauvegarder
2. Côté K9 :
   - Bascule l'app en **Français**, ouvre **Réglages → Activer le cloud**,
     entre ton email → email reçu doit être en FR
   - Logout
   - Bascule l'app en **English**, refais le flow → email doit être en EN
3. Côté ravito : faire un login pour vérifier qu'on a toujours le template
   ravito (pas K9)

---

## Domaine d'envoi (optionnel mais recommandé)

Par défaut, les emails partent de `noreply@mail.app.supabase.io`, ce qui :
- Fait souvent atterrir en spam (Gmail, Outlook)
- N'inspire pas confiance

**Solution propre** : configurer un SMTP custom (Resend, Postmark, SendGrid).

Dashboard `ravito` → **Authentication** → **Emails** → **SMTP Settings** :
```
Sender email:    rappels@k9.app  (ou noreply@k9-one.vercel.app)
Sender name:     K9
Host:            smtp.resend.com
Port:            465
Username:        resend
Password:        re_...  (ta RESEND_API_KEY)
```

Bonus : tu réutilises ta `RESEND_API_KEY` déjà configurée pour
`/api/cron-reminders`. Une seule clé pour tous les emails K9.

⚠️ Comme Auth est partagé avec ravito, ce SMTP serait utilisé par
ravito aussi. À aligner avec ravito ou attendre la migration K9 sur
son propre projet Supabase.
