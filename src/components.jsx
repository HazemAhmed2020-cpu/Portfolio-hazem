import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { screenshotCaption } from '../shared/projects';
import { issuerLogo } from '../shared/issuers';
import { X, ArrowUpRight, Database, Braces, Layers3, BookOpen, Sparkles, GraduationCap, ShoppingBag, Scale, Workflow } from 'lucide-react';

export function Reveal({ children, className='', delay=0, enabled=true, ...rest }) {
  const reduced=useReducedMotion();
  return <motion.div className={className} initial={enabled&&!reduced?{opacity:0,y:25}:false} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.12}} transition={{duration:.65,delay,ease:[.2,.65,.3,1]}} {...rest}>{children}</motion.div>;
}
export function IssuerMark({shortIssuer='',issuer='',plainFallback=false}) {
  const logo=issuerLogo(shortIssuer);
  if(!logo&&plainFallback)return <span>{shortIssuer}</span>;
  return <span className={`issuer-mark issuer-${shortIssuer.trim().toLowerCase()}${logo?' issuer-with-logo':''}`}>
    {logo?<img className="issuer-logo" src={logo} alt={`${shortIssuer.trim().toUpperCase()} — ${issuer||'training provider'} logo`} loading="lazy"/>:shortIssuer}
  </span>;
}
export function ExternalLink({ href, children, className='', ...props }) {
  if(!href) return null;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...props}>{children}</a>;
}
export function Modal({ title, onClose, children, className='' }) {
  const ref=useRef(null),id=useId();
  useEffect(()=>{
    const dialog=ref.current;const previous=document.activeElement;
    dialog.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=old;dialog.close();if(previous?.isConnected)previous.focus();};
  },[]);
  return createPortal(<dialog ref={ref} aria-labelledby={id} className={`modal ${className}`} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-inner"><div className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21}/></button></div>{children}</div></dialog>,document.body);
}
export function ProjectArtwork({ project, detailed=false }) {
  if(project.image) return <div className={`project-art art-${project.artwork} ${detailed?'art-detailed':''}`}><div className="art-grid"/><div className="browser-frame"><div className="browser-bar"><span className="browser-dots"><i/><i/><i/></span><span>{project.imageKind==='repository'?'github.com / repository capture':project.demo?.startsWith('/')?'portfolio / project preview':project.demo?new URL(project.demo).hostname:project.shortTitle}</span><ArrowUpRight size={11}/></div><img src={project.image} alt={`${project.shortTitle} — ${project.imageKind==='illustration'?'conceptual project artwork':'interface screenshot'}`} loading="lazy" onError={e=>{e.currentTarget.style.opacity='.3';e.currentTarget.alt='Project screenshot unavailable';}}/></div><span className="art-caption">{screenshotCaption(project)}</span></div>;
  if(['commerce','legal','automation'].includes(project.artwork)){
    const Icon={commerce:ShoppingBag,legal:Scale,automation:Workflow}[project.artwork];
    return <div className={`project-art art-${project.artwork} generic-project-art`}><span className="diagram-eyebrow">{project.category.toUpperCase()} / PROJECT OVERVIEW</span><span className="generic-project-icon"><Icon size={44} strokeWidth={1.25}/></span><strong>{project.shortTitle}</strong><span className="art-caption">CONCEPTUAL PROJECT ILLUSTRATION</span></div>;
  }
  if(project.artwork==='madar') return <div className="project-art art-madar" aria-label="Conceptual illustration for Madar educational platform"><span className="diagram-eyebrow">MADAR / LEARNING WITH PURPOSE</span><div className="madar-orbit orbit-a"/><div className="madar-orbit orbit-b"/><div className="madar-identity"><span className="madar-symbol"><BookOpen size={35} strokeWidth={1.3}/></span><strong>Madar<span>.</span></strong><small>EDUCATIONAL PLATFORM</small></div><span className="madar-node madar-node-learn"><GraduationCap size={19}/><span>Learning</span></span><span className="madar-node madar-node-ai"><Sparkles size={17}/><span>AI exploration</span></span><span className="madar-orbit-dot dot-a"/><span className="madar-orbit-dot dot-b"/><span className="art-caption">CONCEPTUAL PROJECT ILLUSTRATION</span></div>;
  if(project.artwork==='campus') return <div className="project-art art-campus" aria-label="Conceptual campus-map illustration"><span className="diagram-eyebrow">CAMPUS / FIND YOUR NEXT CLASS</span><svg className="campus-map" viewBox="0 0 580 300" fill="none" aria-hidden="true"><defs><pattern id={`mapgrid-${project.id}-${detailed}`} width="36" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-22)"><path d="M0 0H36V22" stroke="#b4b0c4" strokeWidth=".6"/></pattern></defs><rect width="580" height="300" fill={`url(#mapgrid-${project.id}-${detailed})`}/><g transform="translate(70,-3)"><path d="M60 95L152 61L229 101L138 136Z" fill="#f8f4ed" stroke="#b5afc0"/><path d="M60 95V133L138 175V136Z" fill="#aaa4bd"/><path d="M138 136L229 101V140L138 175Z" fill="#8e87a5"/><path d="M252 64L311 42L367 72L310 94Z" fill="#fbf6ef" stroke="#b5afc0"/><path d="M252 64V110L310 143V94Z" fill="#aaa4bd"/><path d="M310 94L367 72V117L310 143Z" fill="#8e87a5"/><path d="M222 192L294 164L365 201L293 229Z" fill="#fbf6ef" stroke="#b5afc0"/><path d="M222 192V225L293 264V229Z" fill="#aaa4bd"/><path d="M293 229L365 201V236L293 264Z" fill="#8e87a5"/><path d="M80 218L167 187L180 147L246 122" stroke="#faf5ed" strokeWidth="13" strokeLinecap="round"/><path className="map-route" d="M80 218L167 187L180 147L246 122" stroke="#e77752" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 6"/><circle cx="80" cy="218" r="9" fill="#e77752" stroke="#fff8ed" strokeWidth="4"/><circle cx="246" cy="122" r="9" fill="#e77752" stroke="#fff8ed" strokeWidth="4"/><path d="M244 81C231 81 221 91 221 104C221 123 244 140 244 140S267 123 267 104C267 91 257 81 244 81Z" fill="#f1835d"/><circle cx="244" cy="103" r="7" fill="#fff8ed"/></g></svg><span className="map-chip"><span/> Your next lecture. One clear route.</span><span className="art-caption">CONCEPTUAL PROJECT ILLUSTRATION</span></div>;
  return <div className="project-art art-platform" aria-label="Illustrated community-platform architecture"><span className="diagram-eyebrow">CTPM / A CONNECTED COMMUNITY</span><div className="platform-line line-a"/><div className="platform-line line-b"/><div className="architecture"><div className="architecture-node node-ui"><Layers3 size={24}/><strong>Community</strong><span>STUDENT EXPERIENCE</span></div><span className="connection-dot connection-one"/><div className="architecture-node node-api"><Braces size={25}/><strong>Connect.</strong><span>TASKS & AUTOMATION</span></div><span className="connection-dot connection-two"/><div className="architecture-node node-db"><Database size={23}/><strong>PostgreSQL</strong><span>DATA LAYER</span></div></div><span className="art-caption">CONCEPTUAL PROJECT ILLUSTRATION</span></div>;
}
