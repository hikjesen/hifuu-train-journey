// The first and last bores meet across the cut to black. A short rock tunnel also
// permits an entrance and a sunlit exit to be watched within the same journey.
const BORES=[[-430,79],[1519,1581],[2898,3440]];
function boreCover(x){let c=0;for(const [a,b] of BORES)c=Math.max(c,smooth(a-4,a+6,x)*(1-smooth(b-6,b+4,x)));return c;}
function buildTunnels(g){
  const wall='#62564f',stone=['#74685c','#776b5c','#827563','#665e55','#7d7061'];
  const arch=(i,r=3.32)=>[.80+r*Math.sin(i*Math.PI/16),r*Math.cos(i*Math.PI/16)];
  const pt=(x,p)=>[x,p[0],p[1]];
  for(const [start,end] of BORES){
    for(let x=start;x<end;x+=7){
      const xx=Math.min(x+7,end);let part=Math.floor((x-start)/7);
      for(let j=0;j<16;j++){
        const a=arch(j),b=arch(j+1);
        g.quad(pt(x,a),pt(xx,a),pt(xx,b),pt(x,b),wall,17);
        if(part%2===0)g.quad(pt(x,arch(j,3.285)),pt(x+.15,arch(j,3.285)),pt(x+.15,arch(j+1,3.285)),pt(x,arch(j+1,3.285)),'#4f4a44',17);
      }
      for(let s of [-1,1]) {
        g.quad([x,-1.4,s*3.32],[xx,-1.4,s*3.32],[xx,.8,s*3.32],[x,.8,s*3.32],wall,17);
        if(part%4===1){
          const z=s*3.295;
          g.box(x+1,1.52,z,.32,.19,.07,'#4c493e',17);
          g.box(x+1,1.53,z-s*.055,.20,.065,.035,'#ffe8a3',19);
        }
      }
    }
    for(const [x,side] of [[start,-1],[end,1]]){
      for(let j=0;j<16;j++){
        const a=arch(j),b=arch(j+1),c=arch(j+1,3.86),d=arch(j,3.86);
        g.quad(pt(x,a),pt(x,b),pt(x,c),pt(x,d),stone[(j*3)%5],18);
        g.quad(pt(x,d),pt(x-side*1.1,d),pt(x-side*1.1,c),pt(x,c),stone[j%5],18);
      }
      for(const s of [-1,1]){
        g.box(x-side*.40,-.12,s*3.57,.85,2.15,.51,'#766958',18);
        // A cut through an embankment exposes the real portal gradually at side-window angles.
        const near=s*3.82,mid=s*9.8,far=s*28.0;
        g.quad([x+side*18,-2.8,mid],[x,2.25,near],[x-side*5,4.2,mid],[x+side*10,-2.6,far],'#696248',18);
        g.quad([x,2.25,near],[x,4.43,near],[x-side*5,6.31,mid],[x-side*5,4.2,mid],'#5e6049',18);
        g.quad([x+side*18,-2.8,mid],[x+side*15,-2.8,near],[x,1.20,near],[x,2.25,near],'#81715f',18);
        g.quad([x,.78,s*3.84],[x,4.48,s*3.84],[x,5.7,s*10],[x,-2.8,s*10],stone[2],18);
      }
      for(let j=0;j<16;j++){
        const a=arch(j,3.85),b=arch(j+1,3.85);
        g.quad(pt(x,a),pt(x,b),[x,4.82,b[1]],[x,4.82,a[1]],'#807263',18);
      }
      g.box(x-side*.4,4.84,0,.9,.18,9.0,'#6d6556',18);
    }
    for(const s of [-1,1]){
      g.quad([start,4.8,s*4.15],[end,4.8,s*4.15],[end,2.6,s*19],[start,2.6,s*19],'#565c40',18);
      g.quad([start,2.6,s*19],[end,2.6,s*19],[end,-3.1,s*37],[start,-3.1,s*37],'#75734d',18);
    }
  }
}
