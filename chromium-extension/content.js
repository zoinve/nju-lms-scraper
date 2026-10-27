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
    .launcher { all:unset; box-sizing:border-box; display:flex; align-items:center;
      justify-content:center; width:44px; height:44px; border-radius:50%;
      background:#4d0099; color:#fff; cursor:pointer;
      box-shadow:0 3px 12px #0003; transition:background .15s,transform .15s; }
    .launcher:hover { background:#3b0075; transform:translateY(-2px); }
    button:focus-visible { outline:3px solid #bc8fe8; outline-offset:3px; }
    button:disabled { opacity:.65; cursor:wait; }
    svg { display:block; width:22px; height:22px; pointer-events:none; }
    [hidden] { display:none!important; }
    .panel { all:initial; box-sizing:border-box; position:absolute; bottom:56px; left:0;
      width:340px; max-width:calc(100vw - 40px); max-height:calc(100dvh - 100px);
      overflow:auto; padding:18px; border:1px solid #e1d9eb; border-radius:16px;
      background:#fff; color:#20242c; box-shadow:0 8px 32px #21004126;
      font:13px/1.6 system-ui,"Microsoft YaHei",sans-serif; }
    .header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .heading { margin:0; color:#4d0099; font-size:16px; font-weight:700; }
    .panel button { all:unset; box-sizing:border-box; display:inline-flex; align-items:center;
      justify-content:center; padding:7px 12px; border-radius:7px; background:#4d0099;
      color:#fff; font:inherit; cursor:pointer; }
    .panel button:hover { background:#3b0075; }
    .panel button:focus-visible { outline:3px solid #bc8fe8; outline-offset:2px; }
    .panel button:disabled { opacity:.55; cursor:wait; }
    .panel .close { padding:0; width:28px; height:28px; background:transparent; color:#69717c; font-size:23px; }
    .panel .close:hover { background:#f1eafa; color:#4d0099; }
    .activity-title { margin:12px 0; font-size:13px; overflow-wrap:anywhere; }
    .file { padding:12px; margin:10px 0; border:1px solid #e9e4ef; border-radius:10px; background:#faf8fd; }
    .name { font-weight:600; overflow-wrap:anywhere; }
    .size { margin:5px 0 9px; color:#69717c; font-size:12px; }
    .status { margin:12px 0; overflow-wrap:anywhere; }
    .error { color:#b42332; }
    .panel .refresh { background:#f1eafa; color:#4d0099; }
    .panel .refresh:hover { background:#e5d8f3; }
    .note { margin:12px 0 0; color:#69717c; font-size:11px; }
    @media (prefers-reduced-motion:reduce) { button { transition:none; } }
    @media print { .launcher,.panel { display:none; } }
  `;
  const launchButton = document.createElement('button');
  launchButton.type = 'button';
  launchButton.className = 'launcher';
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
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  const panel = element('section', 'panel');
  panel.id = 'nju-download-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '课程文件下载');
  launchButton.setAttribute('aria-controls', panel.id);
  launchButton.setAttribute('aria-expanded', 'false');
  const header = element('div', 'header');
  const heading = element('h2', 'heading', '课程文件下载');
  const closeButton = element('button', 'close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭下载弹窗');
  header.append(heading, closeButton);
  const activityTitle = element('p', 'activity-title');
  const fileList = element('div', 'files');
  const status = element('p', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const refreshButton = element('button', 'refresh', '重新读取');
  refreshButton.type = 'button';
  panel.append(header, activityTitle, fileList, status, refreshButton,
    element('p', 'note', '使用当前登录状态，下载进度请查看浏览器下载列表。'));
  shadow.append(style, panel, launchButton);
  let generation = 0;
  let routeKey = '';
  function closePanel(focus = false) {
    panel.hidden = true;
    launchButton.setAttribute('aria-expanded', 'false');
    generation++;
    if (focus) launchButton.focus();
  }
  function showStatus(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }
  async function loadPanel() {
    const requestGeneration = ++generation;
    fileList.replaceChildren();
    activityTitle.textContent = '正在读取当前活动…';
    refreshButton.disabled = true;
    showStatus('正在读取…');
    try {
      const data = await handleActivityMessage({ type: 'NJU_LIST' });
      if (requestGeneration !== generation || panel.hidden) return;
      activityTitle.textContent = data.title;
      for (const file of data.files) {
        const card = element('div', 'file');
        const size = Number.isFinite(file.size) && file.size >= 0 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '大小未知';
        const download = element('button', '', file.supported ? '下载文件' : '暂不支持此类型');
        download.type = 'button';
        download.disabled = !file.supported;
        download.addEventListener('click', async () => {
          download.disabled = true;
          showStatus('正在获取文件地址…');
          try {
            const result = await chrome.runtime.sendMessage({ type: 'PAGE_DOWNLOAD',
              courseId: data.courseId, activityId: data.activityId, uploadId: file.id });
            if (!result?.ok) throw new Error(result?.error || '扩展无法连接，请刷新页面后重试。');
            if (generation === requestGeneration) showStatus('已交给浏览器下载，请在下载列表查看进度。');
          } catch (error) {
            if (generation === requestGeneration) showStatus(error.message, true);
          } finally {
            download.disabled = !file.supported;
          }
        });
        card.append(element('div', 'name', file.name), element('div', 'size', size), download);
        fileList.append(card);
      }
      showStatus(data.files.length ? '选择要保存的附件。' : '当前活动没有附件。');
    } catch (error) {
      if (generation === requestGeneration) showStatus(error.message, true);
    } finally {
      if (generation === requestGeneration) refreshButton.disabled = false;
    }
  }
  launchButton.addEventListener('click', () => {
    if (!panel.hidden) return closePanel();
    panel.hidden = false;
    launchButton.setAttribute('aria-expanded', 'true');
    closeButton.focus();
    loadPanel();
  });
  closeButton.addEventListener('click', () => closePanel(true));
  refreshButton.addEventListener('click', loadPanel);
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !event.composedPath().includes(launcher)) closePanel();
  }, true);
  shadow.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closePanel(true); event.stopPropagation(); }
  });
  function updateLauncher() {
    try {
      const ids = currentActivity();
      const nextKey = `${ids.courseId}/${ids.activityId}`;
      if (nextKey !== routeKey) { closePanel(); routeKey = nextKey; }
      if (!launcher.isConnected) document.documentElement.append(launcher);
    } catch {
      closePanel();
      routeKey = '';
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

  async function handleActivityMessage(message) {
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
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !['NJU_LIST', 'NJU_RESOLVE'].includes(message?.type)) return;
    handleActivityMessage(message).then(data => respond({ ok: true, data }), error => {
      const known = error instanceof Error && !/https?:\/\//.test(error.message);
      respond({ ok: false, error: known ? error.message : '请求失败，请检查网络或重新登录。' });
    });
    return true;
  });
})();
