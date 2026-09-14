import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/execute') {
    try {
      const body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
      });
      
      const { command, cookies_base64, video_url, drive_refresh_token, drive_client_id, drive_client_secret } = JSON.parse(body);
      
      if (!command) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Command is required' }));
        return;
      }

      console.log(`[HTTP Server] Executing command: ${command}`);
      
      // Create environment object for child process
      const env = {
        ...process.env,
        COOKIES_BASE64: cookies_base64,
        VIDEO_URL: video_url,
        DRIVE_REFRESH_TOKEN: drive_refresh_token,
        DRIVE_CLIENT_ID: drive_client_id,
        DRIVE_CLIENT_SECRET: drive_client_secret
      };
      
      const { stdout, stderr } = await execAsync(command, { env });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        stdout, 
        stderr 
      }));
    } catch (error) {
      console.error('[HTTP Server] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: error.message 
      }));
    }
  } else if (req.method === 'POST' && req.url === '/update-env') {
    try {
      const body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
      });
      
      const { variables } = JSON.parse(body);
      
      if (!variables || typeof variables !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Variables object is required' }));
        return;
      }

      console.log('[HTTP Server] Updating environment variables:', variables);
      
      // Update environment variables for current process
      for (const [key, value] of Object.entries(variables)) {
        process.env[key] = value;
      }
      
      // Also update .bashrc for persistence
      const bashrcUpdates = Object.entries(variables)
        .map(([key, value]) => `export ${key}="${value}"`)
        .join('\n');
      
      await execAsync(`echo "${bashrcUpdates}" >> ~/.bashrc`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Environment variables updated' 
      }));
    } catch (error) {
      console.error('[HTTP Server] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: error.message 
      }));
    }
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString() 
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP Server] Command server listening on port ${PORT}`);
  console.log(`[HTTP Server] Available endpoints:`);
  console.log(`[HTTP Server]   POST /execute - Execute command`);
  console.log(`[HTTP Server]   POST /update-env - Update environment variables`);
  console.log(`[HTTP Server]   GET /health - Health check`);
});
