(() => {
  if (globalThis.__njuDownloader) return;
  globalThis.__njuDownloader = true;

  function currentActivity() {
    const path = location.pathname.match(/^\/course\/(\d+)\/learning-activity\/?$/);
    const hash = location.hash.match(/^#\/(\d+)\/?$/);
    if (!path || !hash) throw new Error('请先打开具体学习活动，地址需包含 #/活动编号。');
    return { courseId: path[1], activityId: hash[1] };
  }

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
