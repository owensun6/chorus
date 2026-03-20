const http = require('http');
const https = require('https');

const PORT = 3006;
const AGENT_ID = 'xiaox@localhost';
const CHORUS_SERVER = 'http://localhost:3000';

// 存储接收到的消息
let receivedMessages = [];

// 创建接收消息的 HTTP 服务器
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/receive') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('\n=== 收到消息 ===');
      console.log('原始请求体:', body);
      
      try {
        const data = JSON.parse(body);
        const envelope = data.envelope;
        
        // 验证 envelope
        if (!envelope || !envelope.chorus_version || !envelope.sender_id || 
            !envelope.original_text || !envelope.sender_culture) {
          console.log('验证失败: 缺少必要字段');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'error',
            error_code: 'INVALID_ENVELOPE',
            detail: 'missing required fields'
          }));
          return;
        }
        
        console.log('发送者:', envelope.sender_id);
        console.log('发送者文化:', envelope.sender_culture);
        console.log('消息内容:', envelope.original_text);
        if (envelope.cultural_context) {
          console.log('文化背景:', envelope.cultural_context);
        }
        
        // 存储消息
        receivedMessages.push(envelope);
        
        // 返回成功响应
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        console.log('已回复: { status: "ok" }');
        
      } catch (e) {
        console.log('JSON 解析错误:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          error_code: 'INVALID_ENVELOPE',
          detail: e.message
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// 注册 agent
function register() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      agent_id: AGENT_ID,
      endpoint: `http://localhost:${PORT}/receive`,
      agent_card: {
        chorus_version: '0.2',
        user_culture: 'en-US',
        supported_languages: ['en', 'zh-CN']
      }
    });
    
    console.log('\n=== 注册 Agent ===');
    console.log('请求体:', data);
    
    const url = new URL(`${CHORUS_SERVER}/agents`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('注册响应:', body);
        resolve(JSON.parse(body));
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 发送消息
function sendMessage(receiverId, text, culturalContext = null) {
  return new Promise((resolve, reject) => {
    const envelope = {
      chorus_version: '0.4',
      sender_id: AGENT_ID,
      original_text: text,
      sender_culture: 'en-US'
    };
    
    if (culturalContext) {
      envelope.cultural_context = culturalContext;
    }
    
    const data = JSON.stringify({
      receiver_id: receiverId,
      envelope: envelope
    });
    
    console.log('\n=== 发送消息 ===');
    console.log('目标:', receiverId);
    console.log('请求体:', data);
    
    const url = new URL(`${CHORUS_SERVER}/messages`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('发送响应:', body);
        resolve(JSON.parse(body));
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 主函数
async function main() {
  console.log('='.repeat(50));
  console.log('Chorus Agent: xiaox@localhost');
  console.log('='.repeat(50));
  
  // 启动服务器
  server.listen(PORT, () => {
    console.log(`\n接收服务器已启动: http://localhost:${PORT}/receive`);
  });
  
  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 注册
  const regResult = await register();
  if (!regResult.success) {
    console.error('注册失败:', regResult);
    return;
  }
  
  // 发送消息给 agent-zh-cn@localhost
  // 由于接收者的文化是 zh-CN，我需要在 cultural_context 中解释
  const result = await sendMessage(
    'agent-zh-cn@localhost',
    'Hello! I am testing the Chorus protocol. Could you tell me about your capabilities?',
    'This is a test message from an English-speaking agent to verify cross-cultural communication.'
  );
  
  console.log('\n=== 发送结果 ===');
  console.log(JSON.stringify(result, null, 2));
  
  // 等待接收消息
  console.log('\n等待接收消息...');
  console.log('(按 Ctrl+C 退出)');
}

main().catch(console.error);