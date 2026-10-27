function safeName(name) {
  let value = String(name || 'attachment').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '');
  if (!value || value === '.' || value === '..') value = 'attachment';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) value = `_${value}`;
  // Leave room for the downloads directory and browser conflict suffixes.
  if (value.length > 180) {
    const dot = value.lastIndexOf('.');
    const extension = dot > 0 && value.length - dot <= 12 ? value.slice(dot) : '';
    value = value.slice(0, 180 - extension.length) + extension;
  }
  return value;
}

async function handleMessage(message) {
  if (!Number.isInteger(message.tabId)) throw new Error('找不到活动标签页。');
  const tab = await chrome.tabs.get(message.tabId);
  const url = new URL(tab.url);
  if (url.origin !== 'https://lms.nju.edu.cn' || !/^\/course\/\d+\/learning-activity\/?$/.test(url.pathname)) {
    throw new Error('请在 LMS 学习活动页面使用扩展。');
  }
  let result;
  try {
    result = await chrome.tabs.sendMessage(message.tabId, {
      type: message.type === 'LIST' ? 'NJU_LIST' : 'NJU_RESOLVE',
      uploadId: message.uploadId, activityId: message.activityId, courseId: message.courseId
    }, { frameId: 0 });
  } catch {
    throw new Error('请刷新 LMS 页面后重新打开扩展。');
  }
  if (!result?.ok) throw new Error(result?.error || '无法读取课程附件。');
  if (message.type === 'LIST') return result.data;
  const file = result.data;
  const target = new URL(file.url);
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('文件地址无效。');
  const id = await chrome.downloads.download({
    url: target.href,
    filename: `NJU-LMS/${file.activityId}/${safeName(file.name)}`,
    conflictAction: 'uniquify', saveAs: false
  });
  return { downloadId: id };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'PAGE_DOWNLOAD') {
    // Bind inline UI requests to the actual sending top-level LMS tab.
    if (!sender.tab?.id || sender.frameId !== 0) return;
    (async () => {
      const tab = await chrome.tabs.get(sender.tab.id);
      const url = new URL(tab.url);
      if (url.origin !== 'https://lms.nju.edu.cn' ||
          !/^\/course\/\d+\/learning-activity\/?$/.test(url.pathname) ||
          !/^#\/\d+\/?$/.test(url.hash)) throw new Error('请打开具体的 LMS 学习活动。');
      return handleMessage({ ...message, type: 'DOWNLOAD', tabId: sender.tab.id });
    })().then(data => respond({ ok: true, data }), error => {
      const known = error instanceof Error && !/https?:\/\//.test(error.message);
      respond({ ok: false, error: known ? error.message : '下载失败，请刷新活动页面后重试。' });
    });
    return true;
  }
  // Only the extension's own download UI may initiate privileged downloads.
  if (!sender.url || sender.url.split('?')[0] !== chrome.runtime.getURL('popup.html')) return;
  if (!['LIST', 'DOWNLOAD'].includes(message?.type)) return;
  handleMessage(message).then(data => respond({ ok: true, data }), error => {
    const known = error instanceof Error && !/https?:\/\//.test(error.message);
    respond({ ok: false, error: known ? error.message : '无法启动下载，请刷新页面后重试。' });
  });
  return true;
});
