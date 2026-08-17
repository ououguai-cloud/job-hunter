/* ============================================================
   Terranova × 职聘通 JobHunter —— 背景折射帧同步（主站整合版）

   基于 design/terranova/glass-card.js 的同一算法：
   折射卡是背景视频的"窗口"，每帧测量卡片、把副本容器对齐
   到视口坐标、把当前视频帧画进 canvas，canvas 携带
   filter: url(#liquid-glass-refraction)，浏览器合成时折射。

   与设计页版的差异：
   1. 选择器改用 data-bg-glass（主站 .card 是内容卡，不冲突）
   2. 卡片为纯装饰（无文字内容）
   3. 视频加载失败 → html.no-terranova 降级，背景隐藏、
      body 恢复浅色，主站功能完全不受影响
   4. prefers-reduced-motion → 不启动折射循环并暂停视频
   ============================================================ */

'use strict';

const DUP_PIXEL_RATIO = 1; // 刻意保持 1x，见下方注释

const video = document.getElementById('bg-video');
const card = document.querySelector('[data-bg-glass]');
const container = document.getElementById('dup-video-container');
const canvas = document.getElementById('dup-image');
const ctx = canvas ? canvas.getContext('2d') : null;

let disabled = false;

/* ---------------- 降级：视频不可用时不拖累主站 ---------------- */
function degrade() {
  if (disabled) return;
  disabled = true;
  document.documentElement.classList.add('no-terranova');
}

if (video) {
  video.addEventListener('error', degrade);
  // 远程视频可能一直卡在缓冲：10 秒内没有可解码帧则降级
  setTimeout(() => {
    if (!video.videoWidth && video.readyState < 2) degrade();
  }, 10000);
}

/* ---------------- 无障碍：reduced-motion 保持静态 ---------------- */
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced && video) video.pause();

/* ---------------- 每帧折射同步 ---------------- */
function frame() {
  if (disabled || !ctx) return;

  const rect = card.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  // 卡片还没尺寸或视频还没解码出帧 → 下一帧重试
  if (!rect.width || !rect.height || !video || !video.videoWidth || !video.videoHeight) {
    requestAnimationFrame(frame);
    return;
  }

  // 副本按视口尺寸对齐：滤镜对每个颜色通道位移量不同，
  // 若按卡片尺寸，卡片自身的边缘会出现硬色散带；按视口尺寸，
  // 色散带落在卡片外，只留下干净的折射。
  container.style.left = (-rect.left) + 'px';
  container.style.top = (-rect.top) + 'px';
  container.style.width = vw + 'px';
  container.style.height = vh + 'px';

  // 副本保持 1x（即使 retina 也 1x）：SVG 滤镜开销随像素数
  // 增长，透过卡片看到的是柔和折射，4x 滤镜工作量换不来收益。
  const w = Math.round(vw * DUP_PIXEL_RATIO);
  const h = Math.round(vh * DUP_PIXEL_RATIO);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  // 复现 object-fit: cover 的源矩形
  const cover = Math.max(vw / video.videoWidth, vh / video.videoHeight);
  const sw = vw / cover;
  const sh = vh / cover;
  const sx = (video.videoWidth - sw) / 2;
  const sy = (video.videoHeight - sh) / 2;

  try {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  } catch (e) {
    // 某帧可能尚未解码，跳过，下一帧重试
  }

  if (!disabled) requestAnimationFrame(frame);
}

if (!reduced) requestAnimationFrame(frame);
