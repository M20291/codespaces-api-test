import axios from 'axios';
import _sodium from 'libsodium-wrappers';

class CodespaceManager {
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

  async createCodespace(options = {}) {
    try {
      console.log('Creating codespace...');
      const response = await axios.post(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/codespaces`,
        {
          name: options.name || 'test-codespace',
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

  async createAndWatch(options = {}, targetState = 'Available', watchOptions = {}) {
    const codespace = await this.createCodespace(options);
    console.log(`Watching codespace until it reaches state: ${targetState}`);
    const finalState = await this.watchCodespaceStatus(codespace.name, targetState, watchOptions);
    return finalState;
  }

  async startCodespace(codespaceName) {
    try {
      console.log(`Starting codespace: ${codespaceName}...`);
      const response = await axios.post(
        `${this.apiBase}/user/codespaces/${codespaceName}/start`,
        {},
        { headers: this.headers }
      );
      console.log('✓ Codespace started');
      return response.data;
    } catch (error) {
      console.error('✗ Error starting codespace:', error.response?.data || error.message);
      throw error;
    }
  }

  async stopCodespace(codespaceName) {
    try {
      console.log(`Stopping codespace: ${codespaceName}...`);
      const response = await axios.post(
        `${this.apiBase}/user/codespaces/${codespaceName}/stop`,
        {},
        { headers: this.headers }
      );
      console.log('✓ Codespace stopped');
      return response.data;
    } catch (error) {
      console.error('✗ Error stopping codespace:', error.response?.data || error.message);
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

  async recreateCodespace(codespaceName, options = {}) {
    try {
      console.log(`Recreating codespace: ${codespaceName}...`);
      
      // First delete the existing codespace
      await this.deleteCodespace(codespaceName);
      
      // Wait a moment for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a new codespace with the same configuration
      const newCodespace = await this.createCodespace(options);
      
      console.log('✓ Codespace recreated successfully');
      return newCodespace;
    } catch (error) {
      console.error('✗ Error recreating codespace:', error.response?.data || error.message);
      throw error;
    }
  }

  async recreateAndWatch(options = {}, targetState = 'Available', watchOptions = {}) {
    console.log('Recreating codespace with environment variables...');
    const codespace = await this.recreateCodespace(options.name, options);
    console.log(`Watching new codespace until it reaches state: ${targetState}`);
    const finalState = await this.watchCodespaceStatus(codespace.name, targetState, watchOptions);
    return finalState;
  }

  // Secrets management functions
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

    // Convert base64 public key to Uint8Array
    const keyBytes = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);

    // Encrypt the value
    const encryptedBytes = sodium.crypto_box_seal(
      sodium.from_string(value),
      keyBytes
    );

    // Convert to base64
    return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
  }

  async setRepositorySecret(secretName, secretValue) {
    try {
      console.log(`Setting repository secret: ${secretName}...`);
      
      // Get public key for encryption
      const publicKey = await this.getPublicKey();
      
      // Encrypt the secret value
      const encryptedValue = await this.encryptSecret(secretValue, publicKey);
      
      // Set the secret
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

  async listRepositorySecrets() {
    try {
      console.log('Listing repository secrets...');
      const response = await axios.get(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/codespaces/secrets`,
        { headers: this.headers }
      );
      console.log(`✓ Found ${response.data.secrets?.length || 0} secrets`);
      return response.data;
    } catch (error) {
      console.error('✗ Error listing secrets:', error.response?.data || error.message);
      throw error;
    }
  }

  async deleteRepositorySecret(secretName) {
    try {
      console.log(`Deleting repository secret: ${secretName}...`);
      const response = await axios.delete(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/codespaces/secrets/${secretName}`,
        { headers: this.headers }
      );
      console.log(`✓ Secret deleted: ${secretName}`);
      return response.data;
    } catch (error) {
      console.error(`✗ Error deleting secret ${secretName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async setEnvironmentVariables(variables) {
    try {
      console.log('Setting environment variables as secrets...');
      
      for (const [name, value] of Object.entries(variables)) {
        await this.setRepositorySecret(name, value);
      }
      
      console.log('✓ All environment variables set as secrets');
      return true;
    } catch (error) {
      console.error('✗ Error setting environment variables:', error.message);
      throw error;
    }
  }

  // File management functions for logs
  async uploadFile(filePath, content, message = 'Upload file') {
    try {
      console.log(`Uploading file: ${filePath}...`);
      
      // Get the current file to see if it exists
      let fileSha = null;
      try {
        const existingFile = await axios.get(
          `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`,
          { headers: this.headers }
        );
        fileSha = existingFile.data.sha;
      } catch (error) {
        // File doesn't exist, that's okay
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      // Encode content to base64
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

  async uploadLog(logContent, logName = 'codespace-log') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${logName}-${timestamp}.txt`;
    const filePath = `logs/${fileName}`;
    
    return await this.uploadFile(filePath, logContent, `Upload log: ${fileName}`);
  }

  async listFiles(path = '') {
    try {
      console.log(`Listing files in: ${path || 'root'}...`);
      
      const response = await axios.get(
        `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`,
        { headers: this.headers }
      );

      console.log(`✓ Found ${response.data.length} files/directories`);
      return response.data;
    } catch (error) {
      console.error('✗ Error listing files:', error.response?.data || error.message);
      throw error;
    }
  }

  async listCodespaces() {
    try {
      console.log('Listing codespaces...');
      const response = await axios.get(
        `${this.apiBase}/user/codespaces`,
        { headers: this.headers }
      );
      console.log(`✓ Found ${response.data.length} codespaces`);
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
      console.log(`Status: ${response.data.state}`);
      return response.data;
    } catch (error) {
      console.error('✗ Error getting codespace status:', error.response?.data || error.message);
      throw error;
    }
  }

  async watchCodespaceStatus(codespaceName, targetState = 'Available', options = {}) {
    const {
      interval = 5000,          // Check every 5 seconds
      timeout = 300000,         // Timeout after 5 minutes
      verbose = true
    } = options;

    const startTime = Date.now();
    let currentStatus = null;

    if (verbose) {
      console.log(`Watching codespace status: ${codespaceName}`);
      console.log(`Target state: ${targetState}`);
      console.log(`Check interval: ${interval}ms`);
      console.log(`Timeout: ${timeout}ms`);
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

        // Check for failed states
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
}

// CLI interface
const command = process.argv[2];
const githubToken = process.env.GITHUB_TOKEN || process.argv[3];
const owner = process.env.GITHUB_OWNER || process.argv[4];
const repo = process.env.GITHUB_REPO || process.argv[5];

if (!githubToken) {
  console.error('GITHUB_TOKEN is required');
  console.log('Usage: node codespace-manager.js <command> <github_token> <owner> <repo>');
  console.log('Or set environment variables: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  process.exit(1);
}

const manager = new CodespaceManager(githubToken, owner, repo);

async function main() {
  try {
    switch (command) {
      case 'create':
        await manager.createCodespace();
        break;
      case 'create-and-watch':
        const targetState = process.argv[6] || 'Available';
        await manager.createAndWatch({}, targetState);
        break;
      case 'start':
        const startName = process.argv[6];
        if (!startName) {
          console.error('Codespace name required for start command');
          process.exit(1);
        }
        await manager.startCodespace(startName);
        break;
      case 'stop':
        const stopName = process.argv[6];
        if (!stopName) {
          console.error('Codespace name required for stop command');
          process.exit(1);
        }
        await manager.stopCodespace(stopName);
        break;
      case 'delete':
        const deleteName = process.argv[6];
        if (!deleteName) {
          console.error('Codespace name required for delete command');
          process.exit(1);
        }
        await manager.deleteCodespace(deleteName);
        break;
      case 'list':
        const codespaces = await manager.listCodespaces();
        console.log('\nCodespaces:');
        codespaces.forEach(cs => {
          console.log(`- ${cs.name} (${cs.state})`);
        });
        break;
      case 'status':
        const statusName = process.argv[6];
        if (!statusName) {
          console.error('Codespace name required for status command');
          process.exit(1);
        }
        await manager.getCodespaceStatus(statusName);
        break;
      case 'watch':
        const watchName = process.argv[6];
        const watchTargetState = process.argv[7] || 'Available';
        if (!watchName) {
          console.error('Codespace name required for watch command');
          process.exit(1);
        }
        await manager.watchCodespaceStatus(watchName, watchTargetState);
        break;
      case 'recreate':
        const recreateName = process.argv[6];
        if (!recreateName) {
          console.error('Codespace name required for recreate command');
          process.exit(1);
        }
        await manager.recreateCodespace(recreateName);
        break;
      case 'recreate-and-watch':
        const recreateWatchName = process.argv[6];
        const recreateTargetState = process.argv[7] || 'Available';
        if (!recreateWatchName) {
          console.error('Codespace name required for recreate-and-watch command');
          process.exit(1);
        }
        await manager.recreateAndWatch({ name: recreateWatchName }, recreateTargetState);
        break;
      case 'set-secret':
        const secretName = process.argv[6];
        const secretValue = process.argv[7];
        if (!secretName || !secretValue) {
          console.error('Secret name and value required for set-secret command');
          process.exit(1);
        }
        await manager.setRepositorySecret(secretName, secretValue);
        break;
      case 'list-secrets':
        await manager.listRepositorySecrets();
        break;
      case 'delete-secret':
        const deleteSecretName = process.argv[6];
        if (!deleteSecretName) {
          console.error('Secret name required for delete-secret command');
          process.exit(1);
        }
        await manager.deleteRepositorySecret(deleteSecretName);
        break;
      case 'set-env':
        const envVarName = process.argv[6];
        const envVarValue = process.argv[7];
        if (!envVarName || !envVarValue) {
          console.error('Variable name and value required for set-env command');
          process.exit(1);
        }
        await manager.setEnvironmentVariables({ [envVarName]: envVarValue });
        break;
      case 'upload-file':
        const uploadFilePath = process.argv[6];
        const uploadFileContent = process.argv[7];
        if (!uploadFilePath || !uploadFileContent) {
          console.error('File path and content required for upload-file command');
          process.exit(1);
        }
        await manager.uploadFile(uploadFilePath, uploadFileContent);
        break;
      case 'download-file':
        const downloadFilePath = process.argv[6];
        if (!downloadFilePath) {
          console.error('File path required for download-file command');
          process.exit(1);
        }
        const content = await manager.downloadFile(downloadFilePath);
        console.log('File content:');
        console.log(content);
        break;
      case 'upload-log':
        const logContent = process.argv[6];
        const logName = process.argv[7] || 'codespace-log';
        if (!logContent) {
          console.error('Log content required for upload-log command');
          process.exit(1);
        }
        await manager.uploadLog(logContent, logName);
        break;
      case 'list-files':
        const listPath = process.argv[6] || '';
        const files = await manager.listFiles(listPath);
        console.log('Files:');
        files.forEach(file => {
          console.log(`- ${file.name} (${file.type})`);
        });
        break;
      default:
        console.log('Available commands: create, create-and-watch, start, stop, delete, list, status, watch, recreate, recreate-and-watch, set-secret, list-secrets, delete-secret, set-env, upload-file, download-file, upload-log, list-files');
        console.log('Usage examples:');
        console.log('  node codespace-manager.js create <token> <owner> <repo>');
        console.log('  node codespace-manager.js create-and-watch <token> <owner> <repo> [target_state]');
        console.log('  node codespace-manager.js watch <token> <owner> <repo> <codespace_name> [target_state]');
        console.log('  node codespace-manager.js recreate <token> <owner> <repo> <codespace_name>');
        console.log('  node codespace-manager.js recreate-and-watch <token> <owner> <repo> <codespace_name> [target_state]');
        console.log('  node codespace-manager.js set-secret <token> <owner> <repo> <secret_name> <secret_value>');
        console.log('  node codespace-manager.js list-secrets <token> <owner> <repo>');
        console.log('  node codespace-manager.js delete-secret <token> <owner> <repo> <secret_name>');
        console.log('  node codespace-manager.js set-env <token> <owner> <repo> <var_name> <var_value>');
        console.log('  node codespace-manager.js upload-file <token> <owner> <repo> <file_path> <content>');
        console.log('  node codespace-manager.js download-file <token> <owner> <repo> <file_path>');
        console.log('  node codespace-manager.js upload-log <token> <owner> <repo> <log_content> [log_name]');
        console.log('  node codespace-manager.js list <token> <owner> <repo>');
        console.log('  node codespace-manager.js status <token> <owner> <repo> <codespace_name>');
    }
  } catch (error) {
    process.exit(1);
  }
}

main();
