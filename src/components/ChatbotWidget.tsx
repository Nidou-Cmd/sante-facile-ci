import { useEffect, useRef, useState } from 'react'
import { CHATBOT_GREETING, CHATBOT_QUICK_QUESTIONS, chatbotAnswer } from '../lib/chatbot'

interface BotMessage {
  from: 'bot' | 'user'
  text: string
}

/**
 * Module 10 — Chatbot d'assistance flottant (réponses pré-définies, FR).
 * Monté sur tous les tableaux de bord via DashboardLayout.
 */
export default function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<BotMessage[]>([{ from: 'bot', text: CHATBOT_GREETING }])
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const ask = (question: string) => {
    const q = question.trim()
    if (!q) return
    setMessages((prev) => [...prev, { from: 'user', text: q }, { from: 'bot', text: chatbotAnswer(q) }])
    setInput('')
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Assistant Santé Facile"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-lg transition hover:bg-emerald-700"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Panneau */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="bg-emerald-600 px-4 py-3 text-white">
            <p className="text-sm font-bold">Assistant Santé Facile</p>
            <p className="text-xs text-emerald-100">Réponses automatiques — ne remplace pas un avis médical</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.from === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 p-2">
            <div className="mb-2 flex flex-wrap gap-1">
              {CHATBOT_QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask(input)
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Votre question…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
