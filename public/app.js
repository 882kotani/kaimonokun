const POLL_MS = 4000;

const addForm = document.getElementById('addForm');
const addInput = document.getElementById('addInput');
const listItemsEl = document.getElementById('listItems');
const listEmptyEl = document.getElementById('listEmpty');
const listCountEl = document.getElementById('listCount');
const clearCartBtn = document.getElementById('clearCartBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const syncStatusEl = document.getElementById('syncStatus');

// モーダル用要素
const openTemplateBtn = document.getElementById('openTemplateBtn');
const closeTemplateBtn = document.getElementById('closeTemplateBtn');
const templateModal = document.getElementById('templateModal');
const templateItemsEl = document.getElementById('templateItems');
const templateAddForm = document.getElementById('templateAddForm');
const templateAddInput = document.getElementById('templateAddInput');
const copyTemplateBtn = document.getElementById('copyTemplateBtn');

let items = [];
let template = [];
let lastItemsJson = '';
let editingItemId = null;
let editingTemplateId = null;

// 買い物リスト用 ドラッグ状態管理
let draggedIndex = null;
let touchDraggedIndex = null;
let touchTimer = null;
let isLongPress = false;

// テンプレート用 ドラッグ状態管理
let tplDraggedIndex = null;
let tplTouchDraggedIndex = null;
let tplTouchTimer = null;
let tplIsLongPress = false;

function setSyncOk(ok) {
	syncStatusEl.textContent = ok ? '同期中' : '同期エラー';
	syncStatusEl.classList.toggle('error', !ok);
}

function sortItemsByChecked() {
	const unchecked = items.filter((it) => !it.checked);
	const checked = items.filter((it) => it.checked);
	items = [...unchecked, ...checked];
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

	// PC用ドラッグ
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
		document
			.querySelectorAll('#listItems .item-row')
			.forEach((r) => r.classList.remove('drag-over'));
	});

	// スマホ用長押しドラッグ
	row.addEventListener(
		'touchstart',
		(e) => {
			if (e.target.closest('.checkbox, .qty-control, .edit-btn, .trash, button, input')) return;

			touchDraggedIndex = null;
			isLongPress = false;

			touchTimer = setTimeout(() => {
				isLongPress = true;
				touchDraggedIndex = index;
				row.classList.add('dragging');
				if (navigator.vibrate) navigator.vibrate(40);
			}, 300);
		},
		{ passive: true },
	);

	row.addEventListener(
		'touchmove',
		(e) => {
			if (!isLongPress) {
				clearTimeout(touchTimer);
				return;
			}

			if (touchDraggedIndex !== null) {
				if (e.cancelable) e.preventDefault();

				const touch = e.touches[0];
				const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
				const targetRow = targetEl ? targetEl.closest('#listItems .item-row') : null;

				document
					.querySelectorAll('#listItems .item-row')
					.forEach((r) => r.classList.remove('drag-over'));
				if (targetRow && targetRow !== row) {
					targetRow.classList.add('drag-over');
				}
			}
		},
		{ passive: false },
	);

	row.addEventListener('touchend', async (e) => {
		clearTimeout(touchTimer);

		if (touchDraggedIndex !== null) {
			row.classList.remove('dragging');
			const changedTouch = e.changedTouches[0];
			const targetEl = document.elementFromPoint(changedTouch.clientX, changedTouch.clientY);
			const targetRow = targetEl ? targetEl.closest('#listItems .item-row') : null;

			document
				.querySelectorAll('#listItems .item-row')
				.forEach((r) => r.classList.remove('drag-over'));

			if (targetRow) {
				const targetIndex = Array.from(listItemsEl.children).indexOf(targetRow);
				if (targetIndex !== -1 && touchDraggedIndex !== targetIndex) {
					const [movedItem] = items.splice(touchDraggedIndex, 1);
					items.splice(targetIndex, 0, movedItem);
					renderBoard();
					await saveReorder();
				}
			}
		}
		touchDraggedIndex = null;
		isLongPress = false;
	});

	row.addEventListener('touchcancel', () => {
		clearTimeout(touchTimer);
		row.classList.remove('dragging');
		document
			.querySelectorAll('#listItems .item-row')
			.forEach((r) => r.classList.remove('drag-over'));
		touchDraggedIndex = null;
		isLongPress = false;
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

	const qtyControl = document.createElement('div');
	qtyControl.className = 'qty-control';

	const minusBtn = document.createElement('button');
	minusBtn.className = 'qty-btn minus';
	minusBtn.textContent = '−';
	minusBtn.setAttribute('aria-label', `${it.name}の個数を減らす`);
	minusBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		const currentQty = it.quantity || 1;
		if (currentQty > 1) {
			updateQuantity(it.id, currentQty - 1);
		}
	});

	const qtyVal = document.createElement('span');
	qtyVal.className = 'qty-val';
	qtyVal.textContent = String(it.quantity || 1);

	const plusBtn = document.createElement('button');
	plusBtn.className = 'qty-btn plus';
	plusBtn.textContent = '＋';
	plusBtn.setAttribute('aria-label', `${it.name}の個数を増やす`);
	plusBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		const currentQty = it.quantity || 1;
		updateQuantity(it.id, currentQty + 1);
	});

	qtyControl.appendChild(minusBtn);
	qtyControl.appendChild(qtyVal);
	qtyControl.appendChild(plusBtn);

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
	row.appendChild(qtyControl);
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

// ================== 買い物リスト API ==================

async function fetchItems() {
	try {
		const res = await fetch('/api/items');
		if (!res.ok) throw new Error('failed');
		const data = await res.json();
		const json = JSON.stringify(data);
		if (json !== lastItemsJson) {
			items = data;
			sortItemsByChecked();
			lastItemsJson = JSON.stringify(items);
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

async function updateQuantity(id, quantity) {
	items = items.map((it) => (it.id === id ? { ...it, quantity } : it));
	renderBoard();
	try {
		const res = await fetch(`/api/items/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ quantity }),
		});
		if (!res.ok) throw new Error('failed');
		await saveReorder();
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
	sortItemsByChecked();
	renderBoard();
	try {
		const res = await fetch(`/api/items/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ checked }),
		});
		if (!res.ok) throw new Error('failed');
		await saveReorder();
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

// ================== テンプレート モーダル 描画 ==================

function renderTemplate() {
	templateItemsEl.innerHTML = '';
	if (template.length === 0) {
		const empty = document.createElement('p');
		empty.className = 'empty';
		empty.textContent = 'テンプレートはまだありません。下の欄から追加してください。';
		templateItemsEl.appendChild(empty);
		return;
	}
	template.forEach((tpl, index) => {
		templateItemsEl.appendChild(buildTemplateRow(tpl, index));
	});
}

function buildTemplateRow(tpl, index) {
	const row = document.createElement('div');
	row.className = 'item-row';
	row.draggable = true;

	// PC用ドラッグ
	row.addEventListener('dragstart', (e) => {
		tplDraggedIndex = index;
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
		if (tplDraggedIndex !== null && tplDraggedIndex !== index) {
			const [movedItem] = template.splice(tplDraggedIndex, 1);
			template.splice(index, 0, movedItem);
			renderTemplate();
			await saveTemplateReorder();
		}
		tplDraggedIndex = null;
	});

	row.addEventListener('dragend', () => {
		row.classList.remove('dragging');
		document
			.querySelectorAll('#templateItems .item-row')
			.forEach((r) => r.classList.remove('drag-over'));
	});

	// スマホ用長押しドラッグ
	row.addEventListener(
		'touchstart',
		(e) => {
			if (e.target.closest('.edit-btn, .trash, button, input')) return;

			tplTouchDraggedIndex = null;
			tplIsLongPress = false;

			tplTouchTimer = setTimeout(() => {
				tplIsLongPress = true;
				tplTouchDraggedIndex = index;
				row.classList.add('dragging');
				if (navigator.vibrate) navigator.vibrate(40);
			}, 300);
		},
		{ passive: true },
	);

	row.addEventListener(
		'touchmove',
		(e) => {
			if (!tplIsLongPress) {
				clearTimeout(tplTouchTimer);
				return;
			}

			if (tplTouchDraggedIndex !== null) {
				if (e.cancelable) e.preventDefault();

				const touch = e.touches[0];
				const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
				const targetRow = targetEl ? targetEl.closest('#templateItems .item-row') : null;

				document
					.querySelectorAll('#templateItems .item-row')
					.forEach((r) => r.classList.remove('drag-over'));
				if (targetRow && targetRow !== row) {
					targetRow.classList.add('drag-over');
				}
			}
		},
		{ passive: false },
	);

	row.addEventListener('touchend', async (e) => {
		clearTimeout(tplTouchTimer);

		if (tplTouchDraggedIndex !== null) {
			row.classList.remove('dragging');
			const changedTouch = e.changedTouches[0];
			const targetEl = document.elementFromPoint(changedTouch.clientX, changedTouch.clientY);
			const targetRow = targetEl ? targetEl.closest('#templateItems .item-row') : null;

			document
				.querySelectorAll('#templateItems .item-row')
				.forEach((r) => r.classList.remove('drag-over'));

			if (targetRow) {
				const targetIndex = Array.from(templateItemsEl.children).indexOf(targetRow);
				if (targetIndex !== -1 && tplTouchDraggedIndex !== targetIndex) {
					const [movedItem] = template.splice(tplTouchDraggedIndex, 1);
					template.splice(targetIndex, 0, movedItem);
					renderTemplate();
					await saveTemplateReorder();
				}
			}
		}
		tplTouchDraggedIndex = null;
		tplIsLongPress = false;
	});

	row.addEventListener('touchcancel', () => {
		clearTimeout(tplTouchTimer);
		row.classList.remove('dragging');
		document
			.querySelectorAll('#templateItems .item-row')
			.forEach((r) => r.classList.remove('drag-over'));
		tplTouchDraggedIndex = null;
		tplIsLongPress = false;
	});

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

// ================== テンプレート API ==================

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

async function saveTemplateReorder() {
	try {
		const res = await fetch('/api/template/reorder', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(template),
		});
		if (!res.ok) throw new Error('failed');
		setSyncOk(true);
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

// モーダル操作
openTemplateBtn.addEventListener('click', () => {
	templateModal.hidden = false;
	fetchTemplate();
});

closeTemplateBtn.addEventListener('click', () => {
	templateModal.hidden = true;
});

// モーダルの背景クリックで閉じる
templateModal.addEventListener('click', (e) => {
	if (e.target === templateModal) {
		templateModal.hidden = true;
	}
});

templateAddForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const name = templateAddInput.value.trim();
	if (!name) return;
	templateAddInput.value = '';
	addTemplateItem(name);
});

copyTemplateBtn.addEventListener('click', () => {
	if (confirm('テンプレートの項目をリストに追加しますか？')) {
		copyTemplateToList();
	}
});

// ================== 初期化 ==================

fetchItems();
setInterval(fetchItems, POLL_MS);
