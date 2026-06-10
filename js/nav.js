// Mobile nav toggle + active page highlight
(function () {
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    // Close nav when a link is clicked (mobile)
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setOpen(false);
      });
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // Highlight current page in nav
  var path = window.location.pathname.replace(/\/$/, '') || '/';
  var links = document.querySelectorAll('.site-nav a');
  links.forEach(function (link) {
    var href = link.getAttribute('href').replace(/\/$/, '') || '/';
    if (path === href || (path.endsWith(href) && href !== '/')) {
      link.classList.add('active');
    }
  });
})();
