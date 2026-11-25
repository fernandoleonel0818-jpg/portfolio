import { useState, useRef, useEffect, type FormEvent } from 'react';
import type { Message, LeadData } from '../types/chat';

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    '¡Hola! Soy el asistente virtual de Fernando. Contame qué proyecto tenés en mente y te ayudo a armar una propuesta.',
};

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [leadSummary, setLeadSummary] = useState<LeadData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Baja el scroll interno del chat cada vez que llega un mensaje nuevo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // slice(1) omite el saludo inicial para que Gemini reciba siempre primero un mensaje del usuario
        body: JSON.stringify({ messages: updatedMessages.slice(1) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al conectar con el asistente.');
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);

      if (data.isComplete && data.leadData) {
        setLeadSummary(data.leadData);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado. Intentá de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([INITIAL_MESSAGE]);
    setLeadSummary(null);
    setError(null);
    setInput('');
  };

  return (
    <div className="mt-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden flex flex-col shadow-xl">
      {/* Zona de mensajes */}
      <div
        ref={scrollRef}
        className="p-6 space-y-4 h-96 overflow-y-auto scroll-smooth"
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-emerald-500 text-zinc-950 font-medium'
                  : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700/50'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Indicador de "escribiendo..." */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 text-sm bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]"></span>
            </div>
          </div>
        )}

        {/* Tarjeta de confirmación cuando el lead se califica y envía */}
        {leadSummary && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-400">
                ✓ Resumen enviado a Fernando
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                Prioridad: {leadSummary.priority}
              </span>
            </div>
            <p className="text-xs text-zinc-300">
              <strong>Proyecto:</strong> {leadSummary.projectType} ·{' '}
              <strong>Plazo:</strong> {leadSummary.timeline}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
            >
              Iniciar una nueva consulta
            </button>
          </div>
        )}

        {/* Mensaje de error si falla la petición */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Formulario de entrada */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading || Boolean(leadSummary)}
          placeholder={
            leadSummary
              ? 'Consulta finalizada. Hacé clic arriba para iniciar otra.'
              : 'Ej: Necesito una landing page con chatbot...'
          }
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || Boolean(leadSummary)}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}