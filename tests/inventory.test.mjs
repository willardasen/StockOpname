import assert from 'node:assert/strict';
import test from 'node:test';
import { read } from 'xlsx';
import { parseQuantity, totalQuantity } from '../src/lib/quantity.ts';
import { exportToExcel } from '../src/utils/excel.ts';

test('BOX and SIZE quantities use whole base units', () => {
  assert.equal(parseQuantity(''), 0);
  assert.equal(parseQuantity('1.234'), 1234);
  for (const value of ['-1', '1,5', '1.5', '1.23.456', '9007199254740992']) {
    assert.ok(Number.isNaN(parseQuantity(value)));
  }
  assert.equal(totalQuantity('BOX', 12, 2, 3), 27);
  assert.equal(totalQuantity('SIZE', 12, 2, 3), 3);
  assert.equal(totalQuantity('SIZE', 1, 2, 0), 0);
  assert.ok(Number.isNaN(totalQuantity('BOX', 10, Number.MAX_SAFE_INTEGER, 0)));
});

test('Excel export preserves numeric quantities, text cells and cancellation', async () => {
  const notices = [];
  let sent;
  let save = true;
  globalThis.window = { __TAURI_INTERNALS__: {
    invoke: async (command, payload) => {
      assert.equal(command, 'export_workbook');
      sent = payload;
      return save;
    },
  } };
  globalThis.alert = text => notices.push(text);
  try {
    const rows = [{ Tanggal: '02/01/2026 23:58', Jumlah: -2, Satuan: 'Pasang', Catatan: '=1+1' }];
    await exportToExcel(rows, 'riwayat');
    assert.equal(sent.filename, 'riwayat.xlsx');
    const book = read(Uint8Array.from(sent.bytes), { type: 'array' });
    const sheet = book.Sheets[book.SheetNames[0]];
    assert.equal(sheet.A2.v, rows[0].Tanggal);
    assert.equal(sheet.B2.t, 'n');
    assert.equal(sheet.B2.v, -2);
    assert.equal(sheet.C2.v, 'Pasang');
    assert.equal(sheet.D2.t, 's');
    assert.equal(sheet.D2.v, '=1+1');
    assert.equal(sheet.D2.f, undefined);
    assert.equal(notices.length, 1);
    save = false;
    await exportToExcel(rows, 'riwayat.xlsx');
    assert.equal(notices.length, 1);
  } finally {
    delete globalThis.window;
    delete globalThis.alert;
  }
});
