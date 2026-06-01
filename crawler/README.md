# 题库爬虫脚本

独立 Node.js 脚本，用于抓取小学教育网站的公开题目资源并生成 JSON 导入文件。

## 安装

```bash
cd crawler
npm install
```

## 运行

```bash
# 抓取指定学科/年级
node crawler.js --subject=数学 --grade=六年级

# 抓取所有学科/年级
node crawler.js --subject=all --grade=all
```

## 导入

1. 打开微信开发者工具 → 云开发 → 数据库
2. 选择集合 `exam_questions`
3. 点击"导入" → 选择 `output/questions_*.json`

## 自定义爬取规则

在 `crawler.js` 中修改 `getUrlsFor()` 和 `parseQuestionsFromHtml()` 函数适配目标网站。
