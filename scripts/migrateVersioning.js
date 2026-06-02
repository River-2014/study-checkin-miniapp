/**
 * 题目版本控制迁移工具
 *
 * 为 exam_questions 添加 familyId, versionNumber, isLatest, contentHash 字段。
 *
 * @cloudbase/node-sdk 需要腾讯云密钥，推荐使用云函数方式（无需密钥）。
 *
 * 运行本脚本查看详细操作说明:
 *   node scripts/migrateVersioning.js
 */

console.log('========================================');
console.log('题目版本控制迁移工具');
console.log('========================================\n');

console.log('★★★ 方式一：通过云函数执行（推荐）\n');
console.log('步骤:');
console.log('  1. 微信开发者工具中，右键 miniprogram/cloudfunctions/migrateVersioning');
console.log('  2. 选择"上传并部署：云端安装依赖"');
console.log('  3. 在云开发控制台 → 云函数 → migrateVersioning → 测试');
console.log('  4. 先预览: 传入 { "dryRun": true } 查看有多少题需要迁移');
console.log('  5. 实际执行: 传入 {}');
console.log('  6. 完成后可删除此云函数\n');

console.log('幂等性: 已有版本字段的题目自动跳过，可多次安全执行。\n');

console.log('迁移内容:');
console.log('  familyId      ← questionId（原始题目 ID 作为家族 ID）');
console.log('  versionNumber ← 1');
console.log('  isLatest      ← true');
console.log('  contentHash   ← MD5(stem[0:100] + options + answer + explanation)\n');

console.log('========================================');
console.log('如需本地执行:');
console.log('  1. npm install @cloudbase/node-sdk');
console.log('  2. 设置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY 环境变量');
console.log('  3. 设置 CLOUDBASE_ENV 环境变量');
console.log('  4. node scripts/migrateVersioning.js --dryRun');
console.log('========================================');
