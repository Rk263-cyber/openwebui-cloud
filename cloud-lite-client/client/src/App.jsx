import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Menu, Plus, Trash2, Edit2, Loader2, Search, Zap, Check, Cloud, CloudOff } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchLocalChats, fetchLocalMessages, sendMessage, generateId, syncMessages, deleteChat } from './services/api'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('cloud-ui-theme') || 'deep-graphite')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cloud-ui-theme', theme)
  }, [theme])

  useEffect(() => {
    // Initial load
    loadChats()
    
    // Online/Offline listeners
    const handleOnline = async () => {
      setIsOnline(true)
      setIsSyncing(true)
      await syncMessages()
      await loadChats()
      setIsSyncing(false)
    }
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Initial sync
    if (navigator.onLine) handleOnline();
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId)
    }
  }, [activeChatId])

  const loadChats = async () => {
    const list = await fetchLocalChats()
    setChats(list)
  }

  const loadMessages = async (id) => {
    const msgs = await fetchLocalMessages(id)
    setMessages(msgs)
  }

  const handleNewChat = () => {
    setActiveChatId(generateId())
    setMessages([])
    setIsSidebarOpen(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const text = input.trim()
    setInput('')
    setIsThinking(true)
    
    let chatId = activeChatId
    if (!chatId) {
      chatId = generateId()
      setActiveChatId(chatId)
    }
    
    // Optimistic UI update for user message
    const tempUserMsg = { id: Date.now(), role: 'user', content: text, created_at: Date.now() }
    const currentMsgs = [...messages, tempUserMsg]
    setMessages(currentMsgs)
    
    setTimeout(() => {
      const scrollDiv = document.getElementById('chat-scroll-area')
      if (scrollDiv) scrollDiv.scrollTop = scrollDiv.scrollHeight
    }, 50)

    try {
      await sendMessage(currentMsgs, chatId, text)
      await loadMessages(chatId)
      await loadChats()
    } catch(err) {
      console.error(err)
      alert("Error sending message")
    } finally {
      setIsThinking(false)
      setTimeout(() => {
        const scrollDiv = document.getElementById('chat-scroll-area')
        if (scrollDiv) scrollDiv.scrollTop = scrollDiv.scrollHeight
      }, 50)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if(confirm("Delete this chat?")) {
      await deleteChat(id)
      if (activeChatId === id) {
        handleNewChat()
      }
      loadChats()
    }
  }

  return (
    <div className="flex h-[100dvh] w-full bg-bg-base text-text-primary overflow-hidden relative font-sans">
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : (window.innerWidth < 768 ? '-100%' : 0) }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        className={cn(
          "absolute md:relative z-50 h-full w-64 bg-bg-panel border-r border-border flex flex-col flex-shrink-0 shadow-xl md:shadow-none",
          window.innerWidth < 768 && !isSidebarOpen ? "pointer-events-none md:pointer-events-auto" : ""
        )}
      >
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={handleNewChat}
            className="flex-1 flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-bg-hover border border-border rounded-lg transition-colors font-medium text-sm"
          >
            <Plus size={16} /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {chats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false) }}
              className={cn(
                "group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors",
                activeChatId === chat.id ? "bg-bg-hover text-text-primary font-medium" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              )}
            >
              <div className="truncate pr-8">{chat.title || 'New Chat'}</div>
              <button 
                onClick={(e) => handleDelete(e, chat.id)}
                className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-border rounded text-text-secondary hover:text-red-400 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border">
           <div className="flex items-center gap-2 mb-4 px-2 text-xs text-text-secondary">
             {isOnline ? (
                isSyncing ? <><Loader2 size={12} className="animate-spin text-accent"/> Syncing...</> : <><Cloud size={12} className="text-accent"/> Synced</>
             ) : (
               <><CloudOff size={12} className="text-red-400"/> Offline</>
             )}
           </div>
           <select 
             value={theme} 
             onChange={(e) => setTheme(e.target.value)}
             className="w-full bg-bg-hover border border-border text-sm rounded-lg p-2 text-text-primary outline-none focus:border-accent"
           >
             <option value="deep-graphite">Deep Graphite</option>
             <option value="claude-light">Claude Light</option>
             <option value="midnight-blue">Midnight Blue</option>
             <option value="openai-dark">OpenAI Dark</option>
             <option value="glass-aurora">Glass Aurora</option>
             <option value="nord">Nord</option>
             <option value="oled-black">OLED Black</option>
           </select>
        </div>
      </motion.aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 flex items-center justify-between px-4 border-b border-transparent md:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
            <Menu size={20} />
          </button>
          <div className="font-semibold text-sm">CloudUI</div>
          <div className="w-8"></div>
        </header>

        <div id="chat-scroll-area" className="flex-1 overflow-y-auto px-4 pb-32 pt-8 flex justify-center scroll-smooth">
          <div className="w-full max-w-3xl space-y-8">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 mt-32">
                <div className="w-16 h-16 rounded-2xl bg-bg-panel border border-border flex items-center justify-center mb-6 shadow-xl">
                  <Zap size={28} className="text-accent" />
                </div>
                <h1 className="text-2xl font-medium mb-2">How can I help you today?</h1>
                <p className="text-sm">Start a conversation to get started.</p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <motion.div 
                key={msg.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center mr-4 text-white shadow-md">
                    <Zap size={14} />
                  </div>
                )}
                <div className={cn(
                  "relative max-w-[85%] sm:max-w-[75%]", 
                  msg.role === 'user' 
                    ? "bg-bg-hover px-5 py-3.5 rounded-2xl rounded-br-sm shadow-sm" 
                    : "flex-1 min-w-0"
                )}>
                  <div className={cn("prose prose-invert max-w-none", msg.role === 'user' ? 'text-[15px]' : '')}>
                    {msg.role === 'user' ? msg.content : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {msg.role === 'assistant' && msg.model && (
                    <div className="mt-2 text-xs text-text-secondary font-medium px-2 py-1 bg-bg-panel inline-block rounded-md border border-border">
                      {msg.model}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isThinking && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex w-full justify-start"
              >
                <div className="w-8 h-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center mr-4 text-white shadow-md">
                  <Zap size={14} />
                </div>
                <div className="flex gap-1 items-center h-8 px-2">
                   <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                   <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                   <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-bg-base via-bg-base to-transparent pt-8 pb-6 px-4 flex justify-center pointer-events-none">
          <form 
            onSubmit={handleSubmit}
            className="w-full max-w-3xl relative pointer-events-auto shadow-2xl rounded-2xl bg-bg-input border border-border focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all"
          >
            <textarea 
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = '56px'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
              }}
              placeholder="Message CloudUI..."
              className="w-full bg-transparent text-text-primary px-4 py-4 pr-12 min-h-[56px] max-h-[200px] resize-none outline-none font-sans text-[15px]"
              rows={1}
            />
            <button 
              type="submit"
              disabled={!input.trim() || isThinking}
              className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-text-primary text-bg-base flex items-center justify-center disabled:opacity-30 disabled:bg-border disabled:text-text-secondary transition-all hover:scale-105"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
