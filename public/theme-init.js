// Apply theme before React loads to prevent flash of wrong theme.
// A file instead of an inline script, so the Content-Security-Policy can allow scripts from 'self' only.
;(function () {
  var t = 'light'
  try {
    t = localStorage.getItem('spendiary.theme') || 'light'
  } catch (e) {
    // Storage blocked (private mode, site data off): keep the light theme
  }
  var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0f1117' : '#fbfbfd')
})()
