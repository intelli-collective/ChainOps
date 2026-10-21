import type { ReactNode } from 'react'

export type LandingIconName = 'arrow' | 'shield' | 'layers' | 'lock' | 'link' | 'branch' | 'rocket' | 'database' | 'chart' | 'document' | 'bolt' | 'users' | 'cube' | 'bell' | 'github' | 'ethereum' | 'helmet' | 'foundry' | 'slither' | 'network' | 'mail' | 'menu' | 'close'

const shapes: Record<LandingIconName, ReactNode> = {
  arrow: <><path d="M6 18 18 6M6 6h12v12" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m9 12 2 2 4-5" /></>,
  layers: <><path d="m3 7 9-5 9 5-9 5Zm0 5 9 5 9-5M3 17l9 5 9-5" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  link: <><path d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0)" /></>,
  branch: <><circle cx="6" cy="4" r="2" /><circle cx="6" cy="20" r="2" /><circle cx="19" cy="6" r="2" /><path d="M6 6v12m2-6h3a8 8 0 0 0 8-4" /></>,
  rocket: <><path d="M9 15c-1-8 4-12 12-12 0 8-4 13-12 12Zm0 0-3 3m3-9-5 1-2 6 6-1m7 0-1 5-6 2 1-6M5 19l-2 2" /><circle cx="16" cy="8" r="2" /></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="4" /><path d="M3 5v14c0 5 18 5 18 0V5M3 12c0 5 18 5 18 0" /></>,
  chart: <><rect x="3" y="13" width="4" height="8" rx="1" /><rect x="10" y="8" width="4" height="13" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" /></>,
  document: <><path d="M5 2h9l5 5v15H5Zm9 0v6h5M8 12h4m-4 4h8m-8 3h5" /></>,
  bolt: <path d="m14 2-10 12h7l-1 8 10-12h-7Z" />,
  users: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2M6 17h6" /></>,
  cube: <><path d="m12 2 10 6v10l-10 6L2 18V8Zm0 12L2 8m10 6 10-6m-10 6v10" /><circle cx="12" cy="7" r=".6" /><circle cx="7" cy="16" r=".6" /><circle cx="17" cy="16" r=".6" /></>,
  bell: <><path d="M5 9a7 7 0 0 1 14 0v6l2 3H3l2-3Zm4 12h6M12 2V0" /></>,
  github: <path fill="currentColor" stroke="none" d="M12 .8A11.2 11.2 0 0 0 8.46 22.63c.56.1.77-.24.77-.54v-2.1c-3.12.68-3.78-1.33-3.78-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.62 1.22 3.26.93.1-.73.39-1.23.71-1.51-2.5-.29-5.12-1.25-5.12-5.56 0-1.23.44-2.23 1.15-3.02-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.15A10.7 10.7 0 0 1 12 6.14c.95 0 1.9.13 2.8.38 2.13-1.45 3.07-1.15 3.07-1.15.61 1.54.23 2.68.12 2.96.71.79 1.14 1.79 1.14 3.02 0 4.32-2.62 5.27-5.13 5.55.4.35.76 1.03.76 2.08v3.11c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />,
  ethereum: <><path fill="currentColor" fillOpacity=".85" stroke="none" d="M12 1 5 13l7 4 7-4Zm-7 14 7 9 7-9-7 4Z" /><path d="M12 1v16L5 13m7 4 7-4" stroke="#000" strokeOpacity=".5" strokeWidth=".8" /></>,
  helmet: <><path fill="currentColor" stroke="none" d="M2 16h20v4H2Zm2 0v-4a8 8 0 0 1 16 0v4Z" /><path d="M9 6v8m6-8v8" stroke="#000" strokeWidth="1.5" /></>,
  foundry: <><rect x="3" y="2" width="18" height="20" rx="4" fill="currentColor" stroke="none" /><path d="M9 18V6h7m-7 5h5" stroke="#07120f" strokeWidth="2.5" /></>,
  slither: <path d="M20 5C16 0 5 2 5 7s14 3 14 9-11 8-16 2m2-1c4 3 11 3 11-1S2 13 2 7 14-2 20 2" />,
  network: <><path d="m7 5 4-1 4 4-2 5-4 1-4-4Zm8 6 4-1 4 4-2 5-4 1-4-4M2 6-1 9l2 4 4 1m14-9 3 1 2 4" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 8L22 6" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="m5 5 14 14M5 19 19 5" />,
}

export function LandingIcon({ name, className = '' }: { name: LandingIconName; className?: string }) {
  return <svg className={`landing-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>
}

export function ChainOpsLogo({ wide = false }: { wide?: boolean }) {
  if (wide) return <span className="landing-wordmark"><img src="/logo-2.png" width="2170" height="725" alt="ChainOps — Smart Contract Operations" /><img className="landing-wordmark-light" src="/logo-2.png" width="2170" height="725" alt="" aria-hidden="true" /></span>
  return <span className="landing-brand">
    <img src="/logo-1.png" className="landing-brand-mark" width="1322" height="1190" alt="" />
    <span>Chain<span>Ops</span></span>
  </span>
}
