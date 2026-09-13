const RECORD_SHEET_NAME = '簽到紀錄';
const CODE_SHEET_NAME = '簽到碼';
const RECORD_HEADER = [
  '流水號',
  '伺服器時間',
  '會議代碼',
  '簽到碼',
  '收執號碼',
  '活動名稱',
  '活動日期',
  '地點',
  '預計人數',
  '姓名',
  '身分',
  '班級/單位',
  '電話',
  '是否代理',
  '被代理簽到碼',
  '被代理人姓名',
  '被代理人身分',
  '被代理人班級/單位',
  '備註',
  '本機時間',
  '前筆驗證碼',
  '本筆驗證碼'
];
const CODE_HEADER = ['會議代碼', '簽到碼', '姓名', '身分', '班級/單位', '狀態', '使用時間', '收執號碼'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const checkinCode = clean_(payload.checkinCode).toUpperCase();
    const proxyCode = clean_(payload.proxyCode).toUpperCase();
    const receiptCode = clean_(payload.receiptCode).toUpperCase() || makeReceiptCode_();
    let meetingCode = clean_(payload.meetingCode).toUpperCase();

    if (!checkinCode) {
      throw new Error('請輸入簽到碼');
    }

    const codeSheet = getCodeSheet_();
    const codeRecord = meetingCode
      ? findCode_(codeSheet, meetingCode, checkinCode)
      : findCodeByCheckinCode_(codeSheet, checkinCode);
    if (!codeRecord) throw new Error('簽到碼不在本次會議名單中');
    meetingCode = codeRecord.meetingCode;
    if (codeRecord.status && codeRecord.status !== '未使用') throw new Error('此簽到碼已使用');

    let proxyCodeRecord = null;
    if (payload.isProxy) {
      assertAssignedPerson_(codeRecord, payload);
      if (!proxyCode) throw new Error('請輸入被代理人的簽到碼');
      if (proxyCode === checkinCode) throw new Error('被代理人的簽到碼不能和自己的簽到碼相同');
      proxyCodeRecord = findCode_(codeSheet, meetingCode, proxyCode);
      if (!proxyCodeRecord) throw new Error('被代理人的簽到碼不在本次會議名單中');
      if (proxyCodeRecord.status && proxyCodeRecord.status !== '未使用') throw new Error('被代理人的簽到碼已使用');
      assertProxyTarget_(proxyCodeRecord, payload);
    } else {
      assertAssignedPerson_(codeRecord, payload);
    }

    const sheet = getRecordSheet_();
    const serial = Math.max(sheet.getLastRow(), 1);
    const serverTime = new Date();
    const previousHash = PropertiesService.getScriptProperties().getProperty('lastHash') || '';

    const rowCore = [
      serial,
      serverTime,
      meetingCode,
      checkinCode,
      receiptCode,
      clean_(payload.eventName),
      clean_(payload.eventDate),
      clean_(payload.eventPlace),
      clean_(payload.expectedCount),
      clean_(payload.name),
      clean_(payload.role),
      clean_(payload.groupName),
      clean_(payload.phone),
      payload.isProxy ? '是' : '否',
      payload.isProxy ? proxyCode : '',
      clean_(payload.proxyName),
      clean_(payload.proxyRole),
      clean_(payload.proxyGroupName),
      clean_(payload.note),
      clean_(payload.localIso),
      previousHash
    ];
    const rowHash = sha256_([...rowCore, clean_(payload.id), previousHash].join('|'));

    sheet.appendRow([...rowCore, rowHash]);
    markCodeUsed_(codeSheet, codeRecord.row, serverTime, receiptCode);
    if (proxyCodeRecord) markCodeUsed_(codeSheet, proxyCodeRecord.row, serverTime, receiptCode);
    PropertiesService.getScriptProperties().setProperty('lastHash', rowHash);

    return json_({
      ok: true,
      serial,
      receiptCode,
      serverTime: serverTime.toISOString(),
      rowHash
    });
  } catch (error) {
    return json_({
      ok: false,
      error: String(error)
    });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  setupSheets();
  const action = clean_(e && e.parameter && e.parameter.action).toLowerCase();
  if (action === 'lookup') {
    return lookupCodeForClient_(e.parameter || {});
  }

  return json_({
    ok: true,
    message: 'Bo-ai check-in backend is ready.'
  });
}

function setupSheets() {
  getRecordSheet_();
  getCodeSheet_();
}

function getRecordSheet_() {
  return getSheet_(RECORD_SHEET_NAME, RECORD_HEADER);
}

function getCodeSheet_() {
  return getSheet_(CODE_SHEET_NAME, CODE_HEADER);
}

function getSheet_(sheetName, header) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function findCode_(sheet, meetingCode, checkinCode) {
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index += 1) {
    const row = values[index];
    if (clean_(row[0]).toUpperCase() === meetingCode && clean_(row[1]).toUpperCase() === checkinCode) {
      return {
        row: index + 1,
        meetingCode: clean_(row[0]).toUpperCase(),
        checkinCode: clean_(row[1]).toUpperCase(),
        name: clean_(row[2]),
        role: clean_(row[3]),
        groupName: clean_(row[4]),
        status: clean_(row[5])
      };
    }
  }
  return null;
}

function findCodeByCheckinCode_(sheet, checkinCode) {
  const values = sheet.getDataRange().getValues();
  const matches = [];

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index];
    if (clean_(row[1]).toUpperCase() === checkinCode) {
      matches.push({
        row: index + 1,
        meetingCode: clean_(row[0]).toUpperCase(),
        checkinCode: clean_(row[1]).toUpperCase(),
        name: clean_(row[2]),
        role: clean_(row[3]),
        groupName: clean_(row[4]),
        status: clean_(row[5])
      });
    }
  }

  const activeMatches = matches.filter((record) => record.status !== '停用');
  if (activeMatches.length === 1) return activeMatches[0];
  if (activeMatches.length > 1) throw new Error('這組簽到碼對應到多場會議，請聯絡秘書處');
  return null;
}

function lookupCodeForClient_(params) {
  try {
    const checkinCode = clean_(params.checkinCode).toUpperCase();
    if (!checkinCode) throw new Error('請輸入簽到碼');

    const codeSheet = getCodeSheet_();
    const codeRecord = findCodeByCheckinCode_(codeSheet, checkinCode);
    if (!codeRecord) throw new Error('找不到這組簽到碼，請確認是否為本次會議');

    return json_({
      ok: true,
      meetingCode: codeRecord.meetingCode,
      eventName: clean_(params.eventName),
      eventDate: clean_(params.eventDate),
      eventPlace: clean_(params.eventPlace),
      expectedCount: clean_(params.expectedCount),
      status: codeRecord.status || '未使用',
      representative: {
        name: codeRecord.name,
        role: codeRecord.role || '家長代表',
        groupName: codeRecord.groupName
      }
    });
  } catch (error) {
    return json_({
      ok: false,
      error: String(error).replace(/^Error:\s*/, '')
    });
  }
}

function assertAssignedPerson_(codeRecord, payload) {
  const expected = [codeRecord.name, codeRecord.role, codeRecord.groupName].filter(Boolean);
  if (!expected.length) return;

  if (codeRecord.name && codeRecord.name !== clean_(payload.name)) throw new Error('簽到姓名與名單不符');
  if (codeRecord.role && codeRecord.role !== clean_(payload.role)) throw new Error('簽到身分與名單不符');
  if (codeRecord.groupName && codeRecord.groupName !== clean_(payload.groupName)) throw new Error('簽到班級或單位與名單不符');
}

function assertProxyTarget_(codeRecord, payload) {
  if (codeRecord.name && codeRecord.name !== clean_(payload.proxyName)) throw new Error('被代理人姓名與名單不符');
  if (codeRecord.role && codeRecord.role !== clean_(payload.proxyRole)) throw new Error('被代理人身分與名單不符');
  if (codeRecord.groupName && codeRecord.groupName !== clean_(payload.proxyGroupName)) throw new Error('被代理人班級或單位與名單不符');
}

function markCodeUsed_(sheet, row, serverTime, receiptCode) {
  sheet.getRange(row, 6, 1, 3).setValues([['已使用', serverTime, receiptCode]]);
}

function clean_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function sha256_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return digest.map((byte) => {
    const value = byte < 0 ? byte + 256 : byte;
    return (`0${value.toString(16)}`).slice(-2);
  }).join('');
}

function makeReceiptCode_() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${Utilities.getUuid()}|${Date.now()}|${Math.random()}`,
    Utilities.Charset.UTF_8
  );
  let result = '';
  for (let index = 0; index < 10; index += 1) {
    const value = digest[index] < 0 ? digest[index] + 256 : digest[index];
    result += alphabet[value % alphabet.length];
  }
  return `${result.slice(0, 4)}-${result.slice(4, 7)}-${result.slice(7)}`;
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
