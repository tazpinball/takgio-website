// Mobile nav toggle + active page highlight
(function () {
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('is-open');
    });

    // Close nav when a link is clicked (mobile)
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
      });
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
