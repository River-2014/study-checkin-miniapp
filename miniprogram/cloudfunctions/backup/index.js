const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event) => {
  var type = event.type;
  var data = event.data;
  var wxContext = cloud.getWXContext();
  var openid = wxContext.OPENID;

  if (type === 'save') {
    var exist = await db.collection('backups').where({ openid: openid }).get();
    if (exist.data.length > 0) {
      await db.collection('backups').doc(exist.data[0]._id).update({
        data: { backupData: data, updatedAt: db.serverDate() }
      });
    } else {
      await db.collection('backups').add({
        data: { openid: openid, backupData: data, createdAt: db.serverDate() }
      });
    }
    return { success: true };
  } else if (type === 'load') {
    var res = await db.collection('backups').where({ openid: openid }).get();
    return { success: true, data: res.data[0] ? res.data[0].backupData : null };
  }
  return { success: false, message: '未知操作' };
};
