"""Download activity attachments through the LMS document reading API."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit


def get_json(request, url):
    response = request.get(url, timeout=60000)
    if response.status in (401, 403) or 'json' not in response.headers.get('content-type', ''):
        raise RuntimeError(f'接口访问失败（HTTP {response.status}），请检查权限或重新登录。')
    if not response.ok:
        raise RuntimeError(f'接口返回 HTTP {response.status}')
    return response.json()


def download_activity(playwright, state, url, root):
    match = re.fullmatch(r'/?(\d+)/?', urlsplit(url).fragment)
    if not match:
        raise RuntimeError('download 需要包含 #/活动编号 的完整 URL')
    activity_id = match.group(1)
    request = playwright.request.new_context(storage_state=str(state))
    try:
        base = 'https://lms.nju.edu.cn'
        activity = get_json(request, f'{base}/api/activities/{activity_id}')
        if activity.get('course_id') != 11611:
            raise RuntimeError('该活动不属于课程 11611')
        uploads = activity.get('uploads', [])
        if not uploads:
            raise RuntimeError('该活动未提供附件 uploads')
        folder = root / 'data' / activity_id
        folder.mkdir(parents=True, exist_ok=True)
        report = {'activity_id': activity_id, 'title': activity.get('title'), 'files': []}
        failed = False
        for upload in uploads:
            entry = {'upload_id': upload['id'], 'name': upload['name'], 'expected_bytes': upload.get('size')}
            try:
                if upload.get('type') != 'document':
                    raise RuntimeError('当前仅适配文档附件')
                reference = upload.get('reference_id')
                route = f'/api/uploads/reference/document/{reference}/url' if reference else f"/api/uploads/document/{upload['id']}/url"
                info = get_json(request, f'{base}{route}?preview=true&refer_type=learning_activity&refer_id={activity_id}')
                if info.get('status') != 'ready' or not info.get('url'):
                    raise RuntimeError('文档尚未就绪，或接口未提供文件地址')
                if urlsplit(info['url']).scheme != 'https':
                    raise RuntimeError('拒绝非 HTTPS 文件地址')
                response = request.get(info['url'], timeout=120000)
                body = response.body()
                content_type = response.headers.get('content-type', '')
                entry.update({'http_status': response.status, 'content_type': content_type, 'actual_bytes': len(body), 'source_api': route})
                if not response.ok or 'text/html' in content_type:
                    raise RuntimeError('文件地址返回错误或 HTML，未保存为附件')
                if upload['name'].lower().endswith('.pdf') and not body.startswith(b'%PDF-'):
                    raise RuntimeError('文件头不是 PDF，未保存')
                expected = upload.get('size')
                if expected and len(body) != expected:
                    raise RuntimeError('文件长度与附件元数据不符，未保存')
                name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', upload['name']).rstrip('. ')
                if not name:
                    name = f"attachment-{upload['id']}"
                destination = folder / name
                if destination.exists() and destination.read_bytes() != body:
                    destination = folder / f"{upload['id']}-{name}"
                temporary = destination.with_suffix(destination.suffix + '.part')
                temporary.write_bytes(body)
                temporary.replace(destination)
                entry.update({'saved_as': destination.name, 'sha256': hashlib.sha256(body).hexdigest(), 'status': 'saved', 'pdf_signature': body.startswith(b'%PDF-')})
                print(f'已保存：{destination}（{len(body):,} 字节）', flush=True)
            except Exception as exc:
                failed = True
                # Do not log signed URLs embedded in transport exceptions.
                entry.update({'status': 'failed', 'error_type': type(exc).__name__})
                print(f"附件 {upload['id']} 获取失败（{type(exc).__name__}），请检查登录和文档权限。", flush=True)
            report['files'].append(entry)
        (folder / 'http-analysis.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'HTTP 校验报告：{folder / "http-analysis.json"}')
        if failed:
            raise RuntimeError('部分附件未获取成功，详见 HTTP 报告')
    finally:
        request.dispose()
