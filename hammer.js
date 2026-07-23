#!/usr/bin/env node

/**
 * 🔨 Hammer - 工业级验证系统
 * 
 * 使用方法:
 *   node hammer.js [options]
 * 
 * 选项:
 *   --mode=<mode>      执行模式: strict|normal|fast (默认: strict)
 *   --suites=<list>    指定套件: L1,L2,L3 (逗号分隔)
 *   --parallel         并行执行
 *   --serial           串行执行
 *   --fail-fast        快速失败
 *   --format=<format>  报告格式: full|json|junit|summary (默认: full)
 *   --output=<dir>     报告输出目录 (默认: ./hammer-reports)
 *   --help             显示帮助
 * 
 * 示例:
 *   node hammer.js                                    # 完整验证
 *   node hammer.js --mode=fast --suites=L1,L2,L3     # 快速检查
 *   node hammer.js --format=json --output=./reports  # JSON输出
 */

const Hammer = require('./server/core/Hammer');
const path = require('path');

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'strict',
    parallel: true,
    failFast: false,
    format: 'full',
    output: './hammer-reports'
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
    
    if (arg === '--parallel') {
      options.parallel = true;
    } else if (arg === '--serial') {
      options.parallel = false;
    } else if (arg === '--fail-fast') {
      options.failFast = true;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    } else if (arg.startsWith('--suites=')) {
      options.suites = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🔨 Hammer - Industrial Grade Validation System v3.0.0

Usage: node hammer.js [options]

Options:
  --mode=<mode>      Execution mode: strict|normal|fast (default: strict)
  --suites=<list>    Specify suites: L1,L2,L3 (comma separated)
  --parallel         Execute in parallel mode
  --serial           Execute in serial mode
  --fail-fast        Stop on first failure
  --format=<format>  Report format: full|json|junit|summary (default: full)
  --output=<dir>     Report output directory (default: ./hammer-reports)
  --help, -h         Show this help message

Examples:
  node hammer.js                                    # Full validation
  node hammer.js --mode=fast                        # Quick check
  node hammer.js --suites=L1,L2,L3                 # Specific suites
  node hammer.js --format=json --output=./reports  # JSON output
  node hammer.js --fail-fast                        # Stop early

Quality Gates:
  G0 (Critical) - Block on security/data loss/crash
  G1 (High)     - Block on core function failure
  G2 (Medium)   - Warn on minor issues
  G3 (Low)      - Pass with suggestions
  G4 (Pass)     - Full pass
`);
}

async function main() {
  const options = parseArgs();
  
  // 创建 Hammer 实例
  const hammer = new Hammer({
    basePath: process.cwd(),
    mode: options.mode,
    parallel: options.parallel,
    failFast: options.failFast,
    reporting: {
      format: options.format,
      outputDir: options.output,
      artifacts: true
    }
  });

  // 如果只指定部分套件，禁用其他
  if (options.suites) {
    const allSuites = hammer.getSuites();
    for (const suite of allSuites) {
      if (!options.suites.includes(suite.id)) {
        hammer.disableSuite(suite.id);
      }
    }
  }

  // 事件监听
  hammer.on('strike:start', () => {
    console.log('\n🔨 Hammer is striking...\n');
  });

  hammer.on('suite:complete', ({ id, name, passed, failed }) => {
    if (failed > 0) {
      console.log(`  ⚠️  ${id}: ${passed} passed, ${failed} failed`);
    }
  });

  // 执行验证
  try {
    const results = await hammer.strike({
      suites: options.suites
    });

    // 根据质量门禁退出
    const exitCode = results.gate.passed ? 0 : 1;
    
    if (results.gate.passed) {
      console.log(`\n✅ Quality Gate: ${results.gate.name} - PASSED\n`);
    } else {
      console.log(`\n❌ Quality Gate: ${results.gate.name} - ${results.gate.action}\n`);
    }

    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n💥 Hammer failed with error:', error.message);
    process.exit(1);
  }
}

main();
