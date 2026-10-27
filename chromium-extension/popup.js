const title = document.getElementById('title');
const files = document.getElementById('files');
const status = document.getElementById('status');
const refresh = document.getElementById('refresh');
let busy = false;

function showStatus(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

async function send(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || '扩展通信失败，请重试。');
  return result.data;
}

async function load() {
  if (busy) return;
  refresh.disabled = true;
  files.replaceChildren();
  showStatus('正在读取…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('请先打开 LMS 学习活动页面。');
    const data = await send({ type: 'LIST', tabId: tab.id });
    title.textContent = data.title;
    for (const file of data.files) {
      const card = document.createElement('section');
      card.className = 'file';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = file.name;
      const size = document.createElement('div');
      size.className = 'size';
      size.textContent = Number.isFinite(file.size) && file.size >= 0
        ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '大小未知';
      const button = document.createElement('button');
      button.textContent = file.supported ? '下载文件' : '暂不支持此类型';
      button.disabled = !file.supported;
      button.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        button.disabled = true;
        refresh.disabled = true;
        showStatus('正在获取文件地址…');
        try {
          await send({ type: 'DOWNLOAD', tabId: tab.id, courseId: data.courseId,
            activityId: data.activityId, uploadId: file.id });
          showStatus('已交给浏览器下载，请在下载列表查看进度。');
        } catch (error) {
          showStatus(error.message, true);
        } finally {
          busy = false;
          button.disabled = !file.supported;
          refresh.disabled = false;
        }
      });
      card.append(name, size, button);
      files.append(card);
    }
    showStatus(data.files.length ? '选择要保存的附件。' : '当前活动没有附件。');
  } catch (error) {
    title.textContent = '打开课程文件页面后使用';
    showStatus(error.message, true);
  } finally {
    refresh.disabled = false;
  }
}

refresh.addEventListener('click', load);
load();
