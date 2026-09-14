import axios from 'axios';

class HTTPCommandClient {
  constructor(githubToken, owner, repo, codespaceName) {
    this.githubToken = githubToken;
    this.owner = owner;
    this.repo = repo;
    this.codespaceName = codespaceName;
    this.apiBase = 'https://api.github.com';
    this.serverPort = 3000;
  }

  get headers() {
    return {
      'Authorization': `Bearer ${this.githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async getCodespaceDetails() {
    try {
      const response = await axios.get(
        `${this.apiBase}/user/codespaces/${this.codespaceName}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting codespace details:', error.response?.data || error.message);
      throw error;
    }
  }

  async getCodespaceURL() {
    const codespace = await this.getCodespaceDetails();
    // The codespace URL format is: https://CODESPACENAME-PORT.app.github.dev
    return `https://${this.codespaceName}-${this.serverPort}.app.github.dev`;
  }

  async executeCommand(command) {
    try {
      const url = await this.getCodespaceURL();
      console.log(`Executing command via HTTP: ${command}`);
      console.log(`URL: ${url}/execute`);
      
      const response = await axios.post(
        `${url}/execute`,
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
      console.error('Error executing command:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateEnvironmentVariables(variables) {
    try {
      const url = await this.getCodespaceURL();
      console.log('Updating environment variables via HTTP:', variables);
      console.log(`URL: ${url}/update-env`);
      
      const response = await axios.post(
        `${url}/update-env`,
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
      console.error('Error updating environment variables:', error.response?.data || error.message);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const url = await this.getCodespaceURL();
      console.log(`Health check: ${url}/health`);
      
      const response = await axios.get(
        `${url}/health`,
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
}

// CLI interface
const command = process.argv[2];
const githubToken = process.env.GITHUB_TOKEN || process.argv[3];
const owner = process.env.GITHUB_OWNER || process.argv[4];
const repo = process.env.GITHUB_REPO || process.argv[5];
const codespaceName = process.argv[6];

if (!githubToken || !codespaceName) {
  console.error('GITHUB_TOKEN and codespace name are required');
  console.log('Usage: node http-command-client.js <command> <github_token> <owner> <repo> <codespace_name> [args...]');
  console.log('Commands: exec, update-env, health');
  process.exit(1);
}

const client = new HTTPCommandClient(githubToken, owner, repo, codespaceName);

async function main() {
  try {
    switch (command) {
      case 'exec':
        const cmd = process.argv[7];
        if (!cmd) {
          console.error('Command is required for exec');
          process.exit(1);
        }
        const result = await client.executeCommand(cmd);
        console.log('Result:', result);
        break;
      
      case 'update-env':
        const varName = process.argv[7];
        const varValue = process.argv[8];
        if (!varName || !varValue) {
          console.error('Variable name and value are required for update-env');
          process.exit(1);
        }
        const envResult = await client.updateEnvironmentVariables({ [varName]: varValue });
        console.log('Result:', envResult);
        break;
      
      case 'health':
        const health = await client.healthCheck();
        console.log('Health:', health);
        break;
      
      default:
        console.log('Available commands: exec, update-env, health');
        console.log('Usage examples:');
        console.log('  node http-command-client.js exec <token> <owner> <repo> <codespace_name> "ls -la"');
        console.log('  node http-command-client.js update-env <token> <owner> <repo> <codespace_name> VIDEO_URL "https://youtube.com/watch?v=123"');
        console.log('  node http-command-client.js health <token> <owner> <repo> <codespace_name>');
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
