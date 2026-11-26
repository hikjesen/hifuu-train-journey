const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
function smooth(a, b, x) { const k=clamp((x-a)/(b-a),0,1); return k*k*(3-2*k); }
const sub3 = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross3 = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function norm3(a){const n=Math.hypot(...a)||1; return a.map(x=>x/n);}
const paintCache = new Map();
function paint(hex){
  if(Array.isArray(hex)) return hex;
  if(paintCache.has(hex)) return paintCache.get(hex);
  let s=hex.replace('#','');
  if(s.length===3)s=s.split('').map(c=>c+c).join('');
  const k=parseInt(s,16), c=[(k>>16&255)/255,(k>>8&255)/255,(k&255)/255]; paintCache.set(hex,c);return c;
}
class LabelSheet {
  constructor() {
    this.canvas=document.createElement('canvas'); this.canvas.width=2048;this.canvas.height=2048;
    this.ctx=this.canvas.getContext('2d');this.cells=new Map();
  }
  add(text,style) {
    const key=JSON.stringify([text,style]);if(this.cells.has(key))return this.cells.get(key);
    const slot=this.cells.size;
    if(slot>=64) return [0,0,0,0];
    const w=512,h=128,x=(slot%4)*w,y=Math.floor(slot/4)*h, ctx=this.ctx;
    ctx.fillStyle=style.bg||'#ece2c5';ctx.fillRect(x,y,w,h);
    ctx.save();ctx.beginPath();ctx.rect(x+2,y+2,w-4,h-4);ctx.clip();
    ctx.fillStyle=style.fg||'#493d32';ctx.textAlign=style.align||'center';ctx.textBaseline='middle';
    const tx=ctx.textAlign==='left'?x+20:ctx.textAlign==='right'?x+w-20:x+w/2;
    ctx.font=style.font||'46px "Noto Serif CJK JP", serif';
    ctx.fillText(text,tx,y+(style.sub?48:65),470);
    if(style.sub){ctx.font='20px Georgia, serif';ctx.fillText(style.sub,tx,y+94,466);}
    ctx.restore();
    const uv=[(x+2)/2048,1-(y+h-2)/2048,(x+w-2)/2048,1-(y+2)/2048];this.cells.set(key,uv);return uv;
  }
}
class Geometry {
  constructor(labels, chunked=false){this.labels=labels;this.chunked=chunked;this.parts=new Map();this.trees=new Map();this.lastKey=NaN;this.lastData=null;}
  data(x,z){
    const ix=this.chunked?Math.floor(x/160):0,iz=this.chunked?Math.floor(z/160):0;
    const key=ix*128+iz;if(key===this.lastKey)return this.lastData;
    let p=this.parts.get(key);if(!p){p={values:[],ix,iz};this.parts.set(key,p);}
    this.lastKey=key;this.lastData=p.values;return p.values;
  }
  emit(v,p,n,c,u,w,m){v.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],u,w,m);}
  tri(a,b,c,color,mat=0,uv=null){
    const rgb=paint(color),nr=norm3(cross3(sub3(b,a),sub3(c,a)));
    const v=this.data((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3);
    this.emit(v,a,nr,rgb,uv?uv[0]:0,uv?uv[1]:0,mat);
    this.emit(v,b,nr,rgb,uv?uv[2]:1,uv?uv[3]:0,mat);
    this.emit(v,c,nr,rgb,uv?uv[4]:1,uv?uv[5]:1,mat);
  }
  vtri(a,b,c,ca,cb,cc,m=10){
    const v=this.data((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3),n=norm3(cross3(sub3(b,a),sub3(c,a)));
    this.emit(v,a,n,paint(ca),a[0],a[2],m);this.emit(v,b,n,paint(cb),b[0],b[2],m);this.emit(v,c,n,paint(cc),c[0],c[2],m);
  }
  quad(a,b,c,d,color,mat=0,uv=null){
    if(uv){this.tri(a,b,c,color,mat,uv.slice(0,6));this.tri(a,c,d,color,mat,[uv[0],uv[1],uv[4],uv[5],uv[6],uv[7]]);}
    else {this.tri(a,b,c,color,mat,[0,0,1,0,1,1]);this.tri(a,c,d,color,mat,[0,0,1,1,0,1]);}
  }
  box(x,y,z,sx,sy,sz,color,mat=0){
    const l=x-sx/2,r=x+sx/2,b=y-sy/2,t=y+sy/2,f=z-sz/2,k=z+sz/2;
    const v=[[l,b,f],[r,b,f],[r,t,f],[l,t,f],[l,b,k],[r,b,k],[r,t,k],[l,t,k]];
    for(const face of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])this.quad(v[face[0]],v[face[1]],v[face[2]],v[face[3]],color,mat);
  }
  cyl(a,b,r,color,mat=0,sides=12,re=r){
    const axis=norm3(sub3(b,a)),i=norm3(cross3(axis,Math.abs(axis[1])>.88?[1,0,0]:[0,1,0])),j=cross3(axis,i);
    const data=this.data((a[0]+b[0])/2,(a[2]+b[2])/2),rgb=paint(color);
    let prev=null;
    for(let s=0;s<=sides;s++){const ang=TAU*s/sides,n=i.map((v,k)=>v*Math.cos(ang)+j[k]*Math.sin(ang)),v0=a.map((v,k)=>v+r*n[k]),v1=b.map((v,k)=>v+re*n[k]);
      if(prev){const [p,q,np]=prev;
        for(const [pos,nor,u,v] of [[p,np,0,0],[v0,n,1,0],[v1,n,1,1],[p,np,0,0],[v1,n,1,1],[q,np,0,1]])this.emit(data,pos,nor,rgb,u,v,mat);
        this.tri(a,v0,p,color,mat);this.tri(b,q,v1,color,mat);
      } prev=[v0,v1,n];
    }
  }
  sphere(x,y,z,rx,ry,rz,color,mat=0,segs=14,rings=9){
    const data=this.data(x,z),rgb=paint(color),row=[];
    for(let j=0;j<=rings;j++){const lat=Math.PI*(j/rings-.5),ring=[];
      for(let i=0;i<=segs;i++){const a=TAU*i/segs,dx=Math.cos(lat)*Math.cos(a),dy=Math.sin(lat),dz=Math.cos(lat)*Math.sin(a);
        ring.push([[x+rx*dx,y+ry*dy,z+rz*dz],norm3([dx/rx,dy/ry,dz/rz]),i/segs,j/rings]);}
      if(j){for(let i=1;i<=segs;i++){for(const v of [row[i-1],ring[i-1],ring[i],row[i-1],ring[i],row[i]])this.emit(data,v[0],v[1],rgb,v[2],v[3],mat);}} row.splice(0,row.length,...ring);
    }
  }
  label(a,b,c,d,text,style={}){
    const [l,bt,r,t]=this.labels.add(text,style);this.quad(a,b,c,d,'#ffffff',20,[l,bt,r,bt,r,t,l,t]);
  }
  tree(x,y,z,w,h,species,phase=0){
    const ix=Math.floor(x/160),iz=Math.floor(z/160),key=ix*128+iz;
    let p=this.trees.get(key);if(!p){p={values:[],ix,iz};this.trees.set(key,p);}
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]])p.values.push(x,y,z,w,h,species,phase,u,v);
  }
}
