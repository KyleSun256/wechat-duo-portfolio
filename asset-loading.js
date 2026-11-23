(() => {
  const groups = '.floating-frame, .collab-stage, .rules-stage';
  const pending = new Map();
  const versions = new WeakMap();
  const layer = document.createElement('div');
  layer.className = 'asset-placeholder-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  let frame = 0;
  const visible = new Set();
  const visibility = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const box = pending.get(entry.target);
      if (!box) continue;
      if (entry.isIntersecting) visible.add(entry.target);
      else { visible.delete(entry.target); box.hidden = true; }
    }
    schedule();
  }, { rootMargin: "100px" }) : null;

  function layout() {
    frame = 0;
    for (const target of visible) {
      const placeholder = pending.get(target);
      if (!placeholder) { visible.delete(target); continue; }
      if (!target.isConnected) { placeholder.remove(); pending.delete(target); visible.delete(target); continue; }
      const r = target.getBoundingClientRect();
      let left = Math.max(0, r.left), top = Math.max(0, r.top);
      let right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom);
      for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
      }
      const visible = r.width > 0 && r.height > 0 && right > left && bottom > top;
      placeholder.hidden = !visible;
      if (!visible) continue;
      Object.assign(placeholder.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, clipPath: `inset(${Math.max(0,top-r.top)}px ${Math.max(0,r.right-right)}px ${Math.max(0,r.bottom-bottom)}px ${Math.max(0,left-r.left)}px)` });
      placeholder.classList.toggle('asset-placeholder-small', r.width < 100 || r.height < 60);
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(layout); };
  const resize = new ResizeObserver(schedule);
  function show(target) {
    if (!pending.has(target)) {
      const box = document.createElement('div');
      box.className = 'asset-placeholder';
      box.innerHTML = '<span class="asset-placeholder-spinner"></span><span class="asset-placeholder-label">正在加载…</span>';
      box.hidden = true; layer.append(box); pending.set(target, box); resize.observe(target);
      if (visibility) visibility.observe(target); else visible.add(target);
    }
    schedule();
  }
  function finish(target, error) {
    const box = pending.get(target);
    if (!box) return;
    if (error) {
      box.classList.add('asset-placeholder-error');
      box.querySelector('.asset-placeholder-label').textContent = '图片加载失败';
      schedule();
    } else { resize.unobserve(target); visibility?.unobserve(target); visible.delete(target); box.remove(); pending.delete(target); }
  }
  function waitImage(img) {
    const src = img.currentSrc || img.src;
    if (!src) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const settle = () => {
        if (!img.complete) return;
        img.removeEventListener('load', settle); img.removeEventListener('error', settle);
        if (!img.naturalWidth) { reject(new Error('image failed')); return; }
        (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve);
      };
      img.addEventListener('load', settle); img.addEventListener('error', settle); settle();
    });
  }
  function watchImage(img) {
    const version = (versions.get(img) || 0) + 1; versions.set(img, version);
    img.removeAttribute('data-asset-ready');
    const group = img.closest(groups);
    if (!group) show(img);
    waitImage(img).then(() => {
      if (versions.get(img) !== version) return;
      img.dataset.assetReady = '';
      if (!group) finish(img, false);
    }, () => { if (versions.get(img) === version && !group) finish(img, true); });
  }
  function watchGroup(group) {
    group.classList.add('asset-group-pending');
    show(group);
    const images = [...group.querySelectorAll('img')];
    // 开始准备该动画时，立即加载其所有图层，避免个别懒加载图层卡住整组。
    images.forEach(img => { img.loading = "eager"; });
    Promise.all(images.map(img => waitImage(img).then(() => { img.dataset.assetReady = ''; }))).then(() => {
      group.classList.remove('asset-group-pending'); finish(group, false);
    }, () => finish(group, true));
  }
  const groupElements = document.querySelectorAll(groups);
  groupElements.forEach(group => { group.classList.add('asset-group-pending'); show(group); });
  if ('IntersectionObserver' in window) {
    const groupLoader = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        groupLoader.unobserve(entry.target); watchGroup(entry.target);
      }
    }, { rootMargin: '800px' });
    groupElements.forEach(group => groupLoader.observe(group));
  } else groupElements.forEach(watchGroup);
  document.querySelectorAll('img').forEach(img => { if (!img.closest(groups)) watchImage(img); });
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target.tagName === 'IMG') watchImage(record.target);
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1 || node === layer) continue;
        if (node.matches('img') && !node.closest(groups)) watchImage(node);
        node.querySelectorAll('img').forEach(img => { if (!img.closest(groups)) watchImage(img); });
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
  // 附近内容仍由浏览器优先加载；空闲时按页面顺序逐项预加载其余内容。
  const retainedPreloads = [];
  const idle = () => new Promise(resolve => {
    if ('requestIdleCallback' in window) requestIdleCallback(resolve, { timeout: 2000 });
    else setTimeout(resolve, 100);
  });
  async function preloadFile(url) {
    const image = new Image();
    retainedPreloads.push(image);
    image.src = url;
    try { await waitImage(image); } catch (error) { console.warn('预加载图片失败', url); }
  }
  async function preloadInPageOrder() {
    const items = [...document.querySelectorAll('img, #duo-demo')];
    for (const item of items) {
      await idle();
      if (item.id === 'duo-demo') {
        try { await window.preloadDuoMockup?.(); } catch (error) { console.warn('预加载样机失败', error); }
      } else {
        item.loading = 'eager';
        try { await waitImage(item); } catch (error) { /* 加载失败时继续下一项。 */ }
        if (item.id === 'split-diagram') {
          for (const state of ['free', 'unavailable']) await preloadFile(`assets/split-diagram-${state}.png`);
        } else if (item.id === 'split-device') {
          for (const state of ['free', 'unavailable']) await preloadFile(`assets/split-screen-${state}.png`);
        }
      }
    }
  }
  const beginBackgroundPreload = () => setTimeout(preloadInPageOrder, 1000);
  if (document.readyState === 'complete') beginBackgroundPreload();
  else addEventListener('load', beginBackgroundPreload, { once: true });
  addEventListener('scroll', schedule, true); addEventListener('resize', schedule);
})();
