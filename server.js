const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ITEMS_FILE = path.join(__dirname, 'data', 'items.json');
const TEMPLATE_FILE = path.join(__dirname, 'data', 'template.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- 共通のファイル読み書き ----

function readJson(file) {
	try {
		const raw = fs.readFileSync(file, 'utf-8');
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (e) {
		return [];
	}
}

function writeJson(file, data) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

const readItems = () => readJson(ITEMS_FILE);
const writeItems = (data) => writeJson(ITEMS_FILE, data);
const readTemplate = () => readJson(TEMPLATE_FILE);
const writeTemplate = (data) => writeJson(TEMPLATE_FILE, data);

// ================== 買い物リスト API ==================

// 一覧取得
app.get('/api/items', (req, res) => {
	res.json(readItems());
});

// 追加
app.post('/api/items', (req, res) => {
	const name = (req.body?.name || '').trim();
	if (!name) {
		return res.status(400).json({ error: '商品名を入力してください。' });
	}
	const items = readItems();
	const newItem = {
		id: crypto.randomUUID(),
		name,
		checked: false,
		createdAt: Date.now(),
	};
	items.push(newItem);
	writeItems(items);
	res.status(201).json(newItem);
});

// 並び替え（一括更新）
app.put('/api/items/reorder', (req, res) => {
	if (!Array.isArray(req.body)) {
		return res.status(400).json({ error: '配列形式で送信してください。' });
	}
	writeItems(req.body);
	res.json(req.body);
});

// チェック状態の切り替え、または名前の編集
app.patch('/api/items/:id', (req, res) => {
	const items = readItems();
	const item = items.find((it) => it.id === req.params.id);
	if (!item) {
		return res.status(404).json({ error: 'アイテムが見つかりません。' });
	}
	if (typeof req.body?.checked === 'boolean') {
		item.checked = req.body.checked;
	}
	if (typeof req.body?.name === 'string') {
		const trimmed = req.body.name.trim();
		if (!trimmed) {
			return res.status(400).json({ error: '商品名を入力してください。' });
		}
		item.name = trimmed;
	}
	writeItems(items);
	res.json(item);
});

// 1件削除
app.delete('/api/items/:id', (req, res) => {
	const items = readItems();
	const next = items.filter((it) => it.id !== req.params.id);
	writeItems(next);
	res.status(204).end();
});

// 購入済み（チェック済み）を一括削除
app.post('/api/cart/clear', (req, res) => {
	const items = readItems();
	const next = items.filter((it) => !it.checked);
	writeItems(next);
	res.json(next);
});

// 買い物リストを全件削除（追加機能）
app.delete('/api/items', (req, res) => {
	writeItems([]);
	res.status(204).end();
});

// ================== テンプレート API ==================

// テンプレート一覧取得
app.get('/api/template', (req, res) => {
	res.json(readTemplate());
});

// テンプレートに追加
app.post('/api/template', (req, res) => {
	const name = (req.body?.name || '').trim();
	if (!name) {
		return res.status(400).json({ error: '商品名を入力してください。' });
	}
	const template = readTemplate();
	const newItem = { id: crypto.randomUUID(), name };
	template.push(newItem);
	writeTemplate(template);
	res.status(201).json(newItem);
});

// テンプレート項目の名前を編集
app.patch('/api/template/:id', (req, res) => {
	const template = readTemplate();
	const item = template.find((it) => it.id === req.params.id);
	if (!item) {
		return res.status(404).json({ error: 'テンプレート項目が見つかりません。' });
	}
	const name = (req.body?.name || '').trim();
	if (!name) {
		return res.status(400).json({ error: '商品名を入力してください。' });
	}
	item.name = name;
	writeTemplate(template);
	res.json(item);
});

// テンプレート項目を削除
app.delete('/api/template/:id', (req, res) => {
	const template = readTemplate();
	const next = template.filter((it) => it.id !== req.params.id);
	writeTemplate(next);
	res.status(204).end();
});

// テンプレートを買い物リストにコピー（未チェックの新規アイテムとして追加）
app.post('/api/template/copy', (req, res) => {
	const template = readTemplate();
	const items = readItems();
	const existingNames = new Set(items.map((it) => it.name));
	template.forEach((tpl) => {
		// 同名の未購入アイテムが既にある場合は重複追加しない
		if (existingNames.has(tpl.name)) return;
		items.push({
			id: crypto.randomUUID(),
			name: tpl.name,
			checked: false,
			createdAt: Date.now(),
		});
		existingNames.add(tpl.name);
	});
	writeItems(items);
	res.json(items);
});

app.listen(PORT, () => {
	console.log(`買い物メモを起動しました: http://localhost:${PORT}`);
});
