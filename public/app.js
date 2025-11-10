// Simple client logic: load lists, handle start/switch/clockout, poll active sessions.
const api = {
  employees: '/api/employees',
  projects: '/api/projects',
  activities: '/api/activities',
  start: '/api/start',
  switch: '/api/switch',
  clockout: '/api/clockout',
  active: '/api/active'
};

const $ = id => document.getElementById(id);
const employeeInput = $('employeeInput');
const projectInput = $('projectInput');
const activityInput = $('activityInput');
const startBtn = $('startBtn');
const switchBtn = $('switchBtn');
const clockoutBtn = $('clockoutBtn');
const activeList = $('activeList');
const clockEl = $('clock');

async function fetchList(endpoint, datalistId, labelField = 'name') {
  try {
    const r = await fetch(endpoint);
    const payload = await r.json();
    const arr = payload.data || payload || [];
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = '';
    arr.forEach(item => {
      const opt = document.createElement('option');
      opt.value = (item.employee_number || item.name || item.employee_name || item.project_name || item.activity_name || JSON.stringify(item));
      opt.dataset.raw = JSON.stringify(item);
      datalist.appendChild(opt);
    });
  } catch (e) {
    console.error('fetchList err', e);
  }
}

async function loadLists() {
  await Promise.all([
    fetchList(api.employees, 'employees'),
    fetchList(api.projects, 'projects'),
    fetchList(api.activities, 'activities'),
  ]);
}

function parseInputFromDatalist(inputEl) {
  // When scanner inputs a code we assume the value is the key (employee number or name).
  // For now we send the raw value as employee_id to server. You can adapt when you know field names.
  const val = inputEl.value;
  // Try to find datalist option with matching value and parse data
  const listId = inputEl.getAttribute('list');
  if (!listId) return { id: val, name: val };
  const opts = document.querySelectorAll(`#${listId} option`);
  for (const o of opts) {
    if (o.value === val) {
      try {
        const raw = JSON.parse(o.dataset.raw || '{}');
        // Heuristic: return a couple of fields
        return {
          id: raw.name || raw.employee_number || raw.project_name || raw.activity_name || val,
          name: raw.employee_name || raw.project_name || raw.activity_name || val
        };
      } catch (e) {
        return { id: val, name: val };
      }
    }
  }
  return { id: val, name: val };
}

startBtn.addEventListener('click', async () => {
  const emp = parseInputFromDatalist(employeeInput);
  const proj = parseInputFromDatalist(projectInput);
  const act = parseInputFromDatalist(activityInput);
  if (!emp.id) return alert('Employee required');
  const resp = await fetch(api.start, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_id: emp.id,
      employee_name: emp.name,
      project_id: proj.id,
      project_name: proj.name,
      activity_id: act.id,
      activity_name: act.name
    })
  });
  if (resp.ok) {
    await refreshActive();
  } else {
    const e = await resp.json();
    alert('Start error: ' + (e.error || JSON.stringify(e)));
  }
});

switchBtn.addEventListener('click', async () => {
  const emp = parseInputFromDatalist(employeeInput);
  const proj = parseInputFromDatalist(projectInput);
  const act = parseInputFromDatalist(activityInput);
  if (!emp.id) return alert('Employee required');
  const resp = await fetch(api.switch, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_id: emp.id,
      project_id: proj.id,
      project_name: proj.name,
      activity_id: act.id,
      activity_name: act.name
    })
  });
  if (resp.ok) {
    await refreshActive();
  } else {
    const e = await resp.json();
    alert('Switch error: ' + (e.error || JSON.stringify(e)));
  }
});

clockoutBtn.addEventListener('click', async () => {
  const emp = parseInputFromDatalist(employeeInput);
  if (!emp.id) return alert('Employee required');
  const resp = await fetch(api.clockout, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: emp.id })
  });
  if (resp.ok) {
    alert('Clocked out and submitted (if ERP configured).');
    await refreshActive();
  } else {
    const e = await resp.json();
    alert('Clockout error: ' + (e.error || JSON.stringify(e)));
  }
});

async function refreshActive() {
  try {
    const r = await fetch(api.active);
    const payload = await r.json();
    const data = payload.data || [];
    activeList.innerHTML = data.map(d => {
      const elapsed = d.elapsed_seconds || 0;
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      const elapsedStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      return `<div class="active-row">
        <div class="a-name">${d.employee_name || d.employee_id}</div>
        <div class="a-job">${d.project_name || '-'}</div>
        <div class="a-activity">${d.activity_name || '-'}</div>
        <div class="a-elapsed">${elapsedStr}</div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('refreshActive err', e);
  }
}

function tickClock() {
  // show local time; server time could be fetched if needed
  const now = new Date();
  const s = now.toLocaleTimeString();
  clockEl.textContent = s;
}

// initial load
loadLists().then(() => {
  refreshActive();
  setInterval(refreshActive, 5000); // poll every 5s
  setInterval(tickClock, 1000);
});
