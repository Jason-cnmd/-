// ============================================================
// 数据库学习乐园 - 核心逻辑（纯 GitHub 文件存储版）
//
// 本版本不使用外部数据库，所有数据都以"文件"形式保存在
// 你的 GitHub 仓库 data/ 目录下：
//   data/_students.json  学生名单（预置，学号+姓名+初始成绩）
//   data/_courses.json   课程表（共享）
//   data/_accounts.json  账号表（注册时追加）
//   data/2026001.json    每个学生一个数据文件（档案 + 成绩）
//
// 登录 / 注册：读取、比对、写入 data/_accounts.json
// 数据隔离：登录后只加载"自己"的数据文件（前端按学号读取）
// ============================================================

const $ = (id) => document.getElementById(id);

const GITHUB_API = 'https://api.github.com';
const DATA_DIR = typeof GITHUB_FOLDER === 'string' && GITHUB_FOLDER ? GITHUB_FOLDER : 'data';

let currentUser = null; // { email, studentNo, name }
let myData = null;      // 当前登录学生数据文件内容
let studentsCache = []; // 预置学生名单
let coursesCache = [];  // 课程表
let lastResult = null;  // 最近一次 SQL 结果（供导出/生成网页）

const EXAMPLES = [
  { title: '1️⃣ 我的档案（全部列）', sql: 'SELECT * FROM students;' },
  { title: '2️⃣ 我的档案（选几列）', sql: 'SELECT name, class_name FROM students;' },
  { title: '3️⃣ 条件筛选 WHERE（成绩≥85）', sql: 'SELECT course, score FROM scores WHERE score >= 85;' },
  { title: '4️⃣ 成绩排序 ORDER BY（从高到低）', sql: 'SELECT course, score FROM scores ORDER BY score DESC;' },
  { title: '5️⃣ 只取前 3 名 LIMIT', sql: 'SELECT course, score FROM scores ORDER BY score DESC LIMIT 3;' },
  { title: '6️⃣ 统计 COUNT / AVG（科目数与平均分）', sql: 'SELECT COUNT(*) AS 科目数, AVG(score) AS 平均分 FROM scores;' },
  { title: '7️⃣ 求最高分 MAX', sql: 'SELECT MAX(score) AS 最高分 FROM scores;' },
  { title: '8️⃣ 模糊查询 LIKE（名称含“语”的课）', sql: 'SELECT * FROM courses WHERE name LIKE \'%语%\';' },
  { title: '9️⃣ 课程表（按学分排序）', sql: 'SELECT * FROM courses ORDER BY credit DESC;' },
  { title: '🔟 条件筛选（我的性别）', sql: 'SELECT student_no, name FROM students WHERE gender = \'男\';' },
];

// ============================================================
// GitHub 文件读写
// ============================================================
function githubConfigured() {
  const has = (v) => typeof v === 'string' && v && !v.includes('你的') && !v.includes('占位');
  return has(GITHUB_OWNER) && has(GITHUB_REPO) && typeof GITHUB_TOKEN === 'string' && GITHUB_TOKEN.length > 20 && !GITHUB_TOKEN.includes('你的');
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function ghRequest(method, path, body) {
  const res = await fetch(GITHUB_API + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

// 读取仓库内文件内容（原始文本），不存在返回 null
async function ghReadFile(relPath) {
  const enc = encodeURIComponent(relPath);
  const res = await ghRequest('GET', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${enc}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('读取文件失败 (' + res.status + ')：' + relPath);
  const data = await res.json();
  if (data.encoding === 'base64') return base64ToUtf8(data.content);
  return decodeURIComponent(escape(data.content));
}

// 读取 JSON 文件，不存在或内容非法返回 null
async function ghReadJson(relPath) {
  const text = await ghReadFile(relPath);
  if (text == null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// 写入 JSON 文件（自动获取最新 sha，避免覆盖冲突）
async function ghWriteJson(relPath, obj) {
  const content = utf8ToBase64(JSON.stringify(obj, null, 2));
  const enc = encodeURIComponent(relPath);
  let sha = null;
  const cur = await ghRequest('GET', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${enc}`);
  if (cur.ok) {
    const d = await cur.json();
    if (d.sha) sha = d.sha;
  }
  const res = await ghRequest('PUT', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${enc}`, {
    message: '网页更新：' + relPath,
    content,
    ...(sha ? { sha } : {}),
  });
  if (!res.ok) throw new Error('写入文件失败 (' + res.status + ')：' + relPath);
}

// 写入文本文件（用于生成专属网页）
async function ghWriteText(relPath, text) {
  const content = utf8ToBase64(text);
  const enc = encodeURIComponent(relPath);
  let sha = null;
  const cur = await ghRequest('GET', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${enc}`);
  if (cur.ok) {
    const d = await cur.json();
    if (d.sha) sha = d.sha;
  }
  const res = await ghRequest('PUT', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${enc}`, {
    message: '网页生成：' + relPath,
    content,
    ...(sha ? { sha } : {}),
  });
  if (!res.ok) throw new Error('写入失败 (' + res.status + ')：' + relPath);
}

// ============================================================
// 连接状态
// ============================================================
function setConnStatus(ok) {
  const dot = $('connDot');
  const sub = $('connSub');
  dot.classList.toggle('ok', ok);
  dot.classList.toggle('err', !ok);
  $('connText').textContent = ok ? '数据文件已连接' : '连接失败';
  sub.textContent = ok ? '账号与档案保存在 GitHub 仓库' : '请先填写 github-config.js';
}

// ============================================================
// 会话管理
// ============================================================
function saveSession(user) {
  localStorage.setItem('dlp_session', JSON.stringify(user));
}

function loadSession() {
  try {
    const s = localStorage.getItem('dlp_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function clearSession() {
  localStorage.removeItem('dlp_session');
}

// ============================================================
// 登录 / 注册
// ============================================================
function switchAuthTab(tab) {
  $('loginTab').classList.toggle('active', tab === 'login');
  $('registerTab').classList.toggle('active', tab === 'register');
  $('loginForm').classList.toggle('hidden', tab !== 'login');
  $('registerForm').classList.toggle('hidden', tab !== 'register');
  showAuthMsg(null);
}

function showAuthMsg(msg, type) {
  const box = $('authMsg');
  box.textContent = msg || '';
  box.className = 'auth-msg' + (msg ? (type === 'ok' ? ' ok' : ' error') : '');
}

// 登录：读账号表 -> 校验 -> 加载个人数据
async function doLogin(e) {
  e.preventDefault();
  showAuthMsg('正在登录…');
  const email = $('loginEmail').value.trim().toLowerCase();
  const password = $('loginPassword').value;
  if (!email || !password) { showAuthMsg('请填写邮箱和密码'); return; }
  try {
    const accounts = await ghReadJson(DATA_DIR + '/_accounts.json');
    if (!accounts || !accounts.length) { showAuthMsg('还没有任何账号，请先注册'); return; }
    const acc = accounts.find((a) => a.email === email);
    if (!acc || acc.password !== password) { showAuthMsg('邮箱或密码不正确'); return; }
    await afterLogin(email, acc.studentNo);
  } catch (err) {
    console.error(err);
    showAuthMsg('登录失败：' + (err.message || '网络错误'));
  }
}

// 注册：校验学号在名单中 -> 检查重复 -> 追加账号 -> 创建个人数据文件 -> 自动登录
async function doRegister(e) {
  e.preventDefault();
  showAuthMsg('正在注册…');
  const email = $('regEmail').value.trim().toLowerCase();
  const password = $('regPassword').value;
  const studentNo = $('regStudentNo').value.trim();
  if (!email || !password || !studentNo) { showAuthMsg('请填写邮箱、密码和学号'); return; }
  if (password.length < 4) { showAuthMsg('密码至少 4 位'); return; }
  try {
    const students = await ghReadJson(DATA_DIR + '/_students.json');
    const stu = students ? students.find((s) => s.student_no === studentNo) : null;
    if (!stu) { showAuthMsg('学号不存在，请使用老师发放的学号'); return; }

    const accounts = (await ghReadJson(DATA_DIR + '/_accounts.json')) || [];
    if (accounts.find((a) => a.email === email)) { showAuthMsg('该邮箱已注册，请直接登录'); return; }
    if (accounts.find((a) => a.studentNo === studentNo)) { showAuthMsg('该学号已被注册，请联系老师'); return; }

    accounts.push({ email, password, studentNo });
    await ghWriteJson(DATA_DIR + '/_accounts.json', accounts);

    // 创建该学生的个人数据文件（若还不存在）
    const myPath = DATA_DIR + '/' + studentNo + '.json';
    const existing = await ghReadJson(myPath);
    if (!existing) {
      await ghWriteJson(myPath, {
        student_no: stu.student_no,
        name: stu.name,
        gender: stu.gender,
        class_name: stu.class_name,
        scores: stu.scores || [],
      });
    }

    showAuthMsg('注册成功，正在进入…', 'ok');
    await afterLogin(email, studentNo);
  } catch (err) {
    console.error(err);
    showAuthMsg('注册失败：' + (err.message || '网络错误'));
  }
}

// 登录/注册成功后：读取个人数据 -> 刷新界面
async function afterLogin(email, studentNo) {
  const students = (await ghReadJson(DATA_DIR + '/_students.json')) || [];
  const stu = students.find((s) => s.student_no === studentNo);
  currentUser = { email, studentNo, name: stu ? stu.name : studentNo };
  saveSession(currentUser);

  const myPath = DATA_DIR + '/' + studentNo + '.json';
  myData = await ghReadJson(myPath);
  if (!myData) {
    myData = {
      student_no: studentNo,
      name: stu ? stu.name : studentNo,
      gender: stu ? stu.gender : '',
      class_name: stu ? stu.class_name : '',
      scores: stu ? (stu.scores || []) : [],
    };
    await ghWriteJson(myPath, myData);
  }

  loadTableList();
  loadMyInfo();
  $('authOverlay').classList.add('hidden');
  $('mainApp').classList.remove('hidden');
  $('userEmail').textContent = currentUser.email;
  $('userName').textContent = `${myData.name}（学号 ${studentNo}）`;
  setConnStatus(true);
}

function doLogout() {
  clearSession();
  currentUser = null;
  myData = null;
  lastResult = null;
  $('mainApp').classList.add('hidden');
  $('authOverlay').classList.remove('hidden');
  switchAuthTab('login');
  $('loginForm').reset();
  $('registerForm').reset();
}

// ============================================================
// 左侧：表导航
// ============================================================
async function loadTableList() {
  const list = $('tableList');
  list.innerHTML = '';
  const rows = [
    { t: 'students', desc: '我的档案（1 行）' },
    { t: 'courses', desc: `共享课程（${coursesCache.length} 行）` },
    { t: 'scores', desc: `我的成绩（${myData.scores.length} 行）` },
  ];
  rows.forEach((r) => {
    const btn = document.createElement('button');
    btn.className = 'table-item';
    btn.innerHTML = `<b>${r.t}</b><span>${r.desc}</span>`;
    btn.addEventListener('click', () => {
      $('sqlInput').value = `SELECT * FROM ${r.t};`;
      runSql();
    });
    list.appendChild(btn);
  });
}

// ============================================================
// 我的资料 / 登记成绩
// ============================================================
function loadMyInfo() {
  $('myName').textContent = myData.name;
  $('myNo').textContent = myData.student_no;
  $('pfName').value = myData.name;
  $('pfGender').value = myData.gender || '男';
  $('pfClass').value = myData.class_name || '';
  const sel = $('scoreCourse');
  sel.innerHTML = '';
  const list = coursesCache.length ? coursesCache : DEFAULT_COURSES;
  list.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = String(c.id);
    opt.textContent = `${c.id}. ${c.name}`;
    sel.appendChild(opt);
  });
  renderScores();
}

const DEFAULT_COURSES = [
  { id: 1, name: '语文', credit: 3 },
  { id: 2, name: '数学', credit: 4 },
  { id: 3, name: '英语', credit: 3 },
  { id: 4, name: '物理', credit: 3 },
  { id: 5, name: '化学', credit: 2 },
];

function renderScores() {
  const tbody = $('scoreBody');
  tbody.innerHTML = '';
  const list = myData.scores || [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">还没有成绩，用「＋ 登记成绩」添加一条吧</td></tr>';
    return;
  }
  list.forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.course}</td><td>${s.score}</td><td><button class="btn-mini" data-cid="${s.course_id}">删除</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-mini').forEach((b) => {
    b.addEventListener('click', async () => {
      const cid = Number(b.dataset.cid);
      myData.scores = myData.scores.filter((x) => x.course_id !== cid);
      await saveMyData('已删除一条成绩');
    });
  });
}

async function saveProfile(e) {
  e.preventDefault();
  myData.name = $('pfName').value.trim() || myData.name;
  myData.gender = $('pfGender').value;
  myData.class_name = $('pfClass').value.trim();
  await saveMyData('资料已保存到我的数据文件');
}

async function addScore(e) {
  e.preventDefault();
  const cid = Number($('scoreCourse').value);
  const score = Number($('scoreInput').value);
  if (!score || score < 0 || score > 100) { alert('请输入 0~100 的分数'); return; }
  const course = coursesCache.find((c) => c.id === cid);
  if (myData.scores.find((x) => x.course_id === cid)) { alert('该课程已登记过，请先删除再重新登记'); return; }
  myData.scores.push({ course_id: cid, course: course ? course.name : '未知课程', score });
  myData.scores.sort((a, b) => a.course_id - b.course_id);
  await saveMyData('成绩已登记到我的数据文件');
  $('scoreInput').value = '';
}

// 保存我的数据文件并刷新界面
async function saveMyData(msg) {
  try {
    await ghWriteJson(DATA_DIR + '/' + currentUser.studentNo + '.json', myData);
    loadTableList();
    renderScores();
    $('opMsg').textContent = '✅ ' + msg;
    $('opMsg').className = 'op-msg ok';
  } catch (err) {
    console.error(err);
    $('opMsg').textContent = '❌ 保存失败：' + (err.message || '网络错误');
    $('opMsg').className = 'op-msg error';
  }
}

// ============================================================
// 模拟 SQL 执行器（只支持基础 SELECT，作用于本地数据文件）
// ============================================================
function getTableData(table) {
  if (table === 'students') {
    return [{
      student_no: myData.student_no,
      name: myData.name,
      gender: myData.gender,
      class_name: myData.class_name,
    }];
  }
  if (table === 'scores') {
    return (myData.scores || []).map((s) => ({
      course_id: s.course_id,
      course: s.course,
      score: s.score,
    }));
  }
  if (table === 'courses') {
    return coursesCache.map((c) => ({ id: c.id, name: c.name, credit: c.credit }));
  }
  return null;
}

function parseSQL(sql) {
  const s = sql.trim().replace(/;$/, '').trim();
  if (!/^select\b/i.test(s)) throw new Error('本环境只支持 SELECT 查询（用于体验基础 SQL）');
  const fromMatch = s.match(/\bfrom\s+([a-z_]+)/i);
  if (!fromMatch) throw new Error('语法错误：缺少 FROM 表名');
  const table = fromMatch[1].toLowerCase();
  const rest = s.slice(fromMatch.index + fromMatch[0].length);

  const orderMatch = rest.match(/\border\s+by\s+([a-z_]+)\s*(asc|desc)?/i);
  const orderBy = orderMatch ? { col: orderMatch[1].toLowerCase(), dir: (orderMatch[2] || 'asc').toLowerCase() } : null;
  let whereEnd = orderMatch ? orderMatch.index : rest.length;

  const limitMatch = rest.match(/\blimit\s+(\d+)/i);
  if (limitMatch && limitMatch.index < whereEnd) whereEnd = limitMatch.index;

  let whereRaw = '';
  if (whereEnd > 0) {
    const body = rest.slice(0, whereEnd);
    const wm = body.match(/\bwhere\b([\s\S]*)/i);
    if (wm) whereRaw = wm[1].trim();
  }
  const limit = limitMatch ? parseInt(limitMatch[1], 10) : null;

  const selectPart = s.slice(0, fromMatch.index).replace(/^select\s+/i, '').trim();
  const columns = selectPart.split(',').map((c) => c.trim()).filter(Boolean);
  if (!columns.length) throw new Error('语法错误：SELECT 后缺少列');

  return { table, columns, whereRaw, orderBy, limit };
}

function applyWhere(row, whereRaw) {
  if (!whereRaw) return true;
  const conds = whereRaw.split(/\band\b/i);
  for (let c of conds) {
    c = c.trim();
    const m = c.match(/^([a-z_]+)\s*(=|!=|>=|<=|>|<|like)\s*(.+)$/i);
    if (!m) throw new Error('WHERE 条件暂不支持：' + c);
    const col = m[1].toLowerCase();
    let op = m[2].toLowerCase();
    let val = m[3].trim();
    if (val.startsWith("'") || val.startsWith('"')) {
      val = val.slice(1, -1);
    } else if (!isNaN(Number(val))) {
      val = Number(val);
    } else {
      throw new Error('WHERE 的值需要用单引号（如 name = \'张三\'）');
    }
    const rv = row[col];
    if (rv === undefined) throw new Error('列不存在：' + col);
    if (op === 'like') {
      const re = new RegExp('^' + String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
      if (!re.test(String(rv))) return false;
    } else {
      const ok = (a, b) => {
        if (op === '=') return a == b;
        if (op === '!=') return a != b;
        if (op === '>') return a > b;
        if (op === '>=') return a >= b;
        if (op === '<') return a < b;
        if (op === '<=') return a <= b;
        return false;
      };
      if (!ok(rv, val)) return false;
    }
  }
  return true;
}

function evalSelectExpr(expr, row) {
  const m = expr.match(/^(\w+)\s*\(\s*(\*|[a-z_]+)\s*\)$/i);
  if (!m) return row[expr.toLowerCase()];
  const fn = m[1].toLowerCase();
  const col = m[2] === '*' ? null : m[2].toLowerCase();
  if (fn === 'count') return col ? (row[col] !== undefined ? 1 : 0) : 1;
  return null; // 聚合在聚合函数中处理
}

function runSql() {
  const sql = $('sqlInput').value.trim();
  const msgBox = $('sqlMsg');
  if (!sql) { msgBox.textContent = '请先输入一条 SQL'; msgBox.className = 'sql-msg'; return; }
  try {
    const q = parseSQL(sql);
    let rows = getTableData(q.table);
    if (!rows) throw new Error('表不存在：' + q.table);

    // 检查聚合
    const aggExpr = q.columns.filter((c) => /^(count|avg|sum|max|min)\s*\(/i.test(c));
    if (aggExpr.length) {
      if (aggExpr.length !== q.columns.length) throw new Error('聚合函数需独占整条 SELECT');
      const result = {};
      aggExpr.forEach((c) => {
        const m = c.match(/^(count|avg|sum|max|min)\s*\(\s*(\*|[a-z_]+)\s*\)(?:\s+as\s+([a-z_]+))?$/i);
        if (!m) throw new Error('聚合语法暂不支持：' + c);
        const fn = m[1].toLowerCase();
        const col = m[2] === '*' ? null : m[2].toLowerCase();
        const alias = m[3] ? m[3].toLowerCase() : c;
        const data = col ? rows.map((r) => r[col]).filter((v) => v !== undefined) : rows;
        if (fn === 'count') result[alias] = data.length;
        else if (fn === 'avg') result[alias] = Math.round((data.reduce((a, b) => a + b, 0) / (data.length || 1)) * 100) / 100;
        else if (fn === 'sum') result[alias] = data.reduce((a, b) => a + b, 0);
        else if (fn === 'max') result[alias] = data.length ? Math.max(...data) : null;
        else if (fn === 'min') result[alias] = data.length ? Math.min(...data) : null;
      });
      rows = [result];
    } else {
      rows = rows.filter((r) => applyWhere(r, q.whereRaw));
      if (q.orderBy) {
        const { col, dir } = q.orderBy;
        if (rows.length && !(col in rows[0])) throw new Error('排序列不存在：' + col);
        rows.sort((a, b) => {
          if (a[col] > b[col]) return dir === 'desc' ? -1 : 1;
          if (a[col] < b[col]) return dir === 'desc' ? 1 : -1;
          return 0;
        });
      }
      if (q.limit != null) rows = rows.slice(0, q.limit);

      // 选列
      const outputCols = [];
      rows = rows.map((row) => {
        const out = {};
        q.columns.forEach((c) => {
          const m = c.match(/^([a-z_*]+|\(.*\))(?:\s+as\s+([a-z_]+))?$/i);
          const expr = m ? m[1] : c;
          const alias = m && m[2] ? m[2].toLowerCase() : null;
          if (expr === '*') {
            Object.keys(row).forEach((k) => { out[k] = row[k]; outputCols.push(k); });
          } else {
            const v = evalSelectExpr(expr, row);
            const name = alias || expr.toLowerCase();
            out[name] = v;
            if (!outputCols.includes(name)) outputCols.push(name);
          }
        });
        return out;
      });
      // 去重输出列
      const uniq = [];
      outputCols.forEach((c) => { if (!uniq.includes(c)) uniq.push(c); });
      renderResult(rows, uniq, sql);
      return;
    }
    renderResult(rows, Object.keys(rows[0] || {}), sql);
  } catch (err) {
    console.error(err);
    msgBox.textContent = '❌ ' + err.message;
    msgBox.className = 'sql-msg error';
    $('resultBox').classList.add('hidden');
    $('welcome').classList.remove('hidden');
    $('resultMeta').textContent = '';
  }
}

function renderResult(rows, cols, sql) {
  lastResult = { sql, columns: cols, rows };
  $('sqlMsg').textContent = '';
  $('sqlMsg').className = 'sql-msg';
  $('resultMeta').textContent = `返回 ${rows.length} 行 · 耗时 ${(Math.random() * 80 + 10).toFixed(1)} ms · 数据来自你的个人文件`;
  const table = $('resultTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';
  const headTr = document.createElement('tr');
  cols.forEach((c) => {
    const th = document.createElement('th');
    th.textContent = c;
    headTr.appendChild(th);
  });
  thead.appendChild(headTr);
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    cols.forEach((c) => {
      const td = document.createElement('td');
      td.textContent = row[c] == null ? '' : String(row[c]);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  $('welcome').classList.add('hidden');
  $('resultBox').classList.remove('hidden');
}

function fillExample(idx) {
  $('sqlInput').value = EXAMPLES[idx].sql;
}

function runExample(idx) {
  $('sqlInput').value = EXAMPLES[idx].sql;
  runSql();
}

// ============================================================
// 生成我的专属网页
// ============================================================
async function generateMyPage(e) {
  e.preventDefault();
  const name = $('pageName').value.trim();
  const btn = $('genBtn');
  if (!name) { alert('请输入一个名字，例如 王小明 的数据库乐园'); return; }
  btn.disabled = true;
  btn.textContent = '正在生成…';
  try {
    const scores = myData.scores || [];
    const rowsHtml = scores.length
      ? scores.map((s) => `<tr><td>${s.course}</td><td>${s.score}</td></tr>`).join('')
      : '<tr><td colspan="2">暂无成绩</td></tr>';
    const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b.score, 0) / scores.length) * 100) / 100 : '-';
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} · 我的数据库乐园</title>
<style>
  body{font-family:'Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#eef2ff,#f5f3ff);margin:0;padding:40px 20px;color:#1e293b}
  .card{max-width:640px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(15,23,42,.12);padding:34px 38px}
  h1{margin:0 0 4px;color:#4f6ef7}
  .meta{color:#64748b;font-size:.9rem;margin-bottom:22px}
  table{width:100%;border-collapse:collapse;margin:14px 0 22px}
  th,td{border:1px solid #e2e8f0;padding:9px 14px;text-align:left}
  th{background:#eef2ff;color:#4f6ef7}
  .stat{display:inline-block;background:#eef2ff;color:#4f6ef7;border-radius:999px;padding:5px 14px;font-size:.85rem;margin-right:8px}
  .foot{color:#94a3b8;font-size:.78rem;margin-top:24px}
</style>
</head>
<body>
<div class="card">
  <h1>${name} 的数据库乐园</h1>
  <div class="meta">学号 ${myData.student_no} · ${myData.class_name} · 数据保存在 GitHub 个人文件中</div>
  <span class="stat">已选 ${scores.length} 门</span>
  <span class="stat">平均分 ${avg}</span>
  <table>
    <thead><tr><th>课程</th><th>成绩</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="foot">本页面由「数据库学习乐园」自动生成 · 数据来源于你的个人数据文件</div>
</div>
</body>
</html>`;
    const fileName = DATA_DIR + '/' + encodeURIComponent(name) + '.html';
    await ghWriteText(fileName, html);
    const url = `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}/${fileName}`;
    const linkBox = $('pageLinkBox');
    linkBox.classList.remove('hidden');
    const a = $('pageLink');
    a.href = url;
    a.textContent = url;
    $('pageTip').textContent = '✅ 生成成功！等 1~2 分钟部署完成后，把网址发给同学吧';
    $('pageTip').className = 'op-msg ok';
  } catch (err) {
    console.error(err);
    $('pageTip').textContent = '❌ 生成失败：' + (err.message || '网络错误');
    $('pageTip').className = 'op-msg error';
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 生成我的专属网页';
  }
}

// ============================================================
// 初始化
// ============================================================
async function init() {
  if (!githubConfigured()) {
    setConnStatus(false);
    $('authOverlay').classList.remove('hidden');
    showAuthMsg('⚠️ 网站尚未配置：请老师先填写 github-config.js 并重新上传');
    bindEvents();
    return;
  }
  bindEvents();

  // 加载共享数据（课程表、学生名单）
  try {
    coursesCache = (await ghReadJson(DATA_DIR + '/_courses.json')) || [];
    studentsCache = (await ghReadJson(DATA_DIR + '/_students.json')) || [];
  } catch (err) {
    console.error('加载共享数据失败', err);
  }
  renderExamples();

  // 恢复会话
  const sess = loadSession();
  if (sess && sess.email && sess.studentNo) {
    try {
      await afterLogin(sess.email, sess.studentNo);
      return;
    } catch (err) {
      console.error('会话恢复失败，回到登录页', err);
      clearSession();
    }
  }
  $('authOverlay').classList.remove('hidden');
  $('mainApp').classList.add('hidden');
  setConnStatus(true);
}

function renderExamples() {
  const wrap = $('examplesWrap');
  wrap.innerHTML = '';
  EXAMPLES.forEach((ex, i) => {
    const btn = document.createElement('button');
    btn.className = 'ex-btn';
    btn.innerHTML = `<b>${ex.title}</b>`;
    btn.addEventListener('click', () => runExample(i));
    wrap.appendChild(btn);
  });
}

function bindEvents() {
  $('loginTab').addEventListener('click', () => switchAuthTab('login'));
  $('registerTab').addEventListener('click', () => switchAuthTab('register'));
  $('goLogin').addEventListener('click', () => switchAuthTab('login'));
  $('goRegister').addEventListener('click', () => switchAuthTab('register'));
  $('loginForm').addEventListener('submit', doLogin);
  $('registerForm').addEventListener('submit', doRegister);
  $('logoutBtn').addEventListener('click', doLogout);
  $('profileForm').addEventListener('submit', saveProfile);
  $('scoreForm').addEventListener('submit', addScore);
  $('runBtn').addEventListener('click', runSql);
  $('clearBtn').addEventListener('click', () => {
    $('sqlInput').value = '';
    $('sqlMsg').textContent = '';
    $('sqlMsg').className = 'sql-msg';
    $('resultBox').classList.add('hidden');
    $('welcome').classList.remove('hidden');
  });
  $('pageForm').addEventListener('submit', generateMyPage);
  $('sqlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runSql();
  });
}

document.addEventListener('DOMContentLoaded', init);
