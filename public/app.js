const POLL_MS = 4000;

const addForm = document.getElementById('addForm');
const addInput = document.getElementById('addInput');
const listItemsEl = document.getElementById('listItems');
const listEmptyEl = document.getElementById('listEmpty');
const listCountEl = document.getElementById('listCount');
const clearCartBtn = document.getElementById('clearCartBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const syncStatusEl = document.getElementById('syncStatus');

const toggleTemplateBtn = document.getElementById('toggleTemplateBtn');
const templatePanel = document.getElementById('templatePanel');
const templateItemsEl = document.getElementById('templateItems');
const templateAddForm = document.getElementById('templateAddForm');
const templateAddInput = document.getElementById('templateAddInput');
const copyTemplateBtn = document.getElementById('copyTemplateBtn');

let items = [];
let template = [];
let lastItemsJson = '';
let editingItemId = null;
let editingTemplateId = null;
let draggedIndex = null;

function setSyncOk(ok) {
	syncStatusEl.textContent = ok ? '同期中' : '同期エラー';
	syncStatusEl.classList.toggle('error', !ok);
}

// ================== 買い物リスト 描画 ==================

function renderBoard() {
	const checkedCount = items.filter((it) => it.checked).length;

	listCountEl.textContent = `${items.length}件`;
	listEmptyEl.style.display = items.length ? 'none' : 'block';
	clearCartBtn.hidden = checkedCount === 0;
	clearAllBtn.hidden = items.length === 0;

	listItemsEl.innerHTML = '';
	items.forEach((it, index) => {
		listItemsEl.appendChild(buildListRow(it, index));
	});
}

function buildListRow(it, index) {
	const row = document.createElement('div');
	row.className = 'item-row' + (it.checked ? ' checked-row' : '');
	row.draggable = true;

	row.addEventListener('dragstart', (e) => {
		draggedIndex = index;
		row.classList.add('dragging');
		e.dataTransfer.effectAllowed = 'move';
	});

	row.addEventListener('dragover', (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		row.classList.add('drag-over');
	});

	row.addEventListener('dragleave', () => {
		row.classList.remove('drag-over');
	});

	row.addEventListener('drop', async (e) => {
		e.preventDefault();
		row.classList.remove('drag-over');
		if (draggedIndex !== null && draggedIndex !== index) {
			const [movedItem] = items.splice(draggedIndex, 1);
			items.splice(index, 0, movedItem);
			renderBoard();
			await saveReorder();
		}
		draggedIndex = null;
	});

	row.addEventListener('dragend', () => {
		row.classList.remove('dragging');
		document.querySelectorAll('.item-row').forEach((r) => r.classList.remove('drag-over'));
	});

	if (editingItemId === it.id) {
		row.appendChild(buildEditForm(it));
		return row;
	}

	const box = document.createElement('div');
	box.className = 'checkbox' + (it.checked ? ' checked' : '');
	box.setAttribute('role', 'checkbox');
	box.setAttribute('aria-checked', String(it.checked));
	box.tabIndex = 0;
	if (it.checked) {
		box.innerHTML =
			'<svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	}
	box.addEventListener('click', () => toggleItem(it.id, !it.checked));
	box.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') toggleItem(it.id, !it.checked);
	});

	const name = document.createElement('span');
	name.className = 'item-name' + (it.checked ? ' done' : '');
	name.textContent = it.name;

	const editBtn = document.createElement('button');
	editBtn.className = 'edit-btn';
	editBtn.textContent = '編集';
	editBtn.addEventListener('click', () => {
		editingItemId = it.id;
		renderBoard();
	});

	const trash = document.createElement('button');
	trash.className = 'icon-btn trash';
	trash.setAttribute('aria-label', `${it.name}を削除`);
	trash.textContent = '×';
	trash.addEventListener('click', () => removeItem(it.id));

	row.appendChild(box);
	row.appendChild(name);
	row.appendChild(editBtn);
	row.appendChild(trash);
	return row;
}

function buildEditForm(it) {
	const form = document.createElement('form');
	form.className = 'edit-form';

	const input = document.createElement('input');
	input.type = 'text';
	input.value = it.name;

	const saveBtn = document.createElement('button');
	saveBtn.type = 'submit';
	saveBtn.className = 'small-btn save';
	saveBtn.textContent = '保存';

	const cancelBtn = document.createElement('button');
	cancelBtn.type = 'button';
	cancelBtn.className = 'small-btn cancel';
	cancelBtn.textContent = 'キャンセル';
	cancelBtn.addEventListener('click', () => {
		editingItemId = null;
		renderBoard();
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const name = input.value.trim();
		if (!name) return;
		editingItemId = null;
		renameItem(it.id, name);
	});

	form.appendChild(input);
	form.appendChild(saveBtn);
	form.appendChild(cancelBtn);

	setTimeout(() => input.focus(), 0);

	return form;
}

// ================== 買い物リスト API 呼び出し ==================

async function fetchItems() {
	try {
		const res = await fetch('/api/items');
		if (!res.ok) throw new Error('failed');
		const data = await res.json();
		const json = JSON.stringify(data);
		if (json !== lastItemsJson) {
			items = data;
			lastItemsJson = json;
			renderBoard();
		}
		setSyncOk(true);
	} catch (e) {
		setSyncOk(false);
	}
}

async function addItem(name) {
	try {
		const res = await fetch('/api/items', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
		});
		if (!res.ok) throw new Error('failed');
		lastItemsJson = '';
		await fetchItems();
	} catch (e) {
		setSyncOk(false);
	}
}

async function saveReorder() {
	try {
		const res = await fetch('/api/items/reorder', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(items),
		});
		if (!res.ok) throw new Error('failed');
		lastItemsJson = JSON.stringify(items);
		setSyncOk(true);
	} catch (e) {
		setSyncOk(false);
	}
}

async function toggleItem(id, checked) {
	items = items.map((it) => (it.id === id ? { ...it, checked } : it));
	renderBoard();
	try {
		const res = await fetch(`/api/items/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ checked }),
		});
		if (!res.ok) throw new Error('failed');
		lastItemsJson = '';
		await fetchItems();
	} catch (e) {
		setSyncOk(false);
	}
}

async function renameItem(id, name) {
	items = items.map((it) => (it.id === id ? { ...it, name } : it));
	renderBoard();
	try {
		const res = await fetch(`/api/items/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
		});
		if (!res.ok) throw new Error('failed');
		lastItemsJson = '';
		await fetchItems();
	} catch (e) {
		setSyncOk(false);
	}
}

async function removeItem(id) {
	items = items.filter((it) => it.id !== id);
	renderBoard();
	try {
		const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('failed');
		lastItemsJson = '';
		await fetchItems();
	} catch (e) {
		setSyncOk(false);
	}
}

async function clearPurchased() {
	items = items.filter((it) => !it.checked);
	renderBoard();
	try {
		const res = await fetch('/api/cart/clear', { method: 'POST' });
		if (!res.ok) throw new Error('failed');
		lastItemsJson = '';
		await fetchItems();
	} catch (e) {
		setSyncOk(false);
	}
}

async function clearAllItems() {
	if (!confirm('買い物リストをすべて削除しますか？')) return;
	items = [];
	renderBoard();
	try {
		const res = await fetch('/api/items', { method: 'DELETE' });
		if (!res.ok) throw new Error('failed');
		lastItemsJson = '';
		await fetchItems();
	} catch (e) {
		setSyncOk(false);
	}
}

// ================== テンプレート 描画 ==================

function renderTemplate() {
	templateItemsEl.innerHTML = '';
	if (template.length === 0) {
		const empty = document.createElement('p');
		empty.className = 'empty';
		empty.textContent = 'テンプレートはまだありません。下の欄から追加してください。';
		templateItemsEl.appendChild(empty);
		return;
	}
	template.forEach((tpl) => {
		templateItemsEl.appendChild(buildTemplateRow(tpl));
	});
}

function buildTemplateRow(tpl) {
	const row = document.createElement('div');
	row.className = 'item-row';

	if (editingTemplateId === tpl.id) {
		const form = document.createElement('form');
		form.className = 'edit-form';

		const input = document.createElement('input');
		input.type = 'text';
		input.value = tpl.name;

		const saveBtn = document.createElement('button');
		saveBtn.type = 'submit';
		saveBtn.className = 'small-btn save';
		saveBtn.textContent = '保存';

		const cancelBtn = document.createElement('button');
		cancelBtn.type = 'button';
		cancelBtn.className = 'small-btn cancel';
		cancelBtn.textContent = 'キャンセル';
		cancelBtn.addEventListener('click', () => {
			editingTemplateId = null;
			renderTemplate();
		});

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const name = input.value.trim();
			if (!name) return;
			editingTemplateId = null;
			renameTemplateItem(tpl.id, name);
		});

		form.appendChild(input);
		form.appendChild(saveBtn);
		form.appendChild(cancelBtn);
		setTimeout(() => input.focus(), 0);
		row.appendChild(form);
		return row;
	}

	const name = document.createElement('span');
	name.className = 'item-name';
	name.textContent = tpl.name;

	const editBtn = document.createElement('button');
	editBtn.className = 'edit-btn';
	editBtn.textContent = '編集';
	editBtn.addEventListener('click', () => {
		editingTemplateId = tpl.id;
		renderTemplate();
	});

	const trash = document.createElement('button');
	trash.className = 'icon-btn trash';
	trash.setAttribute('aria-label', `${tpl.name}をテンプレートから削除`);
	trash.textContent = '×';
	trash.addEventListener('click', () => removeTemplateItem(tpl.id));

	row.appendChild(name);
	row.appendChild(editBtn);
	row.appendChild(trash);
	return row;
}

// ================== テンプレート API 呼び出し ==================

async function fetchTemplate() {
	try {
		const res = await fetch('/api/template');
		if (!res.ok) throw new Error('failed');
		template = await res.json();
		renderTemplate();
	} catch (e) {
		setSyncOk(false);
	}
}

async function addTemplateItem(name) {
	try {
		const res = await fetch('/api/template', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
		});
		if (!res.ok) throw new Error('failed');
		await fetchTemplate();
	} catch (e) {
		setSyncOk(false);
	}
}

async function renameTemplateItem(id, name) {
	try {
		const res = await fetch(`/api/template/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
		});
		if (!res.ok) throw new Error('failed');
		await fetchTemplate();
	} catch (e) {
		setSyncOk(false);
	}
}

async function removeTemplateItem(id) {
	try {
		const res = await fetch(`/api/template/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('failed');
		await fetchTemplate();
	} catch (e) {
		setSyncOk(false);
	}
}

async function copyTemplateToList() {
	try {
		const res = await fetch('/api/template/copy', { method: 'POST' });
		if (!res.ok) throw new Error('failed');
		lastItemsJson = '';
		await fetchItems();
	} catch (e) {
		setSyncOk(false);
	}
}

// ================== イベント登録 ==================

addForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const name = addInput.value.trim();
	if (!name) return;
	addInput.value = '';
	addItem(name);
});

clearCartBtn.addEventListener('click', clearPurchased);
clearAllBtn.addEventListener('click', clearAllItems);

toggleTemplateBtn.addEventListener('click', () => {
	const isHidden = templatePanel.hidden;
	templatePanel.hidden = !isHidden;
	toggleTemplateBtn.textContent = isHidden ? 'テンプレートを閉じる' : 'テンプレートを編集';
	if (isHidden) fetchTemplate();
});

templateAddForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const name = templateAddInput.value.trim();
	if (!name) return;
	templateAddInput.value = '';
	addTemplateItem(name);
});

copyTemplateBtn.addEventListener('click', copyTemplateToList);

// ================== 初期化 ==================

fetchItems();
setInterval(fetchItems, POLL_MS);
