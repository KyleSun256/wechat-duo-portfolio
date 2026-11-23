// 3D 模型比较大，接近演示区域时再加载它的运行库和资源。
const host = document.querySelector('#duo-demo');
let loading;
function loadMockup() {
  if (loading) return loading;
  loading = (async () => {
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/apple-duo/runtime.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('3D 运行库加载失败'));
      document.head.append(script);
    });
    const module = await import('./mockup.js');
    await module.mockupReady;
    return module;
  } catch (error) {
    console.error(error);
    const status = host.querySelector('.scene-status');
    if (status) status.textContent = '3D 样机加载失败，请刷新页面重试。';
  }
  })();
  return loading;
}
window.preloadDuoMockup = async () => {
  const module = await loadMockup();
  if (module) await module.preloadMockupAssets();
};
if (host && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      loadMockup();
    }
  }, { rootMargin: '1200px' });
  observer.observe(host);
} else if (host) loadMockup();
