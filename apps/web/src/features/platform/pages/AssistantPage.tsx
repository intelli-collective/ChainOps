import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, errorMessage } from '../../../app/api/client'
import { platformApi, type AssistantAnswer, type AssistantContext, type Project } from '../../../app/api/platform'
import { useLoad } from '../../../app/hooks/useLoad'
import { LoadError, LoadingCard, PageHeader, StateMessage } from '../../../app/ui'
import { WithProject } from './ProjectPages'
import '../../../app/ui.css'
import '../platform.css'

const SUGGESTIONS = ['Why did the latest run fail?', 'Summarize the latest pipeline run.', 'Which security policies apply to this project?']

type Exchange =
  | { id: number; question: string; status: 'pending' }
  | { id: number; question: string; status: 'answered'; answer: AssistantAnswer }
  | { id: number; question: string; status: 'failed'; message: string; code: number }

// ---------- Frames 19/20: AI Assistant (read only) ----------

export function AssistantPage() {
  return <WithProject>{(project) => <Assistant project={project} />}</WithProject>
}

function Assistant({ project }: { project: Project }) {
  const [params] = useSearchParams()
  const runId = params.get('run')
  const { state, reload } = useLoad(() => platformApi.assistantStatus(project.id), [project.id])
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [question, setQuestion] = useState('')
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const nextId = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef<HTMLDivElement>(null)

  const status = state.status === 'ready' ? state.data : null
  const pending = exchanges.some((item) => item.status === 'pending')
  const lastAnswered = [...exchanges].reverse().find((item) => item.status === 'answered')
  const context: AssistantContext | null = lastAnswered?.status === 'answered' ? lastAnswered.answer.context : status?.context ?? null
  const blocked = unavailable ?? (status && !status.available ? 'The AI assistant is not configured on this server. Everything else in ChainOps keeps working.' : null)

  useEffect(() => { latest.current?.scrollIntoView({ block: 'nearest' }) }, [exchanges.length])

  const ask = async (text: string) => {
    const value = text.trim()
    if (!value || pending || blocked) return
    const id = nextId.current++
    setExchanges((items) => [...items, { id, question: value, status: 'pending' }])
    setQuestion('')
    try {
      const answer = await platformApi.askAssistant(project.id, value, runId)
      setExchanges((items) => items.map((item) => (item.id === id ? { id, question: value, status: 'answered', answer } : item)))
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.status : 0
      // Provider outage or missing configuration: keep the page usable and explain once.
      if (code === 503) setUnavailable(errorMessage(failure))
      setExchanges((items) => items.map((item) => (item.id === id ? { id, question: value, status: 'failed', message: errorMessage(failure), code } : item)))
    } finally {
      input.current?.focus()
    }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(question) }

  return (
    <section className="co-page co-assistant" aria-labelledby="assistant-title">
      <PageHeader titleId="assistant-title" back={`/projects/${project.slug}/dashboard`} crumbStyle="link"
        crumbs={[{ label: 'Build' }, { label: 'Projects', to: '/projects' }, { label: project.name, to: `/projects/${project.slug}/dashboard` }, { label: 'AI Assistant' }]}
        title="AI Assistant" subtitle="Get answers about your code, deployments and operations. Read only: this assistant explains evidence and cannot make changes." />

      {state.status === 'loading' && <LoadingCard label="assistant" />}
      {state.status === 'error' && <LoadError code={state.code} message={state.message} what="Assistant" onRetry={reload} />}

      {status && (
        <>
          <div className="co-card co-assistant__context">
            <strong>{context?.project ?? project.name}</strong>
            <span aria-hidden="true">/</span>
            {context?.runId
              ? <Link className="co-assistant__context-link" to={`/projects/${project.slug}/pipelines/${context.runId}`}>{context.label}</Link>
              : <strong>{context?.label ?? 'Project overview'}</strong>}
          </div>

          {blocked && <StateMessage role="status" title="Assistant unavailable" body={blocked} action={unavailable ? <button type="button" className="co-btn co-btn--outline" onClick={() => { setUnavailable(null); reload() }}>Check again</button> : undefined} />}

          {exchanges.length === 0 && !blocked && (
            <div className="co-card co-assistant__empty">
              <p>Ask about pipeline runs, failing tests, artifacts, security policies, approvals or environments. Answers cite the ChainOps data they are based on.</p>
              <div className="co-assistant__suggestions">
                {SUGGESTIONS.map((text) => <button key={text} type="button" className="co-btn co-btn--outline co-btn--small" onClick={() => void ask(text)}>{text}</button>)}
              </div>
            </div>
          )}

          <div className="co-assistant__thread" aria-live="polite">
            {exchanges.map((item, index) => (
              <div key={item.id} className="co-assistant__exchange" ref={index === exchanges.length - 1 ? latest : undefined}>
                <div className="co-card co-assistant__question">{item.question}</div>
                <article className="co-card co-assistant__answer" aria-busy={item.status === 'pending'}>
                  <p className="co-assistant__byline">ChainOps Assistant <span aria-hidden="true">·</span> Read only</p>
                  {item.status === 'pending' && <p role="status" className="co-assistant__pending">Reviewing project data…</p>}
                  {item.status === 'failed' && (
                    <div role="alert" className="co-assistant__error">
                      <p>{item.message}</p>
                      {item.code !== 503 && item.code !== 400 && <button type="button" className="co-btn co-btn--outline co-btn--small" disabled={pending} onClick={() => void ask(item.question)}>Try again</button>}
                    </div>
                  )}
                  {item.status === 'answered' && <AnswerBody answer={item.answer} />}
                </article>
              </div>
            ))}
          </div>

          <form className="co-assistant__ask" onSubmit={submit}>
            <div className="co-assistant__field">
              <label className="co-label" htmlFor="assistant-question">Ask a question</label>
              <input id="assistant-question" ref={input} className="co-control" maxLength={1000} autoComplete="off" placeholder="Ask about this project, run or contract…"
                value={question} onChange={(event) => setQuestion(event.target.value)} disabled={Boolean(blocked)} aria-describedby="assistant-footnote" />
            </div>
            <button type="submit" className="co-btn co-btn--primary co-assistant__send" disabled={!question.trim() || pending || Boolean(blocked)}>
              {pending ? 'Sending…' : <>Send <span aria-hidden="true">→</span></>}
            </button>
          </form>
          <p id="assistant-footnote" className="co-help co-help--muted">Read only · Cannot execute actions, modify code, or trigger deployments.</p>
        </>
      )}
    </section>
  )
}

function AnswerBody({ answer }: { answer: AssistantAnswer }) {
  const logs = answer.evidence.filter((item) => item.kind === 'logs')
  const sources = answer.evidence.filter((item) => item.kind === 'source')
  return (
    <>
      <p className="co-assistant__text">{answer.answer}</p>
      {answer.logExcerpt && (
        <figure className="co-assistant__excerpt">
          <figcaption>{answer.logExcerpt.title}</figcaption>
          {/* Log text is rendered as plain text, never as HTML. */}
          <pre>{answer.logExcerpt.lines.join('\n')}</pre>
        </figure>
      )}
      {logs.map((item) => <Link key={item.link + item.label} className="co-assistant__source" to={item.link}>{item.label} <span aria-hidden="true">→</span></Link>)}
      {sources.length > 0 && (
        <ul className="co-assistant__sources" aria-label="Sources">
          {sources.map((item) => <li key={item.link + item.label}><Link className="co-assistant__source" to={item.link}>{item.label} <span aria-hidden="true">→</span></Link></li>)}
        </ul>
      )}
      {answer.nextSteps.length > 0 && (
        <div className="co-assistant__steps">
          <p>Suggested next steps</p>
          <ol>{answer.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      )}
    </>
  )
}
