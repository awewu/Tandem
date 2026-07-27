(function () {
  var MATERIALS = {
    'home-hero': function (asset) {
      var desktop = document.querySelector('.hero-poster-desktop');
      var mobile = document.querySelector('.hero-poster-mobile');
      var video = document.getElementById('heroVideo');
      if (desktop) desktop.src = asset.src;
      if (mobile) mobile.src = asset.src;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.dataset.desktopSrc = '';
        video.dataset.mobileSrc = '';
        video.style.display = 'none';
      }
    },
    'brand-story': function (asset) {
      setBackground('.entry-res', asset.src);
      setBackground('.news-1', asset.src);
    },
    'service-banner': function (asset) {
      setBackground('.entry-com', asset.src);
    },
    'footer-cert': function (asset) {
      setBackground('.entry-pro', asset.src);
      setBackground('.news-3', asset.src);
    },
  };

  function setBackground(selector, src) {
    var node = document.querySelector(selector);
    if (!node) return;
    node.style.backgroundImage = 'url("' + src + '")';
  }

  function applyMaterials(manifest) {
    if (!manifest || typeof manifest !== 'object') return;
    Object.keys(MATERIALS).forEach(function (key) {
      var asset = manifest[key];
      if (!asset || !asset.src) return;
      MATERIALS[key](asset);
    });
  }

  function initSiteMaterials() {
    fetch('/assets/img/site-materials/manifest.json', { cache: 'no-store' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(applyMaterials)
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteMaterials);
  } else {
    initSiteMaterials();
  }
})();
