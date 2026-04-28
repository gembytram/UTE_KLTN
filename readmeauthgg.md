# 🔐 Google OAuth Local Setup Guide

Follow these steps to configure Google OAuth for local development.

## 1. Set Environment Variables

Run the following commands in **Command Prompt (CMD)**:

```bat
setx GOOGLE_CLIENT_ID "your_client_id_here"
setx GOOGLE_CLIENT_SECRET "your_client_secret_here"
setx GOOGLE_REDIRECT_URI "http://127.0.0.1:5000"
```



---

## 2. Restart Terminal

After running `setx`, close the current terminal and open a new one so the environment variables take effect.

---

## 3. Configure Redirect URI in Google Console

In Google Cloud Console, add the following redirect URI to your OAuth Client:

```
http://127.0.0.1:5000/api/auth/google/callback
```

If you encounter the error:

```
redirect_uri_mismatch
```

→ It means the redirect URI in your backend does not match the one configured in Google.

---

## 4. Notes

* Ensure the redirect URI matches **exactly** (including path and port).
* Never expose secrets in source code or documentation.
* Use `.env` file for local development (recommended).

---

## 5. Example `.env` (recommended)

Create a `.env` file (not committed to git):

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://127.0.0.1:5000
```

Add `.env` to `.gitignore`:

```
.env
```
