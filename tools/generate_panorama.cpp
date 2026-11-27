// Deterministic, image-free source for the far-field environment. World x is east,
// z is north, and the second channel of the height field is z. Colours are sRGB.
// Build: c++ -std=c++17 -O3 -fopenmp tools/generate_panorama.cpp -o /tmp/hifuu-env
// Run: /tmp/hifuu-env 7168 /tmp/hifuu-env.ppm /tmp/hifuu-sky.pam
//      magick /tmp/hifuu-env.ppm -sampling-factor 1x1 -quality 92 src/horizon.jpg
//      magick /tmp/hifuu-sky.pam -define webp:lossless=true -define webp:exact=true src/sky-layers.webp
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <omp.h>
using std::max;
using std::min;
constexpr float pi=3.14159265358979323846f;
inline float clamp(float n,float a=0,float b=1) {
  return min(b,max(a,n));
}

inline float mix(float a,float b,float t) {
  return a+(b-a)*t;
}

inline float smooth(float a,float b,float x) {
  float t=clamp((x-a)/(b-a));
  return t*t*(3.f-2.f*t);
}

inline float sq(float x) {
  return x*x;
}

struct C {
  float r,g,b;
  C operator+(C v)const {
    return {r+v.r,g+v.g,b+v.b};
  }
  C operator-(C v)const {
    return {r-v.r,g-v.g,b-v.b};
  }
  C operator*(float a)const {
    return {r*a,g*a,b*a};
  }
};
inline C blend(C a,C b,float t) {
  return a+(b-a)*t;
}

inline uint32_t hash(uint32_t n) {
  n^=n>>16;
  n*=0x7feb352du;
  n^=n>>15;
  n*=0x846ca68bu;
  n^=n>>16;
  return n;
}

inline float unit(uint32_t n) {
  return (hash(n)>>8)*(1.f/16777216.f);
}

constexpr int NB=128;
std::vector<float> nt(NB*NB*NB);
inline float lattice(int x,int z,int y=0) {
  return nt[((y&127)*128+(z&127))*128+(x&127)];
}

inline float n2(float x,float z) {
  int a=(int)floorf(x),b=(int)floorf(z);
  float u=x-a,v=z-b;
  u=u*u*(3-2*u);
  v=v*v*(3-2*v);
  return mix(mix(lattice(a,b),lattice(a+1,b),u),mix(lattice(a,b+1),lattice(a+1,b+1),u),v);
}

inline float n3(float x,float z,float y) {
  int a=(int)floorf(x),b=(int)floorf(z),c=(int)floorf(y);
  float u=x-a,v=z-b,w=y-c;
  u=u*u*(3-2*u);
  v=v*v*(3-2*v);
  w=w*w*(3-2*w);
  return mix(mix(mix(lattice(a,b,c),lattice(a+1,b,c),u),mix(lattice(a,b+1,c),lattice(a+1,b+1,c),u),v),mix(mix(lattice(a,b,c+1),lattice(a+1,b,c+1),u),mix(lattice(a,b+1,c+1),lattice(a+1,b+1,c+1),u),v),w);
}

float fb(float x,float z) {
  return n2(x,z)*.53f+n2(.86f*x*2.05f+.51f*z*2.05f+17,-.51f*x*2.05f+.86f*z*2.05f+8)*.27f+n2(-.31f*x*4.3f+.95f*z*4.3f+50,-.95f*x*4.3f-.31f*z*4.3f+6)*.13f+n2(.64f*x*8.65f-.77f*z*8.65f+12,.77f*x*8.65f+.64f*z*8.65f+41)*.07f;
}
// The coverage volume is sampled both along the viewing ray and towards the sun.
// The grid is deliberately reused by all rays so lighting stays consistent at seams.
constexpr int CN=544, CY=43;
constexpr float cloudSpan=64.f,base=2.05f,thick=1.72f;
std::vector<float> cloud(CN*CN*CY),sunlight(CN*CN*CY);
constexpr float sunAz=-42.8f*pi/180,sunAlt=7.7f*pi/180;
constexpr float moonAz=19.2f*pi/180;
inline int idx(int x,int z,int y) {
  return (y*CN+z)*CN+x;
}

inline float vol(const std::vector<float>& field,float x,float z,float y) {
  if (y<=0||y>=CY-1)return 0;
  int ix=floorf(x),iz=floorf(z),iy=int(y);
  float u=x-ix,v=z-iz,w=y-iy;
  int ax=(ix%CN+CN)%CN,az=(iz%CN+CN)%CN,bx=ax+1==CN?0:ax+1,bz=az+1==CN?0:az+1;
  return mix(mix(mix(field[idx(ax,az,iy)],field[idx(bx,az,iy)],u),mix(field[idx(ax,bz,iy)],field[idx(bx,bz,iy)],u),v),mix(mix(field[idx(ax,az,iy+1)],field[idx(bx,az,iy+1)],u),mix(field[idx(ax,bz,iy+1)],field[idx(bx,bz,iy+1)],u),v),w);
}

void clouds() {
#pragma omp parallel for schedule(static)
  for (int z=0;z<CN;z++) for (int x=0;x<CN;x++) {
    float xx=(x-CN/2)*cloudSpan/CN,zz=(z-CN/2)*cloudSpan/CN;
    // Clustered cloud streets intersect the north-facing window on either side of the peak.
    float sw=fb(xx*.081f+22.4f,zz*.096f+38.1f), weather=(sw-.54f)*1.05f-.20f;
    struct Bank {
      float x,z,a,b,amplitude,angle;
    };
    static constexpr Bank banks[]={{-8.8f,14.8f,6.9f,2.4f,.57f,-.14f},{-3.7f,4.8f,3.8f,1.1f,.33f,-.21f},{-5.6f,10.0f,3.6f,1.2f,.37f,-.28f},{5.3f,5.6f,1.8f,.85f,.37f,-.26f},{9.3f,8.0f,5.1f,1.62f,.49f,.31f},{3.1f,12.8f,4.5f,.8f,.35f,-.16f},{-12.f,24.9f,13.8f,2.8f,.48f,-.19f},{5.f,23.7f,8.f,1.4f,.37f,.12f},{10,-2,5,1.7f,.45f,.2f},{-4,-12,4,2,.4f,-.5f},{-12,-12,4,2,.44f,.15f}};
    float sculpt=0;
    for (const auto& b:banks) {
      float dx=xx-b.x,dz=zz-b.z;
      float X=cosf(b.angle)*dx+sinf(b.angle)*dz,Z=-sinf(b.angle)*dx+cosf(b.angle)*dz;
      sculpt+=b.amplitude*expf(-sq(X/b.a)-sq(Z/b.b));
    }
    weather-=.27f*expf(-sq((xx+.2f)/1.85f)-sq((zz-5.3f)/2.0f));
    weather-=.43f*expf(-sq((xx+10.7f)/3.2f)-sq((zz-11.7f)/3.1f));
    // Crosswinds open a break through the two-kilometre cloud layer over the
    // northeast shoulder. The gap is three-dimensional, and its edges remain noisy.
    float acrossMoon=xx*cosf(moonAz)-zz*sinf(moonAz);
    float alongMoon=xx*sinf(moonAz)+zz*cosf(moonAz);
    float breakShape=acrossMoon+.61f*(fb(xx*.53f+53,zz*.31f+17)-.5f);
    weather-=.73f*expf(-sq(breakShape/(1.42f+.057f*max(0.f,alongMoon)))-sq((alongMoon-7.75f)/4.25f));
    weather+=sculpt+.52f*(fb(xx*.38f+8.3f,zz*.41f+72)-.5f);
    for (int k=0;k<CY;k++) {
      float y=k/float(CY-1), adv=.52f*y;
      float X=xx+adv+18.35f,Z=zz+.24f*y+11.7f;
      float f=.45f*n3(X*.74f,Z*.77f,y*1.7f+14)+.28f*n3(X*1.5f+32,Z*1.6f+14,y*3.9f+8)+.16f*n3(X*3.35f+18,Z*3.21f+42,y*7.4f+45)+.11f*n3(X*6.9f+2,Z*7.0f+7,y*16.6f+1);
      float body=weather+1.22f*(f-.50f)+.07f-.34f*powf(fabsf(2.04f*y-.88f),1.35f)-.08f*y;
      cloud[idx(x,z,k)]=max(0.f,body)*6.f*smooth(.015f,.16f,y)*(1-smooth(.77f,.995f,y));
    }
  }
  const float sx=sinf(sunAz),sz=cosf(sunAz),sy=tanf(sunAlt);
#pragma omp parallel for schedule(static)
  for (int k=0;k<CY;k++) for (int z=0;z<CN;z++) for (int x=0;x<CN;x++) {
    if (!cloud[idx(x,z,k)])continue;
    float tau=0,prev=0;
    for (float t:{.19f,.47f,.86f,1.43f,2.28f,3.48f,5.0f,7.16f,10.25f}) {
      tau+=vol(cloud,x+t*sx*CN/cloudSpan,z+t*sz*CN/cloudSpan,k+t*sy*(CY-1)/thick)*(t-prev);
      prev=t;
    }
    sunlight[idx(x,z,k)]=.16f+.84f*expf(-.50f*tau);
  }
}

struct IceLayer {
  C color; // Straight, unassociated sRGB scattering colour in 0…255.
  float opacity;
};

float solarWarmth(float azimuth) {
  float azdiff=acosf(clamp(cosf(azimuth-sunAz),-1.f,1.f));
  return expf(-powf(azdiff/.92f,2.22f));
}

// A seven-kilometre ice layer carries a feathered, curved stream of falling
// crystals. The shear, spacing and finite longitudinal extent vary independently.
IceLayer highClouds(float sx, float sz, float elevation, float warmth) {
  C thinIce=blend({205,175,213},{255,211,160},warmth);
  float m=sinf(elevation);
  if (m<.012f) return {thinIce,0.f};
  float x=sx*7.6f/(m+.018f), z=sz*7.6f/(m+.018f);
  float swirl=fb(x*.14f+23,z*.16f+45)-.5f;
  float drift=fb(x*.08f+z*.036f+33,z*.56f-x*.13f+swirl*2.0f+5);
  float mantle=fb(x*.072f+48,z*.077f+17);
  float hair=fb(x*.16f+44,z*2.3f-x*.36f+swirl*3.6f+23);
  float veil=smooth(.40f,.72f,drift)*smooth(.31f,.72f,mantle)*(.32f+.87f*hair);
  float veilOpacity=veil*.41f*smooth(.016f,.075f,m);

  // Cirrus uncinus starts in little fallstreak-generating cells. Each tuft has
  // a finite hooked tail as the descending crystals encounter a different wind.
  // Head placement and independently varying lengths leave open gaps between them.
  struct Fallstreak { float x, z, length, width, bend, tilt, weight; };
  static constexpr Fallstreak sources[]={
    {-14.4f,16.0f, 8.0f,1.16f,-2.12f,-.14f,.76f},
    {-8.1f,14.7f, 6.6f,.93f, 1.66f, .19f,.89f},
    {-5.9f,18.3f, 5.7f,.80f,-1.33f,-.12f,.68f},
    {-.5f,16.6f, 7.8f,1.05f,-1.78f,-.18f,.97f},
    { 4.4f,14.4f, 5.0f,.76f, 1.47f, .03f,.62f},
    {10.2f,15.5f, 4.6f,.52f,-1.08f,-.24f,.57f},
    // A light source cell just west of the lunar direction allows wind to draw
    // a short veil over the limb during the journey.
    {3.85f,19.72f,4.9f,.64f,.87f,.32f,1.05f}
  };
  if (x < -21.f || x > 20.f || z < 9.f || z > 23.f) return {thinIce,veilOpacity};
  float tau=0.f, upper=0.f;
  float eddy=fb(x*.33f+22,z*.37f+37)-.5f;
  float shear=fb(x*.42f+45,z*.20f+62)-.5f;
  for (const auto& cell:sources) {
    float dx=x-cell.x,dz=z-cell.z;
    float along=dx*cosf(cell.tilt)+dz*sinf(cell.tilt);
    if (along < -3.f || along > cell.length+2.f) continue;
    float across=-dx*sinf(cell.tilt)+dz*cosf(cell.tilt);
    float t=clamp(along/cell.length);
    float curve=cell.bend*(.71f*sinf(t*1.62f)+.29f*t*t)+.66f*shear+.46f*eddy;
    float drift=across-curve;
    float head=expf(-sq(along/1.80f)-sq((across-.72f*eddy)/(cell.width*1.17f)));
    float spread=cell.width*(.67f+.93f*t)+.22f*shear;
    float tail=smooth(-.7f,1.5f,along)*(1-smooth(.44f,1.05f,t));
    tail*=expf(-sq(drift/spread));
    float broad=fb(along*.38f+37,drift*.62f+shear*1.78f+11);
    float fiber=fb(along*.28f+drift*.17f+51,drift*2.15f+1.13f*broad+1.91f*shear+23);
    float fine=fb(along*.55f+43,drift*4.51f+1.65f*shear+29);
    float texture=smooth(.29f,.72f,.31f*broad+.47f*fiber+.22f*fine);
    float amount=cell.weight*(head*(.31f+.84f*texture)+tail*(.12f+1.22f*texture));
    tau+=amount;
    upper+=amount*clamp(.60f-drift*.23f+.23f*(fiber-.5f)+head*.12f);
  }
  if (tau<.002f) return {thinIce,veilOpacity};
  C iceShade=blend({157,140,195},{225,137,158},warmth);
  C iceSun=blend({249,168,193},{255,208,147},warmth);
  C ice=blend(iceShade,iceSun,clamp(upper/tau));
  float fallOpacity=1.f-expf(-tau*1.19f);
  float visibleVeil=(1.f-fallOpacity)*veilOpacity;
  float opacity=fallOpacity+visibleVeil;
  return {(ice*fallOpacity+thinIce*visibleVeil)*(1.f/opacity),opacity};
}

C clearSky(float a,float h,float glow) {
  float m=sinf(h);
  float sunD=acosf(clamp(cosf(h)*cosf(sunAlt)*cosf(a-sunAz)+m*sinf(sunAlt),-1.f,1.f));

  // Long optical paths on the solar side carry copper, apricot and rose. The
  // shallower eastern line of sight opens directly into cool twilight above it.
  C eastern=blend({220,166,180},{120,125,190},smooth(.025f,.37f,h));
  eastern=blend(eastern,{53,67,128},1.f-expf(-max(0.f,h-.255f)*2.42f));
  C western=blend({255,212,124},{249,151,144},smooth(.045f,.32f,h));
  western=blend(western,{117,99,163},1.f-expf(-max(0.f,h-.25f)*2.52f));
  C col=blend(eastern,western,glow);
  float afterglow=expf(-sq((h-.13f)/.135f))*(1.f-glow);
  col=blend(col,{215,152,189},afterglow*.23f);
  col=blend(col,{255,192,108},.49f*expf(-sunD*4.9f));
  col=blend(col,{255,226,150},.74f*expf(-sunD*21.f));
  col=blend(col,{255,252,221},1.f-smooth(.0041f,.0051f,sunD));
  return col;
}

// Each low-cloud sample scatters its own colour plus a fraction of the incident
// sky through distance haze. The coefficient of incoming sky is therefore the
// terminal transmittance plus those small, differently weighted haze terms.
struct LowSky {
  C color;
  float incidentTransmission;
};

LowSky sky(float a,float el,int px,int py) {
  float h=max(el,0.f), m=sinf(h), glow=solarWarmth(a);
  float sx=sinf(a)*cosf(h), sz=cosf(a)*cosf(h);
  C col=clearSky(a,h,glow);
  float incidentTransmission=1.f;
  if (h>.006f) {
    float t=base/max(m,.001f),end=min(54.f,(base+thick)/max(m,.001f));
    if (end>t) {
      float step=clamp((end-t)/47.f,.065f,.22f),trans=1, hazeTransmission=0.f;
      C scatter{0,0,0};
      float rnd=.4f+unit(px*7963u+py*9703u)*.2f;
      t+=step*rnd;
      for (;t<end&&trans>.012f;t+=step) {
        float xx=CN*.5f+sx*t*CN/cloudSpan,zz=CN*.5f+sz*t*CN/cloudSpan,yy=(m*t-base)*(CY-1)/thick;
        float d=vol(cloud,xx,zz,yy);
        if (d<.001f)continue;
        auto detail=[&](float X,float Z,float Y) {
          return n3(X*.86f+32,Z*.96f+69,Y*.33f+6)*.53f+n3(X*2.03f+21,Z*2.08f+8,Y*.73f+1)*.28f+n3(X*4.31f+29,Z*4.40f+2,Y*1.66f+17)*.13f+n3(X*8.70f+4,Z*8.26f+29,Y*3.32f+21)*.06f;
        };
        float edge=detail(xx,zz,yy);
        d=max(0.f,d+1.24f*(edge-.54f)*smooth(0.f,.11f,d));
        if (d<.001f)continue;
        float fineSun=(edge-detail(xx-.71f,zz+.66f,yy+.55f));
        float lit=clamp(vol(sunlight,xx,zz,yy)+fineSun*.83f+.09f*expf(-d*1.35f)),norm=yy/(CY-1);
        float lightAngle=clamp(.24f+.64f*glow+.12f*norm);
        C shadow=blend({91,95,156},{165,120,168},lightAngle);
        C light=blend({249,165,193},{255,215,149},clamp(glow*.93f+.10f*norm));
        float transmitted=smooth(.24f,.96f,lit+.07f*norm);
        float blueBounce=.12f*(1.f-expf(-d))*(1.f-.68f*glow);
        shadow=blend(shadow,{105,105,175},blueBounce);
        C local=blend(shadow,light,transmitted*(.87f+.11f*norm));
        // Fine sunward edges collect a little forward-scattered golden light.
        float rim=expf(-d*2.1f)*smooth(.38f,.96f,lit)*(.17f+.22f*glow);
        local=blend(local,blend({255,196,209},{255,229,161},glow),rim);
        float distHaze=clamp((t-9.f)/58.f,0,.49f);
        float hazeMix=distHaze*.72f;
        local=blend(local,col,hazeMix);
        float tau=1-expf(-d*step*1.55f);
        hazeTransmission+=trans*tau*hazeMix;
        scatter=scatter+local*(trans*tau);
        trans*=1-tau;
      }
      incidentTransmission=trans+hazeTransmission;
      col=scatter+col*trans;
    }
  }
  return {col,clamp(incidentTransmission)};
}
// Mountain relief combines overlapping volcanic cones and distorted radial ribs.
// Hydraulic erosion subsequent to construction carves the fine drainage network.
constexpr int N=2321;
constexpr float cell=12.f, radius=(N-1)*cell*.5f;
std::vector<float> terrain(N*N),slx(N*N),slz(N*N),trees(N*N);
std::vector<C> surface(N*N);
std::vector<uint8_t> img;
std::vector<uint16_t> depth;
std::vector<float> skyTransmission;
int W,H;
float cone(float x,float z,float cx,float cz,float ax,float az,float amp,float rot,float expn) {
  float X=(x-cx)*cosf(rot)+(z-cz)*sinf(rot),Z=-(x-cx)*sinf(rot)+(z-cz)*cosf(rot);
  float d=sqrtf(sq(X/ax)+sq(Z/az));
  return amp*powf(max(0.f,1.f-d),expn);
}

// A compact, uneven buttress follows a bent centreline on the caldera flank.
float buttress(float x, float z, float x0, float z0, float x1, float z1,
               float bend, float width, float amplitude) {
  float dx=x1-x0, dz=z1-z0, length=sqrtf(dx*dx+dz*dz);
  float t=((x-x0)*dx+(z-z0)*dz)/(length*length);
  float across=((x-x0)*dz-(z-z0)*dx)/length;
  float crest=bend*sinf(pi*clamp(t))+.23f*bend*sinf(2*pi*clamp(t));
  float core=expf(-sq((across-crest)/width));
  return amplitude*core*smooth(-.13f,.21f,t)*(1-smooth(.70f,1.13f,t));
}

float terrainModel(float x,float z) {
  float near=sqrtf(x*x+z*z),horizon=smooth(1200,4600,near);
  float longN=fb(x*.00027f+22,z*.00027f+8),midN=fb(x*.00086f+44,z*.00086f+31);
  float h=(-95+265*longN+130*(midN-.48f))*horizon-46*(1-horizon);
  // Low ridges wrap the basin at all azimuths. Successive generations overlap with haze.
  float ang=atan2f(x,z);
  float ranges=expf(-sq((near-(8400+1100*sinf(3*ang)+470*cosf(7*ang)))/1700));
  float outer=expf(-sq((near-(12300+500*cosf(4*ang)))/2100));
  h+=ranges*(240+290*longN+170*(midN-.5f)) + outer*(360+410*longN+270*(midN-.5f));
  float X=x+190*(fb(x*.00055f+19,z*.00055f+43)-.5f)+35*(midN-.5f);
  float Z=z+140*(fb(x*.00068f+3,z*.00068f+24)-.5f);
  float main=cone(X,Z,650,6550,4870,3170,2110,-.11f,1.08f);
  float side=cone(X,Z,-1030,7300,3880,3350,1630,.2f,1.04f),rear=cone(X,Z,2380,7940,3680,3420,1710,-.25f,1.04f);
  float west=cone(X,Z,-3740,7450,4280,2420,1135,.26f,1.0f),east=cone(X,Z,4450,7040,3500,3060,940,-.37f,1.f);
  auto unite=[](float a,float b,float k) {
    float t=max(k-fabsf(a-b),0.f)/k;
    return max(a,b)+t*t*k*.25f;
  };
  float mound=unite(unite(main,side,220),unite(rear,unite(west,east,115),135),175);
  if (mound>28) {
    // Unequal lava lobes overlap and cross the fall line. The large rib on the
    // southwest face is split by the caldera, with a shorter fan on its lee.
    float xw=x+324.f*(fb(x*.00073f+23,z*.00065f+48)-.5f);
    float zw=z+223.f*(fb(x*.00085f+43,z*.00074f+11)-.5f);
    float lobes=buttress(xw,zw,790,6650,-1180,4240,282,262,292)
               +buttress(xw,zw,622,6400,2390,5200,-305,326,215)
               +buttress(xw,zw,-820,7430,-2430,5910,-172,261,151)
               +buttress(xw,zw,2020,7500,3060,5980,242,239,134)
               +buttress(xw,zw,-510,5280,-1450,4710,65,125,89)
               -buttress(xw,zw,930,6260,110,5020,171,148,124);
    float relief=(fb(xw*.00062f+47,zw*.00087f+12)-.5f)*241
                +(fb(xw*.00285f+12,zw*.00215f+51)-.50f)*62;
    float fractured=1-fabsf(2*n2(xw*.00185f+zw*.0014f+27,zw*.00128f-xw*.0007f+40)-1);
    // Broken volcanic strata produce kinked oblique outcrops on either side of a snow bowl.
    float qx=xw+194*(fb(xw*.0018f+41,zw*.0012f+62)-.5f);
    float qz=zw+163*(fb(xw*.0013f+21,zw*.0022f+19)-.5f);
    float rockRidge=0.f, amplitude=106.f,frequency=.00174f;
    for (int octave=0;octave<4;octave++) {
      float v=n2((qx*.94f+qz*.60f)*frequency+17+octave*23,
                 (-qx*.34f+qz*.66f)*frequency+32+octave*11);
      float ridged=1.f-fabsf(2.f*v-1.f);
      rockRidge+=amplitude*(ridged*ridged-.53f);
      float rotated=.84f*qx+.48f*qz;
      qz=-.48f*qx+.84f*qz;qx=rotated;
      amplitude*=.45f;frequency*=2.06f;
    }
    relief+=rockRidge*smooth(470,1420,mound);
    mound+=smooth(210,1110,mound)*lobes+(.28f+.72f*smooth(120,950,mound))
          *(relief+(fractured-.6f)*52.f+(fb(x*.010f+11,z*.010f+27)-.5f)*23.f);
  }
  float crater=sqrtf(sq((X+140.f)/820.f)+sq((Z-6040.f)/690.f));
  mound-=170.f*expf(-powf(crater,3.1f)*1.85f);
  mound+=46.f*expf(-sq((crater-1.08f)/.27f))*smooth(5550,6280,Z);
  float fore=(expf(-sq((near-(3120+790*sinf(2.8f*ang)+420*cosf(4*ang)))/920)))*(75+180*(longN-.27f));
  float distant=cone(X,Z,-6050,11100,4200,2250,680,.36f,1.03f)+cone(X,Z,-9270,9280,3410,2700,510,-.12f,1.19f);
  distant+=cone(X,Z,6520,11050,4100,2840,820,-.29f,1.14f)+cone(X,Z,9500,9250,3320,3090,490,.19f,1.18f);
  fore+=116*expf(-sq((x+3750)/1750.f)-sq((z-3810)/880.f))+96*expf(-sq((x-3320)/1900.f)-sq((z-3650)/820.f));
  float lowRelief=smooth(700,1750,near)*(1-smooth(3700,6300,near));
  h+=lowRelief*((fb(x*.00083f+26,z*.00125f+44)-.5f)*95.f+(fb(x*.0034f+9,z*.0039f+19)-.5f)*25.f);
  float relief=h+max(0.f,mound-25)+fore+distant;
  float valleyFloor=-54.f+15.f*(longN-.5f)+near*.003f;
  return mix(valleyFloor,relief,smooth(390,1630,near));
}

inline float sample(const std::vector<float>& b,float x,float z) {
  int i=clamp(floorf(x),0,N-2),j=clamp(floorf(z),0,N-2);
  float u=clamp(x-i),v=clamp(z-j);
  return mix(mix(b[j*N+i],b[j*N+i+1],u),mix(b[(j+1)*N+i],b[(j+1)*N+i+1],u),v);
}

void mountains() {
#pragma omp parallel for schedule(static)
  for (int z=0;z<N;z++) for (int x=0;x<N;x++)terrain[z*N+x]=terrainModel(x*cell-radius,z*cell-radius);
  // On resistant volcanic bedrock runoff leaves shallow rills. Retain the unweathered
  // surface to constrain stream incision; unconstrained droplets cut parallel flutes.
  std::vector<float> bedrock=terrain;
  // Individual rain paths transport sediment downhill, separating snowfields with dendritic outcrops.
  uint32_t seed=782365;
  auto rnd=[&]() {
    seed=1664525u*seed+1013904223u;
    return (seed>>8)/16777216.f;
  };
  for (int drop=0;drop<725000;drop++) {
    float x,z;
    if (drop%5) {
      x=(rnd()*11600-5300+radius)/cell;
      z=(rnd()*9000+1850+radius)/cell;
    } else {
      x=rnd()*(N-4)+2;
      z=rnd()*(N-4)+2;
    }
    float vx=0,vz=0,load=0,water=1,energy=1;
    for (int life=0;life<43;life++) {
      int i=(int)x,j=(int)z;
      if (i<3||j<3||i>=N-4||j>=N-4)break;
      float fx=x-i,fz=z-j;
      int o=j*N+i;
      float h0=terrain[o],h1=terrain[o+1],h2=terrain[o+N],h3=terrain[o+N+1];
      float hh=mix(mix(h0,h1,fx),mix(h2,h3,fx),fz);
      float gx=mix(h1-h0,h3-h2,fz),gz=mix(h2-h0,h3-h1,fx);
      vx=.33f*vx-.67f*gx;
      vz=.33f*vz-.67f*gz;
      float len=sqrtf(vx*vx+vz*vz);
      if (len<.005f)break;
      vx/=len;
      vz/=len;
      float nx=x+vx,nz=z+vz;
      float dh=sample(terrain,nx,nz)-hh,cap=max(.11f,-dh)*water*energy*1.35f;
      if (load>cap||dh>0) {
        float put=(dh>0?min(dh,load):(load-cap)*.27f);
        terrain[o]+=put*(1-fx)*(1-fz);
        terrain[o+1]+=put*fx*(1-fz);
        terrain[o+N]+=put*(1-fx)*fz;
        terrain[o+N+1]+=put*fx*fz;
        load-=put;
      }
      else {
        float take=min((cap-load)*.085f,-dh)*.30f;
        terrain[o]-=take*.40f;
        terrain[o-1]-=take*.115f;
        terrain[o+1]-=take*.115f;
        terrain[o-N]-=take*.115f;
        terrain[o+N]-=take*.115f;
        terrain[o-N-1]-=take*.035f;
        terrain[o-N+1]-=take*.035f;
        terrain[o+N-1]-=take*.035f;
        terrain[o+N+1]-=take*.035f;
        load+=take;
      }
      energy=clamp(sqrtf(max(.15f,energy*energy-dh*.27f)),.3f,4.4f);
      water*=.972f;
      x=nx;
      z=nz;
    }
  }
#pragma omp parallel for schedule(static)
  for (int i=0;i<N*N;i++) {
    float eroded=terrain[i]-bedrock[i];
    terrain[i]=bedrock[i]+clamp(eroded,-14.f,8.f)*.21f;
  }
  // Gravity redistributes loose talus after fluvial incision, preserving steep bedrock walls.
  std::vector<float> work=terrain;
  for (int pass=0;pass<7;pass++) {
#pragma omp parallel for schedule(static)
    for (int z=1;z<N-1;z++) for (int x=1;x<N-1;x++) {
      int i=z*N+x;
      float c=terrain[i],delta=0;
      for (int n:{i-1,i+1,i-N,i+N}) {
        float e=terrain[n]-c;
        delta+=copysignf(max(0.f,fabsf(e)-9.4f),e)+e*.11f;
      }
      work[i]=c+delta*.19f;
    }
    std::swap(terrain,work);
  }
#pragma omp parallel for schedule(static)
  for (int z=1;z<N-1;z++) for (int x=1;x<N-1;x++) {
    int o=z*N+x;
    slx[o]=(terrain[o+1]-terrain[o-1])/(2*cell);
    slz[o]=(terrain[o+N]-terrain[o-N])/(2*cell);
  }
#pragma omp parallel for schedule(static)
  for (int z=2;z<N-2;z++) for (int x=2;x<N-2;x++) {
    int o=z*N+x;
    float xx=x*cell-radius,zz=z*cell-radius,h=terrain[o],gx=slx[o],gz=slz[o],slope=sqrtf(gx*gx+gz*gz),len=sqrtf(1+slope*slope),nx=-gx/len,nz=-gz/len,ny=1/len;
    float broad=fb(xx*.0019f+19,zz*.0019f+33),cluster=fb(xx*.007f+34,zz*.007f+4),grit=n2(xx*.029f+31,zz*.029f+23),micro=unit(x*6151u+z*277u);
    // Directional visibility is evaluated on the actual height field. It catches secondary ridges and talus bowls.
    float shade=0;
    for (float d:{3.f,7.f,15.f,31.f,57.f,99.f,157.f}) {
      float high=sample(terrain,x-d*.946f,z+d*.325f);
      shade=max(shade,(high-h)/(d*cell));
    }
    float direct=clamp((nx*-.927f+nz*.245f+ny*.283f)*1.11f);
    float sun=smooth(.005f,.62f,direct)*(1-.79f*smooth(.225f,.46f,shade));
    float bowl=clamp((terrain[o-N*2]+terrain[o+N*2]+terrain[o-2]+terrain[o+2]-4*h)*.063f,-1,1);
    float variation=(broad-.5f)*1.0f+(cluster-.5f)*.44f;
    float grain=(grit-.5f)*.15f+(micro-.5f)*.1f;
    float valley=fb(xx*.00066f+24,zz*.00057f+52);
    float patch=clamp(.48f+1.67f*(broad-.5f)+1.05f*(valley-.5f)+.76f*(cluster-.5f));
    float woods=smooth(160,865,h+(valley-.5f)*830+(cluster-.5f)*280-slope*135+nx*115);
    woods*=.39f+.61f*smooth(.13f,.76f,patch);
    C green=blend({26,59,52},{75,84,55},clamp(.43f+variation));
    C autumn=blend({110,58,40},{184,96,47},clamp(.40f+variation*1.25f));
    autumn=blend(autumn,{182,139,57},clamp((cluster-.57f)*2.8f)*.88f);
    C low=blend(green,autumn,woods);
    float alpine=smooth(1080,1470,h+(broad-.5f)*305+(cluster-.5f)*140+slope*74);
    C rock=blend({75,66,67},{142,117,102},clamp(.48f+variation*1.1f+bowl*.072f));
    C substrate=blend(low,rock,alpine);
    C unlit=blend(substrate,{80,68,87},.25f)*(ny*.09f+.77f+grain);
    C lit=substrate*(.96f+grain+direct*.30f)+C{24,12,5};
    C color=blend(unlit,lit,sun);
    float wind=nx*.31f+nz*.20f;
    float snowline=1190+220*wind-99*bowl+390*(valley-.5f)+450*(broad-.5f)+140*(cluster-.5f)+55*(grit-.5f);
    // Persistent snow follows concave gullies, with rock breaking through steep convex faces.
    float snowHeight=smooth(snowline-78,snowline+92,h);
    float bare=smooth(.79f,1.50f,slope+.19f*wind-.18f*bowl+(.50f-cluster)*.48f);
    float darkSpur=smooth(.50f,.73f,cluster-.18f*bowl+wind*.09f);
    float snow=clamp(snowHeight*(1-bare*mix(.18f,.94f,darkSpur)*(1-.19f*smooth(1490,2050,h))));
    // Thin lava beds, deep ribs and scoured windward patches show through fresh
    // powder. Their azimuth follows the exposed face rather than constant height.
    float shift=fb(xx*.0032f+37,zz*.0033f+16)-.5f;
    float veins=fb((xx*.0105f+zz*.0067f)+shift*2.4f+31,
                   zz*.0036f-xx*.0025f+shift*.7f+23);
    float rockPatch=smooth(.49f,.73f,cluster+.16f*(broad-.5f)-.13f*bowl);
    float exposed=smooth(.545f,.68f,veins)*rockPatch*(.18f+.58f*bare);
    snow*=1-exposed;
    C cold=blend({149,158,188},{187,191,209},clamp(.39f+.47f*ny+.14f*bowl));
    C white=blend({251,226,211},{255,249,236},clamp(.24f+direct*.82f));
    C ice=blend(cold,white,sun);
    float sastrugi=(fb(xx*.032f+zz*.013f+21,zz*.008f-xx*.006f+64)-.5f)*.060f;
    ice=ice*(.979f+(.5f-grit)*.033f+micro*.023f+sastrugi);
    color=blend(color,ice,snow);
    // Low spruce canopy roughens the silhouette and gives the foothills their scale.
    float range=sqrtf(xx*xx+zz*zz);
    float forest=(1-smooth(1030,1400,h))*(1-smooth(.46f,1.f,slope))*smooth(240,1150,range);
    float canopy=fb(xx*.0084f+52,zz*.0097f+7);
    float spruce=clamp(.72f+1.40f*(valley-.49f)+.59f*(broad-.5f));
    C crown=blend({31,52,50},{93,104,70},clamp(.34f+1.72f*(canopy-.38f)+.37f*sun));
    C birch=blend({83,78,50},{148,113,62},clamp((canopy-.21f)*1.65f+.25f*sun));
    color=blend(color,blend(birch,crown,spruce),forest*(1-smooth(270,750,h))*.78f);
    float height=forest*(3.3f+6.2f*micro+5.4f*grit+3.8f*canopy);
    trees[o]=height;
    color=color*(1+forest*((micro-.50f)*.22f+(grit-.50f)*.10f));
    surface[o]=color;
  }
}

void pixel(int x,int y,C color) {
  uint32_t p=(y*W+x)*3;
  float grain=(unit(uint32_t(p))-.5f)*1.15f;
  img[p]=clamp(color.r+grain,0,255)+.5f;
  img[p+1]=clamp(color.g+grain,0,255)+.5f;
  img[p+2]=clamp(color.b+grain,0,255)+.5f;
}

void draw() {
  H=W/2;
  img.resize(size_t(W)*H*3);
  depth.assign(size_t(W)*H,65535);
  int skyRows=(H+1)/2;
  skyTransmission.assign(size_t(W)*skyRows,0.f);
#pragma omp parallel for schedule(dynamic,1)
  for (int x=0;x<W;x++) {
    float a=((x+.5f)/W-.5f)*2*pi,sx=sinf(a),sz=cosf(a);
    // Airlight is sampled from the underlying sky. Use a low saturation for mountain distances.
    C haze=blend({187,155,170},{220,174,153},expf(-sq(acosf(clamp(cosf(a-sunAz),-1,1))/1.25f)));
    for (int y=0;y<H/2+5;y++) {
      float el=(.5f-(y+.5f)/H)*pi;
      LowSky light=sky(a,el,x,y);
      pixel(x,y,light.color);
      if (y<skyRows) skyTransmission[y*W+x]=light.incidentTransmission;
    }
    int limit=H;
    float lastH=H+.5f;
    C prev{64,68,59};
    for (float r=2;r<radius-36;r+=r<210?1.7f:r<3500?5.f:8.1f) {
      float ix=(sx*r+radius)/cell,iz=(sz*r+radius)/cell;
      int i=int(ix),j=int(iz);
      if (i<2||j<2||i>=N-3||j>=N-3)break;
      float u=ix-i,v=iz-j;
      int o=j*N+i;
      float he=mix(mix(terrain[o]+trees[o],terrain[o+1]+trees[o+1],u),mix(terrain[o+N]+trees[o+N],terrain[o+N+1]+trees[o+N+1],u),v);
      float y=(.5f-atan2f(he,r)/pi)*H;
      int top=max(0,int(ceilf(y-.5f)));
      if (top<limit) {
        C c=blend(blend(surface[o],surface[o+1],u),blend(surface[o+N],surface[o+N+1],u),v);
        float fog=clamp(1-expf(-r*(.000036f+.000043f*expf(-max(0.f,he)/520.f))),0,.64f);
        float mist=.23f*smooth(1700,5730,r)*expf(-sq((he-307.f)/185.f));
        c=blend(c,haze,clamp(fog+mist));
        for (int row=limit-1;row>=top;row--) {
          float f=clamp((row+.5f-y)/max(.6f,lastH-y));
          pixel(x,row,blend(c,prev,f));
          depth[row*W+x]=uint16_t(r);
          if (row<skyRows) skyTransmission[row*W+x]=0.f;
        }
        prev=c;
        limit=top;
      }
      lastH=y;
    }
  }
}
// Resolve individual tree crowns into the terrain depth buffer. Against the far
// snowfields and the warm sky, even one- and two-pixel treetops convey distance.
void plantForest() {
  const float pixelsPerRadian=W/(2*pi);
  const int siteStep=8;
  int site=0;
  for (int iz=-10500;iz<=11400;iz+=siteStep) for (int ix=-11100;ix<=11100;ix+=siteStep,site++) {
    uint32_t seed=uint32_t(site)*1031u+9481u;
    float x=ix+unit(seed+1)*siteStep,z=iz+unit(seed+2)*siteStep,r=sqrtf(x*x+z*z);
    if (r<450||r>11900)continue;
    int gx=int((x+radius)/cell),gz=int((z+radius)/cell),index=gz*N+gx;
    float height=terrain[index];
    if (height>1230||trees[index]<2)continue;
    float u=(x+radius)/cell-gx,v=(z+radius)/cell-gz;
    height=mix(mix(terrain[index],terrain[index+1],u),mix(terrain[index+N],terrain[index+N+1],u),v);
    float forest=fb(x*.0012f+17,z*.0014f+54);
    if (unit(seed+4)>.55f+forest*.58f)continue;
    bool conifer=unit(seed+5)<clamp(.78f+.9f*(forest-.5f)-.00043f*max(0.f,height-330));
    float treeH=((conifer?10.f:7.f)+unit(seed+6)*(conifer?9.f:6.f))*(.62f+.38f*smooth(430,970,r));
    float hp=treeH*pixelsPerRadian/r,wp=hp*(conifer?.19f:.39f);
    if (hp<.60f)continue;
    float ang=atan2f(x,z),cx=(.5f+ang/(2*pi))*W-.5f,baseY=(.5f-atan2f(height,r)/pi)*H-.5f;
    float top=baseY-hp;
    int left=int(floorf(cx-wp)),right=int(ceilf(cx+wp));
    float altColor=clamp((height-260.f)/690.f+1.5f*(.5f-forest));
    float tint=unit(seed+7);
    C native=surface[index];
    C foliage=conifer?blend({43,61,55},{74,82,54},tint):blend(blend({113,91,55},{155,118,61},tint),{145,83,48},altColor);
    foliage=blend(native,foliage,.58f);
    C air=blend({184,157,173},{221,177,148},expf(-sq(acosf(clamp(cosf(ang-sunAz),-1,1))/1.25f)));
    float fog=clamp(1-expf(-r*.000066f)+.16f*smooth(1700,5700,r)*expf(-sq((height-290)/205.f)),0,.65f);
    for (int yy=max(0,int(floorf(top)));yy<=min(H-1,int(ceilf(baseY)));yy++) {
      float k=clamp((yy-top)/hp);
      float tuft=unit(seed*3877u+uint32_t(yy)*2141u);
      float branch=.81f+.15f*sinf(k*30.f+unit(seed+31)*4.8f)+.13f*(tuft-.5f);
      float profile=conifer?(.04f+.97f*k)*branch*(1-.35f*smooth(.78f,1.f,k))
                           :sqrtf(max(0.f,1-sq((k-.46f)/.53f)))*(.91f+.15f*tuft);
      for (int xx=left;xx<=right;xx++) {
        int px=(xx+W)%W,p=yy*W+px;
        if (r>depth[p]+3)continue;
        float dx=xx-cx,coverage=clamp(wp*profile+.48f-fabsf(dx))*clamp((yy-top)+.65f)*clamp(baseY-yy+.5f);
        if (coverage<.025f)continue;
        float light=(.54f-.77f*dx/max(.6f,wp))*(.58f+.42f*(1-k));
        float speckle=unit(seed*947u+uint32_t(yy)*2917u+uint32_t(px)*7411u);
        float roundness=sqrtf(max(0.f,1-sq(dx/max(.5f,wp*profile))));
        float crownLight=.67f+.35f*light+.17f*roundness+(.12f+.09f*!conifer)*(speckle-.5f);
        C out=blend(foliage*crownLight,air,fog);
        C bg{float(img[p*3]),float(img[p*3+1]),float(img[p*3+2])};
        out=blend(bg,out,coverage*.83f);
        pixel(px,yy,out);
        if (yy<(H+1)/2) skyTransmission[p]*=1.f-coverage*.83f;
        if (coverage>.49f)depth[p]=uint16_t(r);
      }
    }
  }
}

constexpr int layerWidth=2048, bandHeight=512;

uint8_t byteValue(float value) {
  return static_cast<uint8_t>(clamp(value,0.f,255.f)+.5f);
}

void setRGBA(std::vector<uint8_t>& atlas,int index,C color,float alpha) {
  atlas[index]=byteValue(color.r);
  atlas[index+1]=byteValue(color.g);
  atlas[index+2]=byteValue(color.b);
  atlas[index+3]=byteValue(alpha*255.f);
}

// Integrate subpixel cloud transparency and terrain/forest silhouettes over an
// atlas texel. At normal export resolution a texel covers exactly 3.5×3.5 pixels.
float filteredTransmission(int x,int y) {
  float stepX=W/float(layerWidth),stepY=H/(2.f*bandHeight);
  float x0=x*stepX,y0=y*stepY,x1=(x+1)*stepX,y1=(y+1)*stepY;
  float weighted=0.f;
  for (int iy=int(floorf(y0));iy<int(ceilf(y1));iy++) {
    float dy=min(y1,iy+1.f)-max(y0,float(iy));
    for (int ix=int(floorf(x0));ix<int(ceilf(x1));ix++) {
      float dx=min(x1,ix+1.f)-max(x0,float(ix));
      weighted+=skyTransmission[iy*W+ix]*dx*dy;
    }
  }
  return weighted/(stepX*stepY);
}

bool writeAtlas(const char* path) {
  std::vector<uint8_t> atlas(size_t(layerWidth)*2*bandHeight*4);
#pragma omp parallel for schedule(static)
  for (int y=0;y<bandHeight;y++) {
    for (int x=0;x<layerWidth;x++) {
      C incident{0,0,0}, scattered{0,0,0}, potential{0,0,0};
      float opacity=0.f;
      // Average scattering in premultiplied form, then store unassociated RGB.
      // Keep a plausible colour even where a perfectly clear texel has zero alpha.
      for (int j=0;j<2;j++) for (int i=0;i<2;i++) {
        float az=((x+(i+.5f)*.5f)/layerWidth-.5f)*2*pi;
        float el=(1.f-(y+(j+.5f)*.5f)/bandHeight)*(.5f*pi);
        float warmth=solarWarmth(az), cosEl=cosf(el);
        incident=incident+clearSky(az,el,warmth);
        IceLayer ice=highClouds(sinf(az)*cosEl,cosf(az)*cosEl,el,warmth);
        scattered=scattered+ice.color*ice.opacity;
        potential=potential+ice.color;
        opacity+=ice.opacity;
      }
      int index=4*(y*layerWidth+x);
      setRGBA(atlas,index,incident*.25f,filteredTransmission(x,y));
      C straight=opacity>1e-7f?scattered*(1.f/opacity):potential*.25f;
      setRGBA(atlas,index+4*bandHeight*layerWidth,straight,opacity*.25f);
    }
  }
  FILE* file=fopen(path,"wb");
  if (!file) return false;
  fprintf(file,"P7\nWIDTH %d\nHEIGHT %d\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n",layerWidth,2*bandHeight);
  bool complete=fwrite(atlas.data(),1,atlas.size(),file)==atlas.size();
  return fclose(file)==0 && complete;
}

int main(int argc,char**argv) {
  if (argc<3 || argc>4) {
    fprintf(stderr,"Usage: generate_panorama width output.ppm [sky-layers.pam]\n");
    return 2;
  }
  W=atoi(argv[1]);
  if (W<256||W>16000||W%2)return 2;
  for (unsigned i=0;i<nt.size();i++)nt[i]=unit(i*1009u+3343u);
  fprintf(stderr,"Synthesizing cloud density and sunlight...\n");
  clouds();
  fprintf(stderr,"Carving and illuminating the terrain...\n");
  mountains();
  fprintf(stderr,"Integrating the spherical environment at %d px...\n",W);
  draw();
  plantForest();
  FILE* f=fopen(argv[2],"wb");
  if (!f)return 1;
  fprintf(f,"P6\n%d %d\n255\n",W,H);
  bool complete=fwrite(img.data(),1,img.size(),f)==img.size();
  if (fclose(f)!=0 || !complete) return 1;
  if (argc==4 && !writeAtlas(argv[3])) return 1;
  return 0;
}
