// Shared by validation and the Studio so project metadata stays consistent.
export const PROJECT_CATEGORIES=['Full-stack','E-commerce','Web app','Automation','Frontend','Interactive','Other'];
export const DEMO_MODES=['live','login','demo','preview','paused'];
export const IMAGE_KINDS=['capture','repository','illustration'];
export const DEMO_MODE_LABELS={live:'Public application',login:'Sign-in required',demo:'Public demo / demonstration data',preview:'Isolated portfolio preview',paused:'Deployment paused / unavailable'};
export const IMAGE_KIND_LABELS={capture:'Actual interface screenshot',repository:'Screenshot from the public repository',illustration:'Conceptual artwork (not a screenshot)'};
export function projectMode(project){
  if(project.demoMode==='paused')return 'paused';
  if(project.demo?.startsWith('/demos/'))return 'preview';
  return project.demoMode||'live';
}
export function sourceHref(project){return project.showSource===false?'':project.repo||'';}
export function publicProject(project){return {...project,repo:sourceHref(project)};}
export function demoHref(project){return projectMode(project)==='paused'?'':project.demo||'';}
export function demoLabel(project,detailed=false){
  const mode=projectMode(project);
  if(mode==='login')return 'Open sign-in';
  if(mode==='demo')return 'Explore demo';
  if(mode==='preview')return 'Open project preview';
  if(project.category==='E-commerce')return 'Browse storefront';
  return detailed?'Visit live project':'View live project';
}
export function screenshotCaption(project){
  if(project.imageCaption?.trim())return project.imageCaption.trim();
  if(project.imageKind==='repository')return 'INTERFACE CAPTURE · FROM PUBLIC REPOSITORY';
  if(project.imageKind==='illustration')return 'CONCEPTUAL PROJECT ILLUSTRATION';
  if(projectMode(project)==='login')return 'ACTUAL INTERFACE · SIGN-IN REQUIRED';
  if(projectMode(project)==='preview')return 'PROJECT PREVIEW · FROM PUBLIC SOURCE';
  if(projectMode(project)==='demo')return 'ACTUAL DEMO INTERFACE';
  return 'ACTUAL PROJECT SCREENSHOT';
}
