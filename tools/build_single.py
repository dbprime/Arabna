#!/usr/bin/env python3
"""Regenerate index-single-file.html from the ES-module sources."""
import base64, json, mimetypes, re, subprocess, sys, pathlib

ROOT = pathlib.Path.cwd()


def discover(root=None):
    """Every ES module under js/ — discovered, so adding a screen needs no edit here."""
    root = pathlib.Path(root or ROOT)
    return sorted(p.relative_to(root).as_posix() for p in (root / 'js').rglob('*.js'))


MODULES = discover()


def make_reader(rev=None, root=None):
    root = pathlib.Path(root or ROOT)
    if rev is None:
        return (lambda p: (root / p).read_bytes())
    return (lambda p: subprocess.check_output(['git', 'show', f'{rev}:{p}'], cwd=root))


def data_uri(path, blob):
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(blob).decode()


def rewrite_specifiers(src, module_path):
    """'../ui.js' / './home.js' -> bare 'arabna/js/ui.js' specifiers."""
    here = pathlib.PurePosixPath(module_path).parent

    def sub(m):
        quote, spec = m.group(2), m.group(3)
        if not spec.startswith('.'):
            return m.group(0)
        target = str((here / spec).as_posix())
        parts = []
        for seg in target.split('/'):
            if seg == '.' or seg == '':
                continue
            if seg == '..':
                parts.pop()
            else:
                parts.append(seg)
        return f'{m.group(1)}{quote}arabna/{"/".join(parts)}{quote}'

    return re.sub(r"(from\s*|import\s*\(?\s*)(['\"])(\.[^'\"]*)(['\"])",
                  lambda m: sub(m), src)


def build(read):
    html = read('index.html').decode('utf-8')
    css = read('styles/app.css').decode('utf-8')

    # inline local icons / logo referenced from the shell and the stylesheet
    def inline_asset(m):
        path = m.group(2)
        if path.startswith(('http', 'data:')):
            return m.group(0)
        return f'{m.group(1)}"{data_uri(path, read(path))}"'

    html = re.sub(r'(href=|src=)"([^"]+\.(?:png|jpg|jpeg|svg|webp|ico))"', inline_asset, html)
    css = re.sub(r'(url\()"?([^")]+\.(?:png|jpg|jpeg|svg|webp))"?(?=\))',
                 lambda m: f'{m.group(1)}"{data_uri(m.group(2), read(m.group(2)))}"', css)

    asset_re = re.compile(r'(src=|href=)"(assets/[^"]+)"')
    # …and asset paths that are plain string literals rather than attributes
    # (the theme picks the logo file at run time, so it cannot be an attribute)
    asset_lit_re = re.compile(r'''(['"])(assets/[^'"]+\.(?:png|jpg|jpeg|svg|webp|ico))\1''')

    imports = {}
    for mod in MODULES:
        src = rewrite_specifiers(read(mod).decode('utf-8'), mod)
        src = asset_re.sub(lambda m: f'{m.group(1)}"{data_uri(m.group(2), read(m.group(2)))}"', src)
        src = asset_lit_re.sub(lambda m: "'" + data_uri(m.group(2), read(m.group(2))) + "'", src)
        imports[f'arabna/{mod}'] = 'data:text/javascript;base64,' + \
            base64.b64encode(src.encode('utf-8')).decode()

    html = html.replace('<link rel="stylesheet" href="styles/app.css" />',
                        '<style>\n' + css + '\n</style>')
    importmap = '<script type="importmap">' + \
        json.dumps({'imports': imports}, ensure_ascii=False) + '</script>'
    html = html.replace('<script type="module" src="js/app.js"></script>',
                        importmap + '\n  <script type="module">import "arabna/js/app.js";</script>')
    return html


if __name__ == '__main__':
    rev = sys.argv[1] if len(sys.argv) > 1 else None
    out = build(make_reader(rev))
    sys.stdout.write(out)
