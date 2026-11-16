// Runs before first paint (blocking, tiny): applies a saved theme so there is no flash, marks JS as available,
// and picks the OS whose first-run steps the download panel shows.
(function () {
  try {
    var t = localStorage.getItem('tiza-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked */ }
  document.documentElement.classList.add('js');
  // Which first-run steps to show (the stylesheet hides the other list): decided here, before first paint, so the
  // download panel does not change size when app.js arrives. Anything that is not Windows gets the Mac steps.
  var ua = navigator.userAgent || '', platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  document.documentElement.setAttribute('data-run-os', /Win/i.test(platform) || /Windows/.test(ua) ? 'win' : 'mac');
})();
