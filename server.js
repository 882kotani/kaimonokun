const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// ファイルパス定義
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_PATH = path.join(DATA_DIR, 'items.json');
const TEMPLATE_PATH = path.join(DATA_DIR, 'template.json');

// data フォルダが存在しない場合は自動作成
if (!fs.existsSync(DATA_DIR)) {
	fs.mkdirSync(DATA_DIR, { recursive: true });
}

// JSONファイル読み込み用ヘルパー
function readJson(filePath) {
	if (!fs.existsSync(filePath)) return [];
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (e) {
		return [];
	}
}

// JSONファイル書き込み用ヘルパー
function writeJson(filePath, data) {
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================== 買い物リスト API ==================

app.get('/api/items', (req, res) => {
	res.json(readJson(ITEMS_PATH));
});

app.post('/api/items', (req, res) => {
	const items = readJson(ITEMS_PATH);
	const newItem = {
		id: crypto.randomUUID(),
		name: req.body.name,
		quantity: 1,
		checked: false,
	};
	items.push(newItem);
	writeJson(ITEMS_PATH, items);
	res.json(newItem);
});

app.put('/api/items/reorder', (req, res) => {
	writeJson(ITEMS_PATH, req.body);
	res.json(req.body);
});

app.patch('/api/items/:id', (req, res) => {
	let items = readJson(ITEMS_PATH);
	items = items.map((it) => {
		if (it.id === req.params.id) {
			return { ...it, ...req.body };
		}
		return it;
	});
	writeJson(ITEMS_PATH, items);
	res.json({ ok: true });
});

app.delete('/api/items/:id', (req, res) => {
	let items = readJson(ITEMS_PATH);
	items = items.filter((it) => it.id !== req.params.id);
	writeJson(ITEMS_PATH, items);
	res.json({ ok: true });
});

app.delete('/api/items', (req, res) => {
	writeJson(ITEMS_PATH, []);
	res.json({ ok: true });
});

app.post('/api/cart/clear', (req, res) => {
	let items = readJson(ITEMS_PATH);
	items = items.filter((it) => !it.checked);
	writeJson(ITEMS_PATH, items);
	res.json({ ok: true });
});

// ================== テンプレート API ==================

app.get('/api/template', (req, res) => {
	res.json(readJson(TEMPLATE_PATH));
});

app.post('/api/template', (req, res) => {
	const template = readJson(TEMPLATE_PATH);
	const newItem = {
		id: crypto.randomUUID(),
		name: req.body.name,
		quantity: 1,
	};
	template.push(newItem);
	writeJson(TEMPLATE_PATH, template);
	res.json(newItem);
});

app.put('/api/template/reorder', (req, res) => {
	writeJson(TEMPLATE_PATH, req.body);
	res.json(req.body);
});

app.patch('/api/template/:id', (req, res) => {
	let template = readJson(TEMPLATE_PATH);
	template = template.map((it) => {
		if (it.id === req.params.id) {
			return { ...it, ...req.body };
		}
		return it;
	});
	writeJson(TEMPLATE_PATH, template);
	res.json({ ok: true });
});

app.delete('/api/template/:id', (req, res) => {
	let template = readJson(TEMPLATE_PATH);
	template = template.filter((it) => it.id !== req.params.id);
	writeJson(TEMPLATE_PATH, template);
	res.json({ ok: true });
});

app.post('/api/template/copy', (req, res) => {
	const template = readJson(TEMPLATE_PATH);
	let items = readJson(ITEMS_PATH);
	const selectedIds = req.body && Array.isArray(req.body.ids) ? req.body.ids : null;

	const existingNames = new Set(items.filter((it) => !it.checked).map((it) => it.name));

	template.forEach((tpl) => {
		if (selectedIds && !selectedIds.includes(tpl.id)) {
			return;
		}
		if (!existingNames.has(tpl.name)) {
			items.push({
				id: crypto.randomUUID(),
				name: tpl.name,
				quantity: tpl.quantity || 1,
				checked: false,
			});
		}
	});

	writeJson(ITEMS_PATH, items);
	res.json(items);
});

app.listen(PORT, () => {
	console.log(`買い物メモを起動しました: http://localhost:${PORT}`);
});
