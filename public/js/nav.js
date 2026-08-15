function toggleNav(id) {
    const nav = document.getElementById(id);
    if (!nav) return;
    nav.classList.toggle('is-open');
}

function closeNav(id) {
    const nav = document.getElementById(id);
    if (!nav) return;
    nav.classList.remove('is-open');
}

// Close nav when clicking outside of the nav wrapper
document.addEventListener('click', function(e) {
    document.querySelectorAll('.nati-nav.is-open').forEach(function(nav) {
        const wrapper = nav.closest('.nati-nav-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            nav.classList.remove('is-open');
        }
    });
});

// Close nav when any nav link is clicked (on mobile)
document.addEventListener('click', function(e) {
    const link = e.target.closest('.nati-nav-link');
    if (link) {
        document.querySelectorAll('.nati-nav.is-open').forEach(function(nav) {
            nav.classList.remove('is-open');
        });
    }
});

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
}
