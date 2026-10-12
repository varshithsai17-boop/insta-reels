# Cloud test frames only (headless Chromium + SwiftShader). Never a full render: Varshith renders on his GPU.
#   python render.py preview <outdir> t1 t2 ...        (RINIT="window.GL_W=1080;..." for full quality)
import sys, json, base64, time, os, mimetypes
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.abspath(__file__))
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
def serve(route):
    path = route.request.url.split('reel.local/', 1)[1].split('?')[0]
    fp = os.path.realpath(os.path.join(ROOT, path))
    if not os.path.isfile(fp): return route.fulfill(status=404, body='')
    ct = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
    if fp.endswith('.js'): ct = 'text/javascript'
    route.fulfill(status=200, body=open(fp, 'rb').read(), headers={'content-type': ct})
def page_ready(p):
    b = p.chromium.launch(args=ARGS, executable_path=CHROME if os.path.exists(CHROME) else None)
    page = b.new_page(viewport={'width': 1080, 'height': 1920})
    errs = []; page.on('pageerror', lambda e: errs.append(str(e))); page.on('console', lambda m: errs.append('console: ' + m.text) if m.type in ('error', 'warning') else None)
    if os.environ.get('RINIT'): page.add_init_script(os.environ['RINIT'])
    page.route('http://reel.local/**', serve)
    page.goto('http://reel.local/reel.html')
    try: page.wait_for_function('window.ready === true', timeout=120000)
    except Exception: print('NOT READY', errs[:10]); raise
    for f in ['400 40px Tinos', 'italic 400 40px Tinos', '700 40px Tinos']: page.evaluate(f'document.fonts.load("{f}")')
    page.evaluate('document.fonts.ready.then(()=>1)')
    tl = json.load(open(f'{ROOT}/timeline.json'))
    page.evaluate('(tl) => setup(tl)', tl)
    return page, errs
def grab(page, t, q=0.9):
    url = page.evaluate(f'(()=>{{renderFrame({t}); return document.getElementById("c").toDataURL("image/jpeg",{q});}})()')
    return base64.b64decode(url.split(',')[1])
if __name__ == '__main__':
    mode = sys.argv[1]
    with sync_playwright() as p:
        page, errs = page_ready(p)
        if mode == 'preview':
            out = sys.argv[2]; os.makedirs(out, exist_ok=True)
            for t in [float(x) for x in sys.argv[3:]]:
                st = time.time(); open(f'{out}/f_{t:05.1f}.jpg', 'wb').write(grab(page, t)); print(t, round(time.time() - st, 2), flush=True)
        if errs: print('PAGE ERRORS:', errs[:12])
