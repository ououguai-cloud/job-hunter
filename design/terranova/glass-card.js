/* ============================================================
   Terranova — liquid-glass frame sync

   The card is a window onto a refracted duplicate of the
   background video. Every animation frame we measure the card,
   place the duplicate container so it lines up 1:1 with the
   real backdrop, and draw the current video frame into the
   canvas. The canvas carries `filter: url(#liquid-glass-refraction)`
   in CSS, so the browser refracts it on composite.
   ============================================================ */

const DUP_PIXEL_RATIO = 1; // deliberate — see note below

const video = document.getElementById('bg-video');
const card = document.querySelector('[data-glass-card]');
const container = document.getElementById('dup-video-container');
const canvas = document.getElementById('dup-image');
const ctx = canvas.getContext('2d');

function frame() {
  const rect = card.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // Bail until the card has size and the video has decoded a frame.
  if (!rect.width || !rect.height || !video.videoWidth || !video.videoHeight) {
    requestAnimationFrame(frame);
    return;
  }

  // Sizing the duplicate to the VIEWPORT rather than to the card is
  // deliberate. The filter shifts each colour channel by a different
  // amount, so the filtered element's own leading edges show hard
  // channel-separation bands. At viewport size those bands fall
  // outside the card and only clean refraction shows.
  container.style.left = (-rect.left) + 'px';
  container.style.top = (-rect.top) + 'px';
  container.style.width = vw + 'px';
  container.style.height = vh + 'px';

  // The duplicate stays at 1x even on retina: the SVG filter's cost
  // scales with pixel count, and what shows through is a soft
  // refraction where 4x the filter work buys nothing.
  const w = Math.round(vw * DUP_PIXEL_RATIO);
  const h = Math.round(vh * DUP_PIXEL_RATIO);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  // Reproduce object-fit: cover for the source rect.
  const cover = Math.max(vw / video.videoWidth, vh / video.videoHeight);
  const sw = vw / cover;
  const sh = vh / cover;
  const sx = (video.videoWidth - sw) / 2;
  const sy = (video.videoHeight - sh) / 2;

  try {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  } catch (e) {
    // A frame may not be decodable yet — skip and retry next frame.
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
