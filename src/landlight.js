// A once-baked dusk shadow map. One texel covers 2.25 m along the railway.
// Canvas top is world z=-960. Its left edge is world x=-768.
function makeLandLight(trees) {
  const light = document.createElement('canvas');
  light.width = 2048; light.height = 1024;
  const ctx = light.getContext('2d', {alpha:false});
  const sx=light.width/4608, sz=light.height/1920;
  const sunHorizontal=Math.hypot(.66,.72), dx=.66/sunHorizontal, dz=.72/sunHorizontal;
  const projectedLength=sunHorizontal/.25;
  const stampW=50, stampH=76, anchorX=25, anchorY=9, axisLength=62;
  const stamps=new Map();
  const clamp01 = v => Math.max(0,Math.min(1,v));

  function stamp(species,variant) {
    const key=species*4+variant;
    if(stamps.has(key)) return stamps.get(key);
    const pixels=new Uint8Array(stampW*stampH);
    let seed=(0xb7ef1+key*0x9175)>>>0;
    const rnd=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
    const noise=new Float32Array(32*32);
    for(let i=0;i<noise.length;i++)noise[i]=rnd();
    function sample(x,y) {
      const a=Math.floor(x),b=Math.floor(y),fx=x-a,fy=y-b;
      const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
      const at=(i,j)=>noise[(i&31)+(j&31)*32];
      return (at(a,b)*(1-u)+at(a+1,b)*u)*(1-v)+(at(a,b+1)*(1-u)+at(a+1,b+1)*u)*v;
    }
    const phase=rnd()*Math.PI*2, isBroad=species===0||species===1||species===6;
    const isLarch=species===2||species===3, grass=species===7;
    const base=isBroad?(species===6?.20:.29):isLarch?.15:.065;
    for(let j=0;j<stampH;j++)for(let i=0;i<stampW;i++) {
      const t=(j+.5-anchorY)/axisLength, x=(i+.5-anchorX)/17.4;
      const bend=.077*Math.sin(t*5.3+phase)*t+.025*Math.sin(t*10.1+phase);
      const p=x-bend, coarse=sample(p*3.9+5,t*9.1+7), fine=sample(p*12+3,t*25+3);
      let leaf=0;
      if(t>base-.04 && t<1.045) {
        const u=clamp01((t-base)/(1-base));
        let r=isBroad ? Math.pow(4*u*(1-u),.51)*(.87+.12*Math.sin(u*5.4+phase)) :
          Math.pow(1-u,.68)*clamp01((u+.025)*9.4);
        if(grass) r=.85*Math.pow(1-u,.64)*Math.sin(Math.PI*(.12+.86*u));
        const serration=isBroad?1:(.92+.08*Math.sin(t*88+phase+.6*Math.sin(t*29+phase)));
        r*=serration*(.84+.28*sample(Math.sign(x)*4.8+5,t*10.2));
        const edge=.115+.052*u;
        const interior=clamp01((r-Math.abs(p)+(coarse-.5)*.13)/edge+.48);
        const density=grass?.31:isBroad?.71:isLarch?.76:.88;
        const lace=isBroad ? .65+.49*coarse : isLarch ? .72+.39*coarse : .85+.22*coarse;
        leaf=interior*density*lace*(.87+.23*fine);
        // Individual small crown openings survive in big, nearby trees.
        if(isBroad || grass) leaf*=.63+.37*clamp01((fine+coarse*.42-.26)*2.5);
      }
      const trunk=(grass?.08:.46)*Math.exp(-Math.pow(p/(isBroad?.038:.041),2)*1.75)*
        clamp01((.85-t)*6)*clamp01((t+.018)*48);
      const contact=(grass?.20:.43)*Math.exp(-(p*p*3.9+t*t*225));
      const alpha=clamp01(1-(1-leaf)*(1-trunk)*(1-contact));
      pixels[j*stampW+i]=Math.round(255*alpha);
    }
    stamps.set(key,pixels); return pixels;
  }

  // The light direction is fixed, so trees of a similar measured size can
  // share the final raster footprint. Accumulate only covered texels.
  const footprints=new Map(), transmission=new Uint8Array(light.width*light.height).fill(255);
  function footprint(species,variant,width,height) {
    const grass=species===7, step=grass?.3:1.0;
    const wi=Math.max(1,Math.round(width/step)), hi=Math.max(1,Math.round(height/step));
    const key=(((species*4+variant)*64+wi)*96+hi);
    let out=footprints.get(key);
    if(out)return out;
    const brush=stamp(species,variant), sw=step*wi/34.8, sl=step*hi*projectedLength/axisLength;
    const offX=-dz*sw*sx,offY=dx*sw*sz,alongX=dx*sl*sx,alongY=dz*sl*sz;
    const corners=[
      [-anchorX,-anchorY],[stampW-anchorX,-anchorY],
      [-anchorX,stampH-anchorY],[stampW-anchorX,stampH-anchorY]
    ];
    const xx=corners.map(([u,v])=>u*offX+v*alongX), yy=corners.map(([u,v])=>u*offY+v*alongY);
    const left=Math.floor(Math.min(...xx)),right=Math.ceil(Math.max(...xx));
    const top=Math.floor(Math.min(...yy)),bottom=Math.ceil(Math.max(...yy));
    const indices=[], clear=[];
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++) {
      const wx=x/sx,wz=y/sz;
      const u=anchorX-.5+(-dz*wx+dx*wz)/sw,v=anchorY-.5+(dx*wx+dz*wz)/sl;
      if(u<0 || u>=stampW-1 || v<0 || v>=stampH-1)continue;
      const i=u|0,j=v|0,fx=u-i,fy=v-j,k=j*stampW+i;
      const a=brush[k]+fx*(brush[k+1]-brush[k]);
      const b=brush[k+stampW]+fx*(brush[k+stampW+1]-brush[k+stampW]);
      const alpha=Math.round(a+(b-a)*fy);
      if(alpha<3)continue;
      indices.push(y*light.width+x); clear.push(255-alpha);
    }
    out={left,right,top,bottom,offset:new Int32Array(indices),clear:new Uint8Array(clear)};
    footprints.set(key,out);return out;
  }
  for(const tree of trees) {
    const [x,,z,width,height,species,phase]=tree;
    if(!(height>0 && width>0))continue;
    const variant=Math.min(2,Math.trunc(Math.abs(phase*23.617%1)*3));
    // The two birches and the two spruces differ in foliage colour; their
    // cast-light profiles have the same physical crown architecture.
    const family=species===1?0:species===3?2:species===5?4:species;
    const f=footprint(family,variant,width,height);
    const X=Math.round((x+768)*sx),Y=Math.round((z+960)*sz),base=Y*light.width+X;
    const touchesEdge=X+f.left<0 || X+f.right>=light.width || Y+f.top<0 || Y+f.bottom>=light.height;
    if(X+f.right<0 || X+f.left>=light.width || Y+f.bottom<0 || Y+f.top>=light.height)continue;
    for(let k=0;k<f.offset.length;k++) {
      const offset=f.offset[k], i=base+offset;
      if(touchesEdge) {
        const dy=Math.round(offset/light.width), col=X+offset-dy*light.width;
        if(i<0||i>=transmission.length||col<0||col>=light.width)continue;
      }
      transmission[i]=(transmission[i]*f.clear[k]+127)/255;
    }
  }
  // The sky still illuminates overlapping shadows. Preserve white sunlight
  // and give the darkest overlapping firs a blue-grey ambient floor.
  const image=ctx.createImageData(light.width,light.height), packed=new Uint32Array(image.data.buffer);
  const lut=new Uint32Array(256);
  const floor=[161,168,179];
  // Packing explicit RGBA bytes also works on big-endian platforms.
  const bytes=new Uint8Array(lut.buffer);
  for(let k=0;k<256;k++){
    for(let ch=0;ch<3;ch++)bytes[k*4+ch]=Math.round(floor[ch]+(255-floor[ch])*k/255);
    bytes[k*4+3]=255;
  }
  for(let i=0;i<transmission.length;i++) packed[i]=lut[transmission[i]];
  ctx.putImageData(image,0,0);
  return light;
}
