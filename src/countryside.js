// All coordinates are metres.  The negative-Z bank faces the mountain.
function makeTreeAtlas() {
  const atlas = document.createElement('canvas');
  atlas.width = 1024; atlas.height = 1024;
  const ctx = atlas.getContext('2d');
  const W = 256, H = 512;
  function random(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  const ramps = [
    ['#4e4c2f','#86733a','#b49445','#d2b45e','#ead387'],
    ['#474a34','#78743b','#999348','#b9a653','#d9c77c'],
    ['#424334','#775e37','#a07a41','#c59651','#dfbc77'],
    ['#444631','#74683c','#9e8541','#c0a34f','#ddc472'],
    ['#202d29','#314234','#4a5740','#606545','#8b845a'],
    ['#22312f','#35493d','#4c6050','#687664','#89917b'],
    ['#514336','#805437','#a0643d','#c3804c','#e2a46b'],
    ['#595444','#7b7351','#9f915e','#baa672','#dbca9a']
  ];
  function palette(stops) {
    const rgb = stops.map(s => [1,3,5].map(i => parseInt(s.slice(i,i+2),16)));
    return Array.from({length:64}, (_, i) => {
      const k = i * (rgb.length - 1) / 63, a = Math.min(rgb.length-2, k|0), t = k-a;
      return 'rgb('+rgb[a].map((n,j)=>Math.round(n+(rgb[a+1][j]-n)*t)).join(',')+')';
    });
  }
  for (let species = 0; species < 8; species++) {
    const r = random(310379 + species * 37591);
    const range = (a,b) => a+(b-a)*r();
    const colors = palette(ramps[species]);
    const tint = v => colors[Math.max(0,Math.min(63, (v * 63)|0))];
    ctx.save();
    ctx.translate((species % 4) * W, (species >> 2) * H);
    ctx.beginPath(); ctx.rect(2, 2, W-4, H-3); ctx.clip();
    const line = (x1,y1,x2,y2,width,color) => {
      ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath();
      ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    };
    const taper = (p,q,a,b,c) => {
      const dx=q[0]-p[0], dy=q[1]-p[1], inv=1/(Math.hypot(dx,dy)||1);
      const ux=-dy*inv*.5, uy=dx*inv*.5;
      ctx.fillStyle=c;
      ctx.beginPath(); ctx.moveTo(p[0]+a*ux,p[1]+a*uy);
      ctx.lineTo(q[0]+b*ux,q[1]+b*uy); ctx.lineTo(q[0]-b*ux,q[1]-b*uy);
      ctx.lineTo(p[0]-a*ux,p[1]-a*uy); ctx.closePath(); ctx.fill();
    };
    if (species === 7) {
      // Japanese silver grass. Light catches individual seed awns.
      for (let i=0;i<125;i++) {
        const base = range(79,173), h=range(92,440), lean=range(-100,100);
        const x=base+lean*.83, y=508-h*.72, tipx=x+lean*.35, tipy=y+range(12,97);
        ctx.strokeStyle=tint(range(.12,.76));
        ctx.lineWidth=range(1.0,2.9); ctx.beginPath();ctx.moveTo(base,509);
        ctx.quadraticCurveTo(base+lean*.55,505-h*.84,tipx,tipy);ctx.stroke();
      }
      for (let i=0;i<34;i++) {
        const base=range(88,165), h=range(245,455), lean=range(-81,80);
        const x=base+lean*.74,y=509-h, endx=x+lean*.41+range(-4,18), endy=y+range(-28,9);
        ctx.strokeStyle=tint(range(.40,.7));ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(base,509);
        ctx.quadraticCurveTo(base+lean*.25,509-h*.76,x,y);ctx.stroke();
        for(let j=0;j<31;j++){
          const t=r(), px=x+(endx-x)*t, py=y+(endy-y)*t-Math.sin(t*Math.PI)*7;
          const spread=(1-t*.65)*range(3,13);
          line(px,py,px+range(-1,1)*spread+4,py-range(4,15),range(.65,1.45),tint(range(.66,1)));
        }
      }
    } else if (species===0 || species===1 || species===6) {
      const birch=species!==6;
      const wood=[], leaves=[], knots=[], trunks=[];
      const stems=species===0 ? [[122,490,18,1],[139,333,-30,.63]] :
        species===1 ? [[133,482,-16,1],[121,394,42,.62]] : [[126,470,8,1],[130,356,-24,.74]];
      function twig(p, dx, dy, width, level, side, factor) {
        const q=[p[0]+dx,p[1]+dy];
        wood.push([p,q,width,Math.max(.38,width*.56)]);
        if(level<2 || (level===2 && r()<.45)) {
          const n=level===0 ? 1 : 2;
          for(let k=0;k<n;k++){
            const t=range(.25,1);
            leaves.push([p[0]+dx*t,p[1]+dy*t,
              range(3.6,7.3)*factor,range(6.2,12.4)*factor,range(.16,.78)]);
          }
        }
        if(level===0) return;
        const l=Math.hypot(dx,dy), angle=Math.atan2(dx,-dy), keep=range(.59,.73);
        for(let k=0;k<2;k++){
          let a=angle+(k?1:-1)*range(.26,.71);
          if (level===1 && birch) a+=side*.25;
          const len=l*keep*range(.75,1.08);
          twig(q,Math.sin(a)*len,-Math.cos(a)*len,width*.59,level-1,side,factor);
        }
      }
      for(const [base,height,lean,scale] of stems) {
        const phase=range(0,6), sway=range(2,5);
        const trunkPoint=(t)=>[base+lean*(t*.4+t*t*.6)+sway*t*Math.sin(t*9+phase),
                               508-height*t];
        const radius=birch?7.7:10.4;
        for(let i=0;i<29;i++) {
          const t=i/29;
          trunks.push([trunkPoint(t),trunkPoint((i+1)/29),(.30+radius*(1-t))*scale,
            (.30+radius*(1-(i+1)/29))*scale,t]);
        }
        if(birch) for(let i=0;i<108*scale;i++){
          const t=r(), p=trunkPoint(t), rad=(.30+radius*(1-t))*scale;
          knots.push([p[0]+range(-.25,.25)*rad,p[1],rad*range(.12,.72),range(.45,1.5)]);
        }
        const count=Math.round((birch?68:59)*scale);
        for(let i=0;i<count;i++) {
          const t=.20+.784*((i+r())/count), p=trunkPoint(t);
          const azimuth=phase+i*2.39996+range(-.32,.32);
          const side=Math.cos(azimuth)<0?-1:1, u=(t-.20)/.79;
          const envelope=(.38+.62*Math.pow(Math.sin(Math.PI*Math.pow(u,.82)),.64)) *
            Math.min(1,(1-u)*4.2+.1);
          // The spiral places some twigs in front of the trunk. Foreshortening
          // those branches keeps the silver birch's inner crown naturally open.
          const foreshorten=.13+.87*Math.abs(Math.cos(azimuth));
          const dx=side*range(22,55)*envelope*foreshorten*(birch?1:1.15)*Math.sqrt(scale);
          const dy=-range(18,48)*Math.sqrt(scale)*(.64+.36*envelope)+7*Math.sin(azimuth);
          twig(p,dx,dy,range(1.3,3.0)*scale*(1-t*.48),3,side,Math.sqrt(scale));
        }
      }
      let minX=Infinity,maxX=-Infinity,minY=999;
      for(const s of leaves){ minX=Math.min(minX,s[0]-s[2]*1.4);maxX=Math.max(maxX,s[0]+s[2]*1.4);minY=Math.min(minY,s[1]-s[3]*1.2); }
      const sx=234/(maxX-minX), sy=488/(508-minY);
      ctx.translate(11-minX*sx,508-508*sy);ctx.scale(sx,sy);
      const drawLeaves=(front)=>{
        for(const [x,y,rx,ry,depth] of leaves) {
          if((depth>.53)!==front) continue;
          const illum=.048 + .37*(1-(x-minX)/(maxX-minX))+
            .16*(1-(y-minY)/(508-minY)) + (depth-.16)*.36;
          const count=birch?21:29, acc=range(-.12,.12);
          for(let j=0;j<count;j++){
            const phi=range(0,Math.PI*2), dist=Math.sqrt(r()),
              px=x+Math.cos(phi)*dist*rx, py=y+Math.sin(phi)*dist*ry;
            const size=range(.75,birch?2.05:2.25);
            ctx.fillStyle=tint(illum+acc+range(-.15,.32)-.11*Math.sin(phi)*dist);
            ctx.beginPath();ctx.ellipse(px,py,size,size*range(.60,1.23),range(-1.3,1.3),0,Math.PI*2);ctx.fill();
          }
        }
      };
      drawLeaves(false);
      for(const s of wood) taper(s[0],s[1],s[2],s[3],birch?'#5e5945':'#685641');
      for(const [p,q,a,b,t] of trunks) {
        taper(p,q,a,b,birch?'#736f5e':'#6b5740');
        taper([p[0]-a*.15,p[1]],[q[0]-b*.15,q[1]],a*.59,b*.59,
          birch ? (t<.11?'#a09a83':'#d1c7a6') : '#8d7554');
      }
      ctx.fillStyle='#57594b';
      for(const [x,y,w,h] of knots) ctx.fillRect(x-w/2,y,w,h);
      drawLeaves(true);
    } else {
      const larch=species===2 || species===3, top=17, bottom=larch?429:474;
      const tx = y => 129+Math.sin(y*.012+.4)*2.7+(508-y)*.009*(species%2?1:-1);
      for(let k=0;k<33;k++){
        const y=top+(508-top)*k/33, yy=top+(508-top)*(k+1)/33;
        taper([tx(y),y],[tx(yy),yy],.5+k*.16,.66+k*.16,'#665c47');
        line(tx(y)-k*.043,y,tx(yy)-k*.044,yy,Math.max(.45,k*.044),'#9a8767');
      }
      // Thin hanging branchlets interrupt each whorl. Both branch spacing and
      // the upward turn of individual tips vary across the crown.
      const count=larch?105:154;
      for(let i=count-1;i>=0;i--) {
        const t=(i+r()*.82)/count, y=top+t*(bottom-top);
        const side=(i%2?1:-1), envelope=Math.pow(t,.78)*(1-.28*Math.max(0,(t-.65)/.35));
        const len=(12+112*envelope)*range(.67,1.02);
        const droop=range(-8,16)+13*t, lift=range(7,23)*(larch?1:.69);
        const cx=tx(y), phase=range(0,6.28);
        function point(u) {
          return [cx+side*len*u,y+droop*u-lift*u*u+Math.sin(u*Math.PI)*range(.8,2.5)];
        }
        const end=point(1);
        ctx.strokeStyle=tint(.10+range(.02,.14));ctx.lineWidth=.8+1.4*t;
        ctx.beginPath();ctx.moveTo(cx,y);ctx.quadraticCurveTo(cx+side*len*.66,y+droop*.73,end[0],end[1]);ctx.stroke();
        const n=Math.round(7+len*.31); 
        for(let j=0;j<n;j++) {
          const u=(j+r())/n, q=point(u), plume=(1-u*.61)*(.32+.68*t);
          const fall=range(6,31)*plume, towards=side*range(1.7,9.8);
          const illum=.18+.15*(1-t)+.11*(side===-1)+.18*u+range(-.15,.14);
          const strand=larch?5:7;
          for(let m=0;m<strand;m++) {
            const v=m/strand, bx=q[0]+towards*v, by=q[1]+fall*v;
            const needle=(1-v*.7)*range(2.0,8.1);
            line(bx-1.45,by,bx+towards*.54,by+needle,range(.82,1.8),tint(illum+range(-.01,.18)));
            if(larch || r()<.62) line(bx,by,bx-side*range(.9,4.3),by-range(1.3,5.3),range(.64,1.45),tint(illum+range(.04,.28)));
          }
          if (r()<.28) line(q[0],q[1],q[0]+side*3.4,q[1]-4.6,1,tint(illum+.29));
        }
        if(i<9) line(cx,y,cx+Math.sin(phase)*5,y-7,1,tint(.54));
      }
    }
    ctx.restore();
  }
  return atlas;
}

function buildCountryside(g) {
  const pi=Math.PI, sin=Math.sin, cos=Math.cos;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
  let state=0x76e982ab;
  function rnd(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}
  const range=(a,b)=>a+(b-a)*rnd();
  function hash(a,b,c=0){
    let h=(Math.imul(a|0,1597334677)^Math.imul(b|0,3812015801)^Math.imul(c|0,2798796415))|0;
    h=Math.imul(h^(h>>>16),0x27d4eb2d);return ((h^(h>>>15))>>>0)/4294967296;
  }
  // A gently indented glacial basin. A single horizontal water surface
  // intersects the continuous ground and exposes the coves and islands.
  const waterY=-14, lakeA=-690, lakeB=1650;
  function lake(x){
    const u=(x-(lakeA+lakeB)*.5)/((lakeB-lakeA)*.5);
    const envelope=Math.sqrt(Math.max(0,1-u*u));
    const mid=171+36*sin(.0045*x-.53)+15*sin(.0103*x+.44)+7*sin(.021*x+1.0);
    const width=108*envelope*(.98+.14*sin(.0067*x+.7)+.064*sin(.022*x+.13));
    return [mid-width,mid+width];
  }
  function shoreDistance(x,d,s){
    if(s>0) return 1000;
    const l=lake(x), outside=Math.max(0,lakeA-x,x-lakeB);
    return Math.max(l[0]-d,d-l[1])+outside*.76;
  }
  function ground(x,d,s){
    const n=.63*sin(x*.0102+d*.015*s)+.37*sin(x*.0181-d*.023+1.9);
    const roll= .55*sin(x*.0043-d*.009*s)+.32*sin(x*.0101+d*.0133)+.2*sin(x*.025+d*.033);
    let h=-1.02-smooth(2.15,7.8,d)*(3.56+.62*n) -
      smooth(8,115,d)*(4.7+3.0*roll) + smooth(100,294,d)*(.8+1.5*n);
    h+= smooth(185,765,d)*(27+17*sin(x*.0032+d*.007)+8*sin(x*.0071-d*.012*s)+5*n);
    h+=smooth(290,490,d)*(6*cos(x*.0064+d*.016));
    const sh=shoreDistance(x,d,s);
    if(sh<67) {
      const bed=waterY+Math.max(-6.9,sh*(.20+.05*n))+(.28*n+.18*sin(x*.05+d*.046));
      h=h+(bed-h)*(1-smooth(4,67,sh))*smooth(6,22,d);
    }
    return h;
  }
  function islet(x,d){
    // Two glacial gravel spits, one long and low, one crowned with larch.
    const k1=Math.pow((x-720)/95,2)+Math.pow((d-174-.085*(x-720))/14,2);
    const k2=Math.pow((x-1040)/48,2)+Math.pow((d-172+.07*(x-1040))/11,2);
    return Math.min(k1,k2);
  }
  function height(x,d,s){
    const h=ground(x,d,s);
    if(s<0 && x>590 && x<1120 && d>110 && d<245){
      const q=islet(x,d);
      if(q<4) return Math.max(h,waterY+2.4-q*3.1);
    }
    return h;
  }
  const dMarks=[0,1.5,2.25,3.3,4.8,6.3,8.2,11,15,20,25,30,36,42,48,54,60,66,72,81,90,99,108,120,132,144,156,168,180,198,216,234,252,270,288,312,336,360,396,432,468,504,552,600,666,744,832,952];
  const xMin=-768,xMax=3840,dx=18,N=Math.round((xMax-xMin)/dx)+1;
  const sideData={};
  function warp(x,d,s){
    return [x+d*.12+Math.min(d*.034,7)*sin(d*.009+x*.0028),
      d+sin(x*.0052+d*.0047+s*.9)*Math.min(d*.07,11)];
  }
  function gridGround(x,z) {
    const s=z<0?-1:1,d=Math.abs(z), data=sideData[s];
    if(!data) return height(x,d,s);
    let u=x-d*.12,v=d;
    for(let i=0;i<2;i++){const q=warp(u,v,s);u+=x-q[0];v+=d-q[1];}
    const j=clamp(Math.floor((u-xMin)/dx),0,N-2);
    let lo=0,hi=dMarks.length-1;
    while(lo+1<hi){const k=(lo+hi)>>1;if(dMarks[k]<=v)lo=k;else hi=k;}
    const A=data[j][lo],B=data[j+1][lo],C=data[j+1][lo+1],D=data[j][lo+1];
    const px=x-A[0],pz=z-A[2],det=(P,Q)=>(P[0]-A[0])*(Q[2]-A[2])-(Q[0]-A[0])*(P[2]-A[2]);
    const interp=(P,Q)=>{
      const den=det(P,Q);
      const b=(px*(Q[2]-A[2])-(Q[0]-A[0])*pz)/den,
        c=((P[0]-A[0])*pz-px*(P[2]-A[2]))/den;
      return A[1]+b*(P[1]-A[1])+c*(Q[1]-A[1]);
    };
    const side=(C[0]-A[0])*pz-(C[2]-A[2])*px;
    return side*det(C,B)>=0 ? interp(C,B) : interp(D,C);
  }
  const soilStops=[[100,95,62],[112,104,68],[136,123,78],[152,133,84]];
  const greenStops=[[55,66,49],[69,78,53],[85,89,57],[118,107,67]];
  const shoreStops=[[94,94,63],[113,107,73],[137,121,85],[158,140,102]];
  const rgbHex=(rgb)=>'#'+rgb.map(x=>Math.round(clamp(x,0,255)).toString(16).padStart(2,'0')).join('');
  function blendRamp(stops,t){
    t=clamp(t,0,.9999)*(stops.length-1);
    const k=t|0;
    return rgbHex(stops[k].map((v,j)=>v+(stops[k+1][j]-v)*(t-k)));
  }
  function groundColor(P,s){
    const x=P[0],d=Math.abs(P[2]);
    const t=.47+.19*sin(.026*x+d*.021)+.12*sin(x*.063-d*.047)+.11*sin(.063*d+x*.043);
    const coast=shoreDistance(x,d,s);
    const stops=coast<7 ? shoreStops : d>280 || (x>1510&&x<2250&&d>64) ? greenStops:soilStops;
    return blendRamp(stops,t);
  }
  const crops=['#c3a35a','#b39a59','#c5a75c','#ad9259','#b69c5c','#d0ac64','#a18955','#b59a65','#bb9d55','#c7a762','#a4975e','#c0a167'];
  const harvested=['#ac8d61','#b49969','#a78960','#aa9169','#b2966b','#ba9c6e'];
  function fieldInfo(row,band,s,d,x) {
    const h=hash(row,band,s+3), mixed=hash(row*3-11,band+15,s+8);
    const isHarvest=h>.66;
    const colors=isHarvest?harvested:crops;
    const color=colors[(mixed*colors.length)|0];
    // Parcel families follow similar orientations. Adjacent owners leave the
    // occasional plot turned across the valley for a fan of oblique furrows.
    const angle=.30+.16*sin(row*.34+s)+.16*(h-.5)+(mixed>.65?.86:0);
    return {color,mat:isHarvest?11:13,angle,id:(row*173+band)*3+s};
  }
  function tileGround(P,Q,R,S,s,colorMap) {
    if(g.vtri){
      g.vtri(P,Q,R,colorMap(P),colorMap(Q),colorMap(R),10);
      g.vtri(P,R,S,colorMap(P),colorMap(R),colorMap(S),10);
    } else g.quad(P,Q,R,S,colorMap(P),10);
  }
  function rowUV(p,angle){
    const ca=cos(angle),sa=sin(angle);
    return [-p[0]*sa+p[2]*ca,p[0]*ca+p[2]*sa];
  }
  function flatStrip(A,B,C,D,t0,t1,color) {
    const lerp=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t+.08,p[2]+(q[2]-p[2])*t];
    g.quad(lerp(A,D,t0),lerp(B,C,t0),lerp(B,C,t1),lerp(A,D,t1),color,10);
  }
  for(const s of [-1,1]){
    const data=Array.from({length:N},(_,i)=>dMarks.map(d=>{
      const [x,w]=warp(xMin+i*dx,d,s);
      return [x,height(x,w,s),s*w];
    }));
    sideData[s]=data;
    for(let i=0;i<N-1;i++) for(let j=0;j<dMarks.length-1;j++){
      const A=data[i][j], B=data[i+1][j], C=data[i+1][j+1], D=data[i][j+1];
      const w=(Math.abs(A[2])+Math.abs(C[2]))*.5, x=(A[0]+C[0])*.5, nominalX=xMin+(i+.5)*dx;
      const coast=shoreDistance(x,w,s), parcelBand=Math.floor((dMarks[j]+dMarks[j+1])/72);
      const owner=Math.floor((i+((parcelBand*3)%5))/5);
      const wooded=x>1510&&x<2260 && w>45 && (w<195 || s>0);
      const open = w>9.6 && w < (s<0 ? 259:219) && coast>9 && !wooded;
      const field=open && (hash(owner,parcelBand,11+s)>.07 || w<81);
      const p=s<0?[A,B,C,D]:[A,D,C,B];
      if(field) {
        const t=fieldInfo(owner,parcelBand,s,w,nominalX);
        g.quad(...p,t.color,t.mat,p.flatMap(P=>rowUV(P,t.angle)));
        if((i+1+(parcelBand*3)%5)%5===0) flatStrip(A,D,C,B,.955,1,'#867c52');
        if(dMarks[j+1]%36===0) flatStrip(A,B,C,D,1-Math.min(.17,.55/(dMarks[j+1]-dMarks[j])),1,'#938651');
      } else if (w<3.35) {
        g.quad(...p,'#716d65',15);
      } else if (coast<-5 && p.every(P=>P[1]<waterY-.45)) {
        // The opaque lake covers its bed. Avoid needless per-vertex colour work.
        g.quad(...p,'#635f49',10);
      } else {
        tileGround(...p,s,P=>groundColor(P,s));
      }
    }
  }
  // Lake strips extend under both shores: the depth test cuts their outline.
  for(let x=lakeA-25;x<lakeB+25;x+=22){
    const X=x+22, a=lake(x), b=lake(X);
    const A=[x,waterY,-(a[0]-18)],B=[X,waterY,-(b[0]-18)],
      C=[X,waterY,-(b[1]+18)],D=[x,waterY,-(a[1]+18)];
    g.quad(A,B,C,D,'#a89d92',12,[x,-A[2],X,-B[2],X,-C[2],x,-D[2]]);
  }
  function placeTree(x,d,s,h,w,type){
    const y=gridGround(x,d*s);
    if(s<0 && y<waterY+.15) return;
    g.tree(x,y-.006*h,d*s,w,h,type,rnd());
  }
  function treeAt(x,d,s,type,size=1){
    const conifer=type>=2 && type<=5;
    const h=(conifer?range(8.5,17.4):range(7.3,15.3))*size;
    const ratio=conifer?range(.31,.53):type===6?range(.67,.94):range(.40,.69);
    placeTree(x,d,s,h,h*ratio,type);
  }
  // The distant canopy makes a continuous, ragged shore with clear breaks
  // at inlets, farmsteads and the edge of the rice basin.
  for(const s of [-1,1]){
    const groups=s<0?217:126;
    for(let i=0;i<groups;i++){
      const x=range(-620,3650), lakeRange=lake(x), shore=x>lakeA&&x<lakeB && s<0;
      const d=shore && rnd()<.64 ? lakeRange[1]+range(5,104) : range(s<0?180:140,755);
      const span=range(17,66), spread=range(5,28), n=Math.floor(range(12,33)), choice=rnd(),
        type = choice<.46?4:choice<.64?5:choice<.78?2:choice<.92?3:1;
      for(let j=0;j<n;j++){
        const X=x+(rnd()+rnd()-1)*span, D=d+(rnd()+rnd()-1)*spread;
        const sp=rnd()<.78?type:(rnd()<.60?4:3);
        treeAt(X,D,s,sp,range(.81,1.23));
      }
    }
  }
  // Birches follow field boundaries, with longer intervals of open view.
  for(const s of [-1,1]){
    const n=s<0?83:60;
    for(let k=0;k<n;k++){
      const x=range(-465,3480), inGrove=x>1470&&x<2300;
      const d=inGrove?range(22,115):range(39,148);
      const spread=range(4,14),count=Math.floor(inGrove?range(10,24):range(3,10));
      const type=rnd()<.43?0:rnd()<.56?1:rnd()<.54?3:6;
      for(let j=0;j<count;j++) {
        const X=x+range(-1,1)*spread,D=Math.max(16,d+range(-1,1)*spread*.46);
        treeAt(X,D,s,rnd()<.87?type:2,range(.7,1.05));
      }
    }
    const clumps = s<0 ? [[134,20],[315,14],[528,22],[766,11],[1065,16],[1192,25],[1440,15],
      [1582,18],[1698,12],[1763,20],[1861,16],[1980,13],[2079,21],[2208,14],
      [2345,22],[2620,19],[2830,14]] : [[-60,22],[110,18],[410,21],[675,15],[990,17],
      [1295,19],[1535,18],[1715,15],[1888,17],[1960,19],[2150,13],[2540,17],[2735,22],[2900,17]];
    for(const [x,d] of clumps){
      const n=Math.floor(range(2,6)),sp=rnd()<.67?0:1;
      for(let j=0;j<n;j++) treeAt(x+range(-4,5),d+range(-2,3),s,sp,range(.63,.91));
    }
  }
  for(const [x,d] of [[685,170],[711,175],[733,173],[750,177],[1034,171],[1043,170]])
    treeAt(x,d,-1,rnd()<.6?2:4,range(.51,.76));
  // Younger shoreline trees join selected mature stands into a continuous,
  // uneven canopy. The gravel beach remains visible between successive stands.
  for(let x=-575;x<1520;x+=range(2.55,4.3)){
    const openness=.52*sin(x*.031-.9)+.35*sin(x*.013+.4)+.2*sin(x*.094);
    if(openness<-.45)continue;
    const d=lake(x)[1]+range(3,18);
    const u=rnd(),type=u<.43?4:u<.63?5:u<.80?3:u<.97?0:6;
    treeAt(x+range(-1.2,1.2),d,-1,type,range(.48,.98));
  }
  // Sparse susuki catches low sun at the embankment and the water's edge.
  for(const s of [-1,1]) for(let i=0;i<(s<0?248:152);i++){
    const x=range(-390,3470),d=range(6.6,15.5),n=Math.floor(range(2,6));
    for(let j=0;j<n;j++) {
      const h=range(.58,1.34);
      placeTree(x+range(-2.8,2.8),d+range(-.9,1.7),s,h,h*range(.68,1.29),7);
    }
  }
  function trackLane(x,s) {
    const d=(s<0?29:44)+9*sin(x*.005+s*.65)+4.1*sin(x*.012+.55);
    return s*d;
  }
  for(const s of [-1,1]){
    for(let x=-540;x<3520;x+=8) {
      if(s<0 && x>1530 && x<2190) continue;
      const a=trackLane(x,s),b=trackLane(x+8,s);
      const P=(X,z)=>[X,gridGround(X,z)+.065,z];
      // Twin wheel ruts expose lighter gravel either side of a grassy crown.
      for(const [o,h,c] of [[-1.02,.40,'#ab9c7f'],[0,.67,'#89865c'],[1.02,.40,'#aa997d']])
        g.quad(P(x,a+o-h),P(x,a+o+h),P(x+8,b+o+h),P(x+8,b+o-h),c,o===0?10:15);
    }
  }
  function farm(x,z,size,weathered=false){
    const y=gridGround(x,z)-.18, L=11.8*size, w=6.4*size, h=3.4*size, roof=1.9*size;
    const dark=weathered?'#74776b':'#9b9181', trim='#746b5e', roofing=weathered?'#787971':'#945f4c';
    const p=(X,Y,Z)=>[x+X,y+Y,z+Z];
    g.box(x,y+h*.5-.16,z,L,h+.26,w,dark,14);
    for(const Z of [-1,1]){
      const z0=Z*(w*.5+.35*size);
      const A=p(-L*.53,h-.13,z0), B=p(L*.53,h-.13,z0),
        C=p(L*.53,h+roof,0),D=p(-L*.53,h+roof,0);
      g.quad(A,B,C,D,roofing,14,[-L*.53,0,L*.53,0,L*.53,w*.5,-L*.53,w*.5]);
      g.box(x,y+h-.14,z+z0,L*1.065,.14*size,.13*size,trim,0);
      for(const sign of [-1,1]){
        const cx=x+sign*(L*.33),cz=z+Z*(w*.5+.025);
        g.box(cx,y+h*.68,cz,1.32*size,1.0*size,.09*size,'#dac5a1',0);
        g.box(cx,y+h*.68,cz+Z*.056*size,1.12*size,.76*size,.035*size,'#4a5855',0);
        g.box(cx,y+h*.68,cz+Z*.08*size,.073*size,.78*size,.03*size,trim,0);
      }
      g.box(x,y+h*.41,z+Z*(w*.5+.035),2.1*size,h*.83,.08*size,'#867b67',14);
    }
    for(const k of [-1,1]){
      const X=k*L*.5;
      g.tri(p(X,h,-w*.5),p(X,h+roof,0),p(X,h,w*.5),'#b2a58a',14);
      g.box(x+X,y+h*.46,z,.12*size,h*.90,2.1*size,'#6a6359',14);
    }
    g.box(x,y+h+roof+.026,z,L*1.066,.105*size,.23*size,'#b0967c',14);
  }
  for(const [x,s,size] of [[51,-1,1.1],[-104,-1,.71],[432,-1,1.2],[944,-1,.85],[1425,-1,1.12],
      [2240,-1,.91],[2500,-1,1.18],[2840,-1,.91],[153,1,1.03],[762,1,.95],[2040,1,1.1],[2640,1,.92]]){
    const d=s<0 && x<1600 ? lake(x)[1]+range(28,60) : range(45,146);
    farm(x,d*s,size,rnd()<.28);
    if(rnd()<.7) farm(x+21*size,(d+9)*s,size*.58,true);
  }
  farm(141,-38,.67,true); farm(846,39,.65,true);
  // Straw racks are slender enough for the hills to show between the bundles.
  for(const [xx,z] of [[252,-32],[515,-47],[1226,-46],[2392,-33],[2774,-38],[734,52],[1945,58]]){
    const by=gridGround(xx,z);
    for(let q=0;q<4;q++){
      const x=xx+q*3.3;
      g.cyl([x,gridGround(x,z-.57),z-.57],[x,by+1.63,z+.11],.063,'#716147',0,5);
      g.cyl([x,gridGround(x,z+.57),z+.57],[x,by+1.63,z-.11],.06,'#786448',0,5);
    }
    g.cyl([xx-.35,by+1.42,z],[xx+10.3,by+1.42,z],.065,'#756044',0,6);
    for(let j=0;j<30;j++){
      const x=xx-.15+j*.342, h=range(.76,1.08),top=by+1.44+range(-.045,.04),
        col=rnd()<.5?'#b99a59':'#ccb274';
      for(const k of [-1,1]){
        const off=range(.27,.41)*k;
        g.quad([x-.10,top,z],[x+.12,top,z],[x+.23,top-h,z+off],[x-.23,top-h+.05,z+off],col,11);
      }
    }
  }
  // Short runs of wires, with real catenary sag between porcelain insulators.
  for(const [start,end,spacing,s] of [[167,701,77,-1],[1230,2030,85,-1],[2500,2965,85,-1],
      [-238,3047,114,1]]){
    let last=null;
    for(let x=start;x<end;x+=spacing+range(-4,4)){
      const d=16.4+1.4*sin(x*.008),z=d*s,y=gridGround(x,z),h=range(6.15,6.6);
      const top=[x+.05,y+h,z+.045];
      g.cyl([x,y-.12,z],top,.131,'#776a58',0,7,.079);
      g.box(top[0],top[1]-.22,z,.13,.14,1.42,'#6a6257',0);
      for(const o of [-.6,.6]){
        g.cyl([x,y+h-.16,z+o],[x,y+h+.08,z+o],.058,'#b4b0a0',0,7);
        if(last) {
          let A=[last[0],last[1],last[2]+o];
          for(let j=1;j<=6;j++){
            const t=j/6,B=[last[0]+(x-last[0])*t,last[1]+(y+h+.07-last[1])*t-2.8*t*(1-t),
              last[2]+(z-last[2])*t+o];
            g.cyl(A,B,.018,'#5c5c55',0,4);A=B;
          }
        }
      }
      last=[x,y+h+.07,z];
    }
  }
}
