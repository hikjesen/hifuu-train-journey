"""Assemble the offline film; Python's standard library is sufficient after baking the panorama."""
import base64
from pathlib import Path
root = Path(__file__).resolve().parents[1]
src = root / 'src'
parts = ('geometry', 'carriage', 'countryside', 'landlight', 'tunnel', 'shaders', 'renderer', 'software', 'ui')
html = (src / 'page.html').read_text()
image = base64.b64encode((src / 'horizon.jpg').read_bytes()).decode('ascii')
html = html.replace('@@PANORAMA@@', 'data:image/jpeg;base64,' + image)
cabin = base64.b64encode((src / 'cabin.webp').read_bytes()).decode('ascii')
html = html.replace('@@CABIN@@', 'data:image/webp;base64,' + cabin)
html = html.replace('/*@@SOURCES@@*/', '\n'.join((src / (p + '.js')).read_text() for p in parts))
dest = root / 'dist' / 'index.html'
dest.parent.mkdir(exist_ok=True)
dest.write_text(html)
print(f'{dest.name}   {dest.stat().st_size:,} bytes')
