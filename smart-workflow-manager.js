import axios from 'axios';
import _sodium from 'libsodium-wrappers';

class SmartWorkflowManager {
  constructor(githubToken, owner, repo) {
    this.githubToken = githubToken;
    this.owner = owner;
    this.repo = repo;
    this.apiBase = 'https://api.github.com';
    this.httpPort = 3000;
  }

  get headers() {
    return {
      'Authorization': `Bearer ${this.githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  // Secret management (for future codespace creation)
  async getPublicKey() {
    try {
      const response = await axios.get(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/codespaces/secrets/public-key`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('✗ Error getting public key:', error.response?.data || error.message);
      throw error;
    }
  }

  async encryptSecret(value, publicKey) {
    await _sodium.ready;
    const sodium = _sodium;
    const keyBytes = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);
    const encryptedBytes = sodium.crypto_box_seal(
      sodium.from_string(value),
      keyBytes
    );
    return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
  }

  async setRepositorySecret(secretName, secretValue) {
    try {
      console.log(`Setting repository secret: ${secretName}...`);
      const publicKey = await this.getPublicKey();
      const encryptedValue = await this.encryptSecret(secretValue, publicKey);
      
      const response = await axios.put(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/codespaces/secrets/${secretName}`,
        {
          encrypted_value: encryptedValue,
          key_id: publicKey.key_id
        },
        { headers: this.headers }
      );
      
      console.log(`✓ Secret set: ${secretName}`);
      return response.data;
    } catch (error) {
      console.error(`✗ Error setting secret ${secretName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Codespace management
  async createCodespace(options = {}) {
    try {
      console.log('Creating codespace...');
      const response = await axios.post(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/codespaces`,
        {
          name: options.name || 'smart-codespace',
          devcontainer_path: options.devcontainerPath || '.devcontainer/devcontainer.json',
          ...options
        },
        { headers: this.headers }
      );
      console.log('✓ Codespace created:', response.data.name);
      return response.data;
    } catch (error) {
      console.error('✗ Error creating codespace:', error.response?.data || error.message);
      throw error;
    }
  }

  async getCodespaceStatus(codespaceName) {
    try {
      const response = await axios.get(
        `${this.apiBase}/user/codespaces/${codespaceName}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('✗ Error getting codespace status:', error.response?.data || error.message);
      throw error;
    }
  }

  async watchCodespaceStatus(codespaceName, targetState = 'Available', options = {}) {
    const {
      interval = 5000,
      timeout = 300000,
      verbose = true
    } = options;

    const startTime = Date.now();
    let currentStatus = null;

    if (verbose) {
      console.log(`Watching codespace: ${codespaceName}`);
      console.log(`Target state: ${targetState}`);
    }

    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(
          `${this.apiBase}/user/codespaces/${codespaceName}`,
          { headers: this.headers }
        );
        currentStatus = response.data.state;

        if (verbose) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`[${elapsed}s] Current status: ${currentStatus}`);
        }

        if (currentStatus === targetState) {
          if (verbose) {
            console.log(`✓ Codespace reached target state: ${targetState}`);
          }
          return response.data;
        }

        if (currentStatus === 'Failed' || currentStatus === 'Unavailable') {
          throw new Error(`Codespace reached failed state: ${currentStatus}`);
        }

        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error('Codespace not found');
        }
        if (verbose) {
          console.error(`Error checking status: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new Error(`Timeout: Codespace did not reach state "${targetState}" within ${timeout}ms. Final status: ${currentStatus}`);
  }

  // HTTP-based command execution (NO SSH)
  async executeCommandViaHTTP(codespaceName, command) {
    try {
      const url = `https://${codespaceName}-${this.httpPort}.app.github.dev/execute`;
      console.log(`Executing command via HTTP: ${command}`);
      console.log(`URL: ${url}`);
      
      const response = await axios.post(
        url,
        { command },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Github-Token': this.githubToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error executing command via HTTP:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateEnvViaHTTP(codespaceName, variables) {
    try {
      const url = `https://${codespaceName}-${this.httpPort}.app.github.dev/update-env`;
      console.log('Updating environment variables via HTTP:', variables);
      console.log(`URL: ${url}`);
      
      const response = await axios.post(
        url,
        { variables },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Github-Token': this.githubToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error updating environment variables via HTTP:', error.response?.data || error.message);
      throw error;
    }
  }

  async healthCheckViaHTTP(codespaceName) {
    try {
      const url = `https://${codespaceName}-${this.httpPort}.app.github.dev/health`;
      console.log(`Health check: ${url}`);
      
      const response = await axios.get(
        url,
        {
          headers: {
            'X-Github-Token': this.githubToken
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Health check failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Smart workflow - combines both approaches
  async runSmartWorkflow(videoUrl, platform = 'youtube', cookies = '', driveCredentials = {}) {
    console.log('==========================================');
    console.log('   Smart Workflow - No SSH Required');
    console.log('==========================================');
    console.log('');

    const startTime = Date.now();
    const workflowLog = [];

    try {
      // Step 1: Set secrets for future use (when creating new codespaces)
      workflowLog.push('Setting secrets for future codespace creation...');
      const envVars = {
        VIDEO_URL: videoUrl,
        PLATFORM: platform,
        ...driveCredentials
      };
      
      if (cookies && cookies.length > 0) {
        envVars.COOKIES = cookies;
      }
      
      await this.setRepositorySecret('VIDEO_URL', videoUrl);
      await this.setRepositorySecret('PLATFORM', platform);
      
      if (cookies && cookies.length > 0) {
        await this.setRepositorySecret('COOKIES', cookies);
      }
      
      Object.keys(driveCredentials).forEach(key => {
        this.setRepositorySecret(key, driveCredentials[key]);
      });
      
      workflowLog.push('✓ Secrets set for future use');

      // Step 2: Check for existing codespace
      workflowLog.push('Checking for existing codespace...');
      const codespaceName = 'smart-codespace';
      
      try {
        const existingCodespace = await this.getCodespaceStatus(codespaceName);
        workflowLog.push(`Found existing codespace: ${codespaceName}`);
        
        if (existingCodespace.state !== 'Available') {
          workflowLog.push('Codespace is not available, waiting...');
          await this.watchCodespaceStatus(codespaceName, 'Available');
        }
      } catch (error) {
        workflowLog.push('No existing codespace found, creating new one...');
        const newCodespace = await this.createCodespace({ name: codespaceName });
        workflowLog.push(`✓ New codespace created: ${newCodespace.name}`);
        
        workflowLog.push('Waiting for codespace to be ready...');
        await this.watchCodespaceStatus(codespaceName, 'Available', {
          interval: 10000,
          timeout: 600000
        });
      }

      // Step 3: Wait for HTTP server to be ready
      workflowLog.push('Waiting for HTTP command server to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Give server time to start
      
      let httpReady = false;
      for (let i = 0; i < 6; i++) {
        try {
          await this.healthCheckViaHTTP(codespaceName);
          httpReady = true;
          workflowLog.push('✓ HTTP server is ready');
          break;
        } catch (error) {
          console.log(`HTTP server not ready yet, retrying in 10s... (${i + 1}/6)`);
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
      
      if (!httpReady) {
        throw new Error('HTTP server did not become ready');
      }

      // Step 4: Update environment variables via HTTP (immediate effect)
      workflowLog.push('Updating environment variables via HTTP...');
      await this.updateEnvViaHTTP(codespaceName, envVars);
      workflowLog.push('✓ Environment variables updated');

      // Step 5: Execute download script via HTTP
      workflowLog.push('Executing download script via HTTP...');
      const scriptResult = await this.executeCommandViaHTTP(
        codespaceName,
        'bash /workspaces/codespaces-api-test/download_and_upload.sh'
      );
      
      workflowLog.push('Script execution completed');
      if (scriptResult.stdout) {
        workflowLog.push('Script output:', scriptResult.stdout);
      }
      if (scriptResult.stderr) {
        workflowLog.push('Script errors:', scriptResult.stderr);
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      workflowLog.push(`Workflow completed in ${duration} seconds`);

      console.log('==========================================');
      console.log('   Workflow Completed Successfully!');
      console.log('==========================================');
      console.log('');
      console.log('Summary:');
      console.log('- Video URL:', videoUrl);
      console.log('- Platform:', platform);
      console.log('- Codespace:', codespaceName);
      console.log('- Duration:', duration, 'seconds');
      console.log('- Method: HTTP-based (no SSH)');

      return {
        success: true,
        codespace: codespaceName,
        duration: duration,
        logs: workflowLog,
        scriptResult: scriptResult
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      workflowLog.push(`✗ Workflow failed after ${duration} seconds`);
      workflowLog.push(`Error: ${error.message}`);

      console.error('==========================================');
      console.error('   Workflow Failed!');
      console.error('==========================================');
      console.error('Error:', error.message);

      return {
        success: false,
        error: error.message,
        duration: duration,
        logs: workflowLog
      };
    }
  }
}

// CLI interface
const command = process.argv[2];
const githubToken = process.env.GITHUB_TOKEN || process.argv[3];
const owner = process.env.GITHUB_OWNER || process.argv[4];
const repo = process.env.GITHUB_REPO || process.argv[5];

if (!githubToken) {
  console.error('GITHUB_TOKEN is required');
  console.log('Usage: node smart-workflow-manager.js <command> <github_token> <owner> <repo> [args...]');
  console.log('Commands: run, exec-http, update-env-http, health-http');
  process.exit(1);
}

const manager = new SmartWorkflowManager(githubToken, owner, repo);

async function main() {
  try {
    switch (command) {
      case 'run':
        const videoUrl = process.argv[6];
        const platform = process.argv[7] || 'youtube';
        const cookies = process.argv[8] || '';
        
        const driveToken = process.env.DRIVE_TOKEN || process.argv[9];
        const driveRefreshToken = process.env.DRIVE_REFRESH_TOKEN || process.argv[10];
        const driveClientId = process.env.DRIVE_CLIENT_ID || process.argv[11];
        const driveClientSecret = process.env.DRIVE_CLIENT_SECRET || process.argv[12];

        if (!videoUrl) {
          console.error('Video URL is required for run command');
          process.exit(1);
        }

        const driveCredentials = {};
        if (driveToken) driveCredentials.DRIVE_TOKEN = driveToken;
        if (driveRefreshToken) driveCredentials.DRIVE_REFRESH_TOKEN = driveRefreshToken;
        if (driveClientId) driveCredentials.DRIVE_CLIENT_ID = driveClientId;
        if (driveClientSecret) driveCredentials.DRIVE_CLIENT_SECRET = driveClientSecret;

        await manager.runSmartWorkflow(videoUrl, platform, cookies, driveCredentials);
        break;

      case 'exec-http':
        const codespaceName = process.argv[6];
        const cmd = process.argv[7];
        if (!codespaceName || !cmd) {
          console.error('Codespace name and command are required');
          process.exit(1);
        }
        const execResult = await manager.executeCommandViaHTTP(codespaceName, cmd);
        console.log('Result:', execResult);
        break;

      case 'update-env-http':
        const envCodespaceName = process.argv[6];
        const varName = process.argv[7];
        const varValue = process.argv[8];
        if (!envCodespaceName || !varName || !varValue) {
          console.error('Codespace name, variable name and value are required');
          process.exit(1);
        }
        const envResult = await manager.updateEnvViaHTTP(envCodespaceName, { [varName]: varValue });
        console.log('Result:', envResult);
        break;

      case 'health-http':
        const healthCodespaceName = process.argv[6];
        if (!healthCodespaceName) {
          console.error('Codespace name is required');
          process.exit(1);
        }
        const health = await manager.healthCheckViaHTTP(healthCodespaceName);
        console.log('Health:', health);
        break;

      default:
        console.log('Available commands: run, exec-http, update-env-http, health-http');
        console.log('Usage examples:');
        console.log('  node smart-workflow-manager.js run <token> <owner> <repo> <video_url> [platform] [cookies] [drive_credentials...]');
        console.log('  node smart-workflow-manager.js exec-http <token> <owner> <repo> <codespace_name> "ls -la"');
        console.log('  node smart-workflow-manager.js update-env-http <token> <owner> <repo> <codespace_name> VAR_NAME "value"');
        console.log('  node smart-workflow-manager.js health-http <token> <owner> <repo> <codespace_name>');
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
