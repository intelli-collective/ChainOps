import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChainOpsLogo, LandingIcon } from './LandingIcon'
import { benefits, capabilities, integrations, workflowSteps } from './content'
import './landing.css'

const repository = 'https://github.com/intelli-collective/ChainOps'
const navigation = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'about', label: 'About' },
]

interface Information {
  title: string
  paragraphs: string[]
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const [information, setInformation] = useState<Information | null>(null)
  const menuToggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id)
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 })
    for (const item of navigation) {
      const section = document.getElementById(item.id)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [])

  function selectSection(id: string) {
    setActiveSection(id)
    setMenuOpen(false)
  }

  return <div className="landing-page">
    <a className="landing-skip-link" href="#landing-main">Skip to content</a>
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <a href="#home" aria-label="ChainOps home" onClick={() => selectSection('home')}><ChainOpsLogo /></a>
        <button ref={menuToggle} className="landing-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="landing-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen((open) => !open)}><LandingIcon name={menuOpen ? 'close' : 'menu'} /></button>
        <nav id="landing-navigation" className={`landing-navigation ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation" onKeyDown={(event) => { if (event.key === 'Escape') { setMenuOpen(false); menuToggle.current?.focus() } }}>
          {navigation.map((item) => <a key={item.id} href={`#${item.id}`} className={activeSection === item.id ? 'is-active' : ''} aria-current={activeSection === item.id ? 'location' : undefined} onClick={() => selectSection(item.id)}>{item.label}</a>)}
          <Link className="landing-mobile-cta" to="/register">Get Started <LandingIcon name="arrow" /></Link>
        </nav>
        <Link className="landing-button landing-button-primary landing-header-cta" to="/register">Get Started <LandingIcon name="arrow" /></Link>
      </div>
    </header>

    <main id="landing-main">
      <section id="home" className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-container landing-hero-inner">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Smart contract operations</p>
            <h1 id="landing-hero-title">Build. Validate.<br /><span>Deploy. Monitor.</span></h1>
            <p className="landing-hero-description">ChainOps is a developer-focused platform that connects your GitHub development with automated validation, governed deployment and real-time monitoring for smart contracts.</p>
            <div className="landing-button-row"><Link className="landing-button landing-button-primary" to="/register">Get Started <LandingIcon name="arrow" /></Link><a className="landing-button landing-button-outline" href="#workflow" onClick={() => selectSection('workflow')}>Learn More</a></div>
          </div>
          <div className="landing-hero-art"><img src="/hero-image.png" alt="Ethereum crystal above an illuminated teal platform, connected to floating cubes" width="1360" height="1156" fetchPriority="high" /></div>
          <ul className="landing-assurances" aria-label="Platform principles">
            <li><LandingIcon name="shield" /><span>Open Source<br />Friendly</span></li>
            <li><LandingIcon name="layers" /><span>EVM Compatible<br />Networks</span></li>
            <li><LandingIcon name="lock" /><span>Governed<br />Deployments</span></li>
            <li><LandingIcon name="link" /><span>End-to-End<br />Traceability</span></li>
          </ul>
        </div>
      </section>

      <section id="integrations" className="landing-integrations landing-section-border" aria-labelledby="landing-integrations-title">
        <div className="landing-container">
          <h2 className="landing-eyebrow" id="landing-integrations-title">Works with industry standards</h2>
          <ul className="landing-partners">{integrations.map((item) => <li key={item.name}><LandingIcon name={item.icon} className={item.className} /><span>{item.name}</span></li>)}</ul>
        </div>
      </section>

      <section id="workflow" className="landing-workflow landing-section-border" aria-labelledby="landing-workflow-title">
        <div className="landing-container landing-workflow-inner">
          <div className="landing-workflow-copy">
            <p className="landing-eyebrow">From code to on-chain</p>
            <h2 id="landing-workflow-title">A <span>connected</span><br />lifecycle for<br />smart contracts.</h2>
            <p className="landing-body-copy">Every change goes through a secure, automated and governed workflow, giving you full visibility and traceability from development to on-chain operations.</p>
            <a className="landing-button landing-button-primary" href="#workflow-steps">Explore Workflow <LandingIcon name="arrow" /></a>
          </div>
          <div className="landing-flow" id="workflow-steps">
            <svg className="landing-flow-connector" viewBox="0 0 720 410" preserveAspectRatio="none" aria-hidden="true"><path d="M605 80h65q30 0 30 30v65q0 30-30 30H50q-30 0-30 30v65q0 30 30 30h55" /><circle cx="130" cy="205" r="5" /><circle cx="365" cy="205" r="5" /><circle cx="600" cy="205" r="5" /></svg>
            <ol className="landing-workflow-grid">{workflowSteps.map((step, index) => <li key={step.title}>
              <button className="landing-workflow-card" type="button" onClick={() => setInformation({ title: `${index + 1}. ${step.title}`, paragraphs: [step.description + '.', 'Follow the same source revision through the workflow. Each stage keeps its results connected to the release, so your team can review the context before moving forward.'] })} aria-label={`Learn about step ${index + 1}: ${step.title}`}>
                <div className="landing-workflow-card-top"><LandingIcon name={step.icon} /><span aria-hidden="true">↗</span></div>
                <h3>{index + 1}. {step.title}</h3><p>{step.description}</p>
              </button>
            </li>)}</ol>
          </div>
        </div>
      </section>

      <section id="features" className="landing-capabilities landing-section-border" aria-labelledby="landing-features-title">
        <div className="landing-container">
          <div className="landing-section-heading"><div><p className="landing-eyebrow">Core capabilities</p><h2 id="landing-features-title">Everything you need<br />for smart contract operations.</h2></div><p className="landing-body-copy">ChainOps brings together development, security, deployment and monitoring into one cohesive platform.</p></div>
          <div className="landing-capability-grid">{capabilities.map((capability) => <article className="landing-capability-card" key={capability.title}>
            <LandingIcon name={capability.icon} />
            <div><h3>{capability.title}</h3><p>{capability.description}</p><button className="landing-text-button" type="button" aria-label={`Learn more about ${capability.title}`} onClick={() => setInformation({ title: capability.title, paragraphs: [capability.detail] })}>Learn more <span aria-hidden="true">→</span></button></div>
          </article>)}</div>
        </div>
      </section>

      <section id="about" className="landing-about" aria-labelledby="landing-about-title">
        <div className="landing-container">
          <div className="landing-section-heading"><div><p className="landing-eyebrow">Why ChainOps</p><h2 id="landing-about-title">Designed for developer teams.<br />Built for real-world operations.</h2></div><p className="landing-body-copy">ChainOps is not a replacement for your existing tools. It integrates with the best tools in the ecosystem and adds the governance, traceability and operational context your team needs.</p></div>
          <div className="landing-benefits">{benefits.map((benefit) => <article key={benefit.title}><LandingIcon name={benefit.icon} /><div><h3>{benefit.title}</h3><p>{benefit.description}</p></div></article>)}</div>
          <div className="landing-cta-panel"><div><p className="landing-eyebrow">Ready to streamline your smart contract operations?</p><h2>Start building with ChainOps.</h2></div><div className="landing-button-row"><Link className="landing-button landing-button-primary" to="/register">Get Started <LandingIcon name="arrow" /></Link><a className="landing-button landing-button-outline" href={repository} target="_blank" rel="noreferrer">View on GitHub <LandingIcon name="github" /></a></div></div>
        </div>
      </section>
    </main>

    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-main">
          <div className="landing-footer-brand"><a href="#home" aria-label="ChainOps home"><ChainOpsLogo wide /></a><p>Smart Contract Operations Platform</p></div>
          <div className="landing-footer-column"><h2>Product</h2>{navigation.filter((item) => item.id !== 'home').map((item) => <a key={item.id} href={`#${item.id}`} onClick={() => selectSection(item.id)}>{item.label}</a>)}</div>
          <div className="landing-footer-column"><h2>Resources</h2><a href={`${repository}/wiki`} target="_blank" rel="noreferrer">Documentation</a><a href={repository} target="_blank" rel="noreferrer">Project Overview</a><button onClick={() => setInformation({ title: 'Frequently asked questions', paragraphs: ['What is ChainOps? A developer platform connecting smart contract validation, approval, deployment and monitoring workflows.', 'Which networks are supported? The project targets EVM-compatible networks, with Sepolia used in the current frontend previews.', 'Does the preview deploy real contracts? No. Authentication, deployment and registry interactions currently use mock services while backend integrations are being developed.'] })}>FAQ</button></div>
          <div className="landing-footer-column landing-connect"><h2>Connect</h2><div className="landing-social-links"><a href={repository} target="_blank" rel="noreferrer" aria-label="ChainOps on GitHub"><LandingIcon name="github" /></a><a href={`${repository}/issues`} target="_blank" rel="noreferrer" aria-label="Contact the ChainOps team through GitHub issues"><LandingIcon name="mail" /></a></div><p>Built for the developer ecosystem.<br />By IntelliCoders.</p></div>
        </div>
        <div className="landing-footer-bottom"><p>© 2026 ChainOps. All rights reserved.</p><div><button onClick={() => setInformation({ title: 'Privacy', paragraphs: ['This landing page does not ask for personal information. Account and workspace previews use mock services.', 'A production privacy policy will be published before real accounts and connected services are introduced.'] })}>Privacy</button><button onClick={() => setInformation({ title: 'Terms', paragraphs: ['ChainOps is currently a development preview. Its simulated actions do not create a secure authenticated session or execute blockchain transactions.', 'Production terms of service will be published when the platform is ready for real use.'] })}>Terms</button><a href={`${repository}/issues`} target="_blank" rel="noreferrer">Contact</a></div></div>
      </div>
    </footer>
    {information && <InformationDialog information={information} onClose={() => setInformation(null)} />}
  </div>
}

function InformationDialog({ information, onClose }: { information: Information; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className="landing-dialog" aria-labelledby="landing-information-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="landing-dialog-heading"><h2 id="landing-information-title">{information.title}</h2><button className="landing-dialog-close" type="button" aria-label="Close details" autoFocus onClick={onClose}><LandingIcon name="close" /></button></div>
    {information.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    <a className="landing-text-button" href={repository} target="_blank" rel="noreferrer">Explore the project on GitHub <span aria-hidden="true">→</span></a>
  </dialog>
}
