const cloud = require('wx-server-sdk');
cloud.init();
exports.main = async (event) => {
  var wxContext = cloud.getWXContext();
  return { openid: wxContext.OPENID };
};
