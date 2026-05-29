import { MessageSquarePlus, Search, SendHorizonal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function MessagesPanel({ currentUser, expanded = false, people = [] }) {
  const [activeId, setActiveId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [draft, setDraft] = useState('');
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [query, setQuery] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async () => {
    if (!currentUser?.id) {
      return;
    }

    try {
      setError('');
      const items = await fetchConversations(currentUser.id);
      setConversations(items);
      setActiveId((currentActiveId) => currentActiveId || items[0]?.id || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  const loadActiveMessages = useCallback(async (conversationId = activeId) => {
    if (!conversationId) {
      return;
    }

    try {
      setError('');
      const messages = await fetchMessages(conversationId);
      setMessagesByConversation((items) => ({ ...items, [conversationId]: messages }));
      await markConversationRead({ conversationId, currentUserId: currentUser.id });
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [activeId, currentUser.id]);

  useEffect(() => {
    void Promise.resolve().then(loadConversations);
  }, [loadConversations]);

  useEffect(() => {
    if (!currentUser?.id) {
      return undefined;
    }

    const reloadMessages = () => {
      void loadConversations();
      void loadActiveMessages();
    };

    const channel = supabase
      .channel(`default-sqd-messages-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_conversation_members' }, reloadMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, reloadMessages)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, loadActiveMessages, loadConversations]);

  useEffect(() => {
    if (!activeId || messagesByConversation[activeId]) {
      return;
    }

    void Promise.resolve().then(() => loadActiveMessages(activeId));
  }, [activeId, loadActiveMessages, messagesByConversation]);

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
    return people.filter((person) => person.id !== currentUser.id && !activeParticipantIds.has(person.id));
  }, [conversations, currentUser.id, people]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const activeParticipant = activeConversation ? getParticipant(activeConversation, people) : null;
  const activeMessages = activeConversation ? messagesByConversation[activeConversation.id] ?? [] : [];

  const createChat = async (person) => {
    try {
      setError('');
      const id = await createDirectConversation(currentUser.id, person.id);
      setActiveId(id);
      setDirectoryOpen(false);
      await loadConversations();
    } catch (createError) {
      setError(createError.message);
    }
  };

  const selectConversation = async (conversationId) => {
    setActiveId(conversationId);
    try {
      await markConversationRead({ conversationId, currentUserId: currentUser.id });
      await loadConversations();
    } catch (readError) {
      setError(readError.message);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = draft.trim();

    if (!text || !activeConversation) {
      return;
    }

    try {
      setError('');
      const messages = await sendDirectMessage({ conversationId: activeConversation.id, currentUserId: currentUser.id, text });
      setMessagesByConversation((items) => ({ ...items, [activeConversation.id]: messages }));
      setDraft('');
      await loadConversations();
    } catch (sendError) {
      setError(sendError.message);
    }
  };

  return (
    <section className="min-w-0">
      {expanded ? (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="y2k-label mb-2">direct_messages / live</span>
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

        <div className={['grid', expanded ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : 'sm:grid-cols-[190px_minmax(0,1fr)]'].join(' ')}>
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

          <div className="min-w-0 p-4">
            {activeParticipant ? (
              <>
                <div className="mb-4">
                  <div className="min-w-0">
                    <p className="truncate font-ui text-base font-bold text-text">{activeParticipant.name}</p>
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
                      @{activeParticipant.userId} / {activeParticipant.status}
                    </p>
                  </div>
                </div>

                <div className={['grid gap-2 overflow-y-auto pr-1', expanded ? 'max-h-[420px]' : 'max-h-72'].join(' ')}>
                  {activeMessages.length > 0 ? (
                    activeMessages.map((message) => {
                      const own = message.authorId === currentUser.id;
                      return (
                        <div
                          className={[
                            'max-w-[85%] rounded-sqd-sm border px-3 py-2 text-sm leading-5',
                            own ? 'ml-auto border-border-strong bg-accent-soft text-text' : 'border-border bg-surface-2/70 text-text-soft',
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

                <form className="mt-4 flex gap-2" onSubmit={handleSend}>
                  <input
                    className="min-w-0 flex-1 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-border-strong"
                    maxLength={1000}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Сообщение"
                    value={draft}
                  />
                  <IconButton active={Boolean(draft.trim())} icon={SendHorizonal} label="Отправить" type="submit" />
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
