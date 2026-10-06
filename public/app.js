const STATUS_LABELS = { planned: '计划中', active: '进行中', done: '已完成' };
const list = document.getElementById('list');
const empty = document.getElementById('empty');
let projects = [];
let filter = 'all';

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    alert(error || `请求失败 (${res.status})`);
    throw new Error(error);
  }
  return res.status === 204 ? null : res.json();
}

function render() {
  const shown = projects.filter((p) => filter === 'all' || p.status === filter);
  list.replaceChildren(...shown.map(renderItem));
  empty.hidden = shown.length > 0;
}

function renderItem(p) {
  const li = document.createElement('li');

  const info = document.createElement('div');
  info.className = 'info';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = p.name;
  const desc = document.createElement('div');
  desc.className = 'desc';
  desc.textContent = p.description;
  info.append(name, desc);

  const select = document.createElement('select');
  select.className = p.status;
  for (const [value, label] of Object.entries(STATUS_LABELS)) {
    select.add(new Option(label, value, false, value === p.status));
  }
  select.onchange = async () => {
    Object.assign(p, await api('PATCH', `/api/projects/${p.id}`, { status: select.value }));
    render();
  };

  const del = document.createElement('button');
  del.className = 'del';
  del.textContent = '删除';
  del.onclick = async () => {
    if (!confirm(`删除「${p.name}」？`)) return;
    await api('DELETE', `/api/projects/${p.id}`);
    projects = projects.filter((x) => x.id !== p.id);
    render();
  };

  li.append(info, select, del);
  return li;
}

document.getElementById('form').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('name');
  const description = document.getElementById('description');
  const status = document.getElementById('status');
  projects.push(await api('POST', '/api/projects', {
    name: name.value,
    description: description.value,
    status: status.value,
  }));
  name.value = description.value = '';
  render();
};

document.getElementById('filters').onclick = (e) => {
  const btn = e.target.closest('button[data-filter]');
  if (!btn) return;
  filter = btn.dataset.filter;
  for (const b of document.querySelectorAll('#filters button')) b.classList.toggle('on', b === btn);
  render();
};

api('GET', '/api/projects').then((data) => {
  projects = data;
  render();
});
