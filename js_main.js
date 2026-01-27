// Simple client-side enhancement for the RSVP form.
// If you're using Formspree, the form will POST to their endpoint directly.
// This script shows a modest on-submit success state without page reload.

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    // If you rely on Formspree, allow the default submit to proceed (no JS).
    // But we'll intercept if action contains "formspree.io/f/" to demo a fetch submission.
    const action = form.action || '';
    if (!action.includes('formspree.io/f/')) return;

    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      });

      if (res.ok) {
        form.innerHTML = '<p>Thank you — your RSVP has been sent. We look forward to celebrating with you!</p>';
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }
    } catch (err) {
      console.error(err);
      alert('Sorry, something went wrong. You can also email us at claraandalex@example.com');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send RSVP';
    }
  });
});