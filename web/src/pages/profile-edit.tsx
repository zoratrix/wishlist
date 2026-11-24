import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch, ApiError, errorMessage } from '../lib/api';
import type { AuthResponse, ProfileUpdatePayload, UserSelfDTO } from '../lib/types';
import { dayOptions, monthOptions } from '../lib/format';
import { AvatarUpload } from '../components/avatar-upload';
import { Button, buttonClasses } from '../components/button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../components/field';
import { Notice } from '../components/notice';
import { meQueryKey, useAuth } from '../hooks/use-auth';

/** Панель в необруталистском стиле: 2px рамка + жёсткая тень. */
const panel = 'rounded-2xl border border-line bg-card';

const legendClass = 'px-1 text-sm font-semibold tracking-wide text-ink';

function ProfileForm({ user }: { user: UserSelfDTO }) {
 const queryClient = useQueryClient();

 const [displayName, setDisplayName] = useState(user.displayName);
 const [bio, setBio] = useState(user.bio ?? '');
 const [birthMonth, setBirthMonth] = useState(user.birthMonth ? String(user.birthMonth) : '');
 const [birthDay, setBirthDay] = useState(user.birthDay ? String(user.birthDay) : '');
 const [birthYear, setBirthYear] = useState(user.birthYear ? String(user.birthYear) : '');
 const [showBirthYear, setShowBirthYear] = useState(user.showBirthYear);
 const [isProfilePublic, setIsProfilePublic] = useState(user.isProfilePublic);
 const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
 const [nameError, setNameError] = useState<string | null>(null);

 const saveMutation = useMutation<AuthResponse, ApiError, ProfileUpdatePayload>({
 mutationFn: (payload) => apiPatch<AuthResponse>('/me/profile', payload),
 onSuccess: (data) => {
 queryClient.setQueryData(meQueryKey, { user: data.user });
 void queryClient.invalidateQueries({ queryKey: meQueryKey });
 setNotice({ kind: 'success', text: 'Профиль сохранён.' });
 },
 onError: (error) => setNotice({ kind: 'error', text: errorMessage(error) }),
 });

 function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setNotice(null);

 if (displayName.trim() === '') {
 setNameError('Введите имя — его увидят гости.');
 return;
 }
 setNameError(null);

 const year = birthYear.trim() === '' ? null : Number(birthYear);
 if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) {
 setNotice({ kind: 'error', text: 'Год рождения укажите числом, например 1992.' });
 return;
 }

 saveMutation.mutate({
 displayName: displayName.trim(),
 bio: bio.trim() === '' ? null : bio.trim(),
 birthMonth: birthMonth === '' ? null : Number(birthMonth),
 birthDay: birthDay === '' ? null : Number(birthDay),
 birthYear: year,
 showBirthYear,
 isProfilePublic,
 });
 }

 const month = birthMonth === '' ? null : Number(birthMonth);
 const days = dayOptions(month);

 return (
 <div>
 <Link to="/app/profile" className={[buttonClasses('secondary', 'sm'), 'inline-flex'].join(' ')}>
 ← К профилю
 </Link>
 <h1 className="mt-3 text-3xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-4xl">
 Редактирование профиля
 </h1>
 <p className="mt-2 text-sm font-medium text-muted">Как вас видят гости и что видно другим.</p>

 <div className="mt-5">
 <AvatarUpload user={user} />
 </div>

 <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
 {notice ? (
 <Notice kind={notice.kind} onClose={() => setNotice(null)}>
 {notice.text}
 </Notice>
 ) : null}

 <div className={`${panel} p-4`}>
 <p className="text-sm font-semibold tracking-wide text-ink">Email</p>
 <p className="mt-1 break-all text-sm font-semibold text-ink">{user.email}</p>
 <p className="mt-1 text-xs font-medium text-muted">
 Email не показывается другим. Смена email появится позже.
 </p>
 </div>

 <div className={`${panel} space-y-4 p-4`}>
 <TextField
 label="Имя"
 value={displayName}
 maxLength={100}
 onChange={(event) => setDisplayName(event.target.value)}
 hint="Так вас увидят гости вишлистов."
 error={nameError}
 />

 <TextAreaField
 label="О себе"
 value={bio}
 rows={3}
 maxLength={300}
 onChange={(event) => setBio(event.target.value)}
 placeholder="Пара слов о себе — необязательно"
 />
 </div>

 <fieldset className={`${panel} p-4`}>
 <legend className={legendClass}>Дата рождения</legend>
 <p className="text-xs font-medium text-muted">
 Нужна для напоминаний. Год можно скрыть.
 </p>
 <div className="mt-3 grid grid-cols-2 gap-3">
 <SelectField
 label="Месяц"
 value={birthMonth}
 onChange={(event) => {
 const value = event.target.value;
 setBirthMonth(value);
 const limit = dayOptions(value === '' ? null : Number(value)).length;
 if (birthDay !== '' && Number(birthDay) > limit) {
 setBirthDay('');
 }
 }}
 >
 <option value="">Не указывать</option>
 {monthOptions().map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </SelectField>

 <SelectField
 label="День"
 value={birthDay}
 onChange={(event) => setBirthDay(event.target.value)}
 disabled={birthMonth === ''}
 >
 <option value="">Не указывать</option>
 {days.map((day) => (
 <option key={day} value={day}>
 {day}
 </option>
 ))}
 </SelectField>
 </div>

 <TextField
 className="mt-4"
 label="Год"
 type="number"
 inputMode="numeric"
 min="1900"
 max={new Date().getFullYear()}
 value={birthYear}
 onChange={(event) => setBirthYear(event.target.value)}
 placeholder="Необязательно"
 hint="Например, 1992."
 />

 <CheckboxField
 className="mt-3"
 label="Показывать год рождения"
 hint="Если выключено, гости увидят только день и месяц."
 checked={showBirthYear}
 onChange={setShowBirthYear}
 />
 </fieldset>

 <fieldset className={`${panel} p-4`}>
 <legend className={legendClass}>Приватность</legend>
 <CheckboxField
 label="Публичный профиль"
 hint="Если выключено, профиль виден только вам. Списки по ссылке работают всегда."
 checked={isProfilePublic}
 onChange={setIsProfilePublic}
 />
 </fieldset>

 <Button type="submit" className="w-full" loading={saveMutation.isPending}>
 Сохранить профиль
 </Button>
 </form>
 </div>
 );
}

export default function ProfileEditPage() {
 const { user } = useAuth();

 // Защищённый маршрут гарантирует вход; страховка для типов.
 if (!user) {
 return null;
 }

 return (
 <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 md:px-6 md:pt-6">
 <ProfileForm key={user.id} user={user} />
 </div>
 );
}
