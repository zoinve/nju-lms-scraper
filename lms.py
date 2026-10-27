"""Save an interactive LMS login and export a rendered course page."""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
TARGET = 'https://lms.nju.edu.cn/course/11611/learning-activity#/44877'
STATE = ROOT / '.auth' / 'state.json'


def course_page(url):
    parsed = urlsplit(url)
    return parsed.scheme == 'https' and parsed.hostname == 'lms.nju.edu.cn' and parsed.path.rstrip('/') == '/course/11611/learning-activity'


def save_state(context):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    # Keep only this application's state, excluding central SSO credentials.
    state = context.storage_state(indexed_db=True)
    state['cookies'] = [c for c in state['cookies'] if c['domain'].lstrip('.') == 'lms.nju.edu.cn']
    state['origins'] = [o for o in state['origins'] if o['origin'] == 'https://lms.nju.edu.cn']
    temporary = STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(STATE)


def main():
    parser = argparse.ArgumentParser(description='南大 LMS 登录状态保存与课程页面导出')
    parser.add_argument('command', choices=['login', 'scrape', 'download'])
    parser.add_argument('--url', default=TARGET, help='课程活动完整 URL，保留 #/活动编号')
    parser.add_argument('--auto-save', action='store_true', help='登录返回课程页后自动保存状态')
    parser.add_argument('--headless', action='store_true', help='抓取时隐藏浏览器')
    parser.add_argument('--channel', choices=['chromium', 'chrome', 'msedge'], default='chromium')
    parser.add_argument('--selector', help='等待课程内容元素出现的 CSS 选择器')
    parser.add_argument('--wait', type=float, default=5, help='页面额外渲染等待秒数，默认 5')
    parser.add_argument('--timeout', type=float, default=60, help='导航及元素等待超时秒数')
    args = parser.parse_args()
    if not course_page(args.url):
        parser.error('仅支持南大 LMS 课程 11611 的学习活动 URL')
    if args.wait < 0 or args.timeout <= 0:
        parser.error('wait 必须非负，timeout 必须大于零')
    if args.command != 'login' and not STATE.exists():
        parser.error('尚无登录状态，请先运行 python lms.py login')
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        if args.command == 'download':
            from download import download_activity
            download_activity(p, STATE, args.url, ROOT)
            return
        options = {'headless': args.headless and args.command == 'scrape'}
        if args.channel != 'chromium':
            options['channel'] = args.channel
        browser = p.chromium.launch(**options)
        try:
            context = browser.new_context(storage_state=str(STATE) if STATE.exists() and args.command == 'scrape' else None)
            page = context.new_page()
            page.set_default_timeout(args.timeout * 1000)
            response = page.goto(args.url, wait_until='domcontentloaded')
            if args.command == 'login':
                print('请在浏览器中完成登录，进入课程 11611 的学习活动页。')
                print('确认已看到课程内容后，回到这里按 Enter 保存；Ctrl+C 取消。')
                if args.auto_save:
                    print('等待登录完成，最多 10 分钟……', flush=True)
                    import time
                    deadline = time.monotonic() + 600
                    while time.monotonic() < deadline:
                        candidates = [tab for tab in context.pages if course_page(tab.url)]
                        if candidates:
                            page = candidates[-1]
                            page.wait_for_timeout(5000)
                            if course_page(page.url) and not page.locator('input[type=password]:visible').count() and context.cookies('https://lms.nju.edu.cn'):
                                break
                        page.wait_for_timeout(1000)
                    else:
                        raise RuntimeError('等待登录超时，请重新运行 login。')
                else:
                    input()
                candidates = [tab for tab in context.pages if course_page(tab.url)]
                if not candidates:
                    raise RuntimeError('尚未进入目标课程页面，未保存登录状态。')
                page = candidates[-1]
                if page.locator('input[type=password]:visible').count():
                    raise RuntimeError('页面仍有登录表单，未保存登录状态。')
                save_state(context)
                print('已保存本站登录状态到 .auth/state.json（请勿分享）。')
                return
            if response and response.status >= 400:
                raise RuntimeError(f'页面返回 HTTP {response.status}，请检查访问权限或重新登录。')
            page.wait_for_timeout(args.wait * 1000)
            if not course_page(page.url) or page.locator('input[type=password]:visible').count():
                raise RuntimeError('页面跳转或登录已过期，请重新运行 login。')
            if args.selector:
                page.locator(args.selector).first.wait_for(state='visible')
            text = page.locator('body').inner_text()
            if not text.strip():
                raise RuntimeError('页面正文为空，请增加 --wait 或指定 --selector。')
            links = page.locator('a[href]').evaluate_all('(items) => items.map(a => ({text: a.innerText.trim(), url: a.href}))')
            folder = ROOT / 'data' / datetime.now().strftime('%Y%m%d-%H%M%S-%f')
            folder.mkdir(parents=True)
            (folder / 'page.html').write_text(page.content(), encoding='utf-8')
            (folder / 'text.txt').write_text(text, encoding='utf-8')
            (folder / 'links.json').write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding='utf-8')
            (folder / 'metadata.json').write_text(json.dumps({'url': page.url, 'title': page.title(), 'captured_at': datetime.now().astimezone().isoformat()}, ensure_ascii=False, indent=2), encoding='utf-8')
            page.screenshot(path=str(folder / 'page.png'), full_page=True)
            save_state(context)
            print(f'页面导出完成：{folder}')
        finally:
            browser.close()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n已取消。', file=sys.stderr)
        sys.exit(130)
    except Exception as exc:
        print(f'失败：{exc}', file=sys.stderr)
        sys.exit(1)
