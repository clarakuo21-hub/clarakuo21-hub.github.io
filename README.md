# Wedding Invitation (static site)

This is a simple, single-page wedding invitation you can host with GitHub Pages.

How to use
1. Replace placeholder text (names, date, venue) in `index.html`.
2. Put your photos in `assets/` (create the folder). Update image filenames in `index.html`.
3. Configure the RSVP form:
   - Option A (static, easy): Use Formspree
     - Create a form at https://formspree.io/ and get the form ID (e.g. `f/abcd1234`).
     - Replace the `action="https://formspree.io/f/YOUR_FORMSPREE_ID"` in `index.html`.
   - Option B: Use Google Forms — embed the Google Form instead of the HTML form.
   - Option C: Netlify Forms (if you deploy to Netlify).
4. Commit files to the repository root (or to a folder) and push.

Deploy on GitHub Pages
- Enable GitHub Pages in repository Settings → Pages.
- Choose branch `main` (or whichever branch) and folder `/ (root)` and save.
- Wait a few minutes — your site will be available at `https://<your-username>.github.io/<repo>/` or at your custom domain.

Customization ideas
- Swap fonts/colors in `css/styles.css`.
- Add a printable wedding card layout (CSS print stylesheet).
- Generate a social preview image (Open Graph meta tags) and add it to the root.

If you want, I can:
- Customize the template to match your wedding colors and wording.
- Create a dedicated RSVP backend (Google Sheets, Netlify Functions, or GitHub Actions) and show you how to store responses.
- Create a printable PDF invite.
- Generate a simple shareable image for social media.

Enjoy — congratulations!