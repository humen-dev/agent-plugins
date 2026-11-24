(function () {
  var theme = 'dark';
  try {
    if (localStorage.getItem('catalog.theme') === 'light') theme = 'light';
  } catch { /* storage blocked: stay dark */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
