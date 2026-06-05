/* ============================================
   TAKGIO — Google Analytics 4
   --------------------------------------------
   SETUP (one-time, ~2 min):
   1. Go to https://analytics.google.com → Admin → Create Property (or use existing)
   2. Create a Web data stream for https://www.takgio.com
   3. Copy the Measurement ID (looks like G-XXXXXXXXXX)
   4. Paste it into MEASUREMENT_ID below and commit.

   Until a real ID is set, analytics stays OFF (no script loads, no errors).
   ============================================ */
(function () {
  var MEASUREMENT_ID = 'G-SGJ5VGGZQD'; // GA4 property "TAKGIO Website" (owned by info@takgio.com)

  // Not configured yet — do nothing so the site never logs phantom traffic or errors.
  if (!MEASUREMENT_ID || MEASUREMENT_ID === 'G-XXXXXXXXXX') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);
})();
