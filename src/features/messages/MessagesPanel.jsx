import { ArrowLeft, Flag, MessageSquarePlus, Pencil, Search, SendHorizonal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createDirectConversation,
  deleteDirectMessage,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendDirectMessage,
  updateDirectMessage,
} from '../../shared/api/socialApi.js';
import { supabase } from '../../shared/lib/supabase.js';
import Avatar from '../../shared/ui/Avatar.jsx';
import ConfirmDialog from '../../shared/ui/ConfirmDialog.jsx';
import IconButton from '../../shared/ui/IconButton.jsx';
import Panel from '../../shared/ui/Panel.jsx';

function getParticipant(conversation, people) {
  return people.find((person) => person.id === conversation.participantId) || conversation.participant;
}

function shouldStickToBottom(element) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

const MESSAGE_DRAFT_STORAGE_KEY = 'sqd:messages:draft';

const getMessageDraftStorageKey = (userId, conversationId) => {
  if (!userId || !conversationId) {
    return null;
  }

  return `${MESSAGE_DRAFT_STORAGE_KEY}:${userId}:${conversationId}`;
};

const readStoredMessageDraft = (storageKey) => {
  if (!storageKey) {
    return '';
  }

  try {
    return window.localStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
};

const writeStoredMessageDraft = (storageKey, value) => {
  if (!storageKey) {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(storageKey, value);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // Draft persistence is optional; messaging must keep working if storage is unavailable.
  }
};

export default function MessagesPanel({
  currentUser,
  expanded = false,
  onConversationPathChange,
  onOpenProfile,
  onPreferredConversationHandled,
  onReport,
  people = [],
  preferredConversationId = null,
}) {
  const [activeId, setActiveId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [draft, setDraft] = useState({ storageKey: null, value: '' });
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState('');
  const [hasMoreByConversation, setHasMoreByConversation] = useState({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [query, setQuery] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messageActionError, setMessageActionError] = useState('');
  const [sendError, setSendError] = useState('');
  const [busyMessageId, setBusyMessageId] = useState(null);
  const [confirmMessageId, setConfirmMessageId] = useState(null);
  const currentUserId = currentUser?.id;
  const activeIdRef = useRef(activeId);
  const messageInputRef = useRef(null);
  const reloadTimerRef = useRef(null);
  const messagesListRef = useRef(null);
  const pendingScrollBehaviorRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const preferredConversationIdRef = useRef(preferredConversationId);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    preferredConversationIdRef.current = preferredConversationId;

    if (preferredConversationId !== null) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      setActiveId(null);
      setDraft({ storageKey: null, value: '' });
      setEditingMessageId(null);
      setEditingMessageDraft('');
      setMessageActionError('');
      setSendError('');
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [preferredConversationId]);

  const scrollMessagesToBottom = useCallback((behavior = 'smooth') => {
    const element = messagesListRef.current;

    if (!element) {
      pendingScrollBehaviorRef.current = behavior;
      return;
    }

    element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  const requestScrollMessagesToBottom = useCallback((behavior = 'smooth') => {
    pendingScrollBehaviorRef.current = behavior;
  }, []);

  const loadConversations = useCallback(async ({ keepActive = true } = {}) => {
    if (!currentUserId) {
      return [];
    }

    try {
      setError('');
      const items = await fetchConversations(currentUserId);
      const routeConversationId = preferredConversationIdRef.current;
      const preferredExists = routeConversationId && items.some((item) => item.id === routeConversationId);
      setConversations(items);
      setActiveId((currentActiveId) => {
        if (preferredExists) {
          return routeConversationId;
        }

        if (routeConversationId && !preferredExists) {
          return null;
        }

        if (keepActive && currentActiveId && items.some((item) => item.id === currentActiveId)) {
          return currentActiveId;
        }

        return null;
      });
      if (preferredExists) {
        onPreferredConversationHandled?.();
      } else if (routeConversationId) {
        onConversationPathChange?.(null);
      }
      return items;
    } catch (loadError) {
      setError(loadError.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUserId, onConversationPathChange, onPreferredConversationHandled]);

  const loadMessages = useCallback(async (conversationId, { appendOlder = false, before, markRead = false, scroll = false } = {}) => {
    if (!conversationId) {
      return [];
    }

    try {
      setError('');
      const result = await fetchMessages(conversationId, { before });
      setHasMoreByConversation((items) => ({ ...items, [conversationId]: result.hasMore }));
      setMessagesByConversation((items) => ({
        ...items,
        [conversationId]: appendOlder ? [...result.messages, ...(items[conversationId] ?? [])] : result.messages,
      }));

      if (markRead) {
        await markConversationRead({ conversationId, currentUserId: currentUserId });
      }

      if (scroll) {
        requestScrollMessagesToBottom('auto');
      }

      return result.messages;
    } catch (loadError) {
      setError(loadError.message);
      return [];
    }
  }, [currentUserId, requestScrollMessagesToBottom]);

  useEffect(() => {
    void Promise.resolve().then(() => loadConversations({ keepActive: true }));
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    onConversationPathChange?.(activeId);

    shouldAutoScrollRef.current = true;
    void Promise.resolve().then(async () => {
      await loadMessages(activeId, { markRead: true, scroll: true });
      await loadConversations({ keepActive: true });
    });
  }, [activeId, loadConversations, loadMessages, onConversationPathChange]);

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
            requestScrollMessagesToBottom('smooth');
          }
        }
      }, 300);
    };

    const channel = supabase
      .channel(`default-sqd-messages-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_conversations' }, () => scheduleRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_conversation_members' }, () => scheduleRefresh())
      .subscribe();

    return () => {
      window.clearTimeout(reloadTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadConversations, loadMessages, requestScrollMessagesToBottom]);

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

  const activeConversation = activeId ? conversations.find((conversation) => conversation.id === activeId) : null;
  const activeParticipant = activeConversation ? getParticipant(activeConversation, people) : null;
  const draftStorageKey = useMemo(() => getMessageDraftStorageKey(currentUserId, activeConversation?.id), [activeConversation?.id, currentUserId]);
  const draftValue = draft.storageKey === draftStorageKey ? draft.value : readStoredMessageDraft(draftStorageKey);
  const activeMessages = useMemo(
    () => (activeConversation ? messagesByConversation[activeConversation.id] ?? [] : []),
    [activeConversation, messagesByConversation],
  );
  const hasOlderMessages = activeConversation ? Boolean(hasMoreByConversation[activeConversation.id]) : false;

  useLayoutEffect(() => {
    const behavior = pendingScrollBehaviorRef.current;

    if (behavior) {
      scrollMessagesToBottom(behavior);
      pendingScrollBehaviorRef.current = null;
      shouldAutoScrollRef.current = false;
      return;
    }

    if (shouldAutoScrollRef.current) {
      scrollMessagesToBottom('auto');
      shouldAutoScrollRef.current = false;
    }
  }, [activeConversation?.id, activeMessages, scrollMessagesToBottom]);

  const resetComposerState = () => {
    setDraft({ storageKey: null, value: '' });
    setEditingMessageId(null);
    setEditingMessageDraft('');
    setMessageActionError('');
    setSendError('');
    setBusyMessageId(null);
    setConfirmMessageId(null);
  };

  const closeActiveConversation = () => {
    setActiveId(null);
    resetComposerState();
    onConversationPathChange?.(null);
  };

  const createChat = async (person) => {
    try {
      setError('');
      resetComposerState();
      shouldAutoScrollRef.current = true;
      const id = await createDirectConversation(currentUserId, person.id);
      setActiveId(id);
      onConversationPathChange?.(id);
      setDirectoryOpen(false);
      await loadConversations({ keepActive: true });
      await loadMessages(id, { markRead: true, scroll: true });
    } catch (createError) {
      setError(createError.message);
    }
  };

  const selectConversation = (conversationId) => {
    resetComposerState();
    shouldAutoScrollRef.current = true;
    setActiveId(conversationId);
    onConversationPathChange?.(conversationId);
    setDirectoryOpen(false);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = draftValue.trim();

    if (!text || !activeConversation || sending) {
      return;
    }

    const temporaryId = `pending-message-${Date.now()}`;
    const temporaryMessage = {
      id: temporaryId,
      authorId: currentUserId,
      body: text,
      pending: true,
      time: 'отправляется',
    };
    const previousMessages = messagesByConversation[activeConversation.id] ?? [];

    try {
      setSending(true);
      setError('');
      setSendError('');
      setMessageActionError('');
      shouldAutoScrollRef.current = true;
      requestScrollMessagesToBottom('smooth');
      setDraft({ storageKey: draftStorageKey, value: '' });
      writeStoredMessageDraft(draftStorageKey, '');
      setMessagesByConversation((items) => ({ ...items, [activeConversation.id]: [...previousMessages, temporaryMessage] }));
      const result = await sendDirectMessage({ conversationId: activeConversation.id, currentUserId: currentUserId, text });
      setMessagesByConversation((items) => ({ ...items, [activeConversation.id]: result.messages }));
      setHasMoreByConversation((items) => ({ ...items, [activeConversation.id]: result.hasMore }));
      await loadConversations({ keepActive: true });
    } catch (sendError) {
      setSendError(sendError.message);
      setMessagesByConversation((items) => ({
        ...items,
        [activeConversation.id]: [
          ...previousMessages,
          {
            ...temporaryMessage,
            failed: true,
            pending: false,
            time: 'не отправлено',
          },
        ],
      }));
    } finally {
      setSending(false);
      messageInputRef.current?.focus({ preventScroll: true });
    }
  };

  const loadOlderMessages = async () => {
    if (!activeConversation || loadingOlder || activeMessages.length === 0) {
      return;
    }

    try {
      setLoadingOlder(true);
      setMessageActionError('');
      await loadMessages(activeConversation.id, {
        appendOlder: true,
        before: activeMessages[0].createdAt,
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const startEditMessage = (message) => {
    setEditingMessageId(message.id);
    setEditingMessageDraft(message.body);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageDraft('');
  };

  const saveMessageEdit = async (messageId) => {
    const text = editingMessageDraft.trim();

    if (!text || !activeConversation || busyMessageId) {
      return;
    }

    const previousMessages = messagesByConversation[activeConversation.id] ?? [];

    try {
      setBusyMessageId(messageId);
      setMessageActionError('');
      setMessagesByConversation((items) => ({
        ...items,
        [activeConversation.id]: previousMessages.map((message) => (message.id === messageId ? { ...message, body: text, edited: true, pending: true } : message)),
      }));
      const result = await updateDirectMessage({ conversationId: activeConversation.id, currentUserId, messageId, text });
      setMessagesByConversation((items) => ({ ...items, [activeConversation.id]: result.messages }));
      setHasMoreByConversation((items) => ({ ...items, [activeConversation.id]: result.hasMore }));
      cancelEditMessage();
      await loadConversations({ keepActive: true });
    } catch (updateError) {
      setMessagesByConversation((items) => ({ ...items, [activeConversation.id]: previousMessages }));
      setMessageActionError(updateError.message);
    } finally {
      setBusyMessageId(null);
    }
  };

  const removeMessage = (messageId) => {
    if (!activeConversation || busyMessageId) {
      return;
    }

    setConfirmMessageId(messageId);
  };

  const confirmRemoveMessage = async () => {
    if (!activeConversation || !confirmMessageId || busyMessageId) {
      return;
    }

    const messageId = confirmMessageId;
    const previousMessages = messagesByConversation[activeConversation.id] ?? [];

    try {
      setBusyMessageId(messageId);
      setMessageActionError('');
      setMessagesByConversation((items) => ({
        ...items,
        [activeConversation.id]: previousMessages.filter((message) => message.id !== messageId),
      }));
      const result = await deleteDirectMessage({ conversationId: activeConversation.id, currentUserId, messageId });
      setMessagesByConversation((items) => ({ ...items, [activeConversation.id]: result.messages }));
      setHasMoreByConversation((items) => ({ ...items, [activeConversation.id]: result.hasMore }));
      await loadConversations({ keepActive: true });
      setConfirmMessageId(null);
    } catch (deleteError) {
      setMessagesByConversation((items) => ({ ...items, [activeConversation.id]: previousMessages }));
      setMessageActionError(deleteError.message);
    } finally {
      setBusyMessageId(null);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const handleDraftChange = (event) => {
    const value = event.target.value;
    setDraft({ storageKey: draftStorageKey, value });
    writeStoredMessageDraft(draftStorageKey, value);
  };

  return (
    <section className="messages-section min-w-0">
      {expanded ? (
        <div className="messages-page-head mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="poster-title font-display text-4xl leading-none text-text sm:text-5xl">Сообщения</h1>
          </div>
          <button
            className="messages-page-new-chat inline-flex h-10 items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-4 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text-soft transition hover:border-border-strong hover:bg-surface-3/80 hover:text-text"
            onClick={() => setDirectoryOpen((isOpen) => !isOpen)}
            type="button"
          >
            <MessageSquarePlus size={16} strokeWidth={1.8} />
            новый чат
          </button>
        </div>
      ) : null}

      <Panel className={['messages-panel overflow-hidden', expanded ? 'messages-panel--expanded lg:min-h-[620px]' : ''].join(' ')}>
        <div className="messages-sidebar-header border-b border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-ui text-lg font-bold text-text">Диалоги</h2>
            {expanded ? (
              <button
                aria-label="Новый чат"
                aria-pressed={directoryOpen}
                className="messages-sidebar-new-chat inline-flex h-9 shrink-0 items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-3 font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-text-soft transition hover:border-border-strong hover:bg-surface-3/80 hover:text-text sm:hidden"
                onClick={() => setDirectoryOpen((isOpen) => !isOpen)}
                title="Новый чат"
                type="button"
              >
                <MessageSquarePlus size={15} strokeWidth={1.8} />
                <span>новый чат</span>
              </button>
            ) : (
              <IconButton active={directoryOpen} icon={MessageSquarePlus} label="Новый чат" onClick={() => setDirectoryOpen((isOpen) => !isOpen)} />
            )}
          </div>
          <label className="flex items-center gap-2 rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-text-soft">
            <Search size={15} strokeWidth={1.8} />
            <input
              className="w-full border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted"
              name="conversation-search"
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
                    <Avatar active={person.isOnline} image={person.avatarImage} label={person.avatar} size="sm" />
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

        <div className={['messages-layout grid', expanded ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : 'sm:grid-cols-[190px_minmax(0,1fr)]'].join(' ')}>
          <div className={[
            'messages-conversation-list grid max-h-[520px] content-start overflow-y-auto border-border lg:border-r',
            activeParticipant ? 'messages-conversation-list--has-active' : '',
          ].join(' ')}>
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
                    <Avatar active={participant.isOnline} image={participant.avatarImage} label={participant.avatar} size="sm" />
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

          <div className={[
            'messages-chat flex min-h-[520px] min-w-0 flex-col p-4',
            activeParticipant ? 'messages-chat--active' : '',
          ].join(' ')}>
            {activeParticipant ? (
              <>
                <div className="messages-chat-header mb-4 flex items-center gap-3 rounded-sqd-sm border border-border bg-surface-2/60 p-3">
                  <button
                    aria-label="Назад к диалогам"
                    className="messages-back-button grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface-2/80 text-text-soft shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:border-border-strong hover:bg-accent-soft hover:text-text sm:hidden"
                    onClick={closeActiveConversation}
                    type="button"
                  >
                    <ArrowLeft size={19} strokeWidth={2} />
                  </button>
                  <button
                    aria-label={`Открыть профиль ${activeParticipant.name}`}
                    className="rounded-sqd-sm text-left transition hover:opacity-85"
                    onClick={() => onOpenProfile?.(activeParticipant.id)}
                    type="button"
                  >
                    <Avatar active={activeParticipant.isOnline} image={activeParticipant.avatarImage} label={activeParticipant.avatar} size="sm" />
                  </button>
                  <div className="min-w-0">
                    <button
                      className="max-w-full truncate font-ui text-base font-bold text-text transition hover:text-text-soft"
                      onClick={() => onOpenProfile?.(activeParticipant.id)}
                      type="button"
                    >
                      {activeParticipant.name}
                    </button>
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
                    {hasOlderMessages ? (
                      <button
                        className="justify-self-center rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm text-text-soft transition hover:border-border-strong hover:text-text disabled:opacity-50"
                        disabled={loadingOlder}
                        onClick={loadOlderMessages}
                        type="button"
                      >
                        {loadingOlder ? 'Загружаем...' : 'Показать старые сообщения'}
                      </button>
                    ) : null}
                    {activeMessages.length > 0 ? (
                      activeMessages.map((message) => {
                        const own = message.authorId === currentUserId;
                        const editing = editingMessageId === message.id;
                        const busy = busyMessageId === message.id;
                        return (
                          <div
                            className={[
                              'message-bubble group max-w-[85%] rounded-sqd-sm border px-3 py-2 text-sm leading-5',
                              own ? 'message-bubble--own ml-auto border-border-strong bg-accent-soft text-text' : 'border-border bg-surface-2/70 text-text-soft',
                              message.failed ? 'border-warning/50 bg-warning/10 text-warning' : '',
                            ].join(' ')}
                            key={message.id}
                          >
                            {editing ? (
                              <div className="grid gap-2">
                                <textarea
                                  className="min-h-20 resize-none rounded-sqd-xs border border-border bg-bg-soft/75 px-3 py-2 text-sm leading-5 text-text outline-none focus:border-border-strong"
                                  disabled={busy}
                                  maxLength={1000}
                                  name="message-edit-body"
                                  onChange={(event) => setEditingMessageDraft(event.target.value)}
                                  value={editingMessageDraft}
                                />
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className="min-h-10 rounded-sqd-xs border border-border-strong bg-accent-soft px-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text disabled:opacity-50"
                                    disabled={!editingMessageDraft.trim() || busy}
                                    onClick={() => saveMessageEdit(message.id)}
                                    type="button"
                                  >
                                    {busy ? 'сохраняем...' : 'сохранить'}
                                  </button>
                                  <button
                                    className="min-h-10 rounded-sqd-xs border border-border bg-surface-2/70 px-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-soft hover:border-border-strong hover:text-text disabled:opacity-50"
                                    disabled={busy}
                                    onClick={cancelEditMessage}
                                    type="button"
                                  >
                                    отменить
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="whitespace-pre-wrap">{message.body}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <p className="font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted">
                                    {message.pending ? 'отправляется' : message.time}
                                    {message.edited && !message.pending ? ' / изменено' : ''}
                                  </p>
                                  {!message.pending && !message.failed ? (
                                    <span className="ml-auto inline-flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                                      {own ? (
                                        <button
                                          aria-label="Редактировать сообщение"
                                        className="grid size-10 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-muted transition hover:border-border-strong hover:text-text disabled:opacity-50 sm:size-8"
                                        disabled={Boolean(busyMessageId)}
                                        onClick={() => startEditMessage(message)}
                                        type="button"
                                      >
                                        <Pencil size={14} strokeWidth={1.8} />
                                      </button>
                                      ) : null}
                                      {own ? (
                                        <button
                                          aria-label="Удалить сообщение"
                                          className="grid size-10 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-muted transition hover:border-warning/60 hover:text-warning disabled:opacity-50 sm:size-8"
                                          disabled={Boolean(busyMessageId)}
                                          onClick={() => removeMessage(message.id)}
                                          type="button"
                                        >
                                          <Trash2 size={14} strokeWidth={1.8} />
                                        </button>
                                      ) : (
                                        <button
                                          aria-label="Пожаловаться на сообщение"
                                          className="grid size-10 place-items-center rounded-sqd-xs border border-border bg-surface-2/70 text-muted transition hover:border-warning/60 hover:text-warning disabled:opacity-50 sm:size-8"
                                          disabled={Boolean(busyMessageId)}
                                          onClick={() => onReport?.({ messageId: message.id, targetLabel: `сообщение ${activeParticipant?.name || ''}`, targetUserId: message.authorId })}
                                          type="button"
                                        >
                                          <Flag size={14} strokeWidth={1.8} />
                                        </button>
                                      )}
                                    </span>
                                  ) : null}
                                </div>
                              </>
                            )}
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

                <form className="messages-composer mt-4 grid gap-2" onSubmit={handleSend}>
                  <div className="flex gap-2">
                    <textarea
                      className="max-h-36 min-h-10 min-w-0 flex-1 resize-none rounded-sqd-xs border border-border bg-surface-2/70 px-3 py-2 text-sm leading-5 text-text outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-60"
                      aria-disabled={sending}
                      maxLength={1000}
                      name="message-body"
                      onChange={handleDraftChange}
                      onKeyDown={handleComposerKeyDown}
                      placeholder="Сообщение"
                      readOnly={sending}
                      ref={messageInputRef}
                      rows={1}
                      value={draftValue}
                    />
                    <IconButton active={Boolean(draftValue.trim()) && !sending} disabled={!draftValue.trim() || sending} icon={SendHorizonal} label="Отправить" type="submit">
                      {sending ? '...' : null}
                    </IconButton>
                  </div>
                  {sendError ? (
                    <p className="rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                      Не удалось отправить: {sendError}
                    </p>
                  ) : null}
                  {messageActionError ? (
                    <p className="rounded-sqd-xs border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                      {messageActionError}
                    </p>
                  ) : null}
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
      <ConfirmDialog
        busy={Boolean(busyMessageId)}
        confirmLabel="Удалить"
        description="Сообщение будет удалено без восстановления."
        onCancel={() => setConfirmMessageId(null)}
        onConfirm={confirmRemoveMessage}
        open={Boolean(confirmMessageId)}
        title="Удалить сообщение?"
      />
    </section>
  );
}
