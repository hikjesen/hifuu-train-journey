function noiseSheet(){
  const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),img=ctx.createImageData(size,size);
  const hash=(x,y,k)=>{let n=Math.imul(x+1933,0x9e3779b1)^Math.imul(y+911,0x85ebca6b)^Math.imul(k+35,0xc2b2ae35);n^=n>>>16;n=Math.imul(n,0x45d9f3b);n^=n>>>16;return (n>>>0)/4294967295;};
  function noise(x,y,f,k){let i=Math.floor(x*f),j=Math.floor(y*f),a=x*f-i,b=y*f-j;a*=a*(3-2*a);b*=b*(3-2*b);
    const mask=f-1;const at=(a,b)=>hash(a&mask,b&mask,k);
    return (at(i,j)*(1-a)+at(i+1,j)*a)*(1-b)+(at(i,j+1)*(1-a)+at(i+1,j+1)*a)*b;}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,p=(y*size+x)*4;
    img.data[p]=255*(.46*noise(u,v,4,1)+.27*noise(u,v,8,2)+.17*noise(u,v,16,8)+.1*noise(u,v,32,10));
    img.data[p+1]=255*(.49*noise(u,v,16,4)+.29*noise(u,v,32,3)+.22*noise(u,v,64,2));
    img.data[p+2]=255*hash(x,y,12);img.data[p+3]=255;
  }ctx.putImageData(img,0,0);return canvas;
}
function cameraFrame(yaw,pitch,roll=0){
  const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),sr=Math.sin(roll),cr=Math.cos(roll);
  const f=[sy*cp,sp,-cy*cp],r=[cy,0,sy],u=[-sy*sp,cp,cy*sp];
  return {f,r:r.map((v,i)=>v*cr+u[i]*sr),u:u.map((v,i)=>v*cr-r[i]*sr)};
}
class JourneyRenderer{
  constructor(canvas,gl,pano){
    this.canvas=canvas;this.gl=gl;this.pano=pano;
    this.deriv=gl.getExtension('OES_standard_derivatives');
    this.aniso=gl.getExtension('EXT_texture_filter_anisotropic');
    this.skyP=this.program(QUAD_VS,SKY_FS);this.meshP=this.program(MESH_VS,MESH_FS);
    this.treeP=this.program(TREE_VS,TREE_FS);this.postP=this.program(QUAD_VS,COMPOSITE_FS);
    this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    this.blank=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.blank);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    this.horizon=this.texture(pano,false,true);this.grain=this.texture(noiseSheet(),true,false);
    const labels=new LabelSheet(),cabin=new Geometry(labels),land=new Geometry(labels,true);
    buildCarriage(cabin);buildCountryside(land);buildTunnels(land);
    this.labels=this.texture(labels.canvas,false,true);this.atlas=this.texture(makeTreeAtlas(),false,true);
    this.room=this.buffers(cabin.parts,12,false);this.world=this.buffers(land.parts,12,false);
    this.trees=this.buffers(land.trees,9,true);
    this.attrSlots=gl.getParameter(gl.MAX_VERTEX_ATTRIBS);this.enabled=[];
    this.quality=1;this.frame=0;this.refKey=null;this.refTime=-99;this.metric=0;
    this.white=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  }
  program(vs,fs){
    const gl=this.gl; const deriv=this.deriv?'#extension GL_OES_standard_derivatives : enable\n#define AAWIDTH(x) fwidth(x)\n':'#define AAWIDTH(x) (vDepth*.0016)\n';
    const sh=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const p=gl.createProgram(),v=sh(gl.VERTEX_SHADER,vs),f=sh(gl.FRAGMENT_SHADER,(fs.includes('AAWIDTH(')?deriv:'')+fs);
    gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    gl.deleteShader(v);gl.deleteShader(f);const u={},a={};
    for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n);}
    for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);i++){const n=gl.getActiveAttrib(p,i).name;a[n]=gl.getAttribLocation(p,n);}
    return {p,u,a};
  }
  texture(source,repeat,aniso){
    const gl=this.gl,limit=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    let w=source.naturalWidth||source.width,h=source.naturalHeight||source.height;
    if(w>limit||h>limit){const s=Math.min(limit/w,limit/h);const cv=document.createElement('canvas');cv.width=Math.floor(w*s);cv.height=Math.floor(h*s);cv.getContext('2d').drawImage(source,0,0,cv.width,cv.height);source=cv;w=cv.width;h=cv.height;}
    const power=(x)=>(x&(x-1))===0,mip=power(w)&&power(h);const tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,repeat&&mip?gl.REPEAT:gl.CLAMP_TO_EDGE);
    if(mip)gl.generateMipmap(gl.TEXTURE_2D);
    if(aniso&&this.aniso&&mip)gl.texParameterf(gl.TEXTURE_2D,this.aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return tex;
  }
  buffers(map,stride,isTree){
    const gl=this.gl,parts=[];
    for(const p of map.values()){
      const a=p.values;if(!a.length)continue;let loX=Infinity,hiX=-Infinity,loZ=Infinity,hiZ=-Infinity;
      for(let i=0;i<a.length;i+=stride){loX=Math.min(loX,a[i]);hiX=Math.max(hiX,a[i]);loZ=Math.min(loZ,a[i+2]);hiZ=Math.max(hiZ,a[i+2]);}
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);
      parts.push({buffer,count:a.length/stride,x:(loX+hiX)/2,z:(loZ+hiZ)/2,r:Math.hypot(hiX-loX,hiZ-loZ)/2+(isTree?23:6)});
      p.values=null;
    }map.clear();return parts;
  }
  target(w,h){
    const gl=this.gl,f=gl.createFramebuffer(),tex=gl.createTexture(),z=gl.createRenderbuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindRenderbuffer(gl.RENDERBUFFER,z);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,z);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Framebuffer dimensions unsupported');
    return {f,tex,z,w,h};
  }
  resize(w,h){
    const gl=this.gl;const pixelScale=Math.min(devicePixelRatio||1,1.45,1970/Math.max(w,h))*this.quality;
    const W=Math.max(2,Math.round(w*pixelScale)),H=Math.max(2,Math.round(h*pixelScale));
    if(W===this.canvas.width&&H===this.canvas.height&&this.scene)return;
    this.canvas.width=W;this.canvas.height=H;
    for(const t of [this.scene,this.ref])if(t){gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.f);gl.deleteRenderbuffer(t.z);}
    this.scene=this.target(W,H);this.ref=this.target(Math.max(8,Math.round(W*.40)),Math.max(8,Math.round(H*.40)));this.refKey=null;
  }
  use(pr,kit,frames=kit.base){
    const gl=this.gl;gl.useProgram(pr.p);
    const values={...kit,...frames};
    for(const [name,loc] of Object.entries(pr.u)){
      const v=values[name];if(v==null)continue;
      if(v.tex){gl.activeTexture(gl.TEXTURE0+v.slot);gl.bindTexture(gl.TEXTURE_2D,v.tex);gl.uniform1i(loc,v.slot);}
      else if(typeof v==='number')gl.uniform1f(loc,v);
      else if(v.length===2)gl.uniform2fv(loc,v);else if(v.length===3)gl.uniform3fv(loc,v);
    }
    const active=Object.values(pr.a);
    for(const i of this.enabled)if(!active.includes(i))gl.disableVertexAttribArray(i);
    for(const i of active)if(!this.enabled.includes(i))gl.enableVertexAttribArray(i);
    this.enabled=active;
  }
  attrs(pr,layout,stride){
    const gl=this.gl;let offset=0;
    for(const [n,size] of layout){const loc=pr.a[n];if(loc!==undefined)gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride*4,offset*4);offset+=size;}
  }
  screen(pr,kit,frame){
    const gl=this.gl;this.use(pr,kit,frame);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);this.attrs(pr,[['aCorner',2]],2);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  meshes(pr,parts,kit,frame,trees,culled=false){
    const gl=this.gl;this.use(pr,kit,frame);const fx=frame.uForward[0],fz=frame.uForward[2],horizontal=Math.hypot(fx,fz);
    const cosHalf=1/Math.sqrt(1+kit.uLens[0]*kit.uLens[0]+kit.uLens[1]*kit.uLens[1]);
    const sinHalf=Math.sqrt(1-cosHalf*cosHalf);
    const layout=trees?[['aPos',3],['aTree',4],['aUv',2]]:[['aPos',3],['aNorm',3],['aColor',3],['aUv',2],['aMat',1]];
    for(const b of parts){
      if(culled){const dx=b.x-kit.uOrigin,dz=b.z,rad=b.r+48;
        if(Math.abs(dx)>1290+rad||Math.abs(dz)>1180+rad)continue;
        const ahead=fx*dx+fz*dz,side=Math.abs(fz*dx-fx*dz);
        if(horizontal>.72&&(ahead< -rad||side*cosHalf-ahead*sinHalf>rad+25))continue;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);this.attrs(pr,layout,trees?9:12);gl.drawArrays(gl.TRIANGLES,0,b.count);
    }
  }
  dest(target){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.f:null);gl.viewport(0,0,target?target.w:this.canvas.width,target?target.h:this.canvas.height);}
  draw(state,w,h,now){
    this.resize(w,h);const gl=this.gl,t=state.t,travel=t*14,cover=boreCover(travel);
    const sway=state.motion?1:0;
    const roll=sway*(.0015*Math.sin(t*1.57)+.00051*Math.sin(t*5.8));
    const frame=cameraFrame(state.yaw+.00062*sway*Math.sin(t*2.05),state.pitch+.00144*sway*Math.sin(t*1.81),roll);
    const base={uRight:frame.r,uUp:frame.u,uForward:frame.f,uEye:[.008*sway*Math.sin(t*1.8),1.49+sway*(.0052*Math.sin(t*2.2)+.0017*Math.sin(t*7.2)),-.26+sway*.0042*Math.sin(t*1.45)]};
    const tangent=Math.tan(state.fov*DEG*.5),aspect=w/h,side=frame.f[2]>0?1:-1;
    const score=BORES.reduce((s,[a,b])=>{const inside=travel-a,out=travel-b;
      return Math.max(s,inside>0&&out<0?(1-Math.exp(-inside/23)):out>=0?Math.exp(-out/18):0);},0);
    const exposed=(travel>79? .27*Math.exp(-(travel-79)/13):0)+(travel>1581?.34*Math.exp(-(travel-1581)/20):0);
    const kit={uLens:[tangent*aspect,tangent],base,uClock:t,uTravel:travel,uOrigin:travel,uInterior:0,uMirror:0,uCabinLight:1-cover*.92,uAdapt:.65+.97*score,
      uSky:{tex:this.horizon,slot:0},uGrain:{tex:this.grain,slot:1},uLabels:{tex:this.labels,slot:2},uTrees:{tex:this.atlas,slot:3}};
    this.dest(this.scene);gl.clearColor(.05,.045,.05,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);
    this.screen(this.skyP,kit,base);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    this.meshes(this.meshP,this.world,kit,base,false,true);this.meshes(this.treeP,this.trees,kit,base,true,true);
    const refKey=[side,state.yaw,state.pitch,state.fov,cover];
    if(!this.refKey||this.frame%5===0&&(refKey.some((v,i)=>Math.abs(v-this.refKey[i])>.0018)||now-this.refTime>550)){
      this.dest(this.ref);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const mirror=v=>[v[0],v[1],-v[2]],e=base.uEye;const refl={uForward:mirror(frame.f),uRight:mirror(frame.r),uUp:mirror(frame.u),uEye:[e[0],e[1],side*3.04-e[2]],uInterior:1,uOrigin:0,uMirror:1};
      this.meshes(this.meshP,this.room,kit,refl,false);this.refKey=refKey;this.refTime=now;
    }
    this.dest(null);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);
    this.screen(this.postP,kit,{...base,uWorld:{tex:this.scene.tex,slot:4},uReflection:{tex:this.ref.tex,slot:5},uSide:side,uPhoto:1+exposed,uCover:cover,uShutter:state.playing?.278:0,uPixel:[1/this.canvas.width,1/this.canvas.height]});
    gl.enable(gl.DEPTH_TEST);this.meshes(this.meshP,this.room,kit,{...base,uInterior:1,uOrigin:0},false);
    this.frame++;
  }
}
