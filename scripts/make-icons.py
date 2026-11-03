from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent.parent
image=Image.new('RGBA',(1024,1024),(0,0,0,0));draw=ImageDraw.Draw(image)
for e in ET.parse(p/'assets/app-icon.svg').getroot():
 t=e.tag.split('}')[-1];a=e.attrib;f=a.get('fill');f=None if f=='none' else f
 if t=='rect':
  x,y,w,h=[float(a.get(k,0)) for k in ['x','y','width','height']];draw.rounded_rectangle((x,y,x+w,y+h),radius=float(a.get('rx',0)),fill=f)
 elif t=='circle':
  x,y,r=[float(a[k]) for k in ['cx','cy','r']];draw.ellipse((x-r,y-r,x+r,y+r),fill=f)
 elif t in ['polygon','polyline']:
  pts=[tuple(map(float,v.split(','))) for v in a['points'].split()];stroke=a.get('stroke');width=int(a.get('stroke-width',1))
  if t=='polygon':draw.polygon(pts,fill=f);pts=pts+[pts[0]]
  if stroke:draw.line(pts,fill=stroke,width=width,joint='curve')
image.save(p/'assets/app-icon.png')
for size in [32,48,192,512]:image.resize((size,size),Image.Resampling.LANCZOS).save(p/f'assets/app-icon-{size}.png')
image.save(p/'assets/app-icon.icns')
print('SVG-bron gerenderd naar PNG en ICNS.')
