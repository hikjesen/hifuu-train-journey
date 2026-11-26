// Car-local dimensions are in metres. The open bays share their clearances with the glass pass.
function buildCarriage(g) {
  const pi = Math.PI, tau = 2 * pi;
  const MAT = { plain:0, wood:1, metal:2, velvet:3, enamel:4, rubber:5,
                lamp:6, paper:7, carpet:8, linen:9 };
  const c = {
    wood:'#80583d', woodLight:'#a67951', woodShadow:'#573e31', woodEdge:'#a08262',
    walnut:'#684831', lacquer:'#715139', brass:'#ac9066', brassLight:'#c3ac82',
    brassDark:'#775f45', pewter:'#8b8a78', silk:'#e0ceaa', trim:'#56534a',
    gasket:'#313532', green:'#47665e', greenDark:'#334d46', greenEdge:'#788578',
    cut:'#272e2a', headrest:'#d5c9ac', ceiling:'#d4c8ae'
  };
  const halfLength = 8.65, bayPitch = 2.46, windowCenter = 1.50;
  const box=(...args)=>g.box(...args), quad=(...args)=>g.quad(...args);
  const tri=(...args)=>g.tri(...args), rod=(a,b,r,col,mat=MAT.metal,n=8)=>g.cyl(a,b,r,col,mat,n);
  function contour(w,h,r,n=4) {
    const a=[], centers=[[w/2-r,-h/2+r,-pi/2],[w/2-r,h/2-r,0],
                         [-w/2+r,h/2-r,pi/2],[-w/2+r,-h/2+r,pi]];
    for (const [cx,cy,phase] of centers) for(let i=0;i<=n;i++){
      const t=phase+(pi/2)*i/n;
      a.push([cx+Math.cos(t)*r,cy+Math.sin(t)*r]);
    }
    return a;
  }
  function join(a,b,col,mat) {
    for(let i=0;i<a.length;i++) {
      const j=(i+1)%a.length;
      quad(a[i],a[j],b[j],b[i],col,mat);
    }
  }
  function cap(loop, center, col, mat) {
    for(let i=0;i<loop.length;i++) tri(center,loop[i],loop[(i+1)%loop.length],col,mat);
  }
  function polyline(points,r,color,mat=MAT.metal,n=6) {
    for(let i=1;i<points.length;i++) rod(points[i-1],points[i],r,color,mat,n);
  }
  // A rolled upholstered shell. The long flat faces remain flat, the ends recede through two bevels.
  function upholstered(x,y,z,w,h,depth,r,lean,color,seam=false,side=1) {
    const bevel=Math.min(.032,h*.16), ends=[[-.5,bevel],[-.5+bevel/depth,0],
      [.5-bevel/depth,0],[.5,bevel]];
    const loops=ends.map(([dz,b])=>contour(w-2*b,h-2*b,Math.max(.012,r-b*.45),3)
      .map(([xx,yy])=>[x+xx+lean*yy,y+yy,z+depth*dz]));
    for(let j=1;j<loops.length;j++) join(loops[j-1],loops[j],color,MAT.velvet);
    cap(loops[0],[x,y,z-depth/2],color,MAT.velvet);
    cap(loops[3],[x,y,z+depth/2],color,MAT.velvet);
    if(seam) {
      const loop=loops[side>0?2:1];
      for(let k=0;k<loop.length;k++) rod(loop[k],loop[(k+1)%loop.length],.0027,c.greenEdge,MAT.velvet,5);
    }
  }
  function horizontalSlab(x,y,z,w,d,h,r,color,edge) {
    const rim=(ww,dd,rr,yy)=>contour(ww,dd,rr,3).map(([u,v])=>[x+u, yy,z+v]);
    const top=rim(w-.009,d-.009,r-.003,y+h/2), waist=rim(w,d,r,y+h/2-.005);
    const bottom=rim(w-.006,d-.006,r-.002,y-h/2);
    join(top,waist,edge,MAT.wood); join(waist,bottom,color,MAT.wood);
    cap(top,[x,y+h/2,z],color,MAT.wood); cap(bottom,[x,y-h/2,z],c.woodShadow,MAT.wood);
  }
  function windowLoop(x,side,w,h,r,absZ) {
    return contour(w,h,r,5).map(([u,v])=>[x+u,windowCenter+v,side*absZ]);
  }
  function surround(x,s) {
    // Bronze reveal and two distinct rubber lips; the last loop meets the glass.
    const mould=[
      [bayPitch+.002,1.57,.016,1.479],
      [2.348,1.345,.123,1.479,c.wood,MAT.wood],
      [2.326,1.324,.115,1.462,c.woodLight,MAT.wood],
      [2.307,1.302,.106,1.459,c.woodEdge,MAT.wood],
      [2.28,1.272,.098,1.474,'#5e574a',MAT.metal],
      [2.266,1.258,.091,1.484,'#a19780',MAT.metal],
      [2.254,1.247,.087,1.486,'#454940',MAT.rubber],
      [2.240,1.232,.081,1.481,'#626153',MAT.rubber],
      [2.221,1.213,.074,1.487,c.gasket,MAT.rubber],
      [2.21,1.202,.071,1.525,'#494b42',MAT.rubber]
    ];
    let last=windowLoop(x,s,...mould[0]);
    for(let j=1;j<mould.length;j++) {
      const [w,h,r,z,col,mat]=mould[j],next=windowLoop(x,s,w,h,r,z);
      join(last,next,col,mat); last=next;
    }

    const sillZ=s*1.438;
    box(x,.884,sillZ,bayPitch-.002,.033,.187,c.woodLight,MAT.wood);
    box(x,.875,s*1.343,bayPitch-.004,.015,.014,c.woodEdge,MAT.wood);
    box(x,.857,s*1.402,bayPitch-.006,.019,.10,c.woodShadow,MAT.wood);
    // A deep, inset lower panel with nickel bead and small fixing nails.
    box(x,.348,s*1.498,bayPitch,.73,.055,c.walnut,MAT.wood);
    box(x,.456,s*1.463,2.22,.47,.027,'#76533e',MAT.wood);
    for(const t of [-1,1]){
      box(x+t*1.111,.456,s*1.441,.021,.48,.012,c.woodEdge,MAT.wood);
      box(x,.456+t*.235,s*1.445,2.239,.013,.014,c.woodLight,MAT.wood);
    }
    box(x,.117,s*1.454,bayPitch,.13,.043,'#574838',MAT.wood);
    box(x,.183,s*1.439,bayPitch,.009,.016,'#8c7960',MAT.metal);
    box(x,2.331,s*1.492,bayPitch,.116,.055,'#bda98c',MAT.enamel);
    // The narrow column seen between adjacent window bays.
    box(x+bayPitch/2,1.49,s*1.467,.037,1.54,.022,'#78573f',MAT.wood);
    for (const h of [1.01,2.008]){
      const zz=s*1.452;
      g.cyl([x+bayPitch/2,h,zz],[x+bayPitch/2,h,zz-s*.004],.008,'#95816b',MAT.metal,8);
    }
  }

  function curtain(x,s,hand,showWeave,phase) {
    // The head is gathered to runners and narrows into a tieback below the middle.
    const levels=[
      [2.177,.187,1.402],[2.112,.195,1.393],[1.929,.177,1.404],
      [1.665,.134,1.420],[1.42,.091,1.429],[1.347,.065,1.431],
      [1.286,.073,1.413],[1.126,.112,1.398],[.983,.146,1.403]
    ];
    const ribs=showWeave ? 30 : 18, center=x+hand*1.135;
    const rings=levels.map(([y,width,z],j)=>{
      const row=[];
      for(let k=0;k<=ribs;k++){
        const u=k/ribs, pinch=j===5 ? .38 : (j===4||j===6 ? .69 : 1);
        const wave=Math.sin(u*tau*3.5+phase+.19*Math.sin(j*.66))*.020*pinch;
        const drape=(j===8? .010*Math.cos(tau*3.5*u+phase):0);
        row.push([center+hand*(u-.54)*width,y+drape,s*(z+wave-.009*Math.sin(pi*u))]);
      }
      return row;
    });
    const clothTones=['#b2a183','#bbab8f','#d0bea1','#d9c9ad','#d5c4a8','#c3b299','#aa9b82','#aa9a7f'];
    for(let j=1;j<rings.length;j++) for(let k=0;k<ribs;k++){
      const f=(k+.5)/ribs, fold=Math.floor((((f*3.5+.15+phase/tau)%1)+1)%1*8);
      quad(rings[j-1][k],rings[j-1][k+1],rings[j][k+1],rings[j][k],clothTones[fold],MAT.linen);
    }
    const knot=[center-hand*.005,1.346,s*1.405],hook=[center+hand*.074,1.355,s*1.449];
    rod([center-hand*.036,1.341,s*1.407],hook,.0085,'#917b58',MAT.linen,7);
    if(showWeave){
      polyline([knot,[center+hand*.041,1.295,s*1.404],[center+hand*.060,1.29,s*1.408]],.003,'#a28e6b',MAT.linen,5);
      for(let j=1;j<rings.length;j++) rod(rings[j-1][0],rings[j][0],.0026,'#b5a487',MAT.linen,5);
      for(let k=0;k<4;k++){
        const tx=center+hand*(k/3-.5)*.16;
        rod([tx,2.21,s*1.417],[tx,2.173,s*1.411],.0042,c.brassDark,MAT.metal,6);
      }
    }
  }
  // Continuous wooden rails and luggage rack, with a small shadow line under their fastenings.
  function luggageRack(s) {
    rod([-halfLength,2.216,s*1.415],[halfLength,2.216,s*1.415],.0125,c.brass,MAT.metal,12);
    for(const [z,r,col] of [[.995,.017,c.brass],[1.015,.009,c.brassLight],[1.10,.008,'#a19272'],[1.19,.008,'#aa9a7e'],[1.275,.009,'#af9d7e'],[1.355,.012,c.brass]]){
      rod([-8.54,2.171,s*z],[8.54,2.171,s*z],r,col,MAT.metal,8);
    }
    for(let i=-29;i<=29;i++){
      const xx=i*.287;
      rod([xx,2.17,s*1.009],[xx,2.178,s*1.35],.0045,'#a29478',MAT.metal,5);
    }
    for(let i=-7;i<=7;i++){
      const xx=i*1.205;
      box(xx,2.228,s*1.459,.038,.142,.029,'#82745c',MAT.metal);
      polyline([[xx,2.285,s*1.459],[xx,2.27,s*1.385],[xx,2.174,s*1.055],[xx,2.167,s*.994]],.011,c.brass,MAT.metal,7);
    }
  }

  function seat(xc,s,side,detail) {
    const x=xc+side*.94, yBack=.891, z=s*1.012, span=.913;
    const outward=-s, materialColor=c.green;
    // Two pressed steel shoes support the timber plinth. The wheel arches are under the floor.
    for(const dz of [-.282,.282]){
      box(x-side*.15,.162,z+dz,.143,.303,.057,'#444b43',MAT.metal);
      box(x-side*.155,.049,z+dz,.247,.044,.091,'#55594d',MAT.metal);
    }
    box(x-side*.177,.38,z,.48,.083,span-.008,c.walnut,MAT.wood);
    box(x-side*.186,.397,z+outward*(span*.50),.451,.039,.021,c.woodEdge,MAT.wood);
    upholstered(x-side*.189,.491,z,.49,.167,span,.059,-side*.06,materialColor,detail,outward);
    upholstered(x+.004*side,yBack,z,.148,.721,span,.064,side*.125,materialColor,detail,outward);
    const front=-side;
    const backPoint=(u,v)=>{
      const yy=.625+v*.553, bell=Math.sin(pi*v)**.65;
      const sideRoll=(1-u*u)**.68, stitch=1-.64*Math.exp(-u*u*210);
      const offset=.003+.028*bell*sideRoll*stitch;
      return [x+side*.004+side*.125*(yy-yBack)+front*(.074+offset),yy,z+.411*u];
    };
    const cols=detail?16:10, rows=detail?8:5;
    for(let j=0;j<rows;j++){
      const v=j/rows,v2=(j+1)/rows;
      for(let i=0;i<cols;i++){
        const u=i/cols*2-1,u2=(i+1)/cols*2-1;
        quad(backPoint(u,v),backPoint(u2,v),backPoint(u2,v2),backPoint(u,v2),materialColor,MAT.velvet);
      }
    }
    const seams=[];
    for(let j=0;j<=8;j++){
      const p=backPoint(0,j/8);p[0]+=front*.0015;seams.push(p);
    }
    if(detail) polyline(seams,.00175,'#344c44',MAT.velvet,5);
    else for(let j=1;j<seams.length;j++){
      const a=seams[j-1],b=seams[j],w=.0015;
      quad([a[0],a[1],a[2]-w],[a[0],a[1],a[2]+w],[b[0],b[1],b[2]+w],[b[0],b[1],b[2]-w],'#344c44',MAT.velvet);
    }
    if(detail) {
      for(let j=1;j<24;j++){
        const a=backPoint(.009,j/24),b=backPoint(.009,j/24+.014);
        a[0]+=front*.0014;b[0]+=front*.0014;
        rod(a,b,.0006,'#789080',MAT.velvet,5);
      }
    }
    // Cloth follows the rolled edge and lifts slightly at the hem. Narrow stitched hems catch the window.
    const topX=x+side*.048,topY=1.251;
    const clothColors=['#cbc3aa','#cdc5ac','#d0c8af','#d2cab1','#d0c8ae','#cec5ac'];
    for(const offset of [-.224,.224]){
      const center=z+offset, width=.304;
      const profile=[[-.053,-.028],[-.047,.003],[-.020,.005],[.034,.006],
        [.051,.002],[.067,-.009],[.077,-.030],[.082,-.067],[.087,-.083],[.092,-.103],
        [.095,-.126],[.097,-.149],[.098,-.172],[.0995,-.181]];
      const steps=detail ? 12 : 5, fabric=[];
      const folds=detail ? profile : profile.filter((v,i)=>i%2===0);
      for(let j=0;j<folds.length;j++){
        const row=[],[df,dy]=folds[j],hanging=Math.max(0,(-dy-.019)/.162);
        for(let k=0;k<=steps;k++){
          const u=k/steps, scallop=Math.sin(u*3.7*pi+.5)+(u-.5)*1.45;
          const crease=.0025*Math.sin(u*5.7*pi+.5+j*.06)*(.30+.70*hanging);
          const drop=-.0033*scallop*hanging*hanging+(offset<0 ? .0025 : -.0010)*hanging;
          const yy=topY+dy+drop,zz=center+width*(u-.5)*(1-.041*hanging)+.0020*Math.sin(2*u*pi+j*.38);
          let depth=df+crease;
          if(yy<1.180){
            const pu=Math.max(-1,Math.min(1,(zz-z)/.411)),pv=Math.max(0,Math.min(1,(yy-.625)/.553));
            const cushion=backPoint(pu,pv);
            depth=Math.max(depth,(cushion[0]-topX)*front+.010+crease*.75);
          }
          row.push([topX+front*depth,yy,zz]);
        }
        fabric.push(row);
      }
      for(let j=1;j<fabric.length;j++) for(let k=0;k<steps;k++){
        const i=Math.min(5,Math.floor((.5+.47*Math.sin((k+.5)/steps*5.7*pi+.5+j*.06))*6));
        const tone=j===fabric.length-1?'#b8af96':clothColors[i];
        quad(fabric[j-1][k],fabric[j-1][k+1],fabric[j][k+1],fabric[j][k],tone,MAT.linen);
      }
      if(detail){
        for(let k=0;k<steps;k++){
          const hem=fabric[fabric.length-2],a=hem[k].slice(),b=hem[k+1].slice();
          a[0]+=front*.0008;b[0]+=front*.0008;
          rod(a,b,.0007,'#d9d0b7',MAT.linen,5);
        }
      }
    }
    // Dark Bakelite arm cap and two brushed rail supports on the aisle end.
    const az=z+outward*(span/2+.016);
    for(const dx of [.078,.309]){
      rod([x-side*dx,.401,az],[x-side*dx,.708,az],.013,c.pewter,MAT.metal,7);
    }
    horizontalSlab(x-side*.192,.712,az,.41,.066,.043,.023,'#51473b','#796c53');
    if(detail){
      const grabZ=z+outward*(span/2+.021);
      polyline([[x+side*.035,1.005,grabZ],[x+side*.087,1.029,grabZ],
                [x+side*.111,1.053,grabZ],[x+side*.121,1.154,grabZ],[x+side*.085,1.177,grabZ]],
               .008,c.brass,MAT.metal,8);
    }
  }

  function sideTable(x,s,isHero) {
    const y=isHero ? .917 : .793, z=s*1.216, w=isHero ? .91 : .576, d=isHero ? .544 : .526;
    horizontalSlab(x,y-.018,z,w,d,.036,.052,'#946c48','#b5976c');
    for(const t of [-1,1]){
      const xx=x+t*w*.28;
      box(xx,y-.147,s*1.451,.042,.233,.035,c.brassDark,MAT.metal);
      rod([xx,y-.246,s*1.439],[xx,y-.044,s*1.05],.012,'#897d64',MAT.metal,7);
    }
  }

  const roofProfile=[[-1.52,2.357],[-1.475,2.402],[-1.37,2.453],[-1.19,2.499],[-.92,2.538],
      [-.58,2.566],[0,2.582],[.58,2.566],[.92,2.538],[1.19,2.499],[1.37,2.453],[1.475,2.402],[1.52,2.357]];
  function carriageCeiling() {
    const profile=roofProfile;
    for(let j=1;j<profile.length;j++){
      const [z,y]=profile[j-1],[zz,yy]=profile[j];
      quad([-halfLength,y,z],[halfLength,y,z],[halfLength,yy,zz],[-halfLength,yy,zz],c.ceiling,MAT.enamel);
      for(let i=-7;i<=7;i++){
        const x=i*(bayPitch/2)-.615;
        if(Math.abs(x)>8.60)continue;
        quad([x-.013,y-.005,z],[x+.013,y-.005,z],[x+.013,yy-.005,zz],[x-.013,yy-.005,zz],
          '#b9ac94',MAT.enamel);
        quad([x+.010,y-.006,z],[x+.014,y-.006,z],[x+.014,yy-.006,zz],[x+.010,yy-.006,zz],
          '#c5b99e',MAT.enamel);
      }
    }
    for(const s of [-1,1]){
      rod([-8.63,2.36,s*1.475],[8.63,2.36,s*1.475],.020,c.woodLight,MAT.wood,10);
      box(0,2.545,s*.53,17.2,.018,.045,'#c8bca2',MAT.enamel);
    }
    for(let i=-3;i<=3;i++){
      const x=i*bayPitch+.20;
      g.sphere(x,2.547,0,.250,.032,.130,'#8d7859',MAT.metal,16,5);
      g.sphere(x,2.529,0,.238,.025,.117,c.brassLight,MAT.metal,16,5);
      g.sphere(x,2.514,0,.219,.044,.097,'#f0d9a8',MAT.lamp,20,7);
      for(const ss of [-1,1]){
        box(x+ss*.159,2.546,0,.017,.032,.222,c.brassDark,MAT.metal);
        g.sphere(x+ss*.194,2.509,0,.009,.010,.009,c.brass,MAT.metal,8,4);
      }
      // Rectangular slotted ventilation grilles alternate with the opal lamps.
      const xx=x+1.006;
      if(xx+.211>halfLength)continue;
      box(xx,2.563,0,.422,.015,.183,'#a79b84',MAT.metal);
      for(let a=-6;a<=6;a++)
        box(xx+a*.026,2.552,0,.009,.007,.134,'#726f61',MAT.metal);
    }
  }

  function endWall(sign) {
    const x=sign*8.633, inner=x-sign*.065;
    box(x,1.19,0,.105,2.38,3.04,'#876444',MAT.wood);
    for(let j=1;j<roofProfile.length;j++){
      const [z0,h0]=roofProfile[j-1],[z1,h1]=roofProfile[j],xx=x-sign*.053;
      quad([xx,2.36,z0],[xx,2.36,z1],[xx,h1,z1],[xx,h0,z0],'#b3a184',MAT.enamel);
      quad([xx-sign*.003,h0-.015,z0],[xx-sign*.003,h1-.015,z1],[xx-sign*.003,h1,z1],[xx-sign*.003,h0,z0],
        '#8e806a',MAT.wood);
    }
    for(const z of [-1.21,-.81,.81,1.21]){
      box(inner,1.14,z,.030,1.82,.329,'#75563f',MAT.wood);
      for(const h of [.251,2.024]) box(inner-sign*.018,h,z,.018,.022,.334,'#987450',MAT.wood);
      for(const s of [-1,1]) box(inner-sign*.019,1.138,z+s*.162,.013,1.80,.016,'#a07b59',MAT.wood);
    }
    // A vestibule leaf with wire glass, deep walnut rebates, and a brass threshold.
    const dx=inner-sign*.024;
    box(dx,1.061,0,.035,2.112,.904,'#493f35',MAT.rubber);
    box(dx-sign*.02,1.055,0,.035,2.073,.835,'#846547',MAT.wood);
    for(const z of [-.458,.458])
      box(dx-sign*.022,1.063,z,.054,2.138,.047,'#b39870',MAT.wood);
    box(dx-sign*.022,2.123,0,.053,.043,.952,'#ad926c',MAT.wood);
    box(dx-sign*.047,1.549,0,.027,.791,.612,'#ad9875',MAT.metal);
    box(dx-sign*.063,1.549,0,.010,.755,.578,'#343e38',MAT.rubber);
    const glazing=dx-sign*.071;
    box(glazing,1.551,0,.009,.728,.548,'#617168',MAT.enamel);
    // Slender vertical/diagonal wire, masked to the glazing profile by clipping each line segment.
    for(let k=-9;k<=9;k++) {
      const b=k*.088;
      for(const slope of [-1.1,1.1]){
        let z0=-.27,z1=.27;
        const zLow=(-.351-b)/slope,zHigh=(.351-b)/slope;
        z0=Math.max(z0,Math.min(zLow,zHigh));z1=Math.min(z1,Math.max(zLow,zHigh));
        if(z1>z0+.001)
          rod([glazing-sign*.005,1.551+slope*z0+b,z0],[glazing-sign*.005,1.551+slope*z1+b,z1],.0017,'#80877a',MAT.metal,5);
      }
    }
    box(dx-sign*.047,.666,0,.021,.772,.662,'#6b513c',MAT.wood);
    for(const z of [-.323,.323]) box(dx-sign*.062,.663,z,.010,.768,.016,'#997952',MAT.wood);
    for(const yy of [.281,1.049]) box(dx-sign*.059,yy,0,.012,.019,.663,'#977751',MAT.wood);
    box(dx-sign*.052,1.000,.348,.024,.207,.063,c.brassDark,MAT.metal);
    rod([dx-sign*.069,.998,.347],[dx-sign*.113,.998,.347],.013,c.brass,MAT.metal,10);
    rod([dx-sign*.115,.998,.347],[dx-sign*.115,.998,.246],.012,c.brassLight,MAT.metal,10);
    box(dx-sign*.035,.051,0,.071,.078,.882,'#a29472',MAT.metal);
    // A small enamel number above the door. Positive and negative sides face the aisle.
    const same=sign>0?1:-1, xx=dx-sign*.066;
    g.label([xx,2.170,-same*.171],[xx,2.170,same*.171],[xx,2.247,same*.171],[xx,2.247,-same*.171],
      '２ 号 車',{bg:'#394841',fg:'#ece2c6',font:'52px serif',sub:'OBSERVATION CAR'});
    for(const ss of [-1,1]){
      const z=ss*.606;
      box(inner-sign*.030,1.490,z,.039,.194,.085,c.brassDark,MAT.metal);
      polyline([[inner-sign*.05,1.56,z],[inner-sign*.11,1.52,z],
                [inner-sign*.11,1.241,z],[inner-sign*.05,1.21,z]],
                .014,c.brassLight,MAT.metal,8);
    }
  }

  // Tiny flat primitives keep printed matter legible through normal mipmapping of the label atlas.
  function layout(x,y,z,angle,slope=0) {
    const cs=Math.cos(angle),sn=Math.sin(angle);
    const p=(u,v,h=0)=>[x+u*cs+v*sn,y+h+v*slope,z+u*sn-v*cs];
    function rect(u,v,w,d,col,m=MAT.paper,h=0) {
      quad(p(u-w/2,v-d/2,h),p(u+w/2,v-d/2,h),p(u+w/2,v+d/2,h),p(u-w/2,v+d/2,h),col,m);
    }
    function line(a,b,width,col,h=.0009) {
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      if(!len)return;
      const ex=-dy*width/len/2,ey=dx*width/len/2;
      quad(p(a[0]+ex,a[1]+ey,h),p(b[0]+ex,b[1]+ey,h),p(b[0]-ex,b[1]-ey,h),p(a[0]-ex,a[1]-ey,h),col,MAT.paper);
    }
    function mark(u,v,w,d,txt,style,h=.0014) {
      g.label(p(u-w/2,v-d/2,h),p(u+w/2,v-d/2,h),p(u+w/2,v+d/2,h),p(u-w/2,v+d/2,h),txt,style);
    }
    function dot(u,v,r,col,h=.0015) {
      quad(p(u-r,v,h),p(u,v-r,h),p(u+r,v,h),p(u,v+r,h),col,MAT.paper);
    }
    return {p,rect,line,mark,dot};
  }
  function observationBook() {
    const x=-.150,z=-1.339,y=.923;
    const shadow=layout(x+.003,.9173,z+.003,-.112);
    shadow.rect(0,0,.321,.192,'#7f5e41',MAT.wood);
    shadow.rect(0,0,.317,.188,'#72563d',MAT.wood,.00016);
    const b=layout(x,y,z,-.112,.027);
    const boundary=[[-.160,-.094],[.157,-.094],[.157,.094],[-.160,.094]];
    for(let j=0;j<4;j++){
      const pt=b.p(...boundary[j]),next=b.p(...boundary[(j+1)%4]);
      quad([pt[0],.9177,pt[2]],[next[0],.9177,next[2]],next,pt,'#445148',MAT.velvet);
      const upper=b.p(...boundary[j],.0025),upperNext=b.p(...boundary[(j+1)%4],.0025);
      quad(pt,next,upperNext,upper,'#b59d7c',MAT.paper);
    }
    b.rect(-.002,-.0005,.317,.188,'#45584d',MAT.velvet,0);
    b.rect(-.001,0,.307,.184,'#b19e7a',MAT.paper,.0020);
    b.rect(-.077,0,.149,.179,'#d7c6a3',MAT.paper,.0030);
    b.rect(.076,0,.147,.178,'#dfd3b6',MAT.paper,.0036);
    b.rect(.0005,0,.007,.178,'#b4a180',MAT.paper,.0040);
    b.rect(-.107,.031,.062,.0008,'#817b67',MAT.paper,.0045);
    b.mark(-.075,.058,.126,.037,'天体観測手帖',{bg:'#d7c6a3',fg:'#50574b',font:'51px serif',sub:'HIFUU CLUB   •   FIELD NOTES'},.0052);
    const graphite='#777564';
    for(let j=0;j<6;j++){
      const y0=.015-j*.012, len=.048+(j%3)*.021;
      b.line([-.131,y0],[-.024,y0],.00035,'#a69d87',.0046);
      for(let k=0;k<7;k++) {
        const u=-.129+k*len/7, v=y0+.0019;
        b.line([u,v],[u+.0035,v+.0016*Math.sin(j+k*.58)],.00065,graphite,.0049);
      }
    }
    const center=[.075,.004],R=.0568,ink='#7c715b';
    b.mark(.078,.072,.106,.020,'POLARIS',{bg:'#dfd3b6',fg:'#626555',font:'49px Georgia, serif'},.0045);
    for(const r of [R*.34,R*.68,R,R*1.027]){
      const seg=r===R?60:40;
      for(let j=0;j<seg;j++){
        const a=j*tau/seg,d=(j+1)*tau/seg;
        b.line([center[0]+Math.cos(a)*r,center[1]+Math.sin(a)*r],[center[0]+Math.cos(d)*r,center[1]+Math.sin(d)*r],r===R ? .00068 : .00032,ink,.0048);
      }
    }
    for(let j=0;j<24;j++){
      const a=j*tau/24,r=j%3===0?R*.90:R*.973;
      b.line([center[0]+Math.cos(a)*r,center[1]+Math.sin(a)*r],[center[0]+Math.cos(a)*R,center[1]+Math.sin(a)*R],.00045,ink,.0050);
    }
    for(let j=1;j<=47;j++) {
      const a=j*2.39996,d=R*.925*Math.sqrt(j/48);
      b.dot(center[0]+Math.cos(a)*d,center[1]+Math.sin(a)*d,j%7===0 ? .0016 : .00083,'#65644e',.0053);
    }
    const path=[[.035,-.011],[.050,-.0005],[.056,.012],[.074,.017],[.077,.032],[.091,.040],[.105,.031]];
    for(let k=1;k<path.length;k++)b.line(path[k-1],path[k],.00069,'#8d6b42',.0056);
    for(const pt of path)b.dot(...pt,.0016,'#715738',.0058);
    b.rect(.113,-.084,.031,.002,'#8f785b',MAT.paper,.0046);
    const f=layout(-.004,.927,-1.249,-.19);
    f.rect(0,0,.014,.070,'#6f5264',MAT.velvet);
    // An actual hexagonal wooden pencil, with exposed cedar and graphite point.
    const pencilA=b.p(-.133,-.065,.009),pencilB=b.p(.004,-.047,.009);
    rod(pencilA,pencilB,.0032,'#635347',MAT.wood,6);
    const tip=b.p(.0155,-.0454,.009);
    g.cyl(pencilB,tip,.00315,'#b08965',MAT.wood,6,.0007);
    g.cyl(tip,b.p(.0188,-.0450,.009),.00078,'#393938',MAT.plain,6,.0001);
  }
  function tickets() {
    for (const [x,z,rot,ylast] of [[.159,-1.353,-.15,.920],[.203,-1.321,.10,.921]]){
      const t=layout(x,ylast,z,rot);
      t.rect(0,0,.119,.059,'#d9bd91');
      t.rect(0,-.0255,.115,.0011,'#976d52',MAT.paper,.0002);
      t.rect(0,.0254,.115,.0011,'#976d52',MAT.paper,.0002);
      t.rect(.042,0,.0008,.048,'#a88d65',MAT.paper,.00035);
      t.mark(-.009,.003,.089,.031,'旭岳山麓',{bg:'#d9bd91',fg:'#674d3b',font:'54px serif',sub:'ASAHIDAKE   /   乗車券'},.0006);
      t.mark(.050,0,.011,.024,'2',{bg:'#d9bd91',fg:'#705343',font:'66px Georgia, serif'},.0006);
      for(let j=0;j<5;j++)t.rect(.039,-.022+j*.010,.00055,.0040,'#aa916a',MAT.paper,.00055);
    }
    const f=layout(.309,.924,-1.416,.10);
    // The brass watch and its thin chain resting on the wood.
    g.cyl(f.p(0,0,0),f.p(0,0,.004),.025,'#a18a60',MAT.metal,25);
    g.cyl(f.p(0,0,.004),f.p(0,0,.0057),.0224,'#ded4b8',MAT.paper,25);
    for(let i=0;i<12;i++){
      const a=i*tau/12;
      f.line([Math.sin(a)*.018,Math.cos(a)*.018],[Math.sin(a)*.021,Math.cos(a)*.021],.00075,'#5f5a4c',.006);
    }
    f.line([0,0],[-.010,.006],.0009,'#4b4e44',.0065);
    f.line([0,0],[.006,.015],.0007,'#4b4e44',.0069);
    f.dot(0,0,.00145,c.brassDark,.007);
    const chain=[];
    for(let i=0;i<=20;i++)
      chain.push(f.p(.000+i*.0036,.024+Math.sin(i*.28)*.014+i*.001,.002));
    polyline(chain,.0011,'#aa916a',MAT.metal,5);
  }

  function renkoHat(x,y,z) {
    const twist=-.56, cs=Math.cos(twist),sn=Math.sin(twist);
    const P=(u,h,v)=>[x+u*cs-v*sn,y+h,z+u*sn+v*cs];
    const N=48;
    function ring(rx,rz,h,curve,crown=false) {
      const loop=[];
      for(let j=0;j<N;j++){
        const a=j*tau/N, ca=Math.cos(a), sa=Math.sin(a);
        const crease=crown ? 1-.115*Math.exp(-Math.pow((sa+.74)/.22,2)) : 1;
        const sideCurl=curve*(.74*Math.pow(Math.abs(ca),3)-.50*sa+.26*Math.sin(2*a+.3));
        loop.push(P(rx*ca*crease,h+sideCurl,rz*sa));
      }
      return loop;
    }
    const brim0=ring(.139,.158,.015,.023),brim1=ring(.142,.161,.019,.023),
      brim2=ring(.127,.143,.018,.017),base=ring(.092,.105,.026,.003,true);
    cap(brim0,P(0,.004,0),'#333334',MAT.velvet);
    join(brim0,brim1,'#565350',MAT.velvet);
    join(brim1,brim2,'#373838',MAT.velvet);
    join(brim2,base,'#303334',MAT.velvet);
    let last=base;
    for(const [rx,rz,h,curl,col] of [
      [.092,.105,.037,.002,'#313435'],[.0905,.104,.074,.004,'#343637'],
      [.084,.100,.113,.010,'#363838'],[.077,.093,.123,.011,'#3c3e3d'],
      [.064,.080,.122,.012,'#414340'],[.042,.063,.113,.010,'#363937'],
      [.013,.043,.104,.007,'#303333']]){
      const nr=ring(rx,rz,h,curl,true);
      join(last,nr,col,MAT.velvet); last=nr;
    }
    cap(last,P(0,.102,0),'#343736',MAT.velvet);
    const rb0=ring(.0934,.1068,.038,.002,true),rb1=ring(.0919,.1058,.065,.003,true);
    join(rb0,rb1,'#cec9b6',MAT.linen);
    join(ring(.0936,.1069,.040,.002,true),ring(.0934,.1068,.0418,.002,true),'#e0dac7',MAT.linen);
    // Pale grosgrain bow worn on the side of the black felt crown.
    const knot=P(.090,.051,.005);
    quad(knot,P(.110,.074,.043),P(.105,.050,.047),P(.098,.044,.003),'#ded9c7',MAT.linen);
    quad(knot,P(.106,.042,-.043),P(.113,.066,-.046),P(.096,.060,0),'#c7c3b2',MAT.linen);
    tri(P(.093,.050,0),P(.119,.029,.051),P(.111,.030,.055),'#bfbcae',MAT.linen);
    g.sphere(...knot,.009,.009,.009,'#d4cfba',MAT.linen,9,5);
  }
  function violetScarf(x,z) {
    // A folded violet shawl. Its free corner sags over the front edge of the left cushion.
    const tones=['#625567','#756575','#927f91','#867587','#695c6d'];
    const rows=[],nx=17,nz=10;
    for(let j=0;j<=nz;j++){
      const f=j/nz, line=[];
      for(let i=0;i<=nx;i++){
        const u=i/nx, wave=Math.sin(u*tau*2.6+f*1.37);
        const d=Math.max(0,.30-f)/.30, edge=.019*Math.sin(f*5)+.009*Math.cos(u*7);
        line.push([x+(f-.5)*.29+edge+.045*d*d, .579+.0105*wave+.0137*Math.sin(f*5.5)*Math.sin(u*pi)-.112*d*d,z+(u-.5)*.32+.013*Math.sin(f*5.3+u)]);
      }
      rows.push(line);
    }
    for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
      const f=(j+.5)/nz,u=(i+.5)/nx;
      const k=Math.min(4,Math.floor(2.5+2.35*Math.cos(u*tau*2.6+f*1.37)));
      quad(rows[j][i],rows[j+1][i],rows[j+1][i+1],rows[j][i+1],tones[k],MAT.velvet);
    }
    for(let i=0;i<=nx;i++){
      const p=rows[0][i],to=[p[0]-.012,p[1]-.020-(i%4)*.002,p[2]+.004*Math.sin(i)];
      rod(p,to,.0015,'#978495',MAT.linen,5);
    }
  }
  function valise(x,z,y,scale=1) {
    const w=.56*scale,h=.198*scale,d=.260*scale;
    // Leather-grained case with piping and two buckled straps.
    const loops=[
      [-d*.50,w-.027*scale,h-.021*scale],[-d*.46,w,h],[d*.46,w,h],[d*.50,w-.027*scale,h-.021*scale]
    ].map(([dz,ww,hh])=>contour(ww,hh,.043*scale,4).map(([u,v])=>[x+u,y+h/2+v,z+dz]));
    for(let j=1;j<4;j++)join(loops[j-1],loops[j],j===2?'#80573e':'#927151',MAT.velvet);
    cap(loops[0],[x,y+h/2,z-d/2],'#7d5840',MAT.velvet);
    cap(loops[3],[x,y+h/2,z+d/2],'#7d5840',MAT.velvet);
    for(const sx of [-1,1]){
      const xx=x+w*.287*sx;
      box(xx,y+h+.001,z,.032*scale,.005,d*.91,'#5d4838',MAT.velvet);
      for(const sz of [-1,1]){
        box(xx,y+h*.51,z+sz*d*.5,.032*scale,h*.88,.005,'#5c4535',MAT.velvet);
        box(xx,y+h*.65,z+sz*(d/2+.004),.038*scale,.027*scale,.007,c.brass,MAT.metal);
        box(xx,y+h*.65,z+sz*(d/2+.009),.026*scale,.013*scale,.003,'#62523e',MAT.velvet);
      }
    }
    polyline([[x-.069*scale,y+h+.003,z],[x-.059*scale,y+h+.036*scale,z],
              [x+.059*scale,y+h+.036*scale,z],[x+.069*scale,y+h+.003,z]],
             .011*scale,'#5b4938',MAT.velvet,7);
  }

  box(0,-.044,0,2*halfLength,.088,3.05,'#655748',MAT.wood);
  box(0,.001,0,17.25,.007,.715,'#5b5850',MAT.carpet);
  for(const s of [-1,1]){
    box(0,.005,s*.331,17.24,.005,.008,'#a39a80',MAT.carpet);
    box(0,.005,s*.345,17.24,.005,.004,'#948a72',MAT.carpet);
    luggageRack(s);
  }
  carriageCeiling();
  for(let bay=-3;bay<=3;bay++) {
    const x=bay*bayPitch;
    for(const s of [-1,1]) {
      const hero=bay===0&&s===-1,detail=bay===0;
      surround(x,s);
      for(const side of [-1,1]){
        curtain(x,s,side,detail,.34*side+.19*((bay+3)%3));
        seat(x,s,side,detail);
      }
      sideTable(x,s,hero);
    }
  }
  endWall(-1); endWall(1);
  observationBook();
  tickets();
  renkoHat(.722,.576,-1.067);
  violetScarf(-.680,-.887);
  valise(2.62,1.195,2.184,.90);
  valise(-4.93,-1.205,2.184,.86);
}
