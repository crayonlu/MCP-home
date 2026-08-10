var t = localStorage.getItem('mch.theme')
var dark =
  t === 'dark' ||
  ((t === null || t === 'auto') && window.matchMedia('(prefers-color-scheme: dark)').matches)
if (dark) document.documentElement.classList.add('dark')
