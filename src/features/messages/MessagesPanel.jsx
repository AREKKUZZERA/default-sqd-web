import { MessageSquarePlus, Search, SendHorizonal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDirectConversation,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendDirectMessage,
} from '../../shared/api/socialApi.js';
import { supabase } from '../../shared/lib/supabase.js';
import Avatar from '../../shared/ui/Avatar.jsx';
import IconButton from '../../shared/ui/IconButton.jsx';
import Panel from '../../shared/ui/Panel.jsx';

function getParticipant(conversation, people) {
  return conversation.participant || people.find((person) => person.id === conversation.participantId);
}

function shouldStickToBottom(element) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

export default function MessagesPanel({ currentUser, expanded = false, people = [] }) {
  const [activeId, setActiveId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [draft, setDraft] = useState('');
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [query, setQuery] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const currentUserId = currentUser?.id;
  const activeIdRef = useRef(activeId);
  const reloadTimerRef = useRef(null);
  const messagesListRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const scrollMessagesToBottom = useCallback((behavior = 'smooth') => {
    const element = messagesListRef.current;

    if (!element) {
      return;
    }

    window.requestAnimationFrame(() => {
      element.scrollTo({ top: element.scrollHeight, behavior });
    });
  }, []);

  const loadConversations = useCallback(async ({ keepActive = true } = {}) => {
    if (!currentUserId) {
      return [];
    }

    try {
      setError('');
      const items = await fetchConversations(currentUserId);
      setConversations(items);
      setActiveId((currentActiveId) => {
        if (keepActive && currentActiveId && items.some((item) => item.id === currentActiveId)) {
          return currentActiveId;
        }

        return items[0]?.id || null;
      });
      return items;
    } catch (loadError) {
      setError(loadError.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const loadMessages = useCallback(async (conversationId, { markRead = false, scroll = false } = {}) => {
    if (!conversationId) {
      return [];
    }

    try {
      setError('');
      const messages = await fetchMessages(conversationId);
      setMessagesByConversation((items) => ({ ...items, [conversationId]: messages }));

      if (markRead) {
        await markConversationRead({ conversationId, currentUserId: currentUserId });
      }

      if (scroll) {
        scrollMessagesToBottom('auto');
      }

      return messages;
    } catch (loadError) {
      setError(loadError.message);
      return [];
    }
  }, [currentUserId, scrollMessagesToBottom]);

  useEffect(() => {
    void Promise.resolve().then(() => loadConversations({ keepActive: true }));
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    shouldAutoScrollRef.current = true;
    void Promise.resolve().then(async () => {
      await loadMessages(activeId, { markRead: true, scroll: true });
      await loadConversations({ keepActive: true });
    });
  }, [activeId, loadConversations, loadMessages]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const scheduleRefresh = (payload) => {
      window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(async () => {
        const activeConversationId = activeIdRef.current;
        const incomingConversationId = payload?.new?.conversation_id;
        const senderId = payload?.new?.sender_id;
        const isActiveConversation = activeConversationId && activeConversationId === incomingConversationId;

        await loadConversations({ keepActive: true });

        if (isActiveConversation) {
          const sticky = shouldStickToBottom(messagesListRef.current) || senderId === currentUserId;
          await loadMessages(activeConversationId, { markRead: senderId !== currentUserId, scroll: sticky });

          if (sticky) {
            scrollMessagesToBottom('smooth');
          }
        }
      }, 300);
    };

    const channel = supabase
      .channel(`default-sqd-messages-${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_conversations' }, () => scheduleRefresh())
      .subscribe();

    return () => {
      window.clearTimeout(reloadTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadConversations, loadMessages, scrollMessagesToBottom]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const participant = getParticipant(conversation, people);
      const searchable = `${participant?.name ?? ''} ${participant?.userId ?? ''} ${conversation.message}`.toLowerCase();
      return !normalizedQuery || searchable.includes(normalizedQuery);
    });
  }, [conversations, people, query]);

  const availablePeople = useMemo(() => {
    const activeParticipantIds = new Set(conversations.map((conversation) => conversation.participantId));
    return people.filter((person) => person.id !== currentUserId && !activeParticipantIds.has(person.id));
  }, [conversations, currentUserId, people]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const activeParticipant = activeConversation ? getParticipant(activeConversation, people) : null;
  const activeMessages = activeConversation ? messagesByConversation[activeConversation.id] ?? [] : [];

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollMessagesToBottom('auto');
      shouldAutoScrollRef.current = false;
    }
  }, [activeMessages.length, scrollMessagesToBottom]);

  const createChat = async (person) => {
    try {
      setError('');
      const id = await createDirectConversation(currentUserId, person.id);
      setActiveId(id);
      setDirectoryOpen(false);
      await loadConversations({ keepActive: true });
      await loadMessages(id, { markRead: true, scroll: true });
    } catch (createError) {
      setError(createError.message);
    }
  };

  const selectConversation = (conversationId) => {
    setActiveId(conversationId);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text || !activeConversation || sending) {
      return;
    }

    try {
      setSending(true);
      setError('');
      shouldAutoScrollRef.current = true;
      const messages = await sendDirectMessage({ conversationId: activeConversation.id, currentUserId: currentUserId, text });
      setMessagesByConversation((items) => ({ ...items, [activeConversation.id]: messages }));
      setDraft('');
      scrollMessagesToBottom('smooth');
      await loadConversations({ keepActive: true });
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="min-w-0">
      {expanded ? (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="y2k-label mb-2">direct_messages / realtime</span>
            <h1 className="poster-title font-display text-4xl leading-none text-text sm:text-5xl">Сообщения</h1>
          </div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-4 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text-soft transition hover:border-border-strong hover:bg-surface-3/80 hover:text-text"
            onClick={() => setDirectoryOpen((isOpen) => !isOpen)}
            type="button"
          >
            <MessageSquarePlus size={16} strokeWidth={1.8} />
            новый чат
          </button>
        </div>
      ) : null}

      <Panel className={['overflow-hidden', expanded ? 'min-h-[620px]' : ''].join(' ')}>
        <div className="border-b border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-ui text-lg font-bold text-text">Диалоги</h2>
            {!expanded ? (
              <IconButton active={directoryOpen} icon={MessageSquarePlus} label="Новый чат" onClick={() => setDirectoryOpen((isOpen) => !isOpen)} />
            ) : null}
          </div>
          <label className="flex items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text-soft">
            <Search size={15} strokeWidth={1.8} />
            <input
              className="w-full border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск диалога"
              type="search"
              value={query}
            />
          </label>

          {directoryOpen ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {availablePeople.length > 0 ? (
                availablePeople.map((person) => (
                  <button
                    className="flex items-center gap-3 rounded-sqd-xs border border-border bg-surface-2/70 p-3 text-left transition hover:border-border-strong hover:bg-surface-3/80"
                    key={person.id}
                    onClick={() => createChat(person)}
                    type="button"
                  >
                    <Avatar active={person.status === 'online'} image={person.avatarImage} label={person.avatar} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-ui text-sm font-bold text-text">{person.name}</span>
                      <span className="block font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">@{person.userId}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="rounded-sqd-xs border border-border bg-surface-2/70 p-3 text-sm text-text-soft">
                  Нет доступных участников для нового диалога.
                </p>
              )}
            </div>
          ) : null}

          {error ? <p className="mt-3 rounded-sqd-xs border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{error}</p> : null}
        </div>

        <div className={['grid', expanded ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : 'sm:grid-cols-[190px_minmax(0,1fr)]'].join(' ')}>
          <div className="grid max-h-[520px] content-start overflow-y-auto border-border lg:border-r">
            {loading ? (
              <p className="p-4 text-sm text-text-soft">Загружаем диалоги...</p>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => {
                const participant = getParticipant(conversation, people);

                if (!participant) {
                  return null;
                }

                return (
                  <button
                    className={[
                      'flex min-w-0 items-center gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0',
                      activeId === conversation.id ? 'bg-accent-soft text-text shadow-[inset_3px_0_0_var(--color-positive)]' : 'bg-transparent hover:bg-white/[0.025]',
                    ].join(' ')}
                    key={conversation.id}
                    onClick={() => selectConversation(conversation.id)}
                    type="button"
                  >
                    <Avatar active={participant.status === 'online'} image={participant.avatarImage} label={participant.avatar} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-ui text-sm font-bold text-text">{participant.name}</span>
                      <span className={['block truncate text-xs', activeId === conversation.id ? 'text-text-soft' : 'text-muted'].join(' ')}>
                        {conversation.message}
                      </span>
                    </span>
                    {conversation.unread ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full border border-positive/45 bg-positive-soft px-1 font-mono text-[0.6rem] text-positive">
                        {conversation.unread}
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="p-4 text-sm text-text-soft">Диалогов пока нет. Создайте первый чат.</p>
            )}
          </div>

          <div className="flex min-h-[520px] min-w-0 flex-col p-4">
            {activeParticipant ? (
              <>
                <div className="mb-4 flex items-center gap-3 rounded-sqd-sm border border-border bg-surface-2/60 p-3">
                  <Avatar active={activeParticipant.status === 'online'} image={activeParticipant.avatarImage} label={activeParticipant.avatar} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-ui text-base font-bold text-text">{activeParticipant.name}</p>
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
                      @{activeParticipant.userId} / {activeParticipant.status}
                    </p>
                  </div>
                </div>

                <div
                  className="messages-scroll flex-1 overflow-y-auto pr-1"
                  onScroll={() => {
                    shouldAutoScrollRef.current = shouldStickToBottom(messagesListRef.current);
                  }}
                  ref={messagesListRef}
                >
                  <div className="grid min-h-full content-end gap-2 py-1">
                    {activeMessages.length > 0 ? (
                      activeMessages.map((message) => {
                        const own = message.authorId === currentUserId;
                        return (
                          <div
                            className={[
                              'message-bubble max-w-[85%] rounded-sqd-sm border px-3 py-2 text-sm leading-5',
                              own ? 'message-bubble--own ml-auto border-border-strong bg-accent-soft text-text' : 'border-border bg-surface-2/70 text-text-soft',
                            ].join(' ')}
                            key={message.id}
                          >
                            <p>{message.body}</p>
                            <p className="mt-1 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted">{message.time}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="rounded-sqd-sm border border-border bg-surface-2/70 p-3 text-sm text-text-soft">
                        Сообщений пока нет. Начните диалог.
                      </p>
                    )}
                  </div>
                </div>

                <form className="mt-4 flex gap-2" onSubmit={handleSend}>
                  <input
                    className="min-w-0 flex-1 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-border-strong"
                    disabled={sending}
                    maxLength={1000}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Сообщение"
                    value={draft}
                  />
                  <IconButton active={Boolean(draft.trim()) && !sending} disabled={sending} icon={SendHorizonal} label="Отправить" type="submit" />
                </form>
              </>
            ) : (
              <p className="rounded-sqd-sm border border-border bg-surface-2/70 p-4 text-sm text-text-soft">
                Выберите диалог или создайте новый чат.
              </p>
            )}
          </div>
        </div>
      </Panel>
    </section>
  );
}
