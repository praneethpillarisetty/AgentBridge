import { spawn } from 'node:child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const NATIVE_HOST_PATH = 'native-host/host.js';

type NativeRequest = { type: 'get_current_page' | 'get_forms' };

function callNativeHost(payload: NativeRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [NATIVE_HOST_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });

    const stderr: Buffer[] = [];
    child.stderr.on('data', (chunk) => stderr.push(chunk));

    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length, 0);
    child.stdin.write(Buffer.concat([header, body]));
    child.stdin.end();

    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Native host exited with code ${code}: ${Buffer.concat(stderr).toString('utf8')}`));
        return;
      }

      try {
        const output = Buffer.concat(chunks);
        const length = output.readUInt32LE(0);
        const message = JSON.parse(output.subarray(4, 4 + length).toString('utf8'));
        resolve(message);
      } catch (error) {
        reject(error);
      }
    });

    child.on('error', reject);
  });
}

const server = new Server(
  { name: 'agentbridge-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_current_page',
      description: 'Get active page details through native host bridge.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'get_forms',
      description: 'Get visible forms metadata through native host bridge.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'get_current_page' && request.params.name !== 'get_forms') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const data = await callNativeHost({ type: request.params.name });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data),
      },
    ],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
