// Smoke-тест реального API (не моков) для проверки MVP.
// Требует запущенного сервера: npm run dev (в другом терминале).
// Запуск: npm run e2e:smoke
// Другой адрес: E2E_BASE=http://127.0.0.1:3001 npm run e2e:smoke
// ВНИМАНИЕ: создаёт тестовые записи в локальной базе.
const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3000';

let passed = 0;
let failed = 0;
const failures = [];
const allBodies = [];

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name} ${extra}`);
    console.log(`  FAIL ${name} ${extra}`);
  }
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  store(response) {
    const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  get(name) {
    return this.cookies.get(name);
  }
}

async function req(jar, method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (jar && jar.header()) headers.Cookie = jar.header();
  if (jar && jar.get('csrf') && method !== 'GET') headers['X-CSRF-Token'] = jar.get('csrf');
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  allBodies.push({ path, status: response.status, body: text });
  if (jar) jar.store(response);
  return { status: response.status, json, text };
}

const unique = Date.now().toString(36);
const owner = new CookieJar();
const guest = new CookieJar();
const ownerEmail = `e2e-owner-${unique}@example.com`;
const ownerUsername = `owner_${unique}`.slice(0, 20);
const guestEmail = `e2e-guest-${unique}@example.com`;

console.log('[1] Регистрация и сессия');
const meBefore = await req(null, 'GET', '/api/auth/me');
check('me без сессии → user null', meBefore.status === 200 && meBefore.json?.user === null);

const register = await req(owner, 'POST', '/api/auth/register', {
  email: ownerEmail,
  password: 'secret12345',
  displayName: 'Владелец E2E',
  username: ownerUsername,
});
check('регистрация 201', register.status === 201, `status=${register.status}`);
check('выдан sid', Boolean(owner.get('sid')));
check('выдан csrf', Boolean(owner.get('csrf')));

const meAfter = await req(owner, 'GET', '/api/auth/me');
check('me после регистрации', meAfter.status === 200 && meAfter.json?.user?.email === ownerEmail);

console.log('[2] Вишлист и подарки');
const wishlist = await req(owner, 'POST', '/api/me/wishlists', {
  title: 'E2E список',
  description: 'Проверка',
  visibility: 'link',
});
const wishlistId = wishlist.json?.wishlist?.id;
const shareToken = wishlist.json?.wishlist?.shareToken;
check('создание вишлиста 201', wishlist.status === 201 && Boolean(wishlistId), JSON.stringify(wishlist.json));
check(
  'короткая ссылка: токен 7 символов [A-Za-z0-9]',
  typeof shareToken === 'string' && /^[A-Za-z0-9]{7}$/.test(shareToken),
  String(shareToken),
);

const gift1 = await req(owner, 'POST', `/api/me/wishlists/${wishlistId}/gifts`, {
  title: 'Подарок E2E',
  priceMinor: 199900,
  priority: 1,
  links: ['https://example.com/variant-1', 'https://example.com/variant-2'],
});
const giftId = gift1.json?.gift?.id;
check('создание подарка 201', gift1.status === 201 && Boolean(giftId));
check(
  'несколько ссылок сохранены в порядке',
  JSON.stringify(gift1.json?.gift?.links) ===
    JSON.stringify(['https://example.com/variant-1', 'https://example.com/variant-2']),
  JSON.stringify(gift1.json?.gift?.links),
);
check('в ответе нет устаревшего поля url', !('url' in (gift1.json?.gift ?? {})));

const tooManyLinks = await req(owner, 'POST', `/api/me/wishlists/${wishlistId}/gifts`, {
  title: 'Слишком много ссылок',
  links: Array.from({ length: 11 }, (_, i) => `https://example.com/link-${i}`),
});
check('11 ссылок → 400', tooManyLinks.status === 400, `status=${tooManyLinks.status}`);

const patchLinks = await req(owner, 'PATCH', `/api/me/gifts/${giftId}`, {
  links: ['https://example.com/only-one'],
});
check(
  'PATCH links заменяет список',
  patchLinks.status === 200 && patchLinks.json?.gift?.links?.length === 1,
  JSON.stringify(patchLinks.json?.gift?.links),
);

const gift2 = await req(owner, 'POST', `/api/me/wishlists/${wishlistId}/gifts`, { title: 'Второй подарок' });
const gift2Id = gift2.json?.gift?.id;

console.log('[2b] Перевыпуск короткой ссылки');
const relinkWishlist = await req(owner, 'POST', '/api/me/wishlists', {
  title: 'Проверка короткой ссылки',
  visibility: 'link',
});
const relinkId = relinkWishlist.json?.wishlist?.id;
const oldToken = relinkWishlist.json?.wishlist?.shareToken;
check('старый токен нового вишлиста уже короткий', /^[A-Za-z0-9]{7}$/.test(String(oldToken)), String(oldToken));
const relinked = await req(owner, 'POST', `/api/me/wishlists/${relinkId}/share-token`);
const newToken = relinked.json?.wishlist?.shareToken;
check(
  'перевыпуск ссылки: 200 и 7 символов',
  relinked.status === 200 && /^[A-Za-z0-9]{7}$/.test(String(newToken)) && newToken !== oldToken,
  `${relinked.status} ${String(newToken)}`,
);
check('старая ссылка после перевыпуска → 404', (await req(guest, 'GET', `/api/w/${oldToken}`)).status === 404);
check('новая ссылка открывается', (await req(guest, 'GET', `/api/w/${newToken}`)).status === 200);

console.log('[3] Публичный вид и бронирование');
const publicView = await req(guest, 'GET', `/api/w/${shareToken}`);
check('публичный вишлист 200', publicView.status === 200);
check(
  'гость видит ссылки подарка',
  JSON.stringify(publicView.json?.gifts?.[0]?.links) === JSON.stringify(['https://example.com/only-one']),
  JSON.stringify(publicView.json?.gifts?.[0]?.links),
);
check('гость видит 2 подарка', publicView.json?.gifts?.length === 2, String(publicView.json?.gifts?.length));
check('свободный подарок без брони', publicView.json?.gifts?.[0]?.booking === null);
check(
  'viewer гостя: не владелец, не подписан, подписка недоступна',
  publicView.json?.viewer?.isSelf === false &&
    publicView.json?.viewer?.isFollowing === false &&
    publicView.json?.viewer?.canFollow === false,
  JSON.stringify(publicView.json?.viewer),
);
const ownerPublicView = await req(owner, 'GET', `/api/w/${shareToken}`);
check(
  'viewer владельца: isSelf = true',
  ownerPublicView.json?.viewer?.isSelf === true && ownerPublicView.json?.viewer?.canFollow === false,
  JSON.stringify(ownerPublicView.json?.viewer),
);

const book = await req(null, 'POST', `/api/w/${shareToken}/gifts/${giftId}/book`, {
  name: 'Мария',
  email: guestEmail,
});
check('бронирование 201', book.status === 201, `status=${book.status} ${JSON.stringify(book.json)}`);
check('в ответе брони нет email', !book.text.includes(guestEmail));

const bookedView = await req(guest, 'GET', `/api/w/${shareToken}`);
const bookedGift = bookedView.json?.gifts?.find((g) => g.id === giftId);
check('гость видит «занят»', bookedGift?.booking?.status === 'booked');
check('гость не видит имя бронирующего', bookedGift?.booking?.bookerName === undefined);
check('гость не видит email бронирующего', !bookedView.text.includes(guestEmail));

const duplicate = await req(null, 'POST', `/api/w/${shareToken}/gifts/${giftId}/book`, {
  name: 'Другой',
  email: 'other@example.com',
});
check('повторная бронь → 409', duplicate.status === 409, `status=${duplicate.status}`);
check('код GIFT_ALREADY_BOOKED', duplicate.json?.error?.code === 'GIFT_ALREADY_BOOKED');

console.log('[4] Приватность броней для владельца');
const ownerViewHidden = await req(owner, 'GET', `/api/me/wishlists/${wishlistId}`);
const hiddenGift = ownerViewHidden.json?.gifts?.find((g) => g.id === giftId);
check('showBooked=false → booking null', hiddenGift?.booking === null, JSON.stringify(hiddenGift?.booking));

const badNames = await req(owner, 'PATCH', `/api/me/wishlists/${wishlistId}`, { showBookerNames: true });
check('showBookerNames без showBooked → 422', badNames.status === 422, `status=${badNames.status}`);

const toggleBooked = await req(owner, 'PATCH', `/api/me/wishlists/${wishlistId}`, { showBooked: true });
check('включение showBooked', toggleBooked.status === 200, `status=${toggleBooked.status}`);
const ownerViewBooked = await req(owner, 'GET', `/api/me/wishlists/${wishlistId}`);
const shownGift = ownerViewBooked.json?.gifts?.find((g) => g.id === giftId);
check('showBooked=true → бронь видна', shownGift?.booking?.status === 'booked');
check('без showBookerNames имени нет', shownGift?.booking?.bookerName === undefined);

const toggleNames = await req(owner, 'PATCH', `/api/me/wishlists/${wishlistId}`, {
  showBooked: true,
  showBookerNames: true,
});
check('включение имён', toggleNames.status === 200, `status=${toggleNames.status}`);
const ownerViewNamed = await req(owner, 'GET', `/api/me/wishlists/${wishlistId}`);
const namedGift = ownerViewNamed.json?.gifts?.find((g) => g.id === giftId);
check('владелец видит имя', namedGift?.booking?.bookerName === 'Мария');
check('владелец не видит email', !ownerViewNamed.text.includes(guestEmail));

console.log('[5] Отмена брони по email');
const wrongEmail = await req(null, 'POST', `/api/w/${shareToken}/gifts/${giftId}/unbook`, {
  email: 'wrong@example.com',
});
check('чужой email → 400', wrongEmail.status === 400, `status=${wrongEmail.status}`);
check('код UNBOOK_FAILED', wrongEmail.json?.error?.code === 'UNBOOK_FAILED');
check('текст не раскрывает email', !wrongEmail.text.includes(guestEmail));

const correctEmail = await req(null, 'POST', `/api/w/${shareToken}/gifts/${giftId}/unbook`, {
  email: `  ${guestEmail.toUpperCase()}  `,
});
check('свой email (регистр/пробелы) → 200', correctEmail.status === 200, `status=${correctEmail.status}`);

const afterUnbook = await req(guest, 'GET', `/api/w/${shareToken}`);
const freedGift = afterUnbook.json?.gifts?.find((g) => g.id === giftId);
check('подарок снова свободен', freedGift?.booking === null);

console.log('[6] Одновременное бронирование (10 запросов)');
const race = await Promise.all(
  Array.from({ length: 10 }, (_, i) =>
    req(null, 'POST', `/api/w/${shareToken}/gifts/${gift2Id}/book`, {
      name: `Гость ${i}`,
      email: `race${i}-${unique}@example.com`,
    }),
  ),
);
const created = race.filter((r) => r.status === 201).length;
const conflicts = race.filter((r) => r.status === 409).length;
check('ровно одна успешная бронь', created === 1, `created=${created}, conflicts=${conflicts}`);
check('остальные 9 → 409', conflicts === 9, `conflicts=${conflicts}`);

console.log('[7] Статус «уже подарен»');
const markGifted = await req(owner, 'POST', `/api/me/gifts/${gift2Id}/status`, { status: 'gifted' });
check('статус gifted 200', markGifted.status === 200, `status=${markGifted.status}`);
const guestAfterGifted = await req(guest, 'GET', `/api/w/${shareToken}`);
const giftedGift = guestAfterGifted.json?.gifts?.find((g) => g.id === gift2Id);
check('гость видит gifted', giftedGift?.status === 'gifted');
check('бронь закрыта', giftedGift?.booking === null);

const bookGifted = await req(null, 'POST', `/api/w/${shareToken}/gifts/${gift2Id}/book`, {
  name: 'Кто-то',
  email: 'someone@example.com',
});
check('бронь подаренного → 422', bookGifted.status === 422, `status=${bookGifted.status}`);

console.log('[8] Защита чужих данных');
const other = new CookieJar();
const otherUsername = `other_${unique}`.slice(0, 20);
await req(other, 'POST', '/api/auth/register', {
  email: `e2e-other-${unique}@example.com`,
  password: 'secret12345',
  displayName: 'Другой',
  username: otherUsername,
});
const foreignView = await req(other, 'GET', `/api/me/wishlists/${wishlistId}`);
check('чужой вишлист → 404', foreignView.status === 404, `status=${foreignView.status}`);
const foreignDelete = await req(other, 'DELETE', `/api/me/wishlists/${wishlistId}`);
check('чужое удаление → 404', foreignDelete.status === 404, `status=${foreignDelete.status}`);

console.log('[9] Категории (теги) вишлиста');
const categoryA = await req(owner, 'POST', `/api/me/wishlists/${wishlistId}/categories`, {
  name: 'Электроника',
  color: '#5A7BA6',
});
const categoryId = categoryA.json?.category?.id;
check('создание категории 201', categoryA.status === 201 && Boolean(categoryId), JSON.stringify(categoryA.json));
check('цвет категории сохранён', categoryA.json?.category?.color === '#5A7BA6', String(categoryA.json?.category?.color));
const badColor = await req(owner, 'POST', `/api/me/wishlists/${wishlistId}/categories`, {
  name: 'Плохой цвет',
  color: '#12345',
});
check('невалидный цвет → 400', badColor.status === 400, `status=${badColor.status}`);
const recolorCategory = await req(owner, 'PATCH', `/api/me/categories/${categoryId}`, { color: '#6E9B78' });
check(
  'смена цвета категории',
  recolorCategory.status === 200 && recolorCategory.json?.category?.color === '#6E9B78',
  JSON.stringify(recolorCategory.json?.category),
);
const duplicateCategory = await req(owner, 'POST', `/api/me/wishlists/${wishlistId}/categories`, { name: 'Электроника' });
check('дубликат категории → 409', duplicateCategory.status === 409, `status=${duplicateCategory.status}`);
const tagGift = await req(owner, 'PATCH', `/api/me/gifts/${giftId}`, { categoryIds: [categoryId] });
check(
  'назначение категории подарку',
  tagGift.status === 200 && tagGift.json?.gift?.categories?.length === 1,
  JSON.stringify(tagGift.json?.gift?.categories),
);
const publicWithCategories = await req(guest, 'GET', `/api/w/${shareToken}`);
check(
  'гость видит категории списка',
  Array.isArray(publicWithCategories.json?.categories) && publicWithCategories.json.categories.length === 1,
  JSON.stringify(publicWithCategories.json?.categories),
);
const publicGiftCategories = publicWithCategories.json?.gifts?.find((g) => g.id === giftId);
check('гость видит тег подарка', publicGiftCategories?.categories?.[0]?.name === 'Электроника');
check(
  'гость видит цвет категории',
  publicWithCategories.json?.categories?.[0]?.color === '#6E9B78',
  String(publicWithCategories.json?.categories?.[0]?.color),
);
const renamedCategory = await req(owner, 'PATCH', `/api/me/categories/${categoryId}`, { name: 'Техника' });
check(
  'переименование категории',
  renamedCategory.status === 200 && renamedCategory.json?.category?.name === 'Техника',
  JSON.stringify(renamedCategory.json),
);
const clearCategories = await req(owner, 'PATCH', `/api/me/gifts/${giftId}`, { categoryIds: [] });
check('снятие тегов через []', clearCategories.status === 200 && clearCategories.json?.gift?.categories?.length === 0);
await req(owner, 'PATCH', `/api/me/gifts/${giftId}`, { categoryIds: [categoryId] });
const deleteCategory = await req(owner, 'DELETE', `/api/me/categories/${categoryId}`);
check('удаление категории 204', deleteCategory.status === 204, `status=${deleteCategory.status}`);
const afterDeleteGift = await req(owner, 'GET', `/api/me/wishlists/${wishlistId}`);
const giftAfterDelete = afterDeleteGift.json?.gifts?.find((g) => g.id === giftId);
check('после удаления категории тег снят', giftAfterDelete?.categories?.length === 0);

console.log('[10] Подписки и доступ «только подписчикам»');
const followersWishlist = await req(owner, 'POST', '/api/me/wishlists', {
  title: 'Для подписчиков',
  visibility: 'followers',
});
const followersToken = followersWishlist.json?.wishlist?.shareToken;
check('создан followers-вишлист', followersWishlist.status === 201, `status=${followersWishlist.status}`);
const notFollowerView = await req(other, 'GET', `/api/w/${shareToken}`);
check(
  'viewer залогиненного не-подписчика: canFollow = true',
  notFollowerView.json?.viewer?.canFollow === true && notFollowerView.json?.viewer?.isFollowing === false,
  JSON.stringify(notFollowerView.json?.viewer),
);
check(
  'гость не видит followers-список',
  (await req(guest, 'GET', `/api/w/${followersToken}`)).status === 404,
);
const follow = await req(other, 'POST', `/api/users/${ownerUsername}/follow`);
check(
  'подписка на владельца 200',
  follow.status === 200 && follow.json?.isFollowing === true,
  `status=${follow.status}`,
);
const followAgain = await req(other, 'POST', `/api/users/${ownerUsername}/follow`);
check('подписка идемпотентна', followAgain.status === 200 && followAgain.json?.isFollowing === true);
const profileAsFollower = await req(other, 'GET', `/api/users/${ownerUsername}`);
check('viewer.isFollowing = true', profileAsFollower.json?.viewer?.isFollowing === true);
const followerWishlistView = await req(other, 'GET', `/api/w/${followersToken}`);
check('подписчик видит followers-список', followerWishlistView.status === 200);
check(
  'viewer подписчика на followers-списке: isFollowing = true',
  followerWishlistView.json?.viewer?.isFollowing === true &&
    followerWishlistView.json?.viewer?.canFollow === false,
  JSON.stringify(followerWishlistView.json?.viewer),
);
const followersList = await req(owner, 'GET', '/api/me/followers');
check(
  'владелец видит подписчиков без email',
  followersList.status === 200 &&
    Number(followersList.json?.total) >= 1 &&
    !followersList.text.includes('@'),
  `status=${followersList.status}`,
);
const unfollow = await req(other, 'DELETE', `/api/users/${ownerUsername}/follow`);
check('отписка 200', unfollow.status === 200 && unfollow.json?.isFollowing === false);
check(
  'после отписки followers-список → 404',
  (await req(other, 'GET', `/api/w/${followersToken}`)).status === 404,
);

console.log('[11] Email бронирующего не утёк нигде');
const leaks = allBodies.filter((entry) => entry.body.includes(guestEmail));
check('ни в одном ответе API нет email бронирующего', leaks.length === 0, leaks.map((l) => l.path).join(', '));

console.log(`\nИТОГО: пройдено ${passed}, провалено ${failed}`);
if (failed > 0) {
  console.log('Провалы:');
  for (const failure of failures) console.log(' -', failure);
  process.exit(1);
}
