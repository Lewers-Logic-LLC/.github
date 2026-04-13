/* ============================================================
   Lewers Logic LLC — Landing Page JavaScript
   Wrap in <script> tags in a Custom HTML block at the bottom
   of the landing page in WordPress.
   ============================================================ */

(function () {
  'use strict';

  /* ── Mobile Navigation Toggle ─────────────────────────────── */
  var toggle = document.getElementById('llMobileToggle');
  var navLinks = document.getElementById('llNavLinks');

  if (toggle && navLinks) {
    toggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('open');
      toggle.classList.toggle('active');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close menu when a nav link is clicked
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── Smooth Scroll for Anchor Links ───────────────────────── */
  document.querySelectorAll('.ll-landing a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var headerHeight = document.querySelector('.ll-header')
          ? document.querySelector('.ll-header').offsetHeight
          : 0;
        var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

})();
