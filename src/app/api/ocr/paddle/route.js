import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function runProcess(command, args, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let done = false;

    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        child.kill('SIGKILL');
        resolve({
          ok: false,
          code: -1,
          stdout,
          stderr: `${stderr}\nProcess timed out`,
        });
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (!done) {
        done = true;
        clearTimeout(timeout);
        resolve({ ok: false, code: -1, stdout, stderr: `${stderr}\n${error.message}` });
      }
    });

    child.on('close', (code) => {
      if (!done) {
        done = true;
        clearTimeout(timeout);
        resolve({ ok: code === 0, code, stdout, stderr });
      }
    });
  });
}

function buildPythonCandidates() {
  if (process.env.PADDLE_OCR_PYTHON) {
    return [{ command: process.env.PADDLE_OCR_PYTHON, prefixArgs: [] }];
  }

  if (process.platform === 'win32') {
    return [
      { command: 'python', prefixArgs: [] },
      { command: 'py', prefixArgs: ['-3'] },
    ];
  }

  return [
    { command: 'python3', prefixArgs: [] },
    { command: 'python', prefixArgs: [] },
  ];
}

function parseBoolean(value) {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export async function POST(request) {
  const tempFilePath = path.join(os.tmpdir(), `receipt-${randomUUID()}.png`);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const modelLang = String(formData.get('modelLang') || process.env.PADDLE_OCR_MODEL_LANG || 'latin');
    const enableDebug = parseBoolean(String(formData.get('debug') || process.env.PADDLE_OCR_DEBUG || 'false'));
    const minTokenScore = String(formData.get('minTokenScore') || process.env.PADDLE_OCR_MIN_TOKEN_SCORE || '0.35');
    const lexiconPath = String(formData.get('productLexiconPath') || process.env.PADDLE_OCR_LEXICON || '');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ success: false, error: 'Missing image file in form-data key "file"' }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'paddle_receipt_ocr.py');
    const scriptExists = await fs
      .access(scriptPath)
      .then(() => true)
      .catch(() => false);

    if (!scriptExists) {
      return NextResponse.json(
        { success: false, error: 'PaddleOCR script not found at scripts/paddle_receipt_ocr.py' },
        { status: 500 }
      );
    }

    const fileBytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, fileBytes);

    const pythonCandidates = buildPythonCandidates();
    let lastFailure = null;
    const debugDir = enableDebug ? path.join(process.cwd(), '.ocr-debug', `run-${randomUUID()}`) : null;

    for (const candidate of pythonCandidates) {
      const args = [...candidate.prefixArgs, scriptPath, tempFilePath, '--lang', modelLang, '--min-token-score', minTokenScore];
      if (debugDir) {
        args.push('--debug-dir', debugDir);
      }
      if (lexiconPath) {
        args.push('--product-lexicon', lexiconPath);
      }

      const result = await runProcess(candidate.command, args);

      if (!result.ok) {
        lastFailure = result;
        continue;
      }

      try {
        const parsed = JSON.parse(result.stdout);
        return NextResponse.json(parsed);
      } catch (error) {
        lastFailure = {
          ok: false,
          code: -1,
          stdout: result.stdout,
          stderr: `${result.stderr}\nInvalid JSON output: ${error.message}`,
        };
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute PaddleOCR script. Ensure Python and dependencies are installed.',
        details: lastFailure?.stderr || 'Unknown execution error',
      },
      { status: 500 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unexpected server error while processing OCR request',
      },
      { status: 500 }
    );
  } finally {
    await fs.unlink(tempFilePath).catch(() => {});
  }
}
