import React, { Component, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import Portfolio from './Portfolio';
import './styles.css';
import './light.css';
document.documentElement.dataset.theme=window.location.pathname.startsWith('/admin')?'studio':'light';
const Admin=lazy(()=>import('./Admin'));
class ErrorBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){console.error('Interface error:',error.message);}
  render(){if(this.state.failed)return <div className="site-loading"><span className="brand">hazem<span>.</span></span><h1>A small detour.</h1><p>Something didn't load correctly. Please refresh the page.</p><button className="button button-primary" onClick={()=>window.location.reload()}>Try again</button></div>;return this.props.children;}
}
createRoot(document.getElementById('root')).render(<ErrorBoundary>{window.location.pathname.startsWith('/admin')?<Suspense fallback={<div className="site-loading">Opening your studio…</div>}><Admin/></Suspense>:<Portfolio/>}</ErrorBoundary>);
