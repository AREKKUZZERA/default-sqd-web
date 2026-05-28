-- Demo data. You can run this after 001_schema.sql.

insert into public.profiles (id, user_id, name, role, avatar, avatar_image, banner_image, status, bio)
values
  ('user_mira_vale', 'mira_vale', 'Mira Vale', 'Product designer', 'MV', '', '', 'online', 'Собираю идеи, прототипы и команды вокруг живых цифровых продуктов.'),
  ('user_nika_storm', 'nika_storm', 'Nika Storm', 'Product thinker', 'NS', '', '', 'online', 'Комнаты, микроблоги и быстрые реакции.'),
  ('user_ray_chen', 'ray_chen', 'Ray Chen', 'Interface designer', 'RC', '', '', 'online', 'Дизайн, ритм интерфейсов и ночные плейлисты.'),
  ('user_ari_sol', 'ari_sol', 'Ari Sol', 'Team ops', 'AS', '', '', 'offline', 'Сообщения, процессы и рабочие пространства.')
on conflict (id) do update set
  user_id = excluded.user_id,
  name = excluded.name,
  role = excluded.role,
  avatar = excluded.avatar,
  avatar_image = excluded.avatar_image,
  banner_image = excluded.banner_image,
  status = excluded.status,
  bio = excluded.bio;

insert into public.posts (id, owner_id, text, media_attached, tags, created_at)
overriding system value
values
  (1, 'user_mira_vale', 'Собираю ленту default squad: посты должны быть быстрыми, ответы видимыми, а профиль нормальным личным архивом. #dark-social', false, array['dark-social', 'microblog'], now() - interval '4 minutes'),
  (2, 'user_nika_storm', 'Новый формат комнат с короткими постами выглядит живее: меньше шума, больше быстрых реакций и нормальный контекст вокруг темы. #microblog', false, array['microblog', 'product'], now() - interval '12 minutes'),
  (3, 'user_ray_chen', 'Собрал плейлист для ночного дизайна интерфейсов. Визуальный ритм решает больше, чем кажется. #interface-culture', false, array['interface-culture', 'design'], now() - interval '36 minutes'),
  (4, 'user_ari_sol', 'Личные сообщения должны ощущаться как рабочее пространство: поиск, список диалогов и быстрый ответ важнее лишней анимации. #team', false, array['team', 'messages'], now() - interval '1 hour')
on conflict (id) do update set
  owner_id = excluded.owner_id,
  text = excluded.text,
  media_attached = excluded.media_attached,
  tags = excluded.tags;

select setval(pg_get_serial_sequence('public.posts', 'id'), greatest((select max(id) from public.posts), 1), true);

insert into public.comments (id, post_id, author_id, text, created_at)
overriding system value
values
  (101, 1, 'user_nika_storm', 'Да, без лишних декоративных блоков.', now() - interval '3 minutes'),
  (102, 1, 'user_ray_chen', 'Главное - быстрый ответ прямо из карточки.', now() - interval '2 minutes'),
  (201, 2, 'user_mira_vale', 'Поддерживаю. Контекст должен быть рядом с постом.', now() - interval '10 minutes')
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.comments', 'id'), greatest((select max(id) from public.comments), 1), true);

insert into public.post_reactions (post_id, user_id, type)
values
  (1, 'user_mira_vale', 'like'),
  (1, 'user_mira_vale', 'bookmark'),
  (2, 'user_mira_vale', 'repost'),
  (3, 'user_mira_vale', 'like'),
  (3, 'user_mira_vale', 'bookmark'),
  (2, 'user_ray_chen', 'like'),
  (2, 'user_ari_sol', 'like'),
  (4, 'user_nika_storm', 'like')
on conflict do nothing;
