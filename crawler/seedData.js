/**
 * 种子题库数据 v2
 * 全覆盖 1-6 年级语数英，共 54 道完整题目（含答案+解析）
 */
var now = new Date().toISOString();

module.exports = {
  '数学': [
    // === 一年级 ===
    { subject: '数学', grade: '一年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['20以内加减法'], stem: '9 + 8 = ?', options: ['15', '16', '17', '18'], answer: 'C', explanation: '9 + 8 = 17，可以凑十：9+1=10，10+7=17', examPoint: '20以内加法', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '一年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['数数', '比较大小'], stem: '在 13、8、20 这三个数中，最大的数是 ____，最小的数是 ____。', answer: '20||8', explanation: '20 > 13 > 8，所以最大是20，最小是8', examPoint: '数的大小比较', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '一年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['图形', '认识'], stem: '正方体的六个面都是正方形。', answer: '√', explanation: '正方体有6个面，每个面都是大小相同的正方形。', examPoint: '认识立体图形', paperSource: 'seed', status: 'active', createdAt: now },
    // === 二年级 ===
    { subject: '数学', grade: '二年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['乘法', '九九乘法表'], stem: '6 × 7 等于多少？', options: ['42', '36', '48', '49'], answer: 'A', explanation: '6×7=42，根据乘法口诀"六七四十二"。', examPoint: '乘法口诀', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '二年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['除法', '平均分'], stem: '把 20 个苹果平均分给 4 个小朋友，每人分到 ____ 个。', answer: '5', explanation: '20 ÷ 4 = 5，意思是将20平均分成4份，每份是5。', examPoint: '平均分', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '二年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['长度', '单位'], stem: '课桌的高度大约是 1 厘米。', answer: '×', explanation: '课桌高度大约是 70-80 厘米，1 厘米大约是手指甲盖的宽度。', examPoint: '长度单位感知', paperSource: 'seed', status: 'active', createdAt: now },
    // === 三年级 ===
    { subject: '数学', grade: '三年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['分数', '认识'], stem: '一个蛋糕平均分成 8 块，吃了 3 块，吃了这个蛋糕的几分之几？', options: ['3/8', '5/8', '3/5', '1/8'], answer: 'A', explanation: '平均分成8份，吃了3份，就是吃了 3/8。', examPoint: '分数的初步认识', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '三年级', type: '填空题', difficulty: '能力提升', knowledgePoints: ['时间', '计算'], stem: '从 8:45 到 9:20，经过了 ____ 分钟。', answer: '35', explanation: '8:45到9:00是15分钟，9:00到9:20是20分钟，共15+20=35分钟。', examPoint: '时间计算', paperSource: 'seed', status: 'active', createdAt: now },
    // === 四年级 ===
    { subject: '数学', grade: '四年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['运算', '四则运算'], stem: '计算 25 × 4 ÷ 25 × 4 的结果是？', options: ['1', '16', '25', '100'], answer: 'B', explanation: '从左到右依次计算：25×4=100，100÷25=4，4×4=16', examPoint: '四则运算顺序', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '四年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['几何', '角度'], stem: '一个三角形的三个内角分别是 45°、45°、____°。', answer: '90', explanation: '三角形内角和为 180°，180° - 45° - 45° = 90°', examPoint: '三角形内角和', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '四年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['小数', '读写'], stem: '0.3 和 0.30 的大小相等，意义也相同。', answer: '×', explanation: '大小相等但意义不同，0.3表示3个0.1，0.30表示30个0.01。', examPoint: '小数的意义', paperSource: 'seed', status: 'active', createdAt: now },
    // === 五年级 ===
    { subject: '数学', grade: '五年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['小数', '乘法'], stem: '0.25 × 0.4 的结果是？', options: ['0.1', '0.01', '1.0', '0.001'], answer: 'A', explanation: '0.25 × 0.4 = 0.1，小数乘法先按整数乘再点小数点', examPoint: '小数乘法', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '五年级', type: '填空题', difficulty: '能力提升', knowledgePoints: ['方程', '应用题'], stem: '一个数的 3 倍减去 4 等于 8，这个数是 ____。', answer: '4', explanation: '设这个数为 x，3x - 4 = 8，3x = 12，x = 4', examPoint: '简单方程', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '五年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['三角形', '面积'], stem: '两个面积相等的三角形一定能拼成一个平行四边形。', answer: '×', explanation: '两个面积相等的三角形不一定完全一样，只有完全一样的两个三角形才能拼成平行四边形。', examPoint: '三角形与平行四边形', paperSource: 'seed', status: 'active', createdAt: now },
    // === 六年级 ===
    { subject: '数学', grade: '六年级', type: '选择题', difficulty: '能力提升', knowledgePoints: ['百分数', '运算'], stem: '一个数的 25% 是 40，这个数的 60% 是多少？', options: ['85', '96', '100', '108'], answer: 'B', explanation: '先求原数：40 ÷ 25% = 160，再求 160 × 60% = 96', examPoint: '百分数综合应用', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '六年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['分数', '比较大小'], stem: '下面四个分数中，最大的是哪个？', options: ['2/3', '3/5', '5/8', '7/12'], answer: 'A', explanation: '通分比较：2/3 ≈ 0.667，3/5 = 0.6，5/8 = 0.625，7/12 ≈ 0.583', examPoint: '分数比较', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '六年级', type: '填空题', difficulty: '能力提升', knowledgePoints: ['比例', '应用题'], stem: '甲乙两数的比是 3:5，它们的和是 48，甲数是 ____。', answer: '18', explanation: '总份数为 3+5=8，每份为 48÷8=6，甲数为 6×3=18', examPoint: '按比例分配', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '六年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['圆', '周长'], stem: '半径是 2 厘米的圆，它的周长和面积相等。', answer: '×', explanation: '周长是 12.56 厘米，面积是 12.56 平方厘米，数值相同但单位不同，意义不同。', examPoint: '圆的周长与面积辨析', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '数学', grade: '六年级', type: '简答题', difficulty: '冲刺拔高', knowledgePoints: ['行程问题', '方程'], stem: 'A、B 两地相距 360 千米，甲车从 A 地出发每小时行 60 千米，乙车从 B 地出发每小时行 40 千米，两车相向而行。几小时后两车相遇？', answer: '3.6小时', explanation: '相遇时间 = 总距离 ÷ 速度和 = 360 ÷ (60+40) = 360 ÷ 100 = 3.6（小时）', examPoint: '相遇问题', paperSource: 'seed', status: 'active', createdAt: now },
  ],

  '语文': [
    // === 一年级 ===
    { subject: '语文', grade: '一年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['拼音', '声母'], stem: '下面哪个是声母？', options: ['b', 'a', 'o', 'e'], answer: 'A', explanation: '声母是拼音开头的辅音，b是声母，a、o、e都是韵母。', examPoint: '声母韵母辨析', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '一年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['汉字', '笔画'], stem: '"大"字共有 ____ 画，第一笔是 ____。', answer: '3||一', explanation: '"大"字的笔画是：横、撇、捺，共3画，第一笔是横（一）。', examPoint: '基本笔画', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '一年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['拼音', '整体认读音节'], stem: '"zhī" 这个音节中，"zhi" 是整体认读音节。', answer: '√', explanation: 'zhi、chi、shi、ri 都是整体认读音节，直接读出，不需拼读。', examPoint: '整体认读音节', paperSource: 'seed', status: 'active', createdAt: now },
    // === 二年级 ===
    { subject: '语文', grade: '二年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['词语', '反义词'], stem: '"高"的反义词是？', options: ['大', '矮', '长', '胖'], answer: 'B', explanation: '"高"和"矮"是一对反义词，表示高度相反。', examPoint: '反义词积累', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '二年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['古诗', '背诵'], stem: '补充诗句：举头望明月，____ 思故乡。', answer: '低头', explanation: '出自李白《静夜思》：举头望明月，低头思故乡。', examPoint: '古诗积累', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '二年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['标点', '使用'], stem: '"你吃饭了吗"这句话末尾应该用句号。', answer: '×', explanation: '这是问句，末尾应该用问号（？），不是句号。', examPoint: '标点符号使用', paperSource: 'seed', status: 'active', createdAt: now },
    // === 三年级 ===
    { subject: '语文', grade: '三年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['成语', '理解'], stem: '下列词语中哪一个不是成语？', options: ['画蛇添足', '自相矛盾', '美丽动人', '掩耳盗铃'], answer: 'C', explanation: '"美丽动人"是普通词组，不是成语。其他三项都是经典成语。', examPoint: '成语辨析', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '三年级', type: '填空题', difficulty: '能力提升', knowledgePoints: ['阅读理解', '概括'], stem: '"小蝌蚪找妈妈"这个故事中，小蝌蚪最后找到了 ____。', answer: '青蛙', explanation: '小蝌蚪在找妈妈的过程中不断变化，最后变成了青蛙，找到了妈妈。', examPoint: '课文理解', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '三年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['修辞', '拟人'], stem: '"太阳公公露出了笑脸"这句话用了拟人的修辞手法。', answer: '√', explanation: '把太阳比作人，"露出笑脸"是人的动作，这是拟人手法。', examPoint: '拟人修辞', paperSource: 'seed', status: 'active', createdAt: now },
    // === 四年级 ===
    { subject: '语文', grade: '四年级', type: '选择题', difficulty: '能力提升', knowledgePoints: ['古诗', '理解'], stem: '下列哪句诗是描写春天景色的？', options: ['接天莲叶无穷碧', '春眠不觉晓', '霜叶红于二月花', '千山鸟飞绝'], answer: 'B', explanation: '"春眠不觉晓"出自孟浩然《春晓》，直接描写春天。A是夏天，C是秋天，D是冬天。', examPoint: '古诗季节性辨析', paperSource: 'seed', status: 'active', createdAt: now },
    // === 五年级 ===
    { subject: '语文', grade: '五年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['字词', '多音字'], stem: '"音乐"中"乐"的读音是？', options: ['lè', 'yuè', 'yào', 'luò'], answer: 'B', explanation: '"音乐"的"乐"读 yuè，"快乐"的"乐"读 lè。', examPoint: '多音字辨析', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '五年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['古诗', '填空'], stem: '补充诗句：____ 依山尽，黄河入海流。', answer: '白日', explanation: '出自王之涣《登鹳雀楼》："白日依山尽，黄河入海流。"', examPoint: '古诗默写', paperSource: 'seed', status: 'active', createdAt: now },
    // === 六年级 ===
    { subject: '语文', grade: '六年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['古诗', '默写'], stem: '"春风又绿江南岸"中"绿"字的词性是？', options: ['名词', '形容词用作动词', '副词', '介词'], answer: 'B', explanation: '"绿"本是形容词，这里用作动词，意为"使……变绿"，是王安石《泊船瓜洲》中的名句。', examPoint: '词类活用', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '六年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['成语', '积累'], stem: '补充成语：____ 羊补牢，____ 假虎威。', answer: '亡||狐', explanation: '亡羊补牢：丢了羊才修羊圈，比喻出了差错及时补救。狐假虎威：狐狸借老虎的威风。', examPoint: '成语积累', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '六年级', type: '选择题', difficulty: '能力提升', knowledgePoints: ['阅读', '修辞'], stem: '"月亮像一个大玉盘挂在天空"使用了什么修辞手法？', options: ['拟人', '比喻', '夸张', '排比'], answer: 'B', explanation: '把月亮比作大玉盘，是典型的比喻句。', examPoint: '修辞手法辨析', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '语文', grade: '六年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['古诗', '作者'], stem: '"床前明月光，疑是地上霜"的作者是杜甫。', answer: '×', explanation: '这两句出自李白《静夜思》，不是杜甫。', examPoint: '古诗作者识记', paperSource: 'seed', status: 'active', createdAt: now },
  ],

  '英语': [
    // === 一年级 ===
    { subject: '英语', grade: '一年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['字母', '认读'], stem: '英语字母表中共有多少个字母？', options: ['24', '26', '28', '20'], answer: 'B', explanation: '英语字母表有 26 个字母，包括 5 个元音字母和 21 个辅音字母。', examPoint: '英语字母', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '一年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['颜色', '词汇'], stem: '苹果的英文是 ____。', answer: 'apple', explanation: '苹果的英文单词是 apple。', examPoint: '水果词汇', paperSource: 'seed', status: 'active', createdAt: now },
    // === 二年级 ===
    { subject: '英语', grade: '二年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['数字', '词汇'], stem: '—How many books do you have? —I have ____ books. (我有三本书)', options: ['two', 'three', 'four', 'five'], answer: 'B', explanation: '三本书的"三"是 three。', examPoint: '数字词汇', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '二年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['动物', '词汇'], stem: '小猫的英文是 ____。', answer: 'cat', explanation: '小猫的英文是 cat。', examPoint: '动物词汇', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '二年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['句型', '问候'], stem: '"Goodbye" 和 "Hello" 都是打招呼用的，意思相同。', answer: '×', explanation: 'Goodbye 是再见的意思，Hello 是你好的意思，不同。', examPoint: '日常用语辨析', paperSource: 'seed', status: 'active', createdAt: now },
    // === 三年级 ===
    { subject: '英语', grade: '三年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['语法', '人称代词'], stem: '____ is my mother. (她是我妈妈)', options: ['He', 'She', 'It', 'They'], answer: 'B', explanation: '妈妈是女性，用 She（她）。', examPoint: '人称代词', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '三年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['语法', '冠词'], stem: 'I have ____ apple. (我有一个苹果)', options: ['a', 'an', 'the', '/'], answer: 'B', explanation: 'apple 以元音音素开头，用 an。', examPoint: '不定冠词', paperSource: 'seed', status: 'active', createdAt: now },
    // === 四年级 ===
    { subject: '英语', grade: '四年级', type: '选择题', difficulty: '能力提升', knowledgePoints: ['语法', '现在进行时'], stem: 'Listen! The girl ____ in the room.', options: ['sing', 'sings', 'is singing', 'are singing'], answer: 'C', explanation: 'Listen! 提示正在发生，用现在进行时 is singing。', examPoint: '现在进行时', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '四年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['语法', '名词复数'], stem: 'one book 的复数形式是 one books。', answer: '×', explanation: 'one 表示一个，后面应跟单数 book。复数为 three books。', examPoint: '名词单复数', paperSource: 'seed', status: 'active', createdAt: now },
    // === 五年级 ===
    { subject: '英语', grade: '五年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['词汇', '名词'], stem: 'There are many ____ on the farm.', options: ['sheep', 'sheeps', 'sheepes', 'a sheep'], answer: 'A', explanation: 'sheep 的单复数同形，不加 s。', examPoint: '名词单复数', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '五年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['词汇', '数字'], stem: '用英语写出数字：12 = ____。', answer: 'twelve', explanation: '12 的英文是 twelve。', examPoint: '数字词汇', paperSource: 'seed', status: 'active', createdAt: now },
    // === 六年级 ===
    { subject: '英语', grade: '六年级', type: '选择题', difficulty: '基础巩固', knowledgePoints: ['时态', '一般过去时'], stem: 'He ____ to school by bus yesterday.', options: ['go', 'goes', 'went', 'going'], answer: 'C', explanation: 'yesterday 提示用一般过去时，go 的过去式是 went。', examPoint: '一般过去时', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '六年级', type: '填空题', difficulty: '基础巩固', knowledgePoints: ['词汇', '拼写'], stem: 'The opposite of "happy" is ____.', answer: 'sad||unhappy', explanation: '"happy"（开心的）的反义词是 "sad"（伤心的）或 "unhappy"。', examPoint: '反义词', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '六年级', type: '选择题', difficulty: '能力提升', knowledgePoints: ['语法', '比较级'], stem: 'Lucy is ____ than her sister.', options: ['tall', 'taller', 'tallest', 'more tall'], answer: 'B', explanation: 'than 提示使用比较级，tall 的比较级为 taller。', examPoint: '形容词比较级', paperSource: 'seed', status: 'active', createdAt: now },
    { subject: '英语', grade: '六年级', type: '判断题', difficulty: '基础巩固', knowledgePoints: ['语法', 'be动词'], stem: '"I is a student." 这句话的语法是正确的。', answer: '×', explanation: '第一人称 I 应与 am 搭配，正确为 "I am a student."', examPoint: 'be动词搭配', paperSource: 'seed', status: 'active', createdAt: now },
  ],
};
