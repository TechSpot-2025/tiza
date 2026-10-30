// Runs before first paint (blocking, tiny): applies a saved theme so there is no flash, and marks JS as available.
(function () {
  try {
    var t = localStorage.getItem('tiza-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked */ }
  document.documentElement.classList.add('js');
})();
