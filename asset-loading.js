(() => {
  const groups = '.floating-frame, .collab-stage, .rules-stage';
  const pending = new Map();
  const versions = new WeakMap();
  const layer = document.createElement('div');
  layer.className = 'asset-placeholder-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  let frame = 0;

  function layout() {
    frame = 0;
    for (const [target, placeholder] of pending) {
      if (!target.isConnected) { placeholder.remove(); pending.delete(target); continue; }
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
      layer.append(box); pending.set(target, box); resize.observe(target);
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
    } else { resize.unobserve(target); box.remove(); pending.delete(target); }
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
    Promise.all(images.map(img => waitImage(img).then(() => { img.dataset.assetReady = ''; }))).then(() => {
      group.classList.remove('asset-group-pending'); finish(group, false);
    }, () => finish(group, true));
  }
  document.querySelectorAll(groups).forEach(watchGroup);
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
  addEventListener('scroll', schedule, true); addEventListener('resize', schedule);
})();
