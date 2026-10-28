import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Atom, Braces, Code2, UserRound, ArrowUpRight } from 'lucide-react';

export function CursorGlow({ enabled }) {
  const ref=useRef(null);
  const reduced=useReducedMotion();
  useEffect(()=>{
    if(!enabled||reduced||!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return;
    const node=ref.current;let frame=0,x=0,y=0;
    const move=event=>{
      x=event.clientX;y=event.clientY;
      if(!frame)frame=requestAnimationFrame(()=>{
        node.style.setProperty('--glow-x',`${x}px`);
        node.style.setProperty('--glow-y',`${y}px`);
        frame=0;
      });
    };
    window.addEventListener('pointermove',move,{passive:true});
    return()=>{window.removeEventListener('pointermove',move);cancelAnimationFrame(frame);};
  },[enabled,reduced]);
  return <div ref={ref} className="site-ambient" aria-hidden="true"/>;
}

export function TypingRole({ role, enabled }) {
  const reduced=useReducedMotion();
  const phrases=useMemo(()=>[role,'Learning & Applying AI','Lifelong Learner'],[role]);
  const [text,setText]=useState(role);
  useEffect(()=>{
    if(!enabled||reduced){setText(role);return;}
    let phrase=0,index=phrases[0].length,deleting=true,timeout;
    setText(phrases[0]);
    const tick=()=>{
      const word=phrases[phrase];
      if(deleting){
        index=Math.max(0,index-1);setText(word.slice(0,index));
        if(index===0){deleting=false;phrase=(phrase+1)%phrases.length;timeout=setTimeout(tick,260);}
        else timeout=setTimeout(tick,35);
      }else{
        index=Math.min(phrases[phrase].length,index+1);setText(phrases[phrase].slice(0,index));
        if(index===phrases[phrase].length){deleting=true;timeout=setTimeout(tick,2200);}
        else timeout=setTimeout(tick,65);
      }
    };
    timeout=setTimeout(tick,2600);
    return()=>clearTimeout(timeout);
  },[role,enabled,reduced,phrases]);
  return <p className="hero-typing"><span className="typing-prefix" aria-hidden="true">&gt;_</span><span className="sr-only">{role}. Learning and applying AI to current projects. Lifelong learner.</span><span aria-hidden="true" className="typing-word">{text}</span><span aria-hidden="true" className="typing-cursor"/></p>;
}

export function PhotoFrame({ profile, enabled, fallback }) {
  const stageRef=useRef(null),cardRef=useRef(null),entryRef=useRef(null);
  const reduced=useReducedMotion();
  const [imageError,setImageError]=useState(false);
  const animate=enabled&&!reduced;
  useEffect(()=>setImageError(false),[profile.photo]);
  useEffect(()=>{
    if(!profile.photo)return;
    const stage=stageRef.current,card=cardRef.current,entry=entryRef.current;
    if(!stage||!card)return;
    const reset=()=>{
      card.style.setProperty('--tilt-x','0deg');
      card.style.setProperty('--tilt-y','0deg');
      card.style.setProperty('--light-x','50%');
      card.style.setProperty('--light-y','15%');
    };
    reset();
    if(!animate||!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return;
    let frame=0,pointerX=0,pointerY=0;
    const update=()=>{
      const rect=entry.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(pointerX-rect.left)/rect.width));
      const y=Math.max(0,Math.min(1,(pointerY-rect.top)/rect.height));
      card.style.setProperty('--tilt-x',`${(.5-y)*12}deg`);
      card.style.setProperty('--tilt-y',`${(x-.5)*16}deg`);
      card.style.setProperty('--light-x',`${x*100}%`);
      card.style.setProperty('--light-y',`${y*100}%`);
      frame=0;
    };
    const move=event=>{pointerX=event.clientX;pointerY=event.clientY;if(!frame)frame=requestAnimationFrame(update);};
    const leave=()=>{cancelAnimationFrame(frame);frame=0;reset();};
    stage.addEventListener('pointermove',move,{passive:true});
    stage.addEventListener('pointerleave',leave);
    return()=>{stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerleave',leave);cancelAnimationFrame(frame);reset();};
  },[animate,profile.photo]);
  if(!profile.photo)return fallback;
  return <figure className="portrait-stage" ref={stageRef}>
    <div className="portrait-halo" aria-hidden="true"/>
    <div className="portrait-orbit portrait-orbit-one" aria-hidden="true"/>
    <div className="portrait-orbit portrait-orbit-two" aria-hidden="true"/>
    <span className="portrait-coordinate" aria-hidden="true">A LITTLE CURIOSITY. A LOT OF POSSIBILITY.</span>
    <motion.div className="portrait-entry" ref={entryRef} initial={animate?{opacity:0,y:22,scale:.96}:false} animate={{opacity:1,y:0,scale:1}} transition={{duration:animate?.85:0,delay:animate?.15:0,ease:[.2,.7,.3,1]}}>
      <div className="portrait-card" ref={cardRef}>
        <div className="portrait-aura" aria-hidden="true"/>
        <div className="portrait-ring" aria-hidden="true"/>
        <motion.div className="portrait-media" initial={animate?{clipPath:'inset(0 0 100% 0 round 23px)'}:false} animate={{clipPath:'inset(0 0 0% 0 round 23px)'}} transition={{duration:animate?1.15:0,delay:animate?.2:0,ease:[.25,.75,.25,1]}}>
          {imageError?<div className="portrait-fallback"><UserRound size={50}/><span>{profile.name}</span></div>:<motion.img src={profile.photo} alt={`Portrait of ${profile.name}`} width="900" height="1125" fetchPriority="high" decoding="async" initial={animate?{scale:1.07}:false} animate={{scale:1}} transition={{duration:animate?1.5:0,delay:animate?.2:0}} onError={()=>setImageError(true)}/>}
        </motion.div>
        <span className="portrait-chip chip-code" aria-hidden="true"><Code2 size={19}/><span>code</span></span>
        <span className="portrait-chip chip-react" aria-hidden="true"><Atom size={20}/><span>React</span></span>
        <span className="portrait-chip chip-node" aria-hidden="true"><Braces size={18}/><span>Node.js</span></span>
        <span className="portrait-chip chip-python" aria-hidden="true"><span className="python-mark">py</span><span>Python</span></span>
      </div>
    </motion.div>
    <figcaption className="portrait-caption"><span className="portrait-caption-dot"/><span>{profile.name}<small>THE PERSON BEHIND THE CODE</small></span><ArrowUpRight size={17} aria-hidden="true"/></figcaption>
  </figure>;
}
