"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_RECORD_STORAGE_KEY = exports.GAME_RECORD_VERSION = void 0;
exports.createGameRecord = createGameRecord;
exports.resultText = resultText;
exports.recordToText = recordToText;
exports.recordToJson = recordToJson;
exports.loadGameRecords = loadGameRecords;
exports.saveGameRecord = saveGameRecord;
exports.toggleFavoriteRecord = toggleFavoriteRecord;
exports.deleteGameRecord = deleteGameRecord;
const moveNotation_1 = require("./moveNotation");
exports.GAME_RECORD_VERSION = 1;
exports.GAME_RECORD_STORAGE_KEY = 'jieqi.gameRecords.v1';
function nowIso() {
    return new Date().toISOString();
}
function safeStatus(status) {
    return status === 'red_win' || status === 'black_win' ? status : 'playing';
}
function fmtLocalDate(iso) {
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime()))
            return '時間未知';
        return d.toLocaleString();
    }
    catch {
        return '時間未知';
    }
}
function createGameRecord(input) {
    const now = nowIso();
    return {
        version: exports.GAME_RECORD_VERSION,
        id: input.id ?? 'record-' + Date.now(),
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
        title: input.title?.trim() || '未命名棋譜',
        moves: input.moves,
        finalStatus: safeStatus(input.finalStatus),
        moveCount: input.moves.length,
        note: input.note,
        redPlayer: input.redPlayer?.trim() || undefined,
        blackPlayer: input.blackPlayer?.trim() || undefined,
        endReason: input.endReason,
        timeoutSide: input.timeoutSide,
        redTimeMs: input.redTimeMs,
        blackTimeMs: input.blackTimeMs,
        variations: input.variations,
    };
}
function resultText(status) {
    if (status === 'red_win')
        return '紅方勝';
    if (status === 'black_win')
        return '黑方勝';
    return '進行中';
}
function recordToText(record) {
    const lines = [
        '局名：' + record.title,
        '時間：' + fmtLocalDate(record.createdAt),
        '紅方：' + (record.redPlayer ?? '紅方'),
        '黑方：' + (record.blackPlayer ?? '黑方'),
        '結果：' + resultText(record.finalStatus) + (record.endReason === 'timeout' ? '（' + (record.timeoutSide === 'red' ? '紅方' : '黑方') + '時間到）' : ''),
        '',
        ...record.moves.map((move, index) => (index + 1) + '. ' + (0, moveNotation_1.moveText)(move)),
    ];
    if (record.note)
        lines.push('', '備註：' + record.note);
    return lines.join('\n');
}
function recordToJson(record) {
    return JSON.stringify(record, null, 2);
}
function emptyList() {
    return { version: exports.GAME_RECORD_VERSION, records: [] };
}
function loadGameRecords(storage) {
    if (!storage)
        return [];
    try {
        const raw = storage.getItem(exports.GAME_RECORD_STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (parsed.version !== exports.GAME_RECORD_VERSION || !Array.isArray(parsed.records))
            return [];
        return parsed.records.filter(record => record?.version === exports.GAME_RECORD_VERSION && typeof record.id === 'string');
    }
    catch {
        return [];
    }
}
function saveGameRecord(storage, record) {
    if (!storage)
        return false;
    try {
        const records = loadGameRecords(storage);
        const nextRecord = { ...record, updatedAt: nowIso(), moveCount: record.moves.length };
        const index = records.findIndex(item => item.id === record.id);
        if (index >= 0) {
            const existing = records[index];
            records[index] = {
                ...nextRecord,
                createdAt: existing.createdAt,
                favorited: existing.favorited,
                note: nextRecord.note ?? existing.note,
                variations: nextRecord.variations ?? existing.variations,
            };
        }
        else
            records.unshift(nextRecord);
        storage.setItem(exports.GAME_RECORD_STORAGE_KEY, JSON.stringify({ ...emptyList(), records }));
        return true;
    }
    catch {
        return false;
    }
}
function toggleFavoriteRecord(storage, id) {
    if (!storage)
        return false;
    try {
        const records = loadGameRecords(storage);
        const index = records.findIndex(r => r.id === id);
        if (index < 0)
            return false;
        records[index] = { ...records[index], favorited: !records[index].favorited, updatedAt: new Date().toISOString() };
        storage.setItem(exports.GAME_RECORD_STORAGE_KEY, JSON.stringify({ ...emptyList(), records }));
        return true;
    }
    catch {
        return false;
    }
}
function deleteGameRecord(storage, id) {
    if (!storage)
        return false;
    try {
        const records = loadGameRecords(storage).filter(record => record.id !== id);
        storage.setItem(exports.GAME_RECORD_STORAGE_KEY, JSON.stringify({ ...emptyList(), records }));
        return true;
    }
    catch {
        return false;
    }
}
