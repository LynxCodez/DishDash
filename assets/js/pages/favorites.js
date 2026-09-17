'use strict';

window.refreshFavoritesPage = (function () {
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function render() {
    const user = S.currentUser();
    const grid = document.getElementById('favGrid');
    const sub = document.getElementById('favSub');

    if (!user || user.role === 'admin') {
      sub.textContent = 'Sign in to see your saved dishes.';
      grid.innerHTML = UI.emptyState({
        emoji: '💛',
        title: 'Sign in to view favourites',
        msg: 'Tap the heart on any dish to save it here — your favourites follow your account.',
        action: { href: 'login.html?next=favorites.html', label: 'Go to sign in' }
      });
      return;
    }
    const favs = S.getFavs();
    sub.textContent = favs.length
      ? favs.length + ' saved dish' + (favs.length === 1 ? '' : 'es')
      : 'Your most-loved dishes, one tap away.';

    if (!favs.length) {
      grid.innerHTML = UI.emptyState({
        emoji: '💛',
        title: 'No favourites yet',
        msg: 'Tap the heart icon on any dish and it will appear here so you can reorder in seconds.',
        action: { href: 'menu.html', label: 'Discover dishes' }
      });
      return;
    }
    grid.innerHTML = favs.map(UI.foodCardHTML).join('');
    UI.reveal(grid);
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'dishdash_session' || e.key.indexOf('dishdash_favs_') === 0) render();
  });
  window.DD_STORE.on('favs', render);
  window.DD_STORE.on('foods', render);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  return render;
})();
