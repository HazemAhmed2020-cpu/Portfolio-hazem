import { useEffect, useRef } from 'react';
import { Braces, Code2, Database, Atom } from 'lucide-react';

const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize = v => { const l=Math.hypot(...v)||1; return v.map(x=>x/l); };
const center = t => [(1.66+.57*Math.cos(3*t))*Math.cos(2*t), (1.66+.57*Math.cos(3*t))*Math.sin(2*t), .84*Math.sin(3*t)];
function makeMesh() {
  const ringCount=152, sides=16, points=[], edges=[];
  for(let i=0;i<ringCount;i++) {
    const t=i/ringCount*Math.PI*2, p=center(t), next=center(t+.001), prev=center(t-.001);
    const tangent=normalize(next.map((x,j)=>x-prev[j]));
    const n=normalize(cross(tangent,[0,0,1])), b=normalize(cross(tangent,n));
    for(let j=0;j<sides;j++) {
      const a=j/sides*Math.PI*2, tube=.31;
      points.push(p.map((x,k)=>x+tube*(n[k]*Math.cos(a)+b[k]*Math.sin(a))));
      edges.push([i*sides+j,i*sides+(j+1)%sides]);
      edges.push([i*sides+j,((i+1)%ringCount)*sides+j]);
    }
  }
  return {points,edges};
}
const mesh=makeMesh();
export default function Sculpture({ enabled }) {
  const canvasRef=useRef(null);
  const wrapperRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current, wrap=wrapperRef.current;
    const ctx=canvas.getContext('2d');
    if(!ctx) return;
    let w=500,h=500,dpr=1,frame=0,angle=.38,last=0,visible=true,px=0,py=0,tx=0,ty=0;
    function resize(){
      const rect=wrap.getBoundingClientRect(); w=rect.width;h=rect.height;
      dpr=Math.min(window.devicePixelRatio||1,1.75);
      canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';
      render();
    }
    function render(){
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      const ax=.66+py*.22, ay=angle+px*.32, az=-.25;
      const scale=Math.min(w,h)*.175;
      const vertices=mesh.points.map(([x,y,z])=>{
        let yy=y*Math.cos(ax)-z*Math.sin(ax),zz=y*Math.sin(ax)+z*Math.cos(ax);
        let xx=x*Math.cos(ay)+zz*Math.sin(ay);z=-x*Math.sin(ay)+zz*Math.cos(ay);
        x=xx*Math.cos(az)-yy*Math.sin(az);y=xx*Math.sin(az)+yy*Math.cos(az);
        const p=5/(5+z*.35);
        return [w*.50+x*scale*p,h*.49+y*scale*p,z];
      });
      const buckets=Array.from({length:9},()=>[]);
      for(const [a,b] of mesh.edges){const depth=(vertices[a][2]+vertices[b][2])/2;const bucket=Math.max(0,Math.min(8,Math.floor((depth+2.4)/4.8*9)));buckets[bucket].push([a,b]);}
      for(let k=8;k>=0;k--){
        ctx.beginPath();
        for(const [a,b] of buckets[k]){ctx.moveTo(vertices[a][0],vertices[a][1]);ctx.lineTo(vertices[b][0],vertices[b][1]);}
        ctx.strokeStyle=`rgba(${255-k*4},${150-k*7},${91-k*4},${.94-k*.092})`;
        ctx.lineWidth=k<3?.85:.65;ctx.stroke();
      }
    }
    function tick(now){
      if(enabled&&visible&&now-last>32){angle+=.003;px+=(tx-px)*.035;py+=(ty-py)*.035;render();last=now;}
      if(enabled)frame=requestAnimationFrame(tick);
    }
    const move=e=>{const r=wrap.getBoundingClientRect();tx=(e.clientX-r.left)/r.width-.5;ty=(e.clientY-r.top)/r.height-.5;};
    const leave=()=>{tx=0;ty=0;};
    const ro=new ResizeObserver(resize);ro.observe(wrap);
    const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;});io.observe(wrap);
    wrap.addEventListener('pointermove',move);wrap.addEventListener('pointerleave',leave);
    resize();if(enabled)frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);ro.disconnect();io.disconnect();wrap.removeEventListener('pointermove',move);wrap.removeEventListener('pointerleave',leave);};
  },[enabled]);
  return <div className="sculpture" ref={wrapperRef} aria-hidden="true">
    <div className="sculpture-glow" />
    <div className="orbital-ring ring-one"/><div className="orbital-ring ring-two"/>
    <span className="coordinate coord-top">23.5° N / ALWAYS EXPLORING</span>
    <span className="crosshair crosshair-one">+</span><span className="crosshair crosshair-two">+</span>
    <canvas ref={canvasRef}/>
    <div className="floating-label label-react"><Atom size={21}/><span>React</span></div>
    <div className="floating-label label-node"><Braces size={19}/><span>Node.js</span><i/></div>
    <div className="floating-label label-db"><Database size={18}/><span>PostgreSQL</span></div>
    <div className="code-note"><div className="code-note-head"><Code2 size={13}/><span>mindset.js</span><span className="code-dots">•••</span></div><div className="code-note-body"><span className="code-muted">01</span> <span className="code-purple">const</span> purpose = <span className="code-lime">'make it useful'</span>;<br/><span className="code-muted">02</span> <span className="code-purple">while</span> (curious) {'{'}<br/><span className="code-muted">03</span> &nbsp; learn(); build(); <span className="code-comment">// repeat</span><br/><span className="code-muted">04</span> {'}'}<span className="code-cursor"/></div></div>
    <span className="coordinate coord-bottom"><span/> IDEAS IN MOTION</span>
  </div>;
}
