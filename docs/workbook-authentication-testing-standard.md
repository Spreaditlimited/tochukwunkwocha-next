# Workbook Authentication Testing Standard

This standard applies to every Prompt to Profit™ workbook that uses Supabase
Authentication.

## Permanent rule

Learners may create and edit their project files in Notepad, but they must test
the complete authentication flow on a deployed HTTPS website. Authentication
must not be tested by double-clicking HTML files and opening them with a
`file://` address.

## Required build-prompt instructions

The registration prompt must require the complete `register.js` file to:

- pass `emailRedirectTo` to `supabaseClient.auth.signUp`;
- build that destination from `window.location.origin`;
- send the learner back to `login.html`; and
- avoid hardcoding a Netlify subdomain.

## Required test preparation

Before testing registration, the learner must:

1. save every complete file;
2. deploy the complete project folder to Netlify;
3. copy the Netlify HTTPS address;
4. set that address as the Supabase Authentication Site URL;
5. add the complete deployed `login.html` address to Redirect URLs; and
6. open every authentication page from the deployed HTTPS website.

## Required authentication checks

Every authentication chapter must test:

- registration with a new email address;
- receipt of the verification email;
- return from the verification link to the correct deployed website;
- successful and unsuccessful login;
- session persistence after a protected page is refreshed;
- logout;
- rejection of a signed-out visitor from every protected page; and
- redirection of an already signed-in user away from the login page.

The workbook must explain that the verification return may briefly show the
login page or may continue to the dashboard when Supabase restores the new
session. The important result is that the browser returns to the correct HTTPS
website and the learner can reach the protected application.

## Publication requirement

The shared workbook builder validates these requirements. A workbook with an
authentication chapter must not be published if the chapter omits the hosted
test website, Supabase URL Configuration, or the explicit email redirect.
