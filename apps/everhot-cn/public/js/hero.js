/* Everhot hero video swap — mirrors rheem.com: poster first, looping muted video fades in.
   Respects prefers-reduced-motion and the Save-Data hint by leaving the poster in place. */
(function () {
  function initHeroVideo() {
    var video = document.getElementById('heroVideo');
    if (!video) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (reduceMotion || saveData) return; // keep static poster

    var isMobile = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
    var src = (isMobile && video.dataset.mobileSrc) ? video.dataset.mobileSrc : video.dataset.desktopSrc;
    if (!src) return;

    video.src = src;
    video.load();

    function reveal() { video.classList.add('is-ready'); }
    video.addEventListener('canplay', reveal, { once: true });

    var play = video.play();
    if (play && typeof play.catch === 'function') {
      play.catch(function () { /* autoplay blocked: poster remains visible */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroVideo);
  } else {
    initHeroVideo();
  }
})();
