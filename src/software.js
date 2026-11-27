// A Z-buffered software projection for browsers without a WebGL context.
// The immutable compartment has a Cycles light bake. World geometry still
// travels past the actual seated camera; tree cards and lake use the depth buffer.
function readPlate(image,maximum){
  const scale=Math.min(1,maximum/(image.naturalWidth||image.width)),c=document.createElement('canvas');
  const sourceW=image.naturalWidth||image.width,sourceH=image.naturalHeight||image.height;
  c.width=maximum===4096?Math.min(4096,2**Math.ceil(Math.log2(sourceW))):Math.round(sourceW*scale);c.height=Math.round(sourceH*c.width/sourceW);
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0,c.width,c.height);
  return {w:c.width,h:c.height,data:new Uint32Array(g.getImageData(0,0,c.width,c.height).data.buffer)};
}
const rgbWord=(r,g,b)=>((255<<24)|(Math.min(255,Math.max(0,b))<<16)|(Math.min(255,Math.max(0,g))<<8)|Math.min(255,Math.max(0,r)))>>>0;
function textureLevel(src,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(src,0,0,w,h);return {w,h,data:new Uint32Array(ctx.getImageData(0,0,w,h).data.buffer)};
}
class SoftwareJourney {
  constructor(canvas,sky){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.sky=readPlate(sky,4096);
    const shell=byId('cabin');this.cabin=shell&&shell.naturalWidth?readPlate(shell,4096):null;
    this.weather=new SoftwareSkyLayers(byId('sky-layers'));
    const leaf=makeTreeAtlas();this.atlas=[1,.5,.25,.125,.0625].map(s=>textureLevel(leaf,leaf.width*s,leaf.height*s));
    const grain=noiseSheet();this.noise=grain.getContext('2d').getImageData(0,0,grain.width,grain.height).data;
    const land=new Geometry(null,true);buildCountryside(land);buildTunnels(land);
    this.patches=[];this.stands=[];const treeList=[];
    for(const p of land.parts.values()){
      const data=new Float32Array(p.values);p.values=null;
      let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
      for(let j=0;j<data.length;j+=12){x0=Math.min(x0,data[j]);x1=Math.max(x1,data[j]);z0=Math.min(z0,data[j+2]);z1=Math.max(z1,data[j+2]);}
      this.patches.push({data,x:.5*(x0+x1),z:.5*(z0+z1),rad:Math.hypot(x1-x0,z1-z0)/2+12});
    }land.parts.clear();
    for(const p of land.trees.values()){
      const vs=p.values,arr=[];for(let i=0;i<vs.length;i+=54){const tree=vs.slice(i,i+7);treeList.push(tree);arr.push(...tree);}
      this.stands.push({data:new Float32Array(arr),x:(p.ix+.5)*160,z:(p.iz+.5)*160,rad:135});p.values=null;
    }land.trees.clear();
    this.light=typeof makeLandLight==='function'?readPlate(makeLandLight(treeList),2048):null;
    this.frame=0;this.lastDraw=-100;this.scale=.94;this.lastPose=null;
    this.cam=[];this.v0=new Float64Array(9);this.v1=new Float64Array(9);this.v2=new Float64Array(9);
  }
  resize(w,h){
    const s=Math.min(1.25,1160/Math.max(w,h))*this.scale,W=Math.max(2,Math.round(w*s)),H=Math.max(2,Math.round(h*s));
    if(this.W===W&&this.H===H)return;
    this.canvas.width=this.W=W;this.canvas.height=this.H=H;const n=W*H;
    this.img=this.ctx.createImageData(W,H);this.out=new Uint32Array(this.img.data.buffer);this.depth=new Float32Array(n);
    this.blur=new Uint32Array(n);this.env=new Uint32Array(n);this.shell=new Uint32Array(n);this.ref=new Uint32Array(n);
    this.lastPose=null;
  }
  environment(cam,travel){
    const W=this.W,H=this.H,F=this.focal,sky=this.sky,room=this.cabin;
    // Interpolate a rectilinear-to-spherical map in small blocks. Treat the wrap
    // discontinuity explicitly so the longitudinal seam never passes through the aisle.
    const block=12,xs=Math.ceil(W/block),ys=Math.ceil(H/block),stride=8;
    const map=new Float32Array((xs+1)*(ys+1)*stride);let j=0;
    for(let by=0;by<=ys;by++)for(let bx=0;bx<=xs;bx++){
      const dx=(Math.min(W,bx*block)-W/2)/F,dy=(H/2-Math.min(H,by*block))/F;
      let x=cam.f[0]+dx*cam.r[0]+dy*cam.u[0],y=cam.f[1]+dx*cam.r[1]+dy*cam.u[1],z=cam.f[2]+dx*cam.r[2]+dy*cam.u[2];let n=1/Math.hypot(x,y,z);x*=n;y*=n;z*=n;
      const u=Math.atan2(x,-z)/TAU+.5,v=.5-Math.asin(clamp(y,-1,1))/Math.PI;
      const par=(travel-166)*.000060*(1-smooth(.35,.62,y));
      map[j++]=Math.atan2(x+par,-z)/TAU+.5;map[j++]=.5-Math.asin(clamp(y/Math.hypot(x+par,y,z),-1,1))/Math.PI;
      map[j++]=u;map[j++]=v;
      // Reflect the viewing ray off the glazing and intersect the opposite
      // saloon envelope. This preserves ceiling lights and seats at their depths.
      const s=z>0?1:-1,t=(s*1.52+.26)/(Math.abs(z)>.0001?z:.0001),hx=x*t,hy=1.49+y*t,hz=s*1.52;
      const dz=-z;let reach=Math.abs(3.04/(dz||.0001));
      if(y>.001)reach=Math.min(reach,Math.max(.12,(2.49-hy)/y));if(y<-.001)reach=Math.min(reach,Math.max(.12,(-.04-hy)/y));
      if(Math.abs(x)>.001)reach=Math.min(reach,Math.max(.12,((x>0?8.66:-8.66)-hx)/x));
      const rx=hx+x*reach, ry=hy+y*reach-1.49, rz=hz+dz*reach+.26;
      map[j++]=Math.atan2(rx,-rz)/TAU+.5;map[j++]=.5-Math.asin(clamp(ry/(Math.hypot(rx,ry,rz)||1),-1,1))/Math.PI;
      const cloudX=x+this.cloudWind[0]*Math.max(y,0),cloudZ=z+this.cloudWind[1]*Math.max(y,0);
      map[j++]=Math.atan2(cloudX,-cloudZ)/TAU+.5;
      map[j++]=.5-Math.asin(clamp(y/Math.hypot(cloudX,y,cloudZ),-1,1))/Math.PI;
    }
    const top=new Float64Array(stride),bot=new Float64Array(stride),du=new Float64Array(stride),dv=new Float64Array(stride),pos=new Float64Array(stride),step=new Float64Array(stride);
    for(let by=0;by<ys;by++)for(let bx=0;bx<xs;bx++){
      const x0=bx*block,y0=by*block,bw=Math.min(block,W-x0),bh=Math.min(block,H-y0),a=(by*(xs+1)+bx)*stride,b=a+stride,c=a+(xs+1)*stride,d=c+stride;
      for(let k=0;k<stride;k++){
        let A=map[a+k],B=map[b+k],C=map[c+k],D=map[d+k];
        if(!(k&1)){B-=Math.round(B-A);C-=Math.round(C-A);D-=Math.round(D-C);}
        top[k]=A;bot[k]=(C-A)/bh;du[k]=(B-A)/bw;dv[k]=((D-C)/bw-du[k])/bh;
      }
      for(let y=0;y<bh;y++){
        let off=(y0+y)*W+x0;
        for(let k=0;k<stride;k++){step[k]=du[k]+dv[k]*(y+.5);pos[k]=top[k]+bot[k]*(y+.5)+step[k]*.5;}
        let su=pos[0]*sky.w,sv=pos[1]*sky.h,ru=room?pos[2]*room.w:0,rv=room?pos[3]*room.h:0,mu=room?pos[4]*room.w:0,mv=room?pos[5]*room.h:0;
        const dsu=step[0]*sky.w,dsv=step[1]*sky.h,dru=room?step[2]*room.w:0,drv=room?step[3]*room.h:0,dmu=room?step[4]*room.w:0,dmv=room?step[5]*room.h:0;
        for(let x=0;x<bw;x++,off++,su+=dsu,sv+=dsv,ru+=dru,rv+=drv,mu+=dmu,mv+=dmv){
          const background=sky.data[Math.min(sky.h-1,Math.max(0,sv|0))*sky.w+((su|0)&(sky.w-1))];
          if(room){this.shell[off]=room.data[Math.min(room.h-1,Math.max(0,rv|0))*room.w+((ru|0)&(room.w-1))];
            this.ref[off]=room.data[Math.min(room.h-1,Math.max(0,mv|0))*room.w+((mu|0)&(room.w-1))];}
          const optics=(this.shell[off]>>>24)!==255?this.weather.optics(su/sky.w,sv/sky.h):0;
          this.env[off]=(optics>>>24)?this.weather.composite(background,optics,
            pos[2]+x*step[2],pos[3]+x*step[3],pos[6]+x*step[6],pos[7]+x*step[7]):background;
        }
      }
    }
  }
  lakeEnvironment(xi,zi,dist,slope,azRipple,elRipple){
    // Reflect the camera ray about the water plane, then sample the same three
    // angular frames as the visible sky. The ripple offsets perturb all three.
    const sky=this.sky, horizontal=1/Math.sqrt(1+slope*slope),dx=xi/dist*horizontal,dz=zi/dist*horizontal,dy=slope*horizontal;
    const landX=dx+(this.travel-166)*.000060*(1-smooth(.35,.62,dy));
    const farU=.5+Math.atan2(landX,-dz)/TAU+azRipple;
    const farV=.5-Math.atan2(dy,Math.sqrt(landX*landX+dz*dz))/Math.PI+elRipple;
    const base=sky.data[clamp(Math.floor(farV*sky.h),0,sky.h-1)*sky.w+(Math.floor(farU*sky.w)&(sky.w-1))];
    const optics=this.weather.optics(farU,farV);
    if(!(optics>>>24))return base;
    const cloudX=dx+this.cloudWind[0]*dy,cloudZ=dz+this.cloudWind[1]*dy;
    const u=.5+Math.atan2(dx,-dz)/TAU+azRipple,v=.5-Math.atan(slope)/Math.PI+elRipple;
    const cloudU=.5+Math.atan2(cloudX,-cloudZ)/TAU+azRipple;
    const cloudV=.5-Math.atan2(dy,Math.sqrt(cloudX*cloudX+cloudZ*cloudZ))/Math.PI+elRipple;
    return this.weather.composite(base,optics,u,v,cloudU,cloudV);
  }
  visible(part,travel,frame){
    const dx=part.x-travel,dz=part.z+.26,r=part.rad+48;if(Math.abs(dx)>1260+r)return false;
    const fx=frame.f[0],fz=frame.f[2],ahead=fx*dx+fz*dz;
    return Math.hypot(fx,fz)<.70 || (ahead>=-r && Math.abs(fz*dx-fx*dz)*this.cosHalf-ahead*this.sinHalf<r);
  }
  project(dst,a,i,travel,frame){
    const x=a[i]-travel,y=a[i+1]-this.eye,z=a[i+2]+.26, f=frame.f,r=frame.r,u=frame.u;
    dst[0]=r[0]*x+r[1]*y+r[2]*z;dst[1]=u[0]*x+u[1]*y+u[2]*z;dst[2]=f[0]*x+f[1]*y+f[2]*z;
    dst[3]=a[i];dst[4]=a[i+2];dst[5]=a[i+9];dst[6]=a[i+10];
  }
  clip(a,b,near){const f=(near-a[2])/(b[2]-a[2]);return a.map((v,i)=>v+(b[i]-v)*f);}
  surface(a,b,c,m,rc,gc,bc){
    const near=.70,A=a[2]>=near,B=b[2]>=near,C=c[2]>=near;
    if(!A&&!B&&!C)return;
    if(!A||!B||!C){const poly=[],list=[a,b,c];let prev=c;
      for(const v of list){if((v[2]>=near)!==(prev[2]>=near))poly.push(this.clip(prev,v,near));if(v[2]>=near)poly.push(v);prev=v;}
      for(let i=1;i+1<poly.length;i++)this.raster(poly[0],poly[i],poly[i+1],m,rc,gc,bc);return;}
    this.raster(a,b,c,m,rc,gc,bc);
  }
  raster(a,b,c,m,rc,gc,bc){
    const W=this.W,H=this.H,F=this.focal,hw=W*.5,hh=H*.5,za=1/a[2],zb=1/b[2],zc=1/c[2];
    const ax=hw+F*a[0]*za,ay=hh-F*a[1]*za,bx=hw+F*b[0]*zb,by=hh-F*b[1]*zb,cx=hw+F*c[0]*zc,cy=hh-F*c[1]*zc;
    const xmin=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),xmax=Math.min(W-1,Math.floor(Math.max(ax,bx,cx)-.5)),ymin=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),ymax=Math.min(H-1,Math.floor(Math.max(ay,by,cy)-.5));
    if(xmin>xmax||ymin>ymax)return;
    const A=bx-ax,B=cx-ax,C=by-ay,D=cy-ay,area=A*D-B*C;if(Math.abs(area)<.025)return;
    const idx=1/area,dx1=D*idx,dy1=-B*idx,dx2=-C*idx,dy2=A*idx;
    const Z1=zb-za,Z2=zc-za,stepZ=dx1*Z1+dx2*Z2;
    const X0=a[3]*za,Z0=a[4]*za,U0=a[5]*za;
    const X1=b[3]*zb-X0,X2=c[3]*zc-X0,P1=b[4]*zb-Z0,P2=c[4]*zc-Z0,U1=b[5]*zb-U0,U2=c[5]*zc-U0;
    const sX=dx1*X1+dx2*X2,sP=dx1*P1+dx2*P2,sU=dx1*U1+dx2*U2;
    const row=m===11||m===13,ground=m>=10&&m<=15&&m!==12,water=m===12,tunnel=m===17,weather=m===18;
    const out=this.out,depth=this.depth,shell=this.shell,noise=this.noise,light=this.light,sky=this.sky,travel=this.travel;
    for(let y=ymin;y<=ymax;y++){
      const XX=xmin+.5-ax,YY=y+.5-ay;let w1=dx1*XX+dy1*YY,w2=dx2*XX+dy2*YY;
      let iz=za+w1*Z1+w2*Z2,px=X0+w1*X1+w2*X2,pz=Z0+w1*P1+w2*P2,uv=U0+w1*U1+w2*U2;
      for(let x=xmin,i=y*W+xmin;x<=xmax;x++,i++,w1+=dx1,w2+=dx2,iz+=stepZ,px+=sX,pz+=sP,uv+=sU){
        if(w1<-.00004||w2<-.00004||w1+w2>1.00004||iz<=depth[i]||shell[i]>>>24===255)continue;
        depth[i]=iz;const inv=1/iz,wx=px*inv,wz=pz*inv;
        const ni=((((wz*3.3)|0)&255)*256+(((wx*3.3)|0)&255))*4;
        let tone=1,R=rc,G=gc,Bl=bc;
        if(ground||weather){
          const second=((((wz*.91)|0)&255)*256+(((wx*.91)|0)&255))*4;
          tone=.86+.21*noise[second]/255+.10*noise[ni+1]/255;
          if(row&&inv<310){
            const raw=uv*inv/(m===11?.52:.43),warp=(noise[second+1]-127)*.0015+(noise[ni+1]-127)*.0014;
            const coord=raw+warp,phase=coord-Math.floor(coord);
            const strength=clamp(1-inv/(F*.53),0,1);
            const hash=(((wz*10.1|0)&255)*256+((wx*10.1|0)&255))*4;
            const stalk=noise[hash+2]/255,straw=stalk>.88?.16:0;
            tone+=strength*((Math.abs(phase-.5)-.24)*.34+.19*(noise[ni+1]/255-.5)+.16*(stalk-.5)+straw);
            if(m===11)tone*=.94+.12*noise[second+1]/255;
          }
          if(light&&ground){const lx=clamp((wx+768)*light.w/4608|0,0,light.w-1),ly=clamp((wz+960)*light.h/1920|0,0,light.h-1);tone*=(light.data[ly*light.w+lx]&255)/255;}
        }else if(water){
          const zi=wz+.26,xi=wx-travel,dist=Math.max(1,Math.sqrt(xi*xi+zi*zi)),slope=(this.eye+14)/dist;
          const tex=this.lakeEnvironment(xi,zi,dist,slope,(noise[ni]-127)*.045/sky.w,(noise[ni+1]-128)*.032/sky.h);
          const rip=.94+noise[ni+1]*.00042;
          const wind=this.wind,wr=((((wz*6.7+wind)|0)&255)*256+(((wx*.97+wind*.34)|0)&255))*4;
          const glint=noise[wr+1]/255-.5;
          R=(57*.48+(tex&255)*.52)*rip+glint*11;G=(82*.48+(tex>>8&255)*.52)*rip+glint*13;Bl=(88*.48+(tex>>16&255)*.52)*rip+glint*15;
        }else if(tunnel){tone=(.64+.38*noise[ni]/255)*this.adaptation;}
        const fog=(m===17||m===19||water)?0:clamp((inv-35)*.00048,0,.42);
        out[i]=rgbWord((R*tone*(1-fog)+177*fog)*this.exposure,(G*tone*(1-fog)+156*fog)*this.exposure,(Bl*tone*(1-fog)+145*fog)*this.exposure);
      }
    }
  }
  landscape(t,frame){
    const travel=this.travel,ia=this.v0,ib=this.v1,ic=this.v2,distH=this.focal;
    for(const p of this.patches){
      if(!this.visible(p,travel,frame))continue;
      const a=p.data;
      for(let i=0;i<a.length;i+=36){
        const m=a[i+11]|0;
        this.project(ia,a,i,travel,frame);this.project(ib,a,i+12,travel,frame);this.project(ic,a,i+24,travel,frame);
        if(ia[2]<.7&&ib[2]<.7&&ic[2]<.7)continue;
        const len=ia[2]+ib[2]+ic[2];
        if(m===17&&this.cover<.001&&len>780)continue;
        const nd=Math.abs(-.67*a[i+3]+.42*a[i+4]-.63*a[i+5]);
        const L=m===19?1:m===17?.45:.865+nd*.225;
        const r=(a[i+6]+a[i+18]+a[i+30])*85*L,g=(a[i+7]+a[i+19]+a[i+31])*85*L,b=(a[i+8]+a[i+20]+a[i+32])*85*(m===17?L*1.04:L*.985);
        this.surface(ia,ib,ic,m,r,g,b);
      }
    }
    for(const p of this.stands){if(!this.visible(p,travel,frame))continue;const a=p.data;
      for(let i=0;i<a.length;i+=7){
        const x=a[i]-travel,y=a[i+1]-this.eye,z=a[i+2]+.26;
        let zc=x*frame.f[0]+y*frame.f[1]+z*frame.f[2],zt=zc+a[i+4]*frame.f[1];if(zc<.75||zt<.75)continue;
        const X=x*frame.r[0]+y*frame.r[1]+z*frame.r[2],Y=x*frame.u[0]+y*frame.u[1]+z*frame.u[2];
        const baseX=this.W*.5+distH*X/zc,baseY=this.H*.5-distH*Y/zc;
        const topX=this.W*.5+distH*(X+a[i+4]*frame.r[1])/zt,topY=this.H*.5-distH*(Y+a[i+4]*frame.u[1])/zt;
        const width=a[i+3]*distH/zc;
        this.billboard(baseX,baseY,topX,topY,width,zc,zt,a[i+5],a[i+6]);
      }
    }
  }
  billboard(bx,by,tx,ty,width,z0,z1,species,phase){
    const H=this.H,W=this.W,height=by-ty;
    if(height<.72||width<.65||Math.max(tx,bx)+width*.5<0||Math.min(tx,bx)-width*.5>W||by<0||ty>=H)return;
    const level=clamp(Math.floor(Math.log2(220/Math.max(width,height))),0,4),a=this.atlas[level],cw=a.w/4,ch=a.h/2,ox=(species%4)*cw,oy=(species>>2)*ch;
    const flip=phase*7.167%1>.5, tint=(.91+.13*((phase*3.137)%1))*this.exposure,fog=clamp((z0-25)*.00056,0,.48);
    const light=tint*(1-fog),R=177*fog,G=157*fog,B=147*fog,slip=Math.min(4.5,this.shutter*this.focal/Math.max(z0,1)*.29);
    const invH=1/height, invW=1/width;
    for(let y=Math.max(0,Math.ceil(ty-.5));y<Math.min(H,by);y++){
      const k=(y+.5-ty)*invH,Mid=tx+(bx-tx)*k,left=Mid-width*.5,iz=1/(z1+(z0-z1)*k),row=(oy+clamp(k*ch|0,0,ch-1))*a.w+ox;
      const xl=Math.max(0,Math.ceil(left-.5)),xr=Math.min(W-1,Math.floor(left+width-.5));
      for(let x=xl,i=y*W+xl;x<=xr;x++,i++){
        if(this.depth[i]>iz||this.shell[i]>>>24===255)continue;
        const u=(x+.5-left)*invW,xx=clamp((flip?1-u:u)*cw|0,0,cw-1),p=a.data[row+xx];let alpha=(p>>>24)/255;
        let rr=p&255,gg=p>>8&255,bb=p>>16&255;
        if(slip>.7){const s=Math.min(cw-1,Math.max(1,(slip*cw*invW)|0));
          const q=a.data[row+clamp(xx-s,0,cw-1)],r=a.data[row+clamp(xx+s,0,cw-1)],aq=(q>>>24)/255,ar=(r>>>24)/255;
          const at=.54*alpha+.23*(aq+ar);if(at<.09)continue;
          rr=(rr*.54*alpha+.23*((q&255)*aq+(r&255)*ar))/at;gg=(gg*.54*alpha+.23*((q>>8&255)*aq+(r>>8&255)*ar))/at;bb=(bb*.54*alpha+.23*((q>>16&255)*aq+(r>>16&255)*ar))/at;alpha=at;
        }
        if(alpha<.14)continue;const bg=this.out[i],tr=1-alpha;
        this.out[i]=rgbWord((R+light*rr)*alpha+(bg&255)*tr,(G+light*gg)*alpha+(bg>>8&255)*tr,(B+light*bb)*alpha+(bg>>16&255)*tr);if(alpha>.48)this.depth[i]=iz;
      }
    }
  }
  draw(state,w,h,now){
    const gap=now-this.lastDraw;if(gap<28&&this.frame)return;
    this.resize(w,h);this.lastDraw=now;const t=state.t;this.travel=t*14;this.cover=boreCover(this.travel);this.cloudWind=cloudOffset(t);
    this.focal=this.H*.5/Math.tan(state.fov*DEG*.5);const f=cameraFrame(state.yaw,state.pitch),roll=.00135*Math.sin(t*1.57);
    const frame=cameraFrame(state.yaw,state.pitch+.00076*Math.sin(t*1.81),roll);this.eye=1.49+.0052*Math.sin(t*2.2);
    const half=Math.atan(Math.hypot(this.H,this.W)/(2*this.focal));this.cosHalf=Math.cos(half);this.sinHalf=Math.sin(half);
    const pose=[state.yaw,state.pitch,state.fov,this.travel];const old=this.lastPose;
    if(!old||Math.abs(old[0]-pose[0])>.0007||Math.abs(old[1]-pose[1])>.0007||Math.abs(old[2]-pose[2])>.04||Math.abs(old[3]-pose[3])>5){this.environment(f,this.travel);this.lastPose=pose;}
    const nearExit=Math.max(this.travel>=79?Math.exp(-(this.travel-79)/16):0,this.travel>=1581?Math.exp(-(this.travel-1581)/18):0);
    this.exposure=1+nearExit*.30;this.adaptation=.68+.68*this.cover;this.shutter=state.playing?1:0;this.wind=t*.27;
    this.out.set(this.env);this.depth.fill(0);this.landscape(t,frame);
    if(state.playing){this.blur.set(this.out);const src=this.blur,dst=this.out,W=this.W,H=this.H;
      const rx=this.focal*frame.r[0],uy=-this.focal*frame.u[0],fz=frame.f[0];
      for(let y=0;y<H;y++)for(let x=0,i=y*W;x<W;x++,i++){
        const iz=this.depth[i];if(iz<.027||this.shell[i]>>>24===255)continue;
        const dx=Math.round(clamp((rx-(x-W*.5)*fz)*iz*.14,-9,9)),dy=Math.round(clamp((uy-(y-H*.5)*fz)*iz*.14,-6,6));
        if((!dx&&!dy)||x<Math.abs(dx)||x>=W-Math.abs(dx)||y<Math.abs(dy)||y>=H-Math.abs(dy))continue;
        const a=i+dy*W+dx,b=i-dy*W-dx;if(this.shell[a]>>>24>127||this.shell[b]>>>24>127)continue;
        const c=src[i],l=src[a],r=src[b];
        dst[i]=rgbWord((c&255)*.46+((l&255)+(r&255))*.27,(c>>8&255)*.46+((l>>8&255)+(r>>8&255))*.27,(c>>16&255)*.46+((l>>16&255)+(r>>16&255))*.27);
      }}
    const shell=this.shell,ref=this.ref,out=this.out,cover=this.cover,winR=.042+cover*.27,shR=1-cover*.44,shG=1-cover*.58,shB=1-cover*.68;
    for(let i=0;i<out.length;i++){
      const p=shell[i],alpha=(p>>>24)/255;
      if(alpha>.995){if(cover<.001){out[i]=p;continue;}out[i]=rgbWord((p&255)*shR,(p>>8&255)*shG,(p>>16&255)*shB);continue;}
      let v=out[i],r=(v&255),g=(v>>8&255),b=(v>>16&255);
      if(this.depth[i]===0&&nearExit>.01){r*=this.exposure;g*=this.exposure;b*=this.exposure;}
      const a=ref[i],ri=winR*(a>>>24)/255;
      r=r*.995+(a&255)*ri;g=g*.995+(a>>8&255)*ri;b=b*.987+(a>>16&255)*ri;
      if(alpha>.005){r=r*(1-alpha)+(p&255)*shR*alpha;g=g*(1-alpha)+(p>>8&255)*shG*alpha;b=b*(1-alpha)+(p>>16&255)*shB*alpha;}
      out[i]=rgbWord(r,g,b);
    }
    this.ctx.putImageData(this.img,0,0);this.frame++;
    if(this.frame%27===0&&gap>115&&this.scale>.66)this.scale=Math.max(.66,this.scale-.095);
  }
}
