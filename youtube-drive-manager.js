import axios from 'axios';
import _sodium from 'libsodium-wrappers';

class YouTubeDriveManager {
  constructor(githubToken, owner, repo) {
    this.githubToken = githubToken;
    this.owner = owner;
    this.repo = repo;
    this.apiBase = 'https://api.github.com';
  }

  get headers() {
    return {
      'Authorization': `Bearer ${this.githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

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
      console.log(`Setting secret: ${secretName}...`);
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

  async setEnvironmentVariables(variables) {
    console.log('Setting environment variables...');
    for (const [name, value] of Object.entries(variables)) {
      await this.setRepositorySecret(name, value);
    }
    console.log('✓ All environment variables set');
  }

  async uploadFile(filePath, content, message = 'Upload file') {
    try {
      console.log(`Uploading file: ${filePath}...`);
      
      let fileSha = null;
      try {
        const existingFile = await axios.get(
          `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`,
          { headers: this.headers }
        );
        fileSha = existingFile.data.sha;
      } catch (error) {
        if (error.response?.status !== 404) throw error;
      }

      const contentBase64 = Buffer.from(content).toString('base64');
      const body = {
        message: message,
        content: contentBase64
      };

      if (fileSha) {
        body.sha = fileSha;
      }

      const response = await axios.put(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`,
        body,
        { headers: this.headers }
      );

      console.log(`✓ File uploaded: ${filePath}`);
      return response.data;
    } catch (error) {
      console.error(`✗ Error uploading file ${filePath}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async uploadLog(logContent, logName = 'youtube-drive') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${logName}-${timestamp}.txt`;
    const filePath = `logs/${fileName}`;
    return await this.uploadFile(filePath, logContent, `Upload log: ${fileName}`);
  }

  async downloadFile(filePath) {
    try {
      console.log(`Downloading file: ${filePath}...`);
      const response = await axios.get(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`,
        { 
          headers: {
            ...this.headers,
            'Accept': 'application/vnd.github.raw+json'
          }
        }
      );
      console.log(`✓ File downloaded: ${filePath}`);
      return response.data;
    } catch (error) {
      console.error(`✗ Error downloading file ${filePath}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async createCodespace(options = {}) {
    try {
      console.log('Creating codespace...');
      const response = await axios.post(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/codespaces`,
        {
          name: options.name || 'yt-dlp-codespace',
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

  async deleteCodespace(codespaceName) {
    try {
      console.log(`Deleting codespace: ${codespaceName}...`);
      const response = await axios.delete(
        `${this.apiBase}/user/codespaces/${codespaceName}`,
        { headers: this.headers }
      );
      console.log('✓ Codespace deleted');
      return response.data;
    } catch (error) {
      console.error('✗ Error deleting codespace:', error.response?.data || error.message);
      throw error;
    }
  }

  async listCodespaces() {
    try {
      const response = await axios.get(
        `${this.apiBase}/user/codespaces`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('✗ Error listing codespaces:', error.response?.data || error.message);
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

  async recreateCodespace(codespaceName, options = {}) {
    try {
      console.log(`Recreating codespace: ${codespaceName}...`);
      await this.deleteCodespace(codespaceName);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newCodespace = await this.createCodespace(options);
      console.log('✓ Codespace recreated successfully');
      return newCodespace;
    } catch (error) {
      console.error('✗ Error recreating codespace:', error.response?.data || error.message);
      throw error;
    }
  }

  async recreateAndWatch(options = {}, targetState = 'Available', watchOptions = {}) {
    console.log('Recreating codespace with new environment variables...');
    const codespace = await this.recreateCodespace(options.name, options);
    console.log(`Watching new codespace until it reaches state: ${targetState}`);
    const finalState = await this.watchCodespaceStatus(codespace.name, targetState, watchOptions);
    return finalState;
  }

  async runYouTubeToDriveWorkflow(videoUrl, platform = 'youtube', cookies = '', driveCredentials = {}) {
    console.log('==========================================');
    console.log('   YouTube to Drive - API Workflow');
    console.log('==========================================');
    console.log('');

    const startTime = Date.now();
    const workflowLog = [];

    try {
      // Step 1: Set environment variables
      workflowLog.push('Setting environment variables...');
      const envVars = {
        VIDEO_URL: videoUrl,
        PLATFORM: platform,
        ...driveCredentials
      };
      
      // Only set cookies if provided
      if (cookies && cookies.length > 0) {
        envVars.COOKIES = cookies;
        workflowLog.push('Cookies provided - will be set as secret');
      }
      
      await this.setEnvironmentVariables(envVars);
      workflowLog.push('✓ Environment variables set');

      // Step 2: Check existing codespaces
      workflowLog.push('Checking existing codespaces...');
      const existingCodespaces = await this.listCodespaces();
      workflowLog.push(`Found ${existingCodespaces.length} existing codespaces`);

      // Step 3: Delete old codespaces if needed
      if (existingCodespaces.length > 0) {
        for (const cs of existingCodespaces) {
          if (cs.name.includes('yt-dlp')) {
            workflowLog.push(`Deleting old codespace: ${cs.name}`);
            await this.deleteCodespace(cs.name);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      // Step 4: Create new codespace
      workflowLog.push('Creating new codespace...');
      const codespaceName = `yt-dlp-${Date.now()}`;
      const codespace = await this.createCodespace({
        name: codespaceName
      });
      workflowLog.push(`✓ Codespace created: ${codespace.name}`);

      // Step 5: Watch codespace until ready
      workflowLog.push('Waiting for codespace to be ready...');
      await this.watchCodespaceStatus(codespace.name, 'Available', {
        interval: 10000,
        timeout: 600000,
        verbose: true
      });
      workflowLog.push('✓ Codespace is ready');

      // Step 6: Wait for script to complete
      workflowLog.push('Waiting for download and upload script to complete...');
      console.log('Note: The download and upload script is running automatically in the codespace');
      console.log('Waiting 5 minutes for the process to complete...');
      await new Promise(resolve => setTimeout(resolve, 300000));

      // Step 7: Check for logs
      workflowLog.push('Checking for logs...');
      try {
        const logFiles = await this.downloadFile('logs/');
        workflowLog.push('Logs found in repository');
      } catch (error) {
        workflowLog.push('No logs found yet');
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      workflowLog.push(`Workflow completed in ${duration} seconds`);
      workflowLog.push(`Codespace URL: ${codespace.web_url}`);

      const logContent = workflowLog.join('\n');
      await this.uploadLog(logContent, 'youtube-drive-workflow');

      console.log('==========================================');
      console.log('   Workflow Completed Successfully!');
      console.log('==========================================');
      console.log('');
      console.log('Summary:');
      console.log('- Video URL:', videoUrl);
      console.log('- Platform:', platform);
      console.log('- Codespace:', codespace.name);
      console.log('- Duration:', duration, 'seconds');
      console.log('- Codespace URL:', codespace.web_url);
      console.log('');
      console.log('Note: The actual video download and upload happened inside the codespace.');
      console.log('Check the codespace for the downloaded file or logs.');

      return {
        success: true,
        codespace: codespace,
        duration: duration,
        logs: workflowLog
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      workflowLog.push(`✗ Workflow failed after ${duration} seconds`);
      workflowLog.push(`Error: ${error.message}`);

      const logContent = workflowLog.join('\n');
      await this.uploadLog(logContent, 'youtube-drive-workflow-error');

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
  console.log('Usage: node youtube-drive-manager.js <command> <github_token> <owner> <repo>');
  console.log('Or set environment variables: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  process.exit(1);
}

const manager = new YouTubeDriveManager(githubToken, owner, repo);

async function main() {
  try {
    switch (command) {
      case 'run':
        const videoUrl = process.argv[6];
        const platform = process.argv[7] || 'youtube';
        const cookies = process.argv[8] || '';
        
        // Optional drive credentials
        const driveToken = process.env.DRIVE_TOKEN || process.argv[9];
        const driveRefreshToken = process.env.DRIVE_REFRESH_TOKEN || process.argv[10];
        const driveClientId = process.env.DRIVE_CLIENT_ID || process.argv[11];
        const driveClientSecret = process.env.DRIVE_CLIENT_SECRET || process.argv[12];

        if (!videoUrl) {
          console.error('Video URL is required for run command');
          console.log('Usage: node youtube-drive-manager.js run <token> <owner> <repo> <video_url> [platform] [cookies] [drive_token] [drive_refresh_token] [drive_client_id] [drive_client_secret]');
          process.exit(1);
        }

        const driveCredentials = {};
        if (driveToken) driveCredentials.DRIVE_TOKEN = driveToken;
        if (driveRefreshToken) driveCredentials.DRIVE_REFRESH_TOKEN = driveRefreshToken;
        if (driveClientId) driveCredentials.DRIVE_CLIENT_ID = driveClientId;
        if (driveClientSecret) driveCredentials.DRIVE_CLIENT_SECRET = driveClientSecret;

        await manager.runYouTubeToDriveWorkflow(videoUrl, platform, cookies, driveCredentials);
        break;

      case 'quick':
        const quickVideoUrl = process.argv[6];
        if (!quickVideoUrl) {
          console.error('Video URL is required for quick command');
          console.log('Usage: node youtube-drive-manager.js quick <token> <owner> <repo> <video_url>');
          process.exit(1);
        }
        await manager.runYouTubeToDriveWorkflow(quickVideoUrl, 'youtube', '', {});
        break;

      default:
        console.log('Available commands: run, quick');
        console.log('Usage examples:');
        console.log('  node youtube-drive-manager.js run <token> <owner> <repo> <video_url> [platform] [cookies] [drive_token] [drive_refresh_token] [drive_client_id] [drive_client_secret]');
        console.log('  node youtube-drive-manager.js quick <token> <owner> <repo> <video_url>');
        console.log('');
        console.log('Environment variables:');
        console.log('  GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO - GitHub API access');
        console.log('  DRIVE_TOKEN, DRIVE_REFRESH_TOKEN, DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET - Google Drive OAuth');
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
