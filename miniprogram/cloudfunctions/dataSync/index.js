/**
 * dataSync 云函数
 * 数据同步：上传/下载/合并，基于时间戳版本冲突检测
 * action: 'upload' | 'download' | 'merge'
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const userDataCollection = db.collection('user_data');

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: { code: 'AUTH_FAIL', message: '获取用户身份失败' } };

  try {
    var childId = event.childId || OPENID;
    var recordId = OPENID + '_' + childId;

    if (event.action === 'upload') {
      var data = event.data;
      var clientVersion = event.clientVersion || 0;
      var newVersion = Date.now();

      // 查找现有记录
      var existing = await userDataCollection.where({
        _openid: OPENID,
        recordId: recordId
      }).get();

      if (existing.data && existing.data.length > 0) {
        var doc = existing.data[0];
        // 冲突检测：如果云端版本更新则拒绝覆盖
        if (doc.version && clientVersion && doc.version > clientVersion) {
          return {
            success: false,
            conflict: true,
            error: { code: 'VERSION_CONFLICT', message: '云端数据更新，请先下载合并' },
            serverData: doc
          };
        }
        await userDataCollection.doc(doc._id).update({
          data: {
            data: data,
            version: newVersion,
            updatedAt: db.serverDate()
          }
        });
      } else {
        await userDataCollection.add({
          data: {
            _openid: OPENID,
            recordId: recordId,
            childId: childId,
            data: data,
            version: newVersion,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
      }
      return { success: true, version: newVersion };
    }

    if (event.action === 'download') {
      var existing = await userDataCollection.where({
        _openid: OPENID,
        recordId: recordId
      }).get();

      if (existing.data && existing.data.length > 0) {
        return { success: true, data: existing.data[0].data, version: existing.data[0].version };
      }
      return { success: true, data: null, version: 0 };
    }

    if (event.action === 'merge') {
      var existing = await userDataCollection.where({
        _openid: OPENID,
        recordId: recordId
      }).get();

      if (!existing.data || existing.data.length === 0) {
        // 云端无数据，上传本地数据
        var newVersion = Date.now();
        await userDataCollection.add({
          data: {
            _openid: OPENID,
            recordId: recordId,
            childId: childId,
            data: event.localData,
            version: newVersion,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        return { success: true, source: 'local', version: newVersion };
      }

      var serverDoc = existing.data[0];
      var serverVersion = serverDoc.version || 0;
      var localVersion = event.localVersion || 0;

      if (serverVersion >= localVersion) {
        // 云端更新或相同，使用云端数据
        return { success: true, source: 'server', data: serverDoc.data, version: serverVersion };
      } else {
        // 本地更新，上传覆盖
        await userDataCollection.doc(serverDoc._id).update({
          data: {
            data: event.localData,
            version: localVersion,
            updatedAt: db.serverDate()
          }
        });
        return { success: true, source: 'local', version: localVersion };
      }
    }

    return { success: false, error: { code: 'INVALID_ACTION', message: '未知操作' } };
  } catch (e) {
    return { success: false, error: { code: 'DB_ERR', message: e.message } };
  }
};
