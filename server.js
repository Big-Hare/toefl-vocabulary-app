// 先引入 express，定义 app，再使用中间件

// -------------------- 模块引入 --------------------
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');


const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');



// -------------------- 应用初始化 --------------------
const app = express();
const port = 5000;
const SECRET_KEY = 'your_secret_key';
const dbPath = path.join(__dirname, 'data', 'vocabulary_TOEFL.db');
const db = new Database(dbPath, { verbose: console.log });

// -------------------- 中间件配置 --------------------
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// -------------------- 初始化数据库表 --------------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )
`).run();

// -------------------- 上传答题卡 和标准答案--------------------

//设置上传目录和文件存储：

// const uploadsheet = multer({ dest: path.join(__dirname, 'uploads/') });

// -------------------- 上传答题卡 --------------------

// const uploadsheet = multer({ dest: path.join(__dirname, 'uploads/') }).fields([
//   { name: 'image', maxCount: 1 },
//   { name: 'answers', maxCount: 1 }
// ]);

// app.post('/api/grade-sheet', uploadsheet, (req, res) => {
//   const imagePath = req.files.image[0].path;
//   const answerPath = req.files.answers[0].path;
//   const pythonScript = path.join(__dirname, 'ocr', 'recognize.py');

//   execFile('python3', [pythonScript, imagePath, answerPath], (err, stdout, stderr) => {
//     fs.unlink(imagePath, () => {});
//     fs.unlink(answerPath, () => {});

//     if (err) {
//       console.error('识别失败:', err);
//       return res.status(500).json({ error: '识别失败' });
//     }

//     try {
//       const result = JSON.parse(stdout);
//       res.json(result);
//     } catch (parseError) {
//       res.status(500).json({ error: '解析失败' });
//     }
//   });
// });



// -------------------- 上传标准答案和答题卡 --------------------
const uploadCards = multer({ dest: path.join(__dirname, 'uploads/') }).fields([
  { name: 'standard', maxCount: 1 },
  { name: 'student', maxCount: 1 }
]);

app.post('/api/compare-cards', uploadCards, (req, res) => {
  const standardPath = req.files.standard[0].path;
  const studentPath = req.files.student[0].path;
  const scriptPath = path.join(__dirname, 'ocr', 'compare_cards.py');

  execFile('python3', [scriptPath, standardPath, studentPath], (err, stdout, stderr) => {
    fs.unlink(standardPath, () => {});
    fs.unlink(studentPath, () => {});

    if (err) {
      console.error('图像比对失败:', stderr);
      return res.status(500).json({ error: '识别失败' });
    }

    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (parseError) {
      console.error('解析比对结果失败:', parseError);
      res.status(500).json({ error: '解析失败' });
    }
  });
});



// // POST /api/compare
// app.post('/api/compare', upload.fields([
//   { name: 'standardImage' }, { name: 'studentImage' }
// ]), async (req, res) => {
//   const standardImagePath = req.files['standardImage'][0].path;
//   const studentImagePath = req.files['studentImage'][0].path;

//   // 调用 OpenCV 比对逻辑
//   const result = await compareAnswerSheets(standardImagePath, studentImagePath);

//   res.json(result);
// });



// -------------------- 路由：用户注册 --------------------
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: '用户名已存在' });
  }
});

// -------------------- 路由：用户登录 --------------------
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
});

// -------------------- 路由示例：获取随机词汇 --------------------
app.get('/api/english-to-chinese', (req, res) => {
  try {
    const stmt = db.prepare(`SELECT 释义 AS chinese, 词汇 AS english FROM TOEFL ORDER BY RANDOM() LIMIT 1`);
    const row = stmt.get();
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: '未找到词汇数据' });
    }
  } catch (err) {
    console.error('数据库查询错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// -------------------- 启动服务器 --------------------
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});









/*------------------------ 路由示例：单词学习板块-----------------------------------*/
// 按单元查询 并展示TOEFL 单元数据
app.get('/api/toefl/:unit', (req, res) => {
    const unitParam = req.params.unit;  // 接收前端传来的单元名称，例如 "单元1"
    
    // 提取数字部分，将 "单元1" 映射为 1
    const unitNumber = parseInt(unitParam.replace('单元', ''), 10);

    if (isNaN(unitNumber)) {
        return res.status(400).json({ error: 'Invalid unit format' });
    }

    try {
        const rows = db.prepare('SELECT * FROM TOEFL WHERE 所属单元 = ?').all(unitNumber);
        res.json(rows);
    } catch (error) {
        console.error('查询失败:', error);
        res.status(500).send('服务器错误');
    }
});

// 后端添加
app.get('/api/toefl/unit/:unitNumber', (req, res) => {
  const unitNumber = parseInt(req.params.unitNumber, 10);

  if (isNaN(unitNumber)) {
    return res.status(400).json({ error: '无效的单元编号' });
  }

  try {
    const stmt = db.prepare(`
      SELECT 
        词汇 AS word,
        音标 AS phonetic,
        释义 AS definition,
        记忆 AS memory,
        派生 AS derivative,
        例句 AS example
      FROM TOEFL
      WHERE 所属单元 = ?
    `);
    const rows = stmt.all(unitNumber); // ✅ 参数是整数
    res.json(rows);
  } catch (error) {
    console.error('查询失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});









/*--------------------------------路由示例：练习板块---------------------------------*/


/*-----------------------汉译英听写：获取随机中文词汇及对应英文释义----------------*/
app.get('/api/chinese-to-english', (req, res) => {
try {
const stmt = db.prepare(`
SELECT
词汇 AS english,
释义 AS chinese
FROM TOEFL
ORDER BY RANDOM()
LIMIT 1
`);
const row = stmt.get();

if (row) {
console.log('获取词汇成功:', row);
res.json(row);
} else {
console.warn('数据库中没有找到词汇');
res.status(404).json({ error: '未找到词汇数据' });
}
} catch (err) {
console.error('数据库查询错误:', err);
res.status(500).json({ error: '服务器内部错误' });
}
});




/*--------------------路由示例：英译汉QUIZ：获取随机英文词汇及对应中文释义----------------*/
app.get('/api/english-to-chinese', (req, res) => {
try {
const stmt = db.prepare(`
SELECT
释义 AS chinese,
词汇 AS english
FROM TOEFL
ORDER BY RANDOM()
LIMIT 1
`);
const row = stmt.get();

if (row) {
console.log('获取词汇成功:', row);
res.json(row);
} else {
res.status(404).json({ error: '未找到词汇数据' });
}
} catch (err) {
console.error('数据库查询错误:', err);
res.status(500).json({ error: '服务器内部错误' });
}
});

/*----------------------------路由示例：获取随机QUIZ干扰项----------------------------*/
app.get('/api/random-distractors', (req, res) => {
    try {
    const count = parseInt(req.query.count) || 3;
    const exclude = req.query.exclude || '';

    const stmt = db.prepare(`
        SELECT 释义 AS chinese
        FROM TOEFL
        WHERE 释义 != ?
        ORDER BY RANDOM()
        LIMIT ?
        `);

    const rows = stmt.all(exclude, count);
    res.json(rows.map(row => row.chinese));
    } catch (err) {
    console.error('获取干扰项失败:', err);
    res.status(500).json({ error: '获取干扰项失败' });
    }
    });


/*-------------------路由示例：汉译英重练：获取随机中文词汇及对应英文释义----------------*/
app.get('/api/chinese-to-english_retry', (req, res) => {
    try {
    const stmt = db.prepare(`
    SELECT
    词汇 AS english,
    释义 AS chinese
    FROM mistakes
    ORDER BY RANDOM()
    LIMIT 1
    `);
    const row = stmt.get();
    
    if (row) {
    console.log('获取词汇成功:', row);
    res.json(row);
    } else {
    console.warn('数据库中没有找到词汇');
    res.status(404).json({ error: '未找到词汇数据' });
    }
    } catch (err) {
    console.error('数据库查询错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
    }
    });


/*----------------路由示例：英译汉重练：获取随机英文词汇及对应中文释义----------------*/
app.get('/api/english-to-chinese_retry', (req, res) => {
    try {
    const stmt = db.prepare(`
    SELECT
    释义 AS chinese,
    词汇 AS english
    FROM mistakes
    ORDER BY RANDOM()
    LIMIT 1
    `);
    const row = stmt.get();
    
    if (row) {
    console.log('获取词汇成功:', row);
    res.json(row);
    } else {
    res.status(404).json({ error: '未找到词汇数据' });
    }
    } catch (err) {
    console.error('数据库查询错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
    }
    });


        


/*------------------------路由示例：验证答案------------------------------*/
app.post('/api/check-answer', (req, res) => {
try {
const { mode, question, answer } = req.body;

let stmt;
if (mode === 'chinese-to-english') {
// 汉译英：用中文词汇查英文释义
stmt = db.prepare('SELECT 词汇 AS correct FROM TOEFL WHERE 释义 = ?');
} else {
// 英译汉：用英文释义查中文词汇
stmt = db.prepare('SELECT 释义 AS correct FROM TOEFL WHERE 词汇 = ?');
}

const row = stmt.get(question);
if (!row) {
return res.status(404).json({ error: '未找到对应词汇' });
}

const isCorrect = row.correct.toLowerCase() === answer.toLowerCase();
res.json({
isCorrect,
correctAnswer: row.correct
});
} catch (err) {
console.error('验证答案时出错:', err);
res.status(500).json({ error: '验证答案时出错' });
}
});




//--------------------------------------路由示例：错题处理板块----------------------------------------------------------------------------------*/

/*------------------------------------------------------------添加到错题本-----------------------------------*/
app.post('/api/add-mistake', (req, res) => {
    try {
    const { table, word, meaning } = req.body;
    const validTables = ['mistakes'];
    if (!validTables.includes(table)) {
    return res.status(400).json({ error: '无效的错题表名' });
    }
    
    // 直接执行 UPSERT 操作（依赖数据库唯一约束）
    const stmt = db.prepare(`
    INSERT INTO ${table} (词汇, 释义, error_count)
    VALUES (?, ?, 1)
    ON CONFLICT(词汇, 释义)
    DO UPDATE SET error_count = error_count + 1
    `);
    stmt.run(word, meaning);
    res.json({ success: true });
    } catch (err) {
    console.error('添加到错题本失败:', err.message);
    res.status(500).json({ error: '添加到错题本失败' });
    }
    });

/*------------------------------------------------------路由示例：从错题本移除记录-------------------------------------------------------*/
// server.js 中的 /api/remove-mistake 端点
app.post('/api/remove-mistake', (req, res) => {
    try {
    const { table, word, meaning } = req.body;
    
    // 验证表名是否合法
    const validTables = ['mistakes'];
    if (!validTables.includes(table)) {
    return res.status(400).json({ error: '无效的错题表名' });
    }
    
   // 先检查当前计数
const checkStmt = db.prepare(`
    SELECT error_count FROM ${table}
    WHERE 词汇 = ? AND 释义 = ?
    `);
    const row = checkStmt.get(word, meaning);
    
    if (!row) return res.status(404).json({ error: '记录不存在' });
    
    if (row.error_count > 1) {
    // 减少计数
    const updateStmt = db.prepare(`
    UPDATE ${table}
    SET error_count = error_count - 1
    WHERE 词汇 = ? AND 释义 = ?
    `);
    updateStmt.run(word, meaning);
    } else {
    // 删除记录
    const deleteStmt = db.prepare(`
    DELETE FROM ${table}
    WHERE 词汇 = ? AND 释义 = ?
    `);
    deleteStmt.run(word, meaning);
    }
    
    res.json({ success: true });
    } catch (err) {
    console.error('移除错题失败:', err);
    res.status(500).json({ error: '移除错题失败' });
    }
    });


    
//---------------------------------------------------------------路由示例：导入数据板块----------------------------------------------*/

  /*------------------------------------------------------选择excel文件插入test表中----------------*/
  // 在文件顶部添加依赖
  const xlsx = require('xlsx');  // 确保引入xlsx解析库
  // const multer = require('multer');  // 处理文件上传
  const upload = multer();
  
  app.post('/api/upload-excel', upload.single('file'), async (req, res) => {
      try {

// 1. 解析Excel文件
const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = xlsx.utils.sheet_to_json(worksheet);

// 2. 清空原数据
db.prepare('DELETE FROM test').run();

// 3. 创建插入语句（移除ON CONFLICT）
const insertStmt = db.prepare(`
INSERT INTO test (序号, 词汇, 释义)
VALUES (?, ?, ?)
`);

// 4. 批量插入（使用事务）
const insertMany = db.transaction((rows) => {
rows.forEach(row => {
try {
insertStmt.run(
row.序号,
row.词汇?.trim(), // 添加数据清洗
row.释义?.trim()
);
} catch (err) {
console.warn('跳过重复数据:', row);
}
});
});

insertMany(jsonData);

res.json({
message: `成功更新 ${jsonData.length} 条数据`,
total: jsonData.length
});
} catch (err) {
console.error('导入失败:', err);
res.status(500).json({
error: '文件处理失败',
details: err.message
});
}
});


//-------------------------------------------------------------------考试板块--------------------------------*/


 /*-----------------------------------------------------路由示例：考试题目接口（新增分页获取）---------------------------------------*/

app.get('/api/exam-questions', (req, res) => {
    try {
    const stmt = db.prepare(`
    SELECT 词汇 AS english, 释义 AS chinese
    FROM test
    ORDER BY RANDOM()
    `);
    const rows = stmt.all();
    res.json(rows);
    } catch (err) {
    res.status(500).json({ error: '获取题目失败' });
    }
    });
    
     /*----------------------------------------------路由示例：考试总题数接口-----------------------------------------*/// 
    
    app.get('/api/exam-total', (req, res) => {
    try {
    const stmt = db.prepare('SELECT COUNT(*) AS total FROM test');
    const result = stmt.get();
    res.json({ total: result.total });
    } catch (err) {
    res.status(500).json({ error: '获取总数失败' });
    }
    });

 /*---------------------------------------------路由示例：考试答案批改接口------------------------------------------------*/// 
app.post('/api/check-answer_exam', (req, res) => {
    try {
    const { answers } = req.body;
    const results = {};
    
    db.transaction(() => {
    Object.entries(answers).forEach(([chinese, answer]) => {
    const stmt = db.prepare(`
    SELECT 词汇 AS correct
    FROM test
    WHERE 释义 = ?
    `);
    const row = stmt.get(chinese);
    results[chinese] = row?.correct?.toLowerCase() === answer.toLowerCase();
    });
    })();
    
    res.json(results);
    } catch (err) {
    console.error('批改失败:', err);
    res.status(500).json({ error: '考试批改失败' });
    }
    });



/**
 * !消消乐2
 * params: 
 * return: 
 */
// 提供 `/api/test` 接口，提取 `test` 表中 5 组数据




// ✅ 获取 test 表中的5组数据
app.get('/api/Synonym-Matching-Game', (req, res) => {
    try {
      const query = 'SELECT 序号, 词汇, 释义, 派生 FROM synonyms ORDER BY RANDOM() LIMIT 5';
      const rows = db.prepare(query).all();  // 使用 `prepare().all()` 同步查询
      console.log('查询结果:', rows);
      res.json(rows);
    } catch (error) {
      console.error('查询失败:', error);
      res.status(500).json({ error: '查询失败' });
    }
  });
  







 //-------------------------------------------------------------优雅关闭数据库 ------------------------------------------------*/  

process.on('SIGINT', () => {
if (db) {
db.close();
console.log('数据库连接已关闭');
}
process.exit();
});


