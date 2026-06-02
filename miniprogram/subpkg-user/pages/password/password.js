/** 密码页 - 家长模式密码锁 */
const storage = require('../../utils/storage');

Page({
  data: {
    keys: [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'],
    inputVal: '',
    inputLen: 0,
    errorMsg: ''
  },

  /** 点击按键 */
  onKeyTap(e) {
    const val = e.currentTarget.dataset.value;
    if (val === '') return;

    if (val === 'del') {
      // 删除
      if (this.data.inputLen === 0) return;
      this.setData({
        inputVal: this.data.inputVal.slice(0, -1),
        inputLen: this.data.inputLen - 1,
        errorMsg: ''
      });
      return;
    }

    // 输入数字
    if (this.data.inputLen >= 4) return;
    const newVal = this.data.inputVal + String(val);
    const newLen = this.data.inputLen + 1;
    this.setData({
      inputVal: newVal,
      inputLen: newLen,
      errorMsg: ''
    });

    // 输满4位自动验证
    if (newLen === 4) {
      this.verifyPassword(newVal);
    }
  },

  /** 验证密码 */
  verifyPassword(pwd) {
    const ok = storage.verifyPassword(pwd);
    if (ok) {
      storage.setParentUnlocked(true);
      wx.showToast({ title: '验证成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 500);
    } else {
      this.setData({
        errorMsg: '密码错误，请重试',
        inputVal: '',
        inputLen: 0
      });
      wx.vibrateShort({ type: 'medium' }).catch(() => {});
    }
  },

  /** 忘记密码 */
  onForgot() {
    wx.showModal({
      title: '重置密码',
      content: '重置密码将恢复为默认密码 1234，确认重置？',
      success: (res) => {
        if (res.confirm) {
          storage.changePassword('1234');
          wx.showToast({ title: '已重置为 1234', icon: 'none' });
        }
      }
    });
  }
});
