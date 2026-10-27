(() => {
  if (globalThis.__njuDownloader) return;
  globalThis.__njuDownloader = true;

  function currentActivity() {
    const path = location.pathname.match(/^\/course\/(\d+)\/learning-activity\/?$/);
    const hash = location.hash.match(/^#\/(\d+)\/?$/);
    if (!path || !hash) throw new Error('请先打开具体学习活动，地址需包含 #/活动编号。');
    return { courseId: path[1], activityId: hash[1] };
  }

  const launcher = document.createElement('div');
  launcher.id = 'nju-lms-download-launcher';
  launcher.style.cssText = 'all:initial!important;position:fixed!important;left:20px!important;bottom:20px!important;width:44px!important;height:44px!important;z-index:2147483647!important;';
  const shadow = launcher.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    button { all:unset; box-sizing:border-box; display:flex; align-items:center;
      justify-content:center; width:44px; height:44px; border-radius:50%;
      background:#4d0099; color:#fff; cursor:pointer;
      box-shadow:0 3px 12px #0003; transition:background .15s,transform .15s; }
    button:hover { background:#3b0075; transform:translateY(-2px); }
    button:focus-visible { outline:3px solid #bc8fe8; outline-offset:3px; }
    button:disabled { opacity:.65; cursor:wait; }
    svg { display:block; width:22px; height:22px; pointer-events:none; }
    @media (prefers-reduced-motion:reduce) { button { transition:none; } }
    @media print { button { display:none; } }
  `;
  const launchButton = document.createElement('button');
  launchButton.type = 'button';
  launchButton.title = '打开 LMS 文件下载';
  launchButton.setAttribute('aria-label', '打开 LMS 文件下载');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4');
  svg.append(path);
  launchButton.append(svg);
  shadow.append(style, launchButton);
  launchButton.addEventListener('click', async () => {
    launchButton.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'OPEN_PANEL' });
      if (!result?.ok) throw new Error(result?.error || '无法打开下载页。');
      launchButton.title = '打开 LMS 文件下载';
    } catch {
      launchButton.title = '扩展无法连接，请刷新页面后重试';
    } finally {
      launchButton.disabled = false;
    }
  });
  function updateLauncher() {
    try {
      currentActivity();
      if (!launcher.isConnected) document.documentElement.append(launcher);
    } catch {
      launcher.remove();
    }
  }
  window.addEventListener('hashchange', updateLauncher);
  window.addEventListener('popstate', updateLauncher);
  if (window.navigation) window.navigation.addEventListener('navigatesuccess', updateLauncher);
  updateLauncher();

  async function json(path) {
    const response = await fetch(path, {
      credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('json')) {
      throw new Error(`接口访问失败（HTTP ${response.status}），请先登录并确认课程权限。`);
    }
    return response.json();
  }

  async function activity() {
    const ids = currentActivity();
    const data = await json(`/api/activities/${ids.activityId}`);
    if (String(data.course_id) !== ids.courseId || String(data.id) !== ids.activityId) {
      throw new Error('活动与当前页面不一致，请刷新后重试。');
    }
    const now = currentActivity();
    if (now.activityId !== ids.activityId || now.courseId !== ids.courseId) {
      throw new Error('页面已切换，请重新读取附件。');
    }
    return { ...ids, data };
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !['NJU_LIST', 'NJU_RESOLVE'].includes(message?.type)) return;
    (async () => {
      const { courseId, activityId, data } = await activity();
      const uploads = Array.isArray(data.uploads) ? data.uploads : [];
      if (message.type === 'NJU_LIST') {
        return { courseId, activityId, title: data.title || '学习活动', files: uploads.map(file => ({
          id: file.id, name: file.name || `附件 ${file.id}`, size: file.size,
          supported: file.type === 'document' && !file.deleted
        })) };
      }
      if (String(message.activityId) !== activityId || String(message.courseId) !== courseId) {
        throw new Error('页面已切换，请重新打开扩展读取附件。');
      }
      const file = uploads.find(item => String(item.id) === String(message.uploadId));
      if (!file || file.deleted || file.type !== 'document') throw new Error('该附件不存在或不属于文档类型。');
      const route = file.reference_id
        ? `/api/uploads/reference/document/${file.reference_id}/url`
        : `/api/uploads/document/${file.id}/url`;
      const params = new URLSearchParams({ preview: 'true', refer_type: 'learning_activity', refer_id: activityId });
      const result = await json(`${route}?${params}`);
      if (result.status !== 'ready' || !result.url) throw new Error('文档尚未就绪或服务器未提供文件地址。');
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('服务器返回了不支持的文件地址。');
      return { url: url.href, name: file.name, size: file.size, activityId };
    })().then(data => respond({ ok: true, data }), error => {
      const known = error instanceof Error && !/https?:\/\//.test(error.message);
      respond({ ok: false, error: known ? error.message : '请求失败，请检查网络或重新登录。' });
    });
    return true;
  });
})();
