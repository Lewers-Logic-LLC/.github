/*
 * Recycler.IQ Landing Page — WordPress JavaScript
 *
 * HOW TO ADD:
 *   Add a "Custom HTML" block at the BOTTOM of the same page
 *   that contains the landing page content, and wrap this in
 *   <script> tags:
 *
 *   <script>
 *     // paste this file's contents here
 *   </script>
 */

/* ── Demo Request Modal ── */
function riqOpenModal() {
    var overlay = document.getElementById('riqDemoModal');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function riqCloseModal() {
    var overlay = document.getElementById('riqDemoModal');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close on Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') riqCloseModal();
});

// Close on overlay click (outside modal box)
(function () {
    var overlay = document.getElementById('riqDemoModal');
    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) riqCloseModal();
        });
    }
})();

/* ── Countdown Timer (uncomment in HTML when launch date is set) ── */
// Set your launch date here (ISO format):
// var riqLaunchDate = new Date('2026-07-01T00:00:00');

(function () {
    if (typeof riqLaunchDate === 'undefined') return;

    var el = document.getElementById('riq-countdown');
    if (!el) return;
    el.classList.add('active');

    function riqUpdateCountdown() {
        var now = new Date();
        var diff = riqLaunchDate - now;

        if (diff <= 0) {
            document.getElementById('riq-cd-days').textContent = '0';
            document.getElementById('riq-cd-hours').textContent = '0';
            document.getElementById('riq-cd-mins').textContent = '0';
            document.getElementById('riq-cd-secs').textContent = '0';
            return;
        }

        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);

        document.getElementById('riq-cd-days').textContent = d;
        document.getElementById('riq-cd-hours').textContent = h;
        document.getElementById('riq-cd-mins').textContent = m;
        document.getElementById('riq-cd-secs').textContent = s;
    }

    riqUpdateCountdown();
    setInterval(riqUpdateCountdown, 1000);
})();

/* ── Smooth scroll for anchor links ── */
(function () {
    var links = document.querySelectorAll('.riq-landing a[href^="#"]');
    for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
})();
