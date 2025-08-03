#!/usr/bin/env ts-node

/**
 * Example script demonstrating how to use the HTML export functionality
 * 
 * Usage:
 * npx ts-node export-example.ts
 * or
 * npm run export-example (if you add it to package.json scripts)
 */

import { exportCodeAsHtml, exportWithCustomTemplate, listExportedFiles } from './src/utils/html-export-utility';

// Example React component
const reactCounterExample = `
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ 
      padding: '40px',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '400px',
      margin: '0 auto',
      backgroundColor: '#f8f9fa',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>🎯 Counter App</h1>
      <div style={{ 
        fontSize: '2rem', 
        fontWeight: 'bold', 
        color: '#007bff',
        margin: '20px 0'
      }}>
        Count: {count}
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button 
          onClick={() => setCount(count + 1)}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          ➕ Increment
        </button>
        <button 
          onClick={() => setCount(count - 1)}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          ➖ Decrement
        </button>
        <button 
          onClick={() => setCount(0)}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔄 Reset
        </button>
      </div>
    </div>
  );
}

export default Counter;
`;

// Example JavaScript code
const jsCalculatorExample = `
class Calculator {
  constructor() {
    this.result = 0;
    this.createUI();
  }

  createUI() {
    const container = document.getElementById('root');
    if (!container) return;

    container.innerHTML = \`
      <div style="
        max-width: 300px;
        margin: 0 auto;
        padding: 20px;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      ">
        <h2 style="text-align: center; color: #333; margin-bottom: 20px;">🧮 Calculator</h2>
        <div style="
          width: 100%;
          padding: 15px;
          font-size: 1.5rem;
          text-align: right;
          background: #f8f9fa;
          border: 2px solid #dee2e6;
          border-radius: 5px;
          margin-bottom: 15px;
        " id="display">0</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
          <button onclick="calc.clear()" style="grid-column: span 2; padding: 15px; font-size: 1rem; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Clear</button>
          <button onclick="calc.operation('/')" style="padding: 15px; font-size: 1rem; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">÷</button>
          <button onclick="calc.operation('*')" style="padding: 15px; font-size: 1rem; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">×</button>
          
          <button onclick="calc.addDigit('7')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">7</button>
          <button onclick="calc.addDigit('8')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">8</button>
          <button onclick="calc.addDigit('9')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">9</button>
          <button onclick="calc.operation('-')" style="padding: 15px; font-size: 1rem; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">-</button>
          
          <button onclick="calc.addDigit('4')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">4</button>
          <button onclick="calc.addDigit('5')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">5</button>
          <button onclick="calc.addDigit('6')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">6</button>
          <button onclick="calc.operation('+')" style="padding: 15px; font-size: 1rem; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">+</button>
          
          <button onclick="calc.addDigit('1')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">1</button>
          <button onclick="calc.addDigit('2')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">2</button>
          <button onclick="calc.addDigit('3')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">3</button>
          <button onclick="calc.equals()" style="grid-row: span 2; padding: 15px; font-size: 1rem; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">=</button>
          
          <button onclick="calc.addDigit('0')" style="grid-column: span 2; padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">0</button>
          <button onclick="calc.addDigit('.')" style="padding: 15px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">.</button>
        </div>
      </div>
    \`;
    
    this.display = document.getElementById('display');
  }

  addDigit(digit) {
    if (this.display.textContent === '0') {
      this.display.textContent = digit;
    } else {
      this.display.textContent += digit;
    }
  }

  operation(op) {
    this.currentOperation = op;
    this.firstOperand = parseFloat(this.display.textContent);
    this.display.textContent = '0';
  }

  equals() {
    const secondOperand = parseFloat(this.display.textContent);
    let result = 0;
    
    switch (this.currentOperation) {
      case '+':
        result = this.firstOperand + secondOperand;
        break;
      case '-':
        result = this.firstOperand - secondOperand;
        break;
      case '*':
        result = this.firstOperand * secondOperand;
        break;
      case '/':
        result = secondOperand !== 0 ? this.firstOperand / secondOperand : 'Error';
        break;
    }
    
    this.display.textContent = result;
  }

  clear() {
    this.display.textContent = '0';
    this.firstOperand = 0;
    this.currentOperation = null;
  }
}

// Initialize calculator
const calc = new Calculator();
`;

async function runExamples() {
  console.log('🚀 Starting HTML Export Examples...\n');

  try {
    // Example 1: Export React Counter Component
    console.log('📱 Example 1: Exporting React Counter Component...');
    const reactResult = await exportCodeAsHtml({
      code: reactCounterExample,
      language: 'react',
      filename: 'react-counter-example',
      includeTimestamp: true,
    });

    if (reactResult.success) {
      console.log('✅ React example exported successfully!');
      console.log(`📁 Location: ${reactResult.filePath}`);
      console.log(`🌐 Open in browser: file://${reactResult.filePath}\n`);
    } else {
      console.error('❌ React example failed:', reactResult.error);
    }

    // Example 2: Export JavaScript Calculator with Custom Template
    console.log('🧮 Example 2: Exporting JavaScript Calculator...');
    const jsResult = await exportWithCustomTemplate({
      code: jsCalculatorExample,
      language: 'javascript',
      filename: 'js-calculator-example',
      includeTimestamp: true,
    });

    if (jsResult.success) {
      console.log('✅ JavaScript example exported successfully!');
      console.log(`📁 Location: ${jsResult.filePath}`);
      console.log(`🌐 Open in browser: file://${jsResult.filePath}\n`);
    } else {
      console.error('❌ JavaScript example failed:', jsResult.error);
    }

    // Example 3: List all exported files
    console.log('📋 Example 3: Listing all exported files...');
    const listResult = await listExportedFiles();
    
    if (listResult.files.length > 0) {
      console.log(`📁 Export directory: ${listResult.exportDir}`);
      console.log('📄 Exported files:');
      listResult.files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file}`);
      });
    }

    console.log('\n🎉 All examples completed! You can now open the exported HTML files in your browser.');
    console.log('\n💡 Tips:');
    console.log('- The files are saved in the html-exports directory');
    console.log('- Double-click anywhere on the page to toggle debug information');
    console.log('- Press "D" key to toggle debug panel');
    console.log('- The files are completely standalone and can be shared or moved anywhere');

  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Run the examples
if (require.main === module) {
  runExamples().catch(console.error);
}

export { runExamples };