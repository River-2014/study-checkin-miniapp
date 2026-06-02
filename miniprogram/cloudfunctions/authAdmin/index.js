/**
 * authAdmin 云函数
 *
 * 校验当前调用者是否为管理员，返回角色信息。
 * 所有管理类云函数的第一步都是内部鉴权，不依赖前端传参。
 *
 * 入参: 无（自动从 wxContext 获取 openid）
 * 返回: { isAdmin, role, name }
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();

exports.main = async function(event, context) {
  var openid = cloud.getWXContext().OPENID;
  console.log('authAdmin 调用 openid:', openid);

  if (!openid) {
    console.log('authAdmin: 未获取到 openid');
    return { isAdmin: false, role: null, error: '无法获取用户身份' };
  }

  try {
    var res = await db.collection('admins').doc(openid).get();
    console.log('authAdmin: admins查询成功, role=' + (res.data ? res.data.role : '无'));
    if (res.data) {
      return {
        isAdmin: true,
        role: res.data.role || 'operator',
        name: res.data.name || ''
      };
    }
    console.log('authAdmin: admins 中无此 openid: ' + openid);
    return { isAdmin: false, role: null };
  } catch (e) {
    console.log('authAdmin: 查询失败, openid=' + openid + ', error=' + (e.message || '').substring(0, 80));
    return { isAdmin: false, role: null };
  }
};
