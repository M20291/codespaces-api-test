import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'M20291';
const REPO_NAME = 'codespaces-api-test';
const CODESPACE_NAME = 'supreme-acorn-wvgpgj5jrr792vqg6';

class SmartWorkflowManager {
  constructor() {
    this.githubHeaders = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async executeCommandInCodespace(command) {
    try {
      console.log(`[Smart Manager] Executing command in codespace: ${command}`);
      
      // Use GitHub CLI to execute command in codespace
      const { stdout, stderr } = await execAsync(
        `gh codespace ssh -c ${CODESPACE_NAME} -- "${command}"`
      );
      
      return {
        success: true,
        stdout,
        stderr
      };
    } catch (error) {
      console.error('[Smart Manager] Error executing command:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateEnvironmentVariables(variables) {
    try {
      console.log('[Smart Manager] Updating environment variables:', variables);
      
      const envUpdates = Object.entries(variables)
        .map(([key, value]) => `export ${key}="${value}"`)
        .join('\n');
      
      const command = `echo "${envUpdates}" >> ~/.bashrc && source ~/.bashrc`;
      
      const result = await this.executeCommandInCodespace(command);
      
      return result;
    } catch (error) {
      console.error('[Smart Manager] Error updating environment:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async runYouTubeDownload(videoUrl, googleDriveFolderId) {
    try {
      console.log('[Smart Manager] Starting YouTube download workflow');
      
      // Update environment variables
      await this.updateEnvironmentVariables({
        YOUTUBE_URL: videoUrl,
        GOOGLE_DRIVE_FOLDER_ID: googleDriveFolderId
      });
      
      // Execute the download script
      const command = 'bash /workspaces/codespaces-api-test/download_and_upload.sh';
      const result = await this.executeCommandInCodespace(command);
      
      return result;
    } catch (error) {
      console.error('[Smart Manager] Error in workflow:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export for use as module
export default SmartWorkflowManager;

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new SmartWorkflowManager();
  
  const videoUrl = process.argv[2];
  const googleDriveFolderId = process.argv[3];
  
  if (!videoUrl) {
    console.error('Usage: node smart-workflow-manager.js <youtube_url> <google_drive_folder_id>');
    process.exit(1);
  }
  
  manager.runYouTubeDownload(videoUrl, googleDriveFolderId || '')
    .then(result => {
      console.log('Workflow result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Workflow error:', error);
      process.exit(1);
    });
}
