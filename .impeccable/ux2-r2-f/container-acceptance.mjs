#!/usr/bin/env node
/**
 * UX2-R2-F — functional acceptance against the real OCI container.
 *
 * Pure HTTP client. It deliberately imports no application module and starts no
 * local server: every request below goes to the running container's published
 * loopback port. Synthetic identities only; no production endpoint is contacted.
 */
const BASE = (process.env.UX2R2F_BASE_URL || '').replace(/\/+$/, '');
const TEACHER = process.env.UX2R2F_TEACHER_EMAIL || 'ux2r2f-teacher@example.test';
const NON_TEACHER = process.env.UX2R2F_NON_TEACHER_EMAIL || 'ux2r2f-outsider@example.test';

if (!BASE) {
  console.error('UX2R2F_BASE_URL is required');
  process.exit(2);
}

const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(path, { method = 'GET', as = null, body, origin = true } = {}) {
  const headers = {};
  if (as) headers['x-test-synthetic-user'] = as;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET' && origin) headers.origin = BASE;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual'
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: response.status, headers: response.headers, text, json };
}

const t = (path, options = {}) => call(path, { as: TEACHER, ...options });

const health = await call('/health');
check('0. health endpoint on container', health.status === 200 && health.json?.status === 'ok',
  `status=${health.status} service=${health.json?.service}`);

/* 1. Authorized teacher principal */
const meTeacher = await t('/api/auth/me');
check('1. authorized synthetic teacher principal accepted', meTeacher.status === 200 && meTeacher.json?.teacherAuthorized === true,
  `status=${meTeacher.status} teacherAuthorized=${meTeacher.json?.teacherAuthorized}`);

/* 2. Authenticated but unauthorized principal rejected */
const meOutsider = await call('/api/auth/me', { as: NON_TEACHER });
const materialListOutsider = await call('/api/materials', { as: NON_TEACHER });
check('2. authenticated non-teacher rejected by teacher API',
  meOutsider.status === 200 && meOutsider.json?.teacherAuthorized === false && materialListOutsider.status === 403,
  `auth/me=${meOutsider.status} teacherAuthorized=${meOutsider.json?.teacherAuthorized} /api/materials=${materialListOutsider.status}`);

/* Synthetic fixture */
const suffix = Date.now().toString(36);
const classroom = (await t('/api/classes', { method: 'POST', body: { name: `4C Informatica — UX2-R2-F ${suffix}`, academicYear: '2026/2027' } })).json?.class;
const subject = (await t('/api/subjects', { method: 'POST', body: { classId: classroom?.id, name: 'Basi di Dati' } })).json?.subject;
const lesson = (await t('/api/lessons', { method: 'POST', body: {
  classId: classroom?.id, subjectId: subject?.id, title: 'Accettazione OCI — UX2-R2-F', date: '2026-11-10', durationMinutes: 60
} })).json?.lesson;
check('fixture. class/subject/lesson created inside container', Boolean(classroom?.id && subject?.id && lesson?.id),
  `class=${classroom?.id} subject=${subject?.id} lesson=${lesson?.id}`);

const STUDENT_CONTENT = 'UX2R2F-CONTENUTO-ALLIEVI — chiavi primarie e relazioni normalizzate.';
const RESERVED_CONTENT = 'UX2R2F-RISERVATO — soluzioni e note del docente, mai per gli studenti.';

const studentMaterial = (await t('/api/materials', { method: 'POST', body: {
  title: 'Dispensa relazioni — UX2-R2-F',
  contentText: STUDENT_CONTENT,
  pedagogicalRole: 'student_material',
  resourceType: 'student_note',
  classId: classroom?.id,
  subjectId: subject?.id,
  lessonId: lesson?.id
} })).json?.material;
const teacherMaterial = (await t('/api/materials', { method: 'POST', body: {
  title: 'Soluzioni riservate — UX2-R2-F',
  contentText: RESERVED_CONTENT,
  pedagogicalRole: 'teacher_material',
  resourceType: 'teacher_script',
  classId: classroom?.id,
  subjectId: subject?.id,
  lessonId: lesson?.id
} })).json?.material;

const pubPath = (version) => `/api/materials/${encodeURIComponent(studentMaterial?.id)}/versions/${version}/publication`;
const studentListPath = `/api/student/classes/${encodeURIComponent(classroom?.id)}/materials`;
const studentVersionPath = (id, version) =>
  `/api/student/classes/${encodeURIComponent(classroom?.id)}/materials/${encodeURIComponent(id)}/versions/${version}`;

/* 3. v1 initially unpublished */
const before = await t(pubPath(1));
const listBefore = await call(studentListPath);
check('3. synthetic v1 starts unpublished and hidden from students',
  before.status === 200 && before.json?.publication?.status === 'never_published' &&
  before.json?.publication?.isAvailable === false && before.json?.publication?.material?.versionNumber === 1 &&
  Array.isArray(listBefore.json?.materials) && !listBefore.json.materials.some(m => m.resource_id === studentMaterial?.id),
  `publication=${before.json?.publication?.status} visible=${listBefore.json?.materials?.some(m => m.resource_id === studentMaterial?.id)}`);

/* 10a. CSRF guard on the mutation, asserted before any publication exists */
const noOrigin = await call(pubPath(1), { method: 'POST', as: TEACHER, origin: false, body: {} });
const afterNoOrigin = await t(pubPath(1));
check('10a. CSRF blocks publication mutation without Origin and writes nothing',
  noOrigin.status === 403 && afterNoOrigin.json?.publication?.status === 'never_published',
  `no-origin=${noOrigin.status} state=${afterNoOrigin.json?.publication?.status}`);

/* 2b. Non-teacher cannot mutate publication state */
const outsiderPublish = await call(pubPath(1), { method: 'POST', as: NON_TEACHER, body: {} });
check('2b. non-teacher cannot publish', outsiderPublish.status === 403, `status=${outsiderPublish.status}`);

/* 4. Teacher publishes v1 */
const publish = await t(pubPath(1), { method: 'POST', body: {} });
const afterPublish = await t(pubPath(1));
check('4. teacher publishes v1 (POST /publication)', publish.status === 201 &&
  afterPublish.json?.publication?.status === 'available' && afterPublish.json?.publication?.isAvailable === true,
  `status=${publish.status} publication=${afterPublish.json?.publication?.status}`);

/* 5. Public student view shows availability */
const listAfter = await call(studentListPath);
const listed = (listAfter.json?.materials || []).find(m => m.resource_id === studentMaterial?.id);
check('5. anonymous student list confirms availability',
  listAfter.status === 200 && Boolean(listed) && Number(listed?.version_number) === 1,
  `status=${listAfter.status} version=${listed?.version_number}`);

/* 6. Correct content read + download */
const read = await call(studentVersionPath(studentMaterial?.id, 1));
const contentOk = read.status === 200 && read.json?.material?.content === STUDENT_CONTENT;
const download = await call(`${studentVersionPath(studentMaterial?.id, 1)}/download`);
const downloadOk = download.status === 200 && download.text === STUDENT_CONTENT &&
  /^attachment;/.test(download.headers.get('content-disposition') || '');
check('6. student reads the correct content and downloads it unchanged',
  contentOk && downloadOk,
  `read=${read.status} download=${download.status} disposition=${download.headers.get('content-disposition')}`);
check('6b. reserved teacher content never leaks through the student payload',
  !read.text.includes('UX2R2F-RISERVATO') && !download.text.includes('UX2R2F-RISERVATO'),
  'no reserved marker in student body');

/* 9. Teacher Material unavailable to students */
const teacherRead = await call(studentVersionPath(teacherMaterial?.id, 1));
const teacherPublish = await t(`/api/materials/${encodeURIComponent(teacherMaterial?.id)}/versions/1/publication`, { method: 'POST', body: {} });
const listAll = (await call(studentListPath)).json?.materials || [];
check('9. Teacher Material is hidden and refuses publication',
  teacherRead.status === 404 && teacherPublish.status === 400 &&
  !listAll.some(m => m.resource_id === teacherMaterial?.id) && !JSON.stringify(listAll).includes('UX2R2F-RISERVATO'),
  `read=${teacherRead.status} publish=${teacherPublish.status} listed=${listAll.some(m => m.resource_id === teacherMaterial?.id)}`);

/* 7. Teacher withdraws v1 */
const withdraw = await t(pubPath(1), { method: 'DELETE' });
const afterWithdraw = await t(pubPath(1));
check('7. teacher withdraws v1 (DELETE /publication)',
  withdraw.status === 200 && afterWithdraw.json?.publication?.status === 'withdrawn' && afterWithdraw.json?.publication?.isAvailable === false,
  `status=${withdraw.status} publication=${afterWithdraw.json?.publication?.status}`);

/* 8. Same version is no longer available publicly */
const listWithdrawn = await call(studentListPath);
const readWithdrawn = await call(studentVersionPath(studentMaterial?.id, 1));
const downloadWithdrawn = await call(`${studentVersionPath(studentMaterial?.id, 1)}/download`);
check('8. withdrawn v1 disappears from the public student surface',
  readWithdrawn.status === 404 && downloadWithdrawn.status === 404 &&
  !(listWithdrawn.json?.materials || []).some(m => m.resource_id === studentMaterial?.id),
  `read=${readWithdrawn.status} download=${downloadWithdrawn.status} listed=${(listWithdrawn.json?.materials || []).some(m => m.resource_id === studentMaterial?.id)}`);

/* 10b. CSRF guard on withdrawal + no state change */
const withdrawNoOrigin = await call(pubPath(1), { method: 'DELETE', as: TEACHER, origin: false });
const afterWithdrawNoOrigin = await t(pubPath(1));
check('10b. CSRF blocks withdrawal and preserves the withdrawn state',
  withdrawNoOrigin.status === 403 && afterWithdrawNoOrigin.json?.publication?.status === 'withdrawn',
  `no-origin=${withdrawNoOrigin.status} state=${afterWithdrawNoOrigin.json?.publication?.status}`);

/* Idempotence / repeat withdrawal conflict */
const repeatWithdraw = await t(pubPath(1), { method: 'DELETE' });
check('10c. repeated withdrawal is rejected without new events', repeatWithdraw.status === 409, `status=${repeatWithdraw.status}`);

console.log('');
console.log(JSON.stringify({
  baseUrl: BASE,
  teacher: TEACHER,
  nonTeacher: NON_TEACHER,
  checks: results,
  passed: results.filter(r => r.ok).length,
  failed: failures
}, null, 2));
process.exit(failures === 0 ? 0 : 1);
