const PERSPECTIVE=`
uniform vec3 uRight,uUp,uForward,uEye;
uniform vec2 uLens;
vec4 projectPoint(vec3 p){
  vec3 v=p-uEye;float z=dot(v,uForward);
  return vec4(dot(v,uRight)/uLens.x,dot(v,uUp)/uLens.y,1.000046*z-.120003,z);
}
`;
const PANORAMA=`
uniform sampler2D uSky;
uniform float uTravel,uClock;
vec3 sphereColor(vec3 d){
  float g=1.-smoothstep(.35,.62,d.y);
  d=normalize(d+vec3((uTravel-166.)*(.000060*g)+uClock*.000027*(1.-g),0.,0.));
  vec2 uv=vec2(fract(.5+atan(d.x,-d.z)*.159154943),.5+asin(clamp(d.y,-1.,1.))*.318309886);
  return texture2D(uSky,uv).rgb;
}
`;
const QUAD_VS=`attribute vec2 aCorner;varying vec2 vUv;
void main(){vUv=.5*(aCorner+1.);gl_Position=vec4(aCorner,0.,1.);}`;
const SKY_FS=`precision highp float;varying vec2 vUv;`+PERSPECTIVE+PANORAMA+`
void main(){vec2 s=(2.*vUv-1.)*uLens;vec3 d=normalize(uForward+s.x*uRight+s.y*uUp);
  gl_FragColor=vec4(sphereColor(d),0.);}`;
const MESH_VS=`precision highp float;
attribute vec3 aPos,aNorm,aColor;attribute vec2 aUv;attribute float aMat;
uniform float uOrigin;
varying vec3 vPos,vNorm,vColor;varying vec2 vUv;varying float vMat,vDepth;
`+PERSPECTIVE+`
void main(){vPos=aPos;vNorm=aNorm;vColor=aColor;vUv=aUv;vMat=aMat;
  vec3 p=aPos-vec3(uOrigin,0.,0.);gl_Position=projectPoint(p);vDepth=gl_Position.w;}`;
const MESH_FS=`precision highp float;
varying vec3 vPos,vNorm,vColor;varying vec2 vUv;varying float vMat,vDepth;
uniform float uInterior,uCabinLight,uAdapt,uOrigin,uMirror;
uniform sampler2D uGrain,uLabels;
uniform vec3 uEye;
`+PANORAMA+`
vec4 grain(vec2 p){return texture2D(uGrain,p);}
void main(){
  vec3 p=vPos, view=normalize(uEye-(p-vec3(uOrigin,0.,0.))), n=normalize(vNorm);
  if(dot(n,view)<0.)n=-n;
  vec3 c=vColor;
  float m=vMat;
  if(uMirror>.5 && abs(p.z)>1.475)discard;
  if(uInterior>.5){
    float varnish=0., spec=0.;
    if(m>.5 && m<1.5){
      // The grain follows the longest joinery rather than the screen.
      vec2 uv=abs(n.x)>.65?p.zy:p.xy;
      if(abs(n.y)>.65)uv=p.xz;
      vec4 w=grain(uv*vec2(.43,2.8)), f=grain(uv*vec2(.73,8.6)+w.r*.017);
      c*=.84+.18*w.g+.19*f.g+.11*(w.b-.5);
      varnish=.17;
    }else if(m<2.5 && m>1.5){spec=.70;varnish=.44;c*=.94+.09*grain(p.xy*vec2(1.4,12.)+p.z).b;}
    else if(m<3.5 && m>2.5){
      vec2 uv=abs(n.x)>.55?p.zy:(abs(n.y)>.65?p.xz:p.xy);
      vec3 t=grain(uv*3.7).rgb;float fold=.93+.12*t.r;
      c*=fold*(.945+.105*t.b);varnish=.075;
    }else if(m>3.5 && m<4.5){c*=.95+.08*grain(p.xy*2.1+p.z).r;varnish=.09;}
    else if(m>4.5 && m<5.5){c*=.93+.10*grain(p.xy*7.+p.z).b;varnish=.08;}
    else if(m>7.5 && m<8.5){c*=.73+.39*grain(p.xz*1.9).b;}
    else if(m>8.5 && m<9.5){c*=.88+.22*grain(p.xy*vec2(15.,1.)+p.z).g;}
    else if(m>19.5){c=texture2D(uLabels,vUv).rgb;}
    vec3 sun=normalize(vec3(-.64,.40,-.71));
    float dst=abs(p.z+.4), d=dot(n,sun);
    float hemi=.79+.12*n.y+.11*max(-n.z,0.);
    float below=.77+.23*smoothstep(-.06,.94,p.y);
    float face=.83+.13*dot(n,normalize(vec3(-.42,.72,-.54)));
    float endShade=1.-.09*smoothstep(6.,8.6,abs(p.x));
    // Broad sky fill, warm reflected floor light and direct raking evening light.
    vec3 lit=c*hemi*face*below*endShade*vec3(1.03,.995,.975);
    float patch=.25+.75*smoothstep(-.55,.63,sin((p.x+p.z*.63)*2.55));
    lit+=c*vec3(.32,.19,.092)*max(0.,d)*patch;
    vec3 h=normalize(sun+view);
    lit+=vec3(.69,.48,.28)*pow(max(dot(h,n),0.),spec>.4?58.:27.)*(varnish+spec*.9);
    lit+=vec3(.35,.29,.23)*varnish*pow(1.-max(dot(n,view),0.),3.);
    vec3 night=c*vec3(.49,.325,.225)*(.77+.26*n.y)*(.78+.22*cos(p.x*2.55));
    if(m>5.5 && m<6.5){lit=c*1.06;night=c*vec3(1.07,.93,.75);}
    c=mix(night,lit,uCabinLight);
    gl_FragColor=vec4(c,uMirror>.5?1.:0.);return;
  }
  float dist=length(p-vec3(uOrigin,0.,0.)-uEye);
  vec3 light=normalize(vec3(-.68,.42,-.65));float nd=max(0.,dot(n,light));
  float rough=grain(p.xz*.035).r;
  if(m>9.5 && m<11.5 || m>12.5 && m<13.5){
    float closeTex=1.-smoothstep(70.,400.,dist);
    vec4 t=grain(p.xz*.052), b=grain(p.xz*.20);
    c*=.85+.26*t.r+.12*(b.g-.45)*closeTex;
    if(m>10.5){
      float spacing=m<11.5?.52:.43;
      float row=vUv.x/spacing+.038*sin(vUv.y*.27)+.16*(t.g-.5);
      float detail=clamp(1.-AAWIDTH(row)*1.6,0.,1.);
      float ridge=.5+.5*cos(6.283185*row);
      c*=1.+detail*(.34*(ridge-.5)+.15*(b.b-.5));
      c+=vec3(.095,.07,.026)*detail*pow(ridge,4.)*(.38+.62*b.b);
    }
  }else if(m>11.5 && m<12.5){
    vec4 a=grain(vec2(p.x*.018+uClock*.001,p.z*.077)),b=grain(vec2(p.x*.052,p.z*.16-uClock*.0021));
    float fade=.32+.68*(1.-smoothstep(65.,750.,dist));
    vec3 wn=normalize(vec3((a.g+b.r-1.)*.18*fade,1.,(a.r+b.g-1.)*.14*fade));
    vec3 r=reflect(-view,wn);r.y=max(.003,r.y);
    vec3 reflected=sphereColor(r);
    float f=.40+.49*pow(1.-max(dot(view,wn),0.),2.8);
    vec3 water=mix(vec3(.185,.256,.256),reflected,f);
    float sparkle=pow(max(0.,dot(r,normalize(vec3(-.68,.095,-.73)))),78.);
    c=water+sparkle*(.09+.31*b.b)*vec3(1.,.67,.31);
    c*=.965+.058*a.b;
    gl_FragColor=vec4(c,min(1.,2./max(vDepth,1.)));return;
  }else if(m>13.5 && m<14.5){c*=.95+.07*cos(p.x*24.+p.z*20.)/(1.+dist*.03);}
  else if(m>14.5 && m<15.5){c*=.77+.40*grain(p.xz*.52).b;}
  else if(m>16.5 && m<17.5){
    vec2 uv=vec2(p.x,atan(p.y-.8,p.z)*3.32);
    vec4 t=grain(uv*vec2(.20,.42));float joint=smoothstep(.018,.090,abs(fract(p.x/3.5)-.5)*3.5);
    c*=vec3(.52,.53,.59)*(.56+.26*t.r+.23*t.g)*(.86+.14*joint);
    float lamp=exp(-abs(mod(p.x+6.,28.)-14.)*.40)*smoothstep(-1.8,1.55,p.y);
    c+=vec3(.15,.099,.04)*lamp;
    c*=uAdapt;gl_FragColor=vec4(c,min(1.,2./max(vDepth,1.)));return;
  }else if(m>17.5 && m<18.5){c*=.83+.3*grain(p.xy*.4+p.z*.13).r;}
  else if(m>18.5 && m<19.5){gl_FragColor=vec4(c*.94,min(1.,2./max(vDepth,1.)));return;}
  c*=vec3(.86,.845,.84)+vec3(.25,.21,.135)*nd;
  vec3 haze=vec3(.692,.616,.592);
  float fog=1.-exp(-max(dist-60.,0.)*.00072);
  c=mix(c,haze,fog*.85);
  gl_FragColor=vec4(c,min(1.,2./max(vDepth,1.)));
}`;
const TREE_VS=`precision highp float;attribute vec3 aPos;attribute vec4 aTree;attribute vec2 aUv;
uniform float uOrigin;varying vec2 vUv;varying float vD,vSpecies,vPhase,vH,vDist;
`+PERSPECTIVE+`
void main(){vec3 base=aPos-vec3(uOrigin,0.,0.);
  vec2 flat=base.xz-uEye.xz;vec2 right=normalize(vec2(-flat.y,flat.x)+vec2(.00001,0.));
  vec3 p=base+vec3(right.x,0.,right.y)*(aUv.x-.5)*aTree.x+vec3(0.,aUv.y*aTree.y,0.);
  vUv=aUv;vD=projectPoint(p).w;vSpecies=aTree.z;vPhase=aTree.w;vH=aTree.y;vDist=length(base-uEye);gl_Position=projectPoint(p);}
`;
const TREE_FS=`precision highp float;uniform sampler2D uTrees;varying vec2 vUv;varying float vD,vSpecies,vPhase,vH,vDist;
void main(){
  vec2 uv=mix(vec2(.002),vec2(.998),vUv);
  if(fract(vPhase*7.167)>.5)uv.x=1.-uv.x;
  uv=vec2((uv.x+mod(vSpecies,4.))*.25,(uv.y+1.-floor(vSpecies*.25))*.5);
  vec4 t=texture2D(uTrees,uv);
  if(t.a<.27)discard;
  float depthTone=.85+.16*vUv.y;
  vec3 c=t.rgb*depthTone*(.89+.17*fract(vPhase*3.137));
  float f=1.-exp(-max(0.,vDist-28.)*.00083);
  c=mix(c,vec3(.694,.617,.575),f*.90);
  gl_FragColor=vec4(c,min(1.,2./max(vD,1.)));
}`;
const COMPOSITE_FS=`precision highp float;varying vec2 vUv;
uniform sampler2D uWorld,uReflection,uGrain;
uniform vec2 uPixel;
uniform float uClock,uCover,uPhoto,uSide,uShutter;
`+PERSPECTIVE+`
void main(){
  vec2 nd=vUv*2.-1.;vec3 d=normalize(uForward+uRight*nd.x*uLens.x+uUp*nd.y*uLens.y);
  vec4 raw=texture2D(uWorld,vUv);
  vec2 v=(vec2(uRight.x,uUp.x)/uLens-nd*uForward.x)*raw.a*.25*uShutter;
  v=clamp(v,-uPixel*23.,uPixel*23.);
  vec3 c=raw.rgb*.28;
  c+=texture2D(uWorld,vUv+v*.42).rgb*.22+texture2D(uWorld,vUv-v*.42).rgb*.22;
  c+=texture2D(uWorld,vUv+v*.88).rgb*.14+texture2D(uWorld,vUv-v*.88).rgb*.14;
  c*=uPhoto;
  float side=sign(d.z);float plane=side*1.52;
  float t=(plane-uEye.z)/(abs(d.z)>.001?d.z:.001);vec3 p=uEye+d*t;
  if(t>0. && abs(p.x)<8.64 && p.y>.86 && p.y<2.18){
    vec2 uv=vUv;vec4 reflected=texture2D(uReflection,uv);
    float fres=.038+.24*pow(1.-abs(d.z),4.);
    float gain=fres+.245*uCover;
    if(side!=uSide)gain*=.17;
    c*=vec3(.992,.997,.988);
    c+=reflected.rgb*gain;
    vec2 pix=uPixel*vec2(2.,.8);
    c+=texture2D(uReflection,uv+pix).rgb*gain*.10;
    vec4 dirt=texture2D(uGrain,p.xy*vec2(.46,1.7));
    float haze=smoothstep(.50,.83,dirt.r)*.013;
    c=mix(c,vec3(.88,.77,.68),haze);
  }
  gl_FragColor=vec4(c,1.);
}`;
