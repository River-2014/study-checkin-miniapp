/** 日期工具函数 */

/** 获取今日日期字符串 YYYY-MM-DD */
function getTodayStr() {
  const d = new Date();
  return formatDate(d);
}

/** 获取昨日日期字符串 YYYY-MM-DD */
function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

/** Date对象转 YYYY-MM-DD */
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 获取当前月份的第一天是星期几（0=周日） */
function getFirstDayOfMonth(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

/** 获取某月的总天数 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** 判断两个日期是否为同一天 */
function isSameDay(d1, d2) {
  return formatDate(d1) === formatDate(d2);
}

module.exports = {
  getTodayStr,
  getYesterdayStr,
  formatDate,
  getFirstDayOfMonth,
  getDaysInMonth,
  isSameDay
};
