/**
 * adminGuard — 管理员路由守卫
 *
 * 在管理页面 onLoad 中调用 checkAdminPermission，自动鉴权。
 *
 * 用法：
 *   var adminGuard = require('../../utils/adminGuard');
 *   adminGuard.checkAdminPermission(this, 'operator');
 */

var CACHE_KEY = '_admin_auth_cache';
var CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 校验管理员权限
 * @param {Page} page - 当前页面实例（用于 redirectTo）
 * @param {string} minRole - 最低角色要求：'operator' 或 'superadmin'
 * @returns {Promise<boolean>}
 */
async function checkAdminPermission(page, minRole) {
  minRole = minRole || 'operator';

  // 读缓存
  try {
    var cached = wx.getStorageSync(CACHE_KEY);
    if (cached && cached.expireAt > Date.now()) {
      if (!cached.isAdmin) {
        redirectUnauthorized(page);
        return false;
      }
      if (minRole === 'superadmin' && cached.role !== 'superadmin') {
        redirectUnauthorized(page, '仅超级管理员可访问');
        return false;
      }
      return true;
    }
  } catch (e) { /* 缓存读取失败，继续 */ }

  try {
    var res = await wx.cloud.callFunction({ name: 'authAdmin' });
    var auth = res.result || {};

    // 写缓存
    wx.setStorageSync(CACHE_KEY, {
      isAdmin: auth.isAdmin,
      role: auth.role,
      name: auth.name,
      expireAt: Date.now() + CACHE_TTL
    });

    if (!auth.isAdmin) {
      redirectUnauthorized(page);
      return false;
    }

    if (minRole === 'superadmin' && auth.role !== 'superadmin') {
      redirectUnauthorized(page, '仅超级管理员可访问此页面');
      return false;
    }

    return true;
  } catch (e) {
    console.error('权限校验失败:', e);
    redirectUnauthorized(page, '权限校验服务不可用');
    return false;
  }
}

/**
 * 检查当前用户是否为管理员（用于入口按钮显隐控制）
 * @returns {Promise<{isAdmin, role, name}>}
 */
async function isAdmin() {
  try {
    var cached = wx.getStorageSync(CACHE_KEY);
    if (cached && cached.expireAt > Date.now()) {
      return cached;
    }
  } catch (e) { /* */ }

  try {
    var res = await wx.cloud.callFunction({ name: 'authAdmin' });
    var auth = res.result || {};
    wx.setStorageSync(CACHE_KEY, {
      isAdmin: auth.isAdmin,
      role: auth.role,
      name: auth.name,
      expireAt: Date.now() + CACHE_TTL
    });
    return auth;
  } catch (e) {
    return { isAdmin: false, role: null };
  }
}

/**
 * 清除权限缓存（登出时调用）
 */
function clearAuthCache() {
  try { wx.removeStorageSync(CACHE_KEY); } catch (e) { /* */ }
}

function redirectUnauthorized(page, message) {
  wx.redirectTo({
    url: '/subpkg-admin/pages/unauthorized/unauthorized' + (message ? '?msg=' + encodeURIComponent(message) : '')
  });
}

module.exports = {
  checkAdminPermission: checkAdminPermission,
  isAdmin: isAdmin,
  clearAuthCache: clearAuthCache
};
