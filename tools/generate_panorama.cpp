// Deterministic, image-free source for the far-field environment. World x is east,
// z is north, and the second channel of the height field is z. Colours are sRGB.
// Build: c++ -std=c++17 -O3 -fopenmp tools/generate_panorama.cpp -o /tmp/hifuu-env
// Run: /tmp/hifuu-env 7168 /tmp/hifuu-env.ppm
//      magick /tmp/hifuu-env.ppm -sampling-factor 1x1 -quality 92 src/horizon.jpg
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <omp.h>
using std::max; using std::min;
constexpr float pi=3.14159265358979323846f;
inline float clamp(float n,float a=0,float b=1){return min(b,max(a,n));}
inline float mix(float a,float b,float t){return a+(b-a)*t;}
inline float smooth(float a,float b,float x){float t=clamp((x-a)/(b-a));return t*t*(3.f-2.f*t);}
inline float sq(float x){return x*x;}
struct C{float r,g,b; C operator+(C v)const{return {r+v.r,g+v.g,b+v.b};} C operator-(C v)const{return {r-v.r,g-v.g,b-v.b};} C operator*(float a)const{return {r*a,g*a,b*a};}};
inline C blend(C a,C b,float t){return a+(b-a)*t;}
inline uint32_t hash(uint32_t n){n^=n>>16; n*=0x7feb352du;n^=n>>15;n*=0x846ca68bu;n^=n>>16;return n;}
inline float unit(uint32_t n){return (hash(n)>>8)*(1.f/16777216.f);}
constexpr int NB=128; std::vector<float> nt(NB*NB*NB);
inline float lattice(int x,int z,int y=0){return nt[((y&127)*128+(z&127))*128+(x&127)];}
inline float n2(float x,float z){int a=(int)floorf(x),b=(int)floorf(z);float u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return mix(mix(lattice(a,b),lattice(a+1,b),u),mix(lattice(a,b+1),lattice(a+1,b+1),u),v);}
inline float n3(float x,float z,float y){int a=(int)floorf(x),b=(int)floorf(z),c=(int)floorf(y);float u=x-a,v=z-b,w=y-c;u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);
 return mix(mix(mix(lattice(a,b,c),lattice(a+1,b,c),u),mix(lattice(a,b+1,c),lattice(a+1,b+1,c),u),v),mix(mix(lattice(a,b,c+1),lattice(a+1,b,c+1),u),mix(lattice(a,b+1,c+1),lattice(a+1,b+1,c+1),u),v),w);}
float fb(float x,float z){return n2(x,z)*.53f+n2(.86f*x*2.05f+.51f*z*2.05f+17,-.51f*x*2.05f+.86f*z*2.05f+8)*.27f+n2(-.31f*x*4.3f+.95f*z*4.3f+50,-.95f*x*4.3f-.31f*z*4.3f+6)*.13f+n2(.64f*x*8.65f-.77f*z*8.65f+12,.77f*x*8.65f+.64f*z*8.65f+41)*.07f;}
// The coverage volume is sampled both along the viewing ray and towards the sun.
// The grid is deliberately reused by all rays so lighting stays consistent at seams.
constexpr int CN=544, CY=43; constexpr float cloudSpan=64.f,base=2.05f,thick=1.72f;
std::vector<float> cloud(CN*CN*CY),sunlight(CN*CN*CY); constexpr float sunAz=-48*pi/180,sunAlt=5.1f*pi/180;
inline int idx(int x,int z,int y){return (y*CN+z)*CN+x;}
inline float vol(const std::vector<float>& field,float x,float z,float y){if(y<=0||y>=CY-1)return 0;int ix=floorf(x),iz=floorf(z),iy=int(y);float u=x-ix,v=z-iz,w=y-iy;int ax=(ix%CN+CN)%CN,az=(iz%CN+CN)%CN,bx=ax+1==CN?0:ax+1,bz=az+1==CN?0:az+1;return mix(mix(mix(field[idx(ax,az,iy)],field[idx(bx,az,iy)],u),mix(field[idx(ax,bz,iy)],field[idx(bx,bz,iy)],u),v),mix(mix(field[idx(ax,az,iy+1)],field[idx(bx,az,iy+1)],u),mix(field[idx(ax,bz,iy+1)],field[idx(bx,bz,iy+1)],u),v),w);}
void clouds(){
 #pragma omp parallel for schedule(static)
 for(int z=0;z<CN;z++)for(int x=0;x<CN;x++){
 float xx=(x-CN/2)*cloudSpan/CN,zz=(z-CN/2)*cloudSpan/CN;
 // Clustered cloud streets intersect the north-facing window on either side of the peak.
 float sw=fb(xx*.081f+22.4f,zz*.096f+38.1f), weather=(sw-.54f)*1.23f-.09f;
 struct Bank{float x,z,a,b,amplitude,angle;};
 static constexpr Bank banks[]={{-8.8f,14.8f,6.9f,2.4f,.57f,-.14f},{-6.2f,7.7f,3.0f,1.5f,.34f,-.27f},{8.9f,7.9f,5.8f,2.05f,.54f,.23f},{3.1f,12.8f,4.5f,.8f,.35f,-.16f},{-12.f,24.9f,13.8f,2.8f,.48f,-.19f},{5.f,23.7f,8.f,1.4f,.37f,.12f},{10,-2,5,1.7f,.45f,.2f},{-4,-12,4,2,.4f,-.5f},{-12,-12,4,2,.44f,.15f}};
 float sculpt=0;for(const auto& b:banks){float dx=xx-b.x,dz=zz-b.z;float X=cosf(b.angle)*dx+sinf(b.angle)*dz,Z=-sinf(b.angle)*dx+cosf(b.angle)*dz;sculpt+=b.amplitude*expf(-sq(X/b.a)-sq(Z/b.b));}
 weather+=sculpt+.39f*(fb(xx*.38f+8.3f,zz*.41f+72)-.5f);
 for(int k=0;k<CY;k++){
 float y=k/float(CY-1), adv=.52f*y;float X=xx+adv+18.35f,Z=zz+.24f*y+11.7f;
 float f=.54f*n3(X*.50f,Z*.53f,y*1.5f+14)+.25f*n3(X*1.1f+32,Z*1.13f+14,y*3.3f+8)+.13f*n3(X*2.15f+18,Z*2.21f+42,y*6.4f+45)+.08f*n3(X*4.5f+2,Z*4.7f+7,y*12.6f+1);
 float body=weather+1.22f*(f-.50f)+.07f-.34f*powf(fabsf(2.04f*y-.88f),1.35f)-.08f*y;
 cloud[idx(x,z,k)]=max(0.f,body)*6.f*smooth(.015f,.16f,y)*(1-smooth(.77f,.995f,y));
 }}
 const float sx=sinf(sunAz),sz=cosf(sunAz),sy=tanf(sunAlt);
 #pragma omp parallel for schedule(static)
 for(int k=0;k<CY;k++)for(int z=0;z<CN;z++)for(int x=0;x<CN;x++){
 if(!cloud[idx(x,z,k)])continue;float tau=0,prev=0;
 for(float t:{.19f,.47f,.86f,1.43f,2.28f,3.48f,5.0f,7.16f,10.25f}){tau+=vol(cloud,x+t*sx*CN/cloudSpan,z+t*sz*CN/cloudSpan,k+t*sy*(CY-1)/thick)*(t-prev);prev=t;}
 sunlight[idx(x,z,k)]=.16f+.84f*expf(-.50f*tau);
 }}
C sky(float a,float el,int px,int py){
 float azdiff=acosf(clamp(cosf(a-sunAz),-1,1)), glow=expf(-sq(azdiff/1.05f));float h=max(el,0.f),m=sinf(h);
 C horizon=blend({248,180,159},{255,214,138},glow), lower=blend({222,161,181},{255,182,144},glow), middle=blend({153,134,176},{222,160,169},glow*.81f), upper=blend({82,89,139},{118,113,159},glow*.49f);
 C col=blend(horizon,lower,smooth(-.035f,.17f,h));col=blend(col,middle,smooth(.06f,.48f,h));col=blend(col,upper,1-expf(-max(0.f,h-.30f)*2.45f));
 float sx=sinf(a)*cosf(h),sz=cosf(a)*cosf(h),sunD=acosf(clamp(cosf(h)*cosf(sunAlt)*cosf(a-sunAz)+m*sinf(sunAlt),-1,1));
 float seaHaze=expf(-sq(h/.036f));col=blend(col,{255,199,158},seaHaze*.19f);col=blend(col,{255,220,157},.36f*expf(-sunD*5.4f));col=blend(col,{255,239,190},.7f*expf(-sunD*32));col=blend(col,{255,253,226},1-smooth(.0041f,.0051f,sunD));
 // High, sheared wisps. Anisotropic curling density over a separate 8 km plane.
 if(h>.008f){float dx=sx/(m+.055f)*8,dz=sz/(m+.055f)*8;float warp=fb(dx*.14f+23,dz*.17f+45)-.5f;float streak=fb(dx*.065f+dz*.047f+33,dz*.64f-dx*.13f+warp*1.8f+5);float envelope=fb(dx*.075f+48,dz*.075f+17);float fine=fb(dx*.11f+44,dz*2.8f-dx*.34f+warp*3.2f+23);float density=clamp((streak-.39f)*1.9f)*smooth(.25f,.66f,envelope)*(.43f+.62f*fine);col=blend(col,blend({245,192,203},{255,221,173},glow),density*smooth(.008f,.065f,h)*.75f);}
 if(h>.006f){float t=base/max(m,.001f),end=min(54.f,(base+thick)/max(m,.001f));if(end>t){
 float step=clamp((end-t)/40.f,.080f,.27f),trans=1;C scatter{0,0,0};float rnd=.4f+unit(px*7963u+py*9703u)*.2f;t+=step*rnd;
 for(;t<end&&trans>.012f;t+=step){float xx=CN*.5f+sx*t*CN/cloudSpan,zz=CN*.5f+sz*t*CN/cloudSpan,yy=(m*t-base)*(CY-1)/thick;float d=vol(cloud,xx,zz,yy);if(d<.001f)continue;
 float edge=n3(xx*.96f+32,zz*1.08f+69,yy*.33f+6)*.62f+n3(xx*2.73f+21,zz*2.68f+8,yy*.87f+1)*.25f+n3(xx*5.71f+29,zz*5.62f+2,yy*1.86f+17)*.13f; d=max(0.f,d+.42f*(edge-.52f)*smooth(0.f,.15f,d)); if(d<.001f)continue;
 float lit=clamp(vol(sunlight,xx,zz,yy)),norm=yy/(CY-1);C shadow=blend({129,120,157},{178,140,159},.39f*glow+.23f*norm);C light=blend({255,188,175},{255,224,168},glow*.86f);
 C local=blend(shadow,light,clamp(powf(lit,.76f)*(.82f+.17f*norm)+norm*.09f));float distHaze=clamp((t-9.f)/58.f,0,.49f);local=blend(local,col,distHaze*.72f);
 float tau=1-expf(-d*step*1.55f);scatter=scatter+local*(trans*tau);trans*=1-tau;}
 col=scatter+col*trans;}}
 return col;}
// Mountain relief combines overlapping volcanic cones and distorted radial ribs.
// Hydraulic erosion subsequent to construction carves the fine drainage network.
constexpr int N=2321; constexpr float cell=12.f, radius=(N-1)*cell*.5f;
std::vector<float> terrain(N*N),slx(N*N),slz(N*N),trees(N*N);std::vector<C> surface(N*N);std::vector<uint8_t> img;int W,H;
float cone(float x,float z,float cx,float cz,float ax,float az,float amp,float rot,float expn){float X=(x-cx)*cosf(rot)+(z-cz)*sinf(rot),Z=-(x-cx)*sinf(rot)+(z-cz)*cosf(rot);float d=sqrtf(sq(X/ax)+sq(Z/az));return amp*powf(max(0.f,1.f-d),expn);}
float terrainModel(float x,float z){
 float near=sqrtf(x*x+z*z),horizon=smooth(1200,4600,near);float longN=fb(x*.00027f+22,z*.00027f+8),midN=fb(x*.00086f+44,z*.00086f+31);
 float h=(-95+265*longN+130*(midN-.48f))*horizon-46*(1-horizon);
 // Low ridges wrap the basin at all azimuths. Successive generations overlap with haze.
 float ang=atan2f(x,z);float ranges=expf(-sq((near-(8400+1100*sinf(3*ang)+470*cosf(7*ang)))/1700));float outer=expf(-sq((near-(12300+500*cosf(4*ang)))/2100));
 h+=ranges*(240+290*longN+170*(midN-.5f)) + outer*(360+410*longN+270*(midN-.5f));
 float X=x+190*(fb(x*.00055f+19,z*.00055f+43)-.5f)+35*(midN-.5f);float Z=z+140*(fb(x*.00068f+3,z*.00068f+24)-.5f);
 float main=cone(X,Z,650,6550,4870,3170,2110,-.11f,1.08f);
 float side=cone(X,Z,-1030,7300,3880,3350,1630,.2f,1.04f),rear=cone(X,Z,2380,7940,3680,3420,1710,-.25f,1.04f);
 float west=cone(X,Z,-3740,7450,4280,2420,1135,.26f,1.0f),east=cone(X,Z,4450,7040,3500,3060,940,-.37f,1.f);
 auto unite=[](float a,float b,float k){float t=max(k-fabsf(a-b),0.f)/k;return max(a,b)+t*t*k*.25f;};
 float mound=unite(unite(main,side,220),unite(rear,unite(west,east,115),135),175);
 if(mound>28){float dx=X-650,dz=Z-6550,rr=sqrtf(dx*dx+dz*dz),a=atan2f(dx,dz);
 float fold=a+ .22f*sinf(a*3+.4f)+.122f*sinf(rr*.00115f+2*a)+.085f*(fb(x*.0012f+45,z*.0012f+18)-.5f);
 // Large interlocking ridges; sharp knife-edges divide the broad snow gullies.
 float ribs=powf(.5f+.5f*cosf(fold*14.0f+.67f*sinf(fold*7+.5f)+.44f*sinf(rr*.00155f)),3.0f);
 float r2=powf(.5f+.5f*cosf(fold*36+1.8f*sinf(fold*6+rr*.00065f)+.72f*sinf(rr*.0031f)),3.1f);
 float serr=(fb(x*.00116f+48,z*.00116f+8)-.50f)*220 +(fb(x*.0037f+15,z*.0037f+41)-.50f)*65;
 float spine=(ribs-.42f)*175+(r2-.39f)*71;
 float central=smooth(340,1120,main)*smooth(70,490,rr)*(1-smooth(3150,5400,rr));
 float rough=.38f+.62f*smooth(90,880,mound);
 mound+=central*spine+rough*serr + (n2(x*.018f+11,z*.018f+27)-.5f)*13*rough;
 }
 float fore=(expf(-sq((near-(3120+790*sinf(2.8f*ang)+420*cosf(4*ang)))/920)))*(75+180*(longN-.27f));
 return h+max(0.f,mound-25)+fore;}
inline float sample(const std::vector<float>& b,float x,float z){int i=clamp(floorf(x),0,N-2),j=clamp(floorf(z),0,N-2);float u=clamp(x-i),v=clamp(z-j);return mix(mix(b[j*N+i],b[j*N+i+1],u),mix(b[(j+1)*N+i],b[(j+1)*N+i+1],u),v);}
void mountains(){
 #pragma omp parallel for schedule(static)
 for(int z=0;z<N;z++)for(int x=0;x<N;x++)terrain[z*N+x]=terrainModel(x*cell-radius,z*cell-radius);
 // Individual rain paths transport sediment downhill, separating snowfields with dendritic outcrops.
 uint32_t seed=782365;auto rnd=[&](){seed=1664525u*seed+1013904223u;return (seed>>8)/16777216.f;};
 for(int drop=0;drop<1780000;drop++){
 float x,z;if(drop%5){x=(rnd()*11600-5300+radius)/cell;z=(rnd()*9000+1850+radius)/cell;}else{x=rnd()*(N-4)+2;z=rnd()*(N-4)+2;}
 float vx=0,vz=0,load=0,water=1,energy=1;
 for(int life=0;life<43;life++){int i=(int)x,j=(int)z;if(i<3||j<3||i>=N-4||j>=N-4)break;float fx=x-i,fz=z-j;int o=j*N+i;
 float h0=terrain[o],h1=terrain[o+1],h2=terrain[o+N],h3=terrain[o+N+1];float hh=mix(mix(h0,h1,fx),mix(h2,h3,fx),fz);
 float gx=mix(h1-h0,h3-h2,fz),gz=mix(h2-h0,h3-h1,fx);vx=.33f*vx-.67f*gx;vz=.33f*vz-.67f*gz;float len=sqrtf(vx*vx+vz*vz);if(len<.005f)break;vx/=len;vz/=len;float nx=x+vx,nz=z+vz;float dh=sample(terrain,nx,nz)-hh,cap=max(.11f,-dh)*water*energy*1.35f;
 if(load>cap||dh>0){float put=(dh>0?min(dh,load):(load-cap)*.27f);terrain[o]+=put*(1-fx)*(1-fz);terrain[o+1]+=put*fx*(1-fz);terrain[o+N]+=put*(1-fx)*fz;terrain[o+N+1]+=put*fx*fz;load-=put;}
 else{float take=min((cap-load)*.12f,-dh)*.38f;terrain[o]-=take*.40f;terrain[o-1]-=take*.115f;terrain[o+1]-=take*.115f;terrain[o-N]-=take*.115f;terrain[o+N]-=take*.115f;terrain[o-N-1]-=take*.035f;terrain[o-N+1]-=take*.035f;terrain[o+N-1]-=take*.035f;terrain[o+N+1]-=take*.035f;load+=take;}
 energy=clamp(sqrtf(max(.15f,energy*energy-dh*.27f)),.3f,4.4f);water*=.972f;x=nx;z=nz;
 }}
 #pragma omp parallel for schedule(static)
 for(int z=1;z<N-1;z++)for(int x=1;x<N-1;x++){int o=z*N+x;slx[o]=(terrain[o+1]-terrain[o-1])/(2*cell);slz[o]=(terrain[o+N]-terrain[o-N])/(2*cell);}
 #pragma omp parallel for schedule(static)
 for(int z=1;z<N-1;z++)for(int x=1;x<N-1;x++){
 int o=z*N+x;float xx=x*cell-radius,zz=z*cell-radius,h=terrain[o],gx=slx[o],gz=slz[o],slope=sqrtf(gx*gx+gz*gz),len=sqrtf(1+slope*slope),nx=-gx/len,nz=-gz/len,ny=1/len;
 float broad=fb(xx*.0019f+19,zz*.0019f+33),cluster=fb(xx*.007f+34,zz*.007f+4),grit=n2(xx*.029f+31,zz*.029f+23),micro=unit(x*6151u+z*277u);
 // Directional visibility is evaluated on the actual height field. It catches secondary ridges and talus bowls.
 float shade=0;for(float d:{3.f,7.f,15.f,31.f,57.f,99.f,157.f}){float high=sample(terrain,x-d*.946f,z+d*.325f);shade=max(shade,(high-h)/(d*cell));}
 float direct=clamp((nx*-.927f+nz*.245f+ny*.283f)*1.11f);float sun=smooth(.035f,.70f,direct)*(1-.83f*smooth(.20f,.40f,shade));
 float bowl=clamp((terrain[o-N*2]+terrain[o+N*2]+terrain[o-2]+terrain[o+2]-4*h)*.063f,-1,1);
 float variation=(broad-.5f)*1.0f+(cluster-.5f)*.44f;float grain=(grit-.5f)*.15f+(micro-.5f)*.1f;
 float woods=smooth(370,790,h+(broad-.5f)*460+(cluster-.5f)*195-fabsf(slope)*55);
 C green=blend({26,59,52},{75,84,55},clamp(.43f+variation));C autumn=blend({110,58,40},{184,96,47},clamp(.40f+variation*1.25f));autumn=blend(autumn,{182,139,57},clamp((cluster-.57f)*2.8f)*.88f);
 C low=blend(green,autumn,woods);float alpine=smooth(1080,1470,h+(broad-.5f)*305+(cluster-.5f)*140+slope*74);
 C rock=blend({75,66,67},{142,117,102},clamp(.48f+variation*1.1f+bowl*.072f));C substrate=blend(low,rock,alpine);
 C unlit=blend(substrate,{80,68,87},.25f)*(ny*.09f+.77f+grain);C lit=substrate*(.96f+grain+direct*.30f)+C{24,12,5};C color=blend(unlit,lit,sun);
 float wind=nx*.31f+nz*.20f;float snowline=1280+110*wind-87*bowl+390*(broad-.5f)+150*(cluster-.5f)+50*(grit-.5f);
 // Persistent snow follows concave gullies, with rock breaking through steep convex faces.
 float snowHeight=smooth(snowline-78,snowline+92,h);
 float bare=smooth(.79f,1.50f,slope+.19f*wind-.18f*bowl+(.50f-cluster)*.48f);
 float snow=clamp(snowHeight*(1-bare*mix(.92f,.46f,smooth(1400,2080,h))));
 C cold=blend({132,144,177},{177,181,203},clamp(.39f+.47f*ny+.14f*bowl));C white=blend({246,215,198},{255,245,228},clamp(.24f+direct*.82f));C ice=blend(cold,white,sun);
 ice=ice*(.987f+(.5f-grit)*.023f+micro*.014f);color=blend(color,ice,snow);
 // Low spruce canopy roughens the silhouette and gives the foothills their scale.
 float forest=(1-smooth(1030,1400,h))*(1-smooth(.46f,1.f,slope))*smooth(80,180,h);
 float height=forest*(4.3f+6.2f*micro+3.9f*grit);trees[o]=height;
 color=color*(1+forest*((micro-.50f)*.22f+(grit-.50f)*.10f));surface[o]=color;
 }}
void pixel(int x,int y,C color){uint32_t p=(y*W+x)*3;float grain=(unit(uint32_t(p))-.5f)*1.15f;img[p]=clamp(color.r+grain,0,255)+.5f;img[p+1]=clamp(color.g+grain,0,255)+.5f;img[p+2]=clamp(color.b+grain,0,255)+.5f;}
void draw(){H=W/2;img.resize(size_t(W)*H*3);
 #pragma omp parallel for schedule(dynamic,1)
 for(int x=0;x<W;x++){
 float a=((x+.5f)/W-.5f)*2*pi,sx=sinf(a),sz=cosf(a);
 // Airlight is sampled from the underlying sky. Use a low saturation for mountain distances.
 C haze=blend({187,155,170},{220,174,153},expf(-sq(acosf(clamp(cosf(a-sunAz),-1,1))/1.25f)));
 for(int y=0;y<H/2+5;y++){float el=(.5f-(y+.5f)/H)*pi;pixel(x,y,sky(a,el,x,y));}
 int limit=H;float lastH=H+.5f;C prev{64,68,59};
 for(float r=2;r<radius-36;r+=r<210?1.7f:r<3500?5.f:8.1f){float ix=(sx*r+radius)/cell,iz=(sz*r+radius)/cell;int i=int(ix),j=int(iz);if(i<2||j<2||i>=N-3||j>=N-3)break;float u=ix-i,v=iz-j;int o=j*N+i;
 float he=mix(mix(terrain[o]+trees[o],terrain[o+1]+trees[o+1],u),mix(terrain[o+N]+trees[o+N],terrain[o+N+1]+trees[o+N+1],u),v);
 float y=(.5f-atan2f(he,r)/pi)*H;int top=max(0,int(ceilf(y-.5f)));if(top<limit){
 C c=blend(blend(surface[o],surface[o+1],u),blend(surface[o+N],surface[o+N+1],u),v);float fog=clamp(1-expf(-r*(.000035f+.000036f*expf(-max(0.f,he)/470.f))),0,.61f);c=blend(c,haze,fog);
 for(int row=limit-1;row>=top;row--){float f=clamp((row+.5f-y)/max(.6f,lastH-y));pixel(x,row,blend(c,prev,f));}prev=c;limit=top;}
 lastH=y;}
 }}
int main(int argc,char**argv){if(argc<3){fprintf(stderr,"Usage: generate_panorama width output.ppm\n");return 2;}W=atoi(argv[1]);if(W<256||W>16000||W%2)return 2;for(unsigned i=0;i<nt.size();i++)nt[i]=unit(i*1009u+3343u);
 fprintf(stderr,"Synthesizing cloud density and sunlight...\n");clouds();fprintf(stderr,"Carving and illuminating the terrain...\n");mountains();fprintf(stderr,"Integrating the spherical environment at %d px...\n",W);draw();FILE* f=fopen(argv[2],"wb");if(!f)return 1;fprintf(f,"P6\n%d %d\n255\n",W,H);fwrite(img.data(),1,img.size(),f);fclose(f);return 0;}
