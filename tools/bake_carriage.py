#!/usr/bin/env python3
"""Bake the procedural car at its window seat into a transparent, 360-degree CPU fallback.

Requires Node, Blender 4.x (Cycles), Python with Pillow, and local Noto/DejaVu fonts.
Run from anywhere: python3 tools/bake_carriage.py
No stock geometry, photographs, network services, or source textures are used.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
EXPORT = r"""
const fs=require('fs'),vm=require('vm'),path=require('path');
const [project,work]=process.argv.slice(1);
const source=['geometry.js','carriage.js'].map(f=>fs.readFileSync(path.join(project,'src',f),'utf8')).join('\n');
const dump=`
const cells=[], seen=new Map();
const labels={add(t,s){
  const k=JSON.stringify([t,s]);
  if(seen.has(k))return seen.get(k);
  const slot=cells.length,x=(slot%4)*512,y=Math.floor(slot/4)*128;
  const uv=[(x+2)/2048,1-(y+126)/2048,(x+510)/2048,1-(y+2)/2048];
  cells.push({text:t,style:s,x,y});seen.set(k,uv);return uv;
}};
const car=new Geometry(labels);buildCarriage(car);
const mesh=new Float32Array(car.parts.get(0).values);
fs.writeFileSync(path.join(work,'car.f32'),Buffer.from(mesh.buffer));
fs.writeFileSync(path.join(work,'labels.json'),JSON.stringify(cells));
`;
vm.runInNewContext(source+'\n'+dump,{fs,path,work,Buffer});
"""

def make_atlas(directory):
    import json
    import re
    from PIL import Image, ImageDraw, ImageFont
    def font_path(cjk):
        paths = (['/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
                  '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc',
                  'C:/Windows/Fonts/msmincho.ttc'] if cjk else
                 ['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
                  '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
                  'C:/Windows/Fonts/times.ttf'])
        return next((p for p in paths if Path(p).exists()), None)
    atlas=Image.new('RGB',(2048,2048),(206,194,171))
    for cell in json.loads((directory/'labels.json').read_text()):
        s=cell['style']; tile=Image.new('RGB',(512,128),s.get('bg','#ece2c5'))
        def line(value,cy,size):
            cjk=any(ord(ch)>255 for ch in value)
            family=font_path(cjk) or font_path(False)
            font=ImageFont.truetype(family,int(size)) if family else ImageFont.load_default(size=int(size))
            pen=ImageDraw.Draw(tile)
            while size>8 and pen.textlength(value,font=font)>474:
                size-=1;font=ImageFont.truetype(family,int(size)) if family else ImageFont.load_default(size=int(size))
            pen.text((256,cy),value,font=font,fill=s.get('fg','#4a3c2f'),anchor='mm')
        line(cell['text'],48 if s.get('sub') else 64,int(re.search(r'(\d+)px',s.get('font','46px serif')).group(1)))
        if s.get('sub'): line(s['sub'],96,20)
        atlas.paste(tile,(cell['x'],cell['y']))
    atlas.save(directory/'print.png')

def driver():
    import argparse, os, subprocess, tempfile
    from PIL import Image
    ap=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--width',type=int,default=4096)
    ap.add_argument('--samples',type=int,default=22)
    ap.add_argument('--threads',type=int,default=min(8,len(os.sched_getaffinity(0))) if hasattr(os,'sched_getaffinity') else 8)
    ap.add_argument('--output',type=Path,default=ROOT/'src/cabin.webp')
    args=ap.parse_args()
    with tempfile.TemporaryDirectory(prefix='hifuu-interior-') as tmp:
        work=Path(tmp)
        subprocess.run(['node','-e',EXPORT,str(ROOT),str(work)],check=True)
        make_atlas(work)
        subprocess.run(['blender','-b','--factory-startup','-t',str(args.threads),
                        '--python-exit-code','3','-P',str(Path(__file__).resolve()),'--',
                        str(work),str(args.width),str(args.samples)],check=True)
        rendered=filter_render(work)
        args.output.parent.mkdir(parents=True,exist_ok=True)
        rendered.save(args.output,'WEBP',quality=92,method=6,exact=True)
        print(f'{args.output}: {rendered.size[0]} × {rendered.size[1]} RGBA, {args.output.stat().st_size:,} bytes.')

def filter_render(work):
    # A cross-bilateral, multi-scale filter over demodulated irradiance. The independent
    # material and normal guides protect the woven thread, printed maps, brass rims and edges.
    import numpy as np
    from PIL import Image
    source=np.array(Image.open(work/'render.png').convert('RGBA'))
    diffuse=np.array(Image.open(work/'albedo0001.png').convert('RGB'))
    normals=np.array(Image.open(work/'normal0001.png').convert('RGB'))
    height,width=source.shape[:2];result=source.copy()
    def shift(a,dy,dx):
        return np.roll(a,(dy,dx),axis=(0,1))
    for start in range(0,height,136):
        stop=min(height,start+136);top=max(0,start-19);bottom=min(height,stop+19)
        cut=source[top:bottom];albedo0=diffuse[top:bottom].astype('f')/255
        normal0=normals[top:bottom].astype('f')/255
        alpha=cut[:,:,3].astype('f')/255
        tint=.36+.73*albedo0
        original=(cut[:,:,:3].astype('f')/255)/tint
        value=original.copy()
        for step,sigma in ((1,.55),(2,.38),(4,.23),(8,.16)):
            lum=value[:,:,0]*.29+value[:,:,1]*.57+value[:,:,2]*.14
            acc=4*value;sw=np.full(lum.shape,4.,np.float32)
            for yy in (-step,0,step):
                for xx in (-step,0,step):
                    if not (yy or xx):continue
                    nc=shift(normal0,yy,xx)-normal0;dc=shift(albedo0,yy,xx)-albedo0
                    ed=(nc*nc).sum(axis=2)*105+(dc*dc).sum(axis=2)*68
                    dl=(shift(lum,yy,xx)-lum)/sigma;delta=shift(alpha,yy,xx)-alpha
                    cost=1+ed+dl*dl+delta*delta*55
                    w=(1 if xx and yy else 2)/(cost*cost)
                    acc+=w[:,:,None]*shift(value,yy,xx);sw+=w
            value=acc/sw[:,:,None]
        value=(value*.975+original*.025)*tint
        sr=(np.clip(value,0,1)*255+.5).astype('uint8')
        sr[cut[:,:,3]==0]=0
        result[start:stop,:,:3]=sr[start-top:stop-top]
    return Image.fromarray(result,'RGBA')

def cycles_render():
    import bpy, math, numpy as np
    from mathutils import Vector
    workpath,w,n=sys.argv[sys.argv.index('--')+1:];work=Path(workpath);width=int(w);samples=int(n)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc=bpy.context.scene
    sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=samples
    try:
        sc.cycles.denoiser='OPENIMAGEDENOISE';sc.cycles.use_denoising=True
    except TypeError:
        sc.cycles.use_denoising=False
    sc.cycles.use_adaptive_sampling=True;sc.cycles.adaptive_threshold=.11
    sc.cycles.max_bounces=5;sc.cycles.diffuse_bounces=3;sc.cycles.glossy_bounces=3
    sc.cycles.transmission_bounces=3;sc.cycles.transparent_max_bounces=4
    sc.cycles.sample_clamp_indirect=2.4;sc.cycles.seed=724
    sc.render.film_transparent=True;sc.render.resolution_x=width;sc.render.resolution_y=width//2
    sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG'
    sc.render.image_settings.color_mode='RGBA';sc.render.image_settings.color_depth='8'
    sc.render.image_settings.compression=12;sc.render.filepath=str(work/'render.png')
    sc.view_settings.view_transform='AgX';sc.view_settings.exposure=.18

    def node(tree,kind):return tree.nodes.new(kind)
    def connect(tree,src,dest):
        if hasattr(src,'is_output'): tree.links.new(src,dest)
        else:dest.default_value=src
    def mathop(tree,op,a,b):
        nd=node(tree,'ShaderNodeMath');nd.operation=op;connect(tree,a,nd.inputs[0]);connect(tree,b,nd.inputs[1]);return nd.outputs[0]
    def vscale(tree,src,factor):
        nd=node(tree,'ShaderNodeVectorMath');nd.operation='MULTIPLY';connect(tree,src,nd.inputs[0]);nd.inputs[1].default_value=factor;return nd.outputs[0]
    def noise(tree,vec,scale=1,detail=2,rough=.58,dist=0):
        nd=node(tree,'ShaderNodeTexNoise');connect(tree,vec,nd.inputs['Vector']);nd.inputs['Scale'].default_value=scale
        nd.inputs['Detail'].default_value=detail;nd.inputs['Roughness'].default_value=rough;nd.inputs['Distortion'].default_value=dist
        return nd.outputs['Fac']
    def ramp(tree,src,stops):
        nd=node(tree,'ShaderNodeValToRGB');connect(tree,src,nd.inputs[0]);r=nd.color_ramp
        for i,(p,val) in enumerate(stops):
            el=(r.elements[0] if i==0 else r.elements[-1] if i==len(stops)-1 else r.elements.new(p))
            el.position=p;el.color=(*val,1)
        return nd.outputs['Color']
    def multcolor(tree,a,b,factor=1.):
        nd=node(tree,'ShaderNodeMixRGB');nd.blend_type='MULTIPLY';nd.inputs[0].default_value=factor
        connect(tree,a,nd.inputs[1]);connect(tree,b,nd.inputs[2]);return nd.outputs['Color']
    def mixed(tree,a,b,k):
        nd=node(tree,'ShaderNodeMixRGB');connect(tree,k,nd.inputs[0]);connect(tree,a,nd.inputs[1]);connect(tree,b,nd.inputs[2]);return nd.outputs[0]
    def bump(tree,h,strength,dist,shader):
        nd=node(tree,'ShaderNodeBump');nd.inputs['Strength'].default_value=strength;nd.inputs['Distance'].default_value=dist
        connect(tree,h,nd.inputs['Height']);connect(tree,nd.outputs[0],shader.inputs['Normal'])
    def fac(tree,src,gain,bias):return mathop(tree,'ADD',mathop(tree,'MULTIPLY',src,gain),bias)
    linear=lambda v:np.where(v<=.04045,v/12.92,((v+.055)/1.055)**2.4)
    atlas=bpy.data.images.load(str(work/'print.png'));atlas.colorspace_settings.name='sRGB'
    def make_material(kind):
        names={0:'Graphite',1:'Old varnished walnut',2:'Brushed brass and nickel',3:'Moquette and felt',
               4:'Painted enamel',5:'Window rubber',6:'Opal lamp glass',7:'Pencil and laid paper',8:'Aisle carpet',
               9:'Curtains and headrest linen',20:'Printed matter'}
        mat=bpy.data.materials.new(names[kind]);mat.use_nodes=True;t=mat.node_tree;bs=t.nodes.get('Principled BSDF')
        a=node(t,'ShaderNodeVertexColor');a.layer_name='Swatch';base=a.outputs['Color']
        pos=node(t,'ShaderNodeNewGeometry');vec=pos.outputs['Position'];normal=pos.outputs['Normal']
        bs.inputs['Roughness'].default_value=.64;bs.inputs['Specular IOR Level'].default_value=.34
        if kind==1:
            sideCoord=vscale(t,vec,(.68,12.7,16.5))
            split=node(t,'ShaderNodeSeparateXYZ');connect(t,vec,split.inputs[0])
            endVec=node(t,'ShaderNodeCombineXYZ')
            for inp,out,rate in [(0,2,.75),(1,1,13.1),(2,0,16.5)]:
                connect(t,mathop(t,'MULTIPLY',split.outputs[out],rate),endVec.inputs[inp])
            ns=node(t,'ShaderNodeSeparateXYZ');connect(t,normal,ns.inputs[0])
            weight=mathop(t,'GREATER_THAN',mathop(t,'ABSOLUTE',ns.outputs[0],0),.71)
            coord=mixed(t,sideCoord,endVec.outputs[0],weight)
            grain=noise(t,coord,2.35,3,.60,.36)
            fine=noise(t,vscale(t,coord,(1.6,4.4,3.65)),3.0,1.7,.61,.46)
            rings=fac(t,mathop(t,'SINE',fac(t,grain,65.,0),0),.5,.5)
            deep=mathop(t,'POWER',rings,8.)
            pat=mathop(t,'SUBTRACT',mathop(t,'ADD',mathop(t,'MULTIPLY',grain,.79),mathop(t,'MULTIPLY',fine,.26)),mathop(t,'MULTIPLY',deep,.072))
            tint=ramp(t,pat,[(.19,(.54,.40,.30)),(.38,(.76,.63,.48)),(.56,(.98,.90,.75)),(.79,(1.,1.,.95))])
            base=multcolor(t,base,tint,.79)
            connect(t,fac(t,fine,.18,.24),bs.inputs['Roughness']);bs.inputs['Coat Weight'].default_value=.21;bs.inputs['Coat Roughness'].default_value=.24
            bump(t,fine,.19,.00072,bs)
        elif kind==2:
            b=noise(t,vscale(t,vec,(25.,280.,175.)),3.,1.25,.52,.26)
            connect(t,fac(t,b,.29,.19),bs.inputs['Roughness']);bs.inputs['Metallic'].default_value=.73
            bs.inputs['Anisotropic'].default_value=.27;bump(t,b,.11,.000095,bs)
        elif kind in (3,8,9):
            coarse=noise(t,vec,41. if kind!=8 else 78.,3,.59,.33)
            fuzz=noise(t,vscale(t,vec,(.88,1.17,.96)),720 if kind!=8 else 510,1.0,.55,.1)
            thread=mathop(t,'ADD',mathop(t,'MULTIPLY',coarse,.48),mathop(t,'MULTIPLY',fuzz,.52))
            col=ramp(t,thread,[(.23,(.55,.53,.51)),(.5,(.81,.83,.81)),(.76,(.99,.98,.93))])
            base=multcolor(t,base,col,.64 if kind==9 else .75)
            bs.inputs['Sheen Weight'].default_value=.24 if kind in (3,9) else .17
            bs.inputs['Sheen Roughness'].default_value=.75
            bs.inputs['Roughness'].default_value=.82 if kind!=9 else .72
            bump(t,thread,.26,.00068 if kind!=8 else .001,bs)
        elif kind in (0,4,5):
            tex=noise(t,vec,180.,1.4)
            bs.inputs['Roughness'].default_value=.49 if kind==4 else .58
            bs.inputs['Coat Weight'].default_value=.12 if kind==4 else .045
            bump(t,tex,.11,.00025,bs)
        elif kind==6:
            bs.inputs['Roughness'].default_value=.31;bs.inputs['Emission Color'].default_value=(1.,.68,.38,1.)
            bs.inputs['Emission Strength'].default_value=1.35
        elif kind==7:
            tex=noise(t,vec,475.,1.3);bs.inputs['Roughness'].default_value=.84;bump(t,tex,.12,.00015,bs)
        elif kind==20:
            tex=node(t,'ShaderNodeTexImage');tex.image=atlas;tex.interpolation='Linear';base=tex.outputs['Color'];bs.inputs['Roughness'].default_value=.8
        connect(t,base,bs.inputs['Base Color']);return mat

    vertices=np.fromfile(work/'car.f32',dtype=np.float32).reshape((-1,3,12))
    def axis_convert(a):
        return np.ascontiguousarray(np.stack((a[:,0],-a[:,2],a[:,1]),axis=1),dtype=np.float32)
    for kind0 in sorted(np.unique(vertices[:,0,11])):
        kind=int(kind0);src=vertices[vertices[:,0,11]==kind0].reshape((-1,12));count=len(src)
        points=axis_convert(src[:,:3]);normals=axis_convert(src[:,3:6])
        triPoints=points.reshape(-1,3,3);triNorm=normals.reshape(-1,3,3)
        face=np.cross(triPoints[:,1]-triPoints[:,0],triPoints[:,2]-triPoints[:,0])
        flip=(face*triNorm.sum(axis=1)).sum(axis=1)<0
        order=np.arange(count,dtype=np.int32).reshape(-1,3)
        order[flip]=order[flip][:,[0,2,1]]
        # Soften the tangent-continuous seams between authored curved facets, retaining moulded edges.
        _,unique=np.unique(np.round(points*80000).astype(np.int32),axis=0,return_inverse=True)
        agg=np.zeros((unique.max()+1,3),np.float32);np.add.at(agg,unique,normals)
        totals=np.bincount(unique).astype(np.float32);agg/=np.maximum(totals[:,None],1)
        lengths=np.linalg.norm(agg,axis=1);new=agg[unique]/np.maximum(lengths[unique,None],.0001)
        pick=(lengths[unique]>.965)&((normals*new).sum(axis=1)>.936);normals[pick]=new[pick]
        mesh=bpy.data.meshes.new('Car surface '+str(kind));mesh.vertices.add(count);mesh.vertices.foreach_set('co',points.ravel())
        mesh.loops.add(count);mesh.loops.foreach_set('vertex_index',order.ravel())
        mesh.polygons.add(count//3);mesh.polygons.foreach_set('loop_start',np.arange(0,count,3,dtype=np.int32))
        mesh.polygons.foreach_set('use_smooth',np.ones(count//3,dtype=bool));mesh.update(calc_edges=True)
        rgba=np.ones((count,4),np.float32);rgba[:,:3]=linear(src[:,6:9])
        ca=mesh.color_attributes.new('Swatch','FLOAT_COLOR','POINT');ca.data.foreach_set('color',rgba.ravel())
        if kind==20:
            uv=mesh.uv_layers.new(name='Printed position')
            uv.data.foreach_set('uv',np.ascontiguousarray(src[order.ravel(),9:11]).ravel())
        mesh.normals_split_custom_set_from_vertices(normals.tolist())
        ob=bpy.data.objects.new('Car '+str(kind),mesh);sc.collection.objects.link(ob)
        mesh.materials.append(make_material(kind))

    world=bpy.data.worlds.new('Late autumn ambient');sc.world=world;world.use_nodes=True;t=world.node_tree
    coord=node(t,'ShaderNodeTexCoord');sep=node(t,'ShaderNodeSeparateXYZ');connect(t,coord.outputs['Generated'],sep.inputs[0])
    sky=ramp(t,fac(t,sep.outputs['Z'],.5,.5),[(0.,(.19,.16,.15)),(.42,(.37,.34,.36)),(.52,(.94,.73,.63)),(.69,(.71,.63,.76)),(1.,(.41,.44,.62))])
    bg=t.nodes.get('Background');connect(t,sky,bg.inputs['Color']);bg.inputs['Strength'].default_value=.65
    def light(name,typ,p,aim,color,power,size=0,sizeY=0):
        bulb=bpy.data.lights.new(name,typ);bulb.energy=power;bulb.color=color
        ob=bpy.data.objects.new(name,bulb);sc.collection.objects.link(ob);ob.location=p
        ob.rotation_euler=(Vector(aim)-Vector(p)).to_track_quat('-Z','Y').to_euler()
        if typ=='AREA':
            bulb.shape='RECTANGLE';bulb.size=size;bulb.size_y=sizeY
        elif typ=='POINT':bulb.shadow_soft_size=size
        else:bulb.angle=math.radians(size)
        return ob
    light('Low sun grazing the divided lights','SUN',(-7.2,7.5,3.45),(0,0,.82),(1.,.75,.54),2.45,4.5)
    light('Warm northern sky','AREA',(-1.6,4.6,2.85),(0,0,.75),(1.,.79,.67),620,15.,2.7)
    light('Lavender light through the opposite windows','AREA',(1.0,-4.7,2.75),(0,0,.85),(.78,.84,1.),460,15.,3.45)
    for j in range(-3,4):
        light('Lamp '+str(j),'POINT',(j*2.46+.20,0,2.45),(0,0,0),(1.,.71,.43),8.0,.15)

    camera=bpy.data.cameras.new('Window seat');camera.type='PANO';camera.panorama_type='EQUIRECTANGULAR'
    ob=bpy.data.objects.new('Passenger',camera);sc.collection.objects.link(ob)
    ob.location=(0,.26,1.49);ob.rotation_euler=(math.pi/2,0,0)
    sc.camera=ob
    sc.view_layers[0].use_pass_normal=True;sc.view_layers[0].use_pass_diffuse_color=True
    sc.use_nodes=True;tree=sc.node_tree;rl=tree.nodes.get('Render Layers')
    mul=node(tree,'CompositorNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1.
    connect(tree,rl.outputs['Normal'],mul.inputs[1]);mul.inputs[2].default_value=(.5,.5,.5,1.)
    add=node(tree,'CompositorNodeMixRGB');add.blend_type='ADD';add.inputs[0].default_value=1.
    connect(tree,mul.outputs[0],add.inputs[1]);add.inputs[2].default_value=(.5,.5,.5,1.)
    for filename,socket in [('albedo',rl.outputs['DiffCol']),('normal',add.outputs[0])]:
        out=node(tree,'CompositorNodeOutputFile');out.base_path=str(work)
        out.format.file_format='PNG';out.format.color_mode='RGB';out.format.color_depth='8';out.format.compression=8
        out.file_slots[0].path=filename;out.file_slots[0].save_as_render=False
        connect(tree,socket,out.inputs[0])
    bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    if '--' in sys.argv and 'blender' in Path(sys.argv[0]).name.lower():cycles_render()
    else:driver()
