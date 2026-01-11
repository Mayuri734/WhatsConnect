import { useEffect, useState, FormEvent } from "react";
import { Send, MessageCircle, Search, FileText, Zap, StickyNote } from "lucide-react";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  _id: string;
  name: string;
  phone: string;
  unreadCount?: number;
}

interface Conversation {
  contact: Contact;
  lastMessage?: {
    message: string;
    timestamp: string;
  };
}

interface Message {
  _id: string;
  message: string;
  direction: "inbound" | "outbound";
  timestamp: string;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Templates & AI
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [smartReplies, setSmartReplies] = useState<any[]>([]);
  const [generatingReplies, setGeneratingReplies] = useState(false);

  // Notes
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const filtered = conversations.filter((conv) =>
      conv.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.contact.phone.includes(searchQuery)
    );
    setFilteredConversations(filtered);
  }, [searchQuery, conversations]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/conversations");
      const data = await response.json();
      const validConversations = Array.isArray(data)
        ? data.filter((conv: Conversation) => conv.contact && conv.contact._id)
        : [];
      setConversations(validConversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (contactId: string) => {
    try {
      const response = await fetch(`/api/messages/contact/${contactId}`);
      const data = await response.json();
      const msgs = Array.isArray(data) ? data : [];
      setMessages(msgs);

      // Auto-generate smart replies for last inbound message (if any)
      const lastInbound = msgs.slice().reverse().find((m: Message) => m.direction === "inbound");
      if (lastInbound) {
        requestSmartReplies(lastInbound.message, contactId);
      } else {
        setSmartReplies([]);
      }

      // Load notes for selected contact
      loadNotes(contactId);

      // Mark conversation as read on the server and update local state
      try {
        await fetch(`/api/contacts/${contactId}/read`, { method: 'POST' });
        setConversations((prev) => prev.map((conv) =>
          conv.contact._id === contactId
            ? { ...conv, contact: { ...conv.contact, unreadCount: 0 } }
            : conv
        ));
        setFilteredConversations((prev) => prev.map((conv) =>
          conv.contact._id === contactId
            ? { ...conv, contact: { ...conv.contact, unreadCount: 0 } }
            : conv
        ));
      } catch (err) {
        console.error('Failed to mark conversation read:', err);
      }

    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await loadMessages(conversation.contact._id);
  };

  // Templates & AI helpers
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const requestSmartReplies = async (message: string, contactId?: string) => {
    try {
      setGeneratingReplies(true);
      const res = await fetch('/api/ai/smart-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contactId }),
      });
      const data = await res.json();
      setSmartReplies(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (err) {
      console.error('Error fetching smart replies:', err);
      setSmartReplies([]);
    } finally {
      setGeneratingReplies(false);
    }
  };



  // Notes
  const loadNotes = async (contactId: string) => {
    try {
      setNotesLoading(true);
      const res = await fetch(`/api/notes/contact/${contactId}`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setNotesLoading(false);
    }
  };

 const addNote = async (e: FormEvent) => {

    e.preventDefault();
    if (!selectedConversation) return;
    try {
      const payload = { contactId: selectedConversation.contact._id, content: noteContent };
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setNoteContent('');
        loadNotes(selectedConversation.contact._id);
        toast({ title: 'Note added' });
      } else {
        toast({ title: 'Unable to add note' });
      }
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedConversation) loadNotes(selectedConversation.contact._id);
        toast({ title: 'Note deleted' });
      } else {
        toast({ title: 'Unable to delete note' });
      }
    } catch (err) {
      console.error('Error deleting note:', err);
      toast({ title: 'Unable to delete note' });
    }
  };

const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversation) return;

    try {
      setSending(true);
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedConversation.contact.phone,
          message: messageInput,
          contactId: selectedConversation.contact._id,
        }),
      });

      if (response.ok) {
        setMessageInput("");
        loadMessages(selectedConversation.contact._id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-0px)] bg-slate-50 dark:bg-slate-900">
        {/* Conversations List */}
        <div className="w-80 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Conversations</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No conversations</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.contact._id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={`w-full text-left p-4 border-b border-slate-100 dark:border-slate-700 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                    selectedConversation?.contact._id === conversation.contact._id
                      ? "bg-emerald-50 dark:bg-emerald-900/30 border-l-2 border-emerald-500"
                      : ""
                  } ${
                    conversation.contact.unreadCount
                      ? "bg-blue-50 dark:bg-blue-900/20 font-semibold"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {conversation.contact.name}
                    </span>
                    {conversation.contact.unreadCount ? (
                      <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1">
                        {conversation.contact.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  {conversation.lastMessage && (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                        {conversation.lastMessage.message}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {formatDate(conversation.lastMessage.timestamp)}
                      </p>
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation View */}
        <div className="flex-1 flex bg-white dark:bg-slate-800">
          {selectedConversation ? (
            <>
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedConversation.contact.name}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {selectedConversation.contact.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowNotesModal(true)}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm flex items-center gap-2"
                    >
                      <StickyNote className="w-4 h-4" />
                      Notes
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400">No messages yet</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg._id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                            msg.direction === "outbound"
                              ? "bg-emerald-500 text-white rounded-br-none"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-none"
                          }`}
                        >
                          <p className="break-words">{msg.message}</p>
                          <p className={`text-xs mt-1 ${
                            msg.direction === "outbound"
                              ? "text-emerald-100"
                              : "text-slate-500 dark:text-slate-400"
                          }`}>
                            {formatMessageTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!messageInput.trim() || sending}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <div className="flex items-center gap-2">
                    
                    </div>
                  </div>
                </form>
              </div>

{/* Right Panel: AI & Templates */}
<aside
  className="
    w-80
    border-l border-slate-200 dark:border-slate-700
    bg-white dark:bg-slate-900
    p-5
    overflow-y-auto
    space-y-6
  "
>
  {/* Panel Header */}
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
      AI Assistant
    </h3>
    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
      Active
    </span>
  </div>

  {/* Smart Replies */}
  <div
    className="
      rounded-xl
      border border-slate-200 dark:border-slate-700
      bg-slate-50 dark:bg-slate-800
      p-4
      space-y-3
      animate-[fadeUp_0.4s_ease-out]
    "
  >
    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
      🤖 Smart Replies
    </h4>

    {generatingReplies ? (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse"
          />
        ))}
      </div>
    ) : smartReplies.length === 0 ? (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        AI suggestions will appear here based on the conversation.
      </p>
    ) : (
      <div className="flex flex-col gap-3">
        {smartReplies.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setMessageInput(s.text)}
            className="
              group
              text-left
              rounded-xl
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-900
              p-4
              transition-all duration-300
              hover:-translate-y-1 hover:shadow-lg
              active:scale-[0.98]
            "
          >
            <p className="text-sm text-slate-900 dark:text-slate-100 mb-2">
              {s.text}
            </p>

            {/* Confidence bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-1 bg-emerald-500 transition-all duration-700"
                  style={{ width: `${s.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {(s.confidence * 100).toFixed(0)}%
              </span>
            </div>

            {/* Hover CTA */}
            <div
              className="
                mt-2
                text-xs
                text-emerald-600 dark:text-emerald-400
                opacity-0 group-hover:opacity-100
                transition
              "
            >
              Click to insert →
            </div>
          </button>
        ))}
      </div>
    )}
  </div>

  {/* Templates */}
  <div
    className="
      rounded-xl
      border border-slate-200 dark:border-slate-700
      bg-slate-50 dark:bg-slate-800
      p-4
      space-y-3
      animate-[fadeUp_0.5s_ease-out]
    "
  >
    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
      📄 Templates
    </h4>

    {templatesLoading ? (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse"
          />
        ))}
      </div>
    ) : templates.length === 0 ? (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No templates yet. Create some from the Templates page.
      </p>
    ) : (
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
        {templates.map((t) => (
          <button
            key={t._id}
            onClick={() =>
              setMessageInput((s) =>
                s ? s + "\n" + t.message : t.message
              )
            }
            className="
              group
              flex items-center justify-between
              rounded-lg
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-900
              px-4 py-3
              transition
              hover:bg-emerald-50 dark:hover:bg-emerald-900/20
              active:scale-[0.98]
            "
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {t.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.category || "General"}
              </p>
            </div>

            <span
              className="
                text-xs
                px-2 py-1
                rounded-full
                bg-slate-200 dark:bg-slate-700
                group-hover:bg-emerald-500
                group-hover:text-white
                transition
              "
            >
              Use
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
</aside>


              {/* Notes Modal */}
              {showNotesModal && selectedConversation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Notes — {selectedConversation.contact.name}</h3>
                      <button onClick={() => setShowNotesModal(false)} className="text-sm text-slate-500">Close</button>
                    </div>

                    <form onSubmit={addNote} className="mb-4">
                      <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write a note..." className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={3} />
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setShowNotesModal(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Add Note</button>
                      </div>
                    </form>

                    <div className="space-y-3">
                      {notesLoading ? (
                        <div className="text-sm text-slate-500">Loading notes…</div>
                      ) : notes.length === 0 ? (
                        <p className="text-sm text-slate-500">No notes yet</p>
                      ) : (
                        notes.map((n) => (
                          <div key={n._id} className="p-3 border rounded-md border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                            <div className="flex items-start justify-between">
                              <div className="text-sm text-slate-800 dark:text-slate-200">{n.content}</div>
                              <div className="text-xs text-slate-400">
                                <button onClick={() => deleteNote(n._id)} className="text-red-500">Delete</button>
                              </div>
                            </div>
                            <div className="text-xs text-slate-400 mt-2">{new Date(n.createdAt).toLocaleString()}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400 text-lg">
                  Select a conversation to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
