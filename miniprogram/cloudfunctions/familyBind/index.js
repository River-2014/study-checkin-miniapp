/**
 * familyBind 云函数
 * 家长创建邀请码 / 孩子加入家庭
 * action: 'createInvite' | 'joinFamily'
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const usersCollection = db.collection('users');
const invitationsCollection = db.collection('invitations');

function generateCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: { code: 'AUTH_FAIL', message: '获取用户身份失败' } };

  try {
    if (event.action === 'createInvite') {
      // 家长生成邀请码
      var code = generateCode();
      // 确保唯一性
      var existing = await invitationsCollection.where({ code: code, isUsed: false }).get();
      while (existing.data && existing.data.length > 0) {
        code = generateCode();
        existing = await invitationsCollection.where({ code: code, isUsed: false }).get();
      }
      await invitationsCollection.add({
        data: {
          code: code,
          parentOpenid: OPENID,
          expireTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isUsed: false,
          createdAt: db.serverDate()
        }
      });
      return { success: true, data: { code: code } };
    }

    if (event.action === 'joinFamily') {
      // 孩子输入邀请码加入家庭
      var code = event.familyCode;
      if (!code || code.length !== 6) {
        return { success: false, error: { code: 'INVALID_CODE', message: '邀请码格式不正确' } };
      }
      var inviteResult = await invitationsCollection.where({
        code: code,
        isUsed: false
      }).get();

      if (!inviteResult.data || inviteResult.data.length === 0) {
        return { success: false, error: { code: 'CODE_EXPIRED', message: '邀请码无效' } };
      }
      var invite = inviteResult.data[0];

      // 检查邀请码是否过期（24小时有效）
      var expireTime = invite.expireTime ? new Date(invite.expireTime).getTime() : 0;
      if (Date.now() > expireTime) {
        return { success: false, error: { code: 'CODE_EXPIRED', message: '邀请码已过期' } };
      }
      var parentOpenid = invite.parentOpenid;

      // 检查该孩子是否已被绑定 / 获取已有孩子文档
      var childName = event.childName || '孩子';
      var childResult = await usersCollection.where({ _openid: OPENID }).get();
      if (childResult.data && childResult.data.length > 0 && childResult.data[0].parentOpenid) {
        return { success: false, error: { code: 'ALREADY_BOUND', message: '该账号已被其他家庭绑定' } };
      }
      if (childResult.data && childResult.data.length > 0) {
        // 更新已有孩子文档
        await usersCollection.doc(childResult.data[0]._id).update({
          data: {
            role: 'child',
            parentOpenid: parentOpenid,
            nickname: childName,
            avatar: event.avatar || ''
          }
        });
      } else {
        await usersCollection.add({
          data: {
            _openid: OPENID,
            role: 'child',
            nickname: childName,
            avatar: event.avatar || '',
            parentOpenid: parentOpenid,
            createdAt: db.serverDate(),
            lastLoginAt: db.serverDate()
          }
        });
      }

      // 将孩子信息加入家长的 children 数组
      var parentResult = await usersCollection.where({ _openid: parentOpenid }).get();
      if (parentResult.data && parentResult.data.length > 0) {
        var parent = parentResult.data[0];
        var children = parent.children || [];
        // 去重
        var exists = false;
        for (var i = 0; i < children.length; i++) {
          if (children[i].childOpenid === OPENID) { exists = true; break; }
        }
        if (!exists) {
          children.push({ childOpenid: OPENID, childName: childName, avatar: event.avatar || '' });
          await usersCollection.doc(parent._id).update({ data: { children: children } });
        }
      }

      // 标记邀请码已使用
      await invitationsCollection.doc(invite._id).update({ data: { isUsed: true } });

      return { success: true, data: { parentOpenid: parentOpenid } };
    }

    return { success: false, error: { code: 'INVALID_ACTION', message: '未知操作' } };
  } catch (e) {
    return { success: false, error: { code: 'DB_ERR', message: e.message } };
  }
};
