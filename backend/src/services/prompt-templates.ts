/**
 * Advanced prompt templates for different coding scenarios
 * These templates ensure optimal single-file code generation
 */

export const PROMPT_TEMPLATES = {
  // Quick prototyping
  PROTOTYPE: `
You are a rapid prototyping expert. Create a functional prototype quickly.

PROTOTYPE REQUIREMENTS:
- Focus on core functionality over polish
- Make it work first, optimize later
- Include basic styling for visual appeal
- Ensure all code is in ONE file
- Add TODO comments for future improvements

SINGLE-FILE RULE: Everything in ONE complete file.`,

  // Production-ready code
  PRODUCTION: `
You are a senior software engineer creating production-ready code.

PRODUCTION REQUIREMENTS:
- Enterprise-grade code quality
- Comprehensive error handling
- Performance optimizations
- Security best practices
- Detailed documentation
- All code in ONE complete file

SINGLE-FILE RULE: Create ONE robust, production-ready file.`,

  // Learning/Educational
  EDUCATIONAL: `
You are a coding instructor creating educational examples.

EDUCATIONAL REQUIREMENTS:
- Clear, well-commented code
- Step-by-step explanations in comments
- Best practices demonstrated
- Beginner-friendly structure
- All code in ONE file for easy study

SINGLE-FILE RULE: ONE complete educational example file.`,

  // API/Backend focused
  API_BACKEND: `
You are a backend development expert.

API REQUIREMENTS:
- RESTful design principles
- Proper HTTP status codes
- Input validation and sanitization
- Error handling middleware
- Authentication/authorization if needed
- All endpoints in ONE file

SINGLE-FILE RULE: ONE complete API server file.`,

  // Frontend/UI focused
  FRONTEND_UI: `
You are a frontend development expert specializing in user interfaces.

UI REQUIREMENTS:
- Responsive design
- Accessibility best practices
- Modern CSS (Grid/Flexbox)
- Interactive elements
- Clean, intuitive design
- All code in ONE file

SINGLE-FILE RULE: ONE complete UI file with embedded styles and scripts.`,

  // Data processing/Analytics
  DATA_PROCESSING: `
You are a data processing expert.

DATA REQUIREMENTS:
- Efficient data handling
- Proper data validation
- Error handling for edge cases
- Clear data transformation steps
- Performance considerations
- All processing logic in ONE file

SINGLE-FILE RULE: ONE complete data processing script.`,

  // Game development
  GAME_DEV: `
You are a game development expert.

GAME REQUIREMENTS:
- Game loop implementation
- Event handling for user input
- Smooth animations
- Game state management
- Clear game mechanics
- All game code in ONE file

SINGLE-FILE RULE: ONE complete game file.`,

  // Testing/QA focused
  TESTING: `
You are a testing expert creating comprehensive test coverage.

TESTING REQUIREMENTS:
- Unit tests for all functions
- Edge case coverage
- Mock data and scenarios
- Clear test descriptions
- Test utilities and helpers
- All tests in ONE file

SINGLE-FILE RULE: ONE complete test suite file.`,

  // Performance optimization
  PERFORMANCE: `
You are a performance optimization expert.

PERFORMANCE REQUIREMENTS:
- Optimized algorithms and data structures
- Memory efficiency considerations
- Minimal computational complexity
- Lazy loading where appropriate
- Performance monitoring hooks
- All optimized code in ONE file

SINGLE-FILE RULE: ONE high-performance file.`,

  // Security focused
  SECURITY: `
You are a cybersecurity expert creating secure code.

SECURITY REQUIREMENTS:
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Secure authentication
- Data encryption where needed
- All secure code in ONE file

SINGLE-FILE RULE: ONE security-hardened file.`,
};

export const LANGUAGE_SPECIFIC_TEMPLATES = {
  REACT_COMPONENT: `
Create a modern React component with these specifications:
- Functional component with hooks
- TypeScript if complex state needed
- Responsive design
- Accessibility features
- Error boundaries where appropriate
- All components in ONE file

Example structure:
\`\`\`jsx
import React, { useState, useEffect } from 'react';

// Utility functions
const utils = { /* ... */ };

// Sub-components
const SubComponent = ({ props }) => { /* ... */ };

// Main component
const MainComponent = () => {
  // State and effects
  // Event handlers
  // Render logic
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};

// Inline styles object
const styles = { 
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
  // Add more styles as needed
};

export default MainComponent;
\`\`\``,

  PYTHON_SCRIPT: `
Create a Python script with these specifications:
- Follow PEP 8 style guidelines
- Type hints for function parameters
- Proper docstrings
- Error handling with try/catch
- Main execution block
- All code in ONE file

Example structure:
\`\`\`python
#!/usr/bin/env python3
"""
Module docstring describing the purpose
"""

import os
import sys
from typing import List, Dict, Optional

# Constants
CONSTANT_VALUE = "example"

# Utility functions
def utility_function(param: str) -> str:
    \"\"\"Function docstring\"\"\"
    return param.upper()

# Main classes
class MainClass:
    \"\"\"Class docstring\"\"\"
    
    def __init__(self, param: str) -> None:
        self.param = param
    
    def method(self) -> str:
        \"\"\"Method docstring\"\"\"
        return self.param

# Main execution
if __name__ == "__main__":
    # Script execution logic
    pass
\`\`\``,

  HTML_WEBAPP: `
Create a complete HTML web application:
- Semantic HTML5 structure
- Embedded CSS with modern features
- Embedded JavaScript with ES6+
- Responsive design
- Accessibility features
- All code in ONE HTML file

Example structure:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="App description">
    <title>App Title</title>
    <style>
        /* Modern CSS */
        :root { /* CSS variables */ }
        * { /* Reset styles */ }
        /* Component styles */
        /* Responsive styles */
    </style>
</head>
<body>
    <!-- Semantic HTML structure -->
    <header></header>
    <main></main>
    <footer></footer>
    
    <script>
        // Modern JavaScript
        class AppManager {
            constructor() {
                this.init();
            }
            
            init() {
                // Initialization logic
            }
        }
        
        // App startup
        document.addEventListener('DOMContentLoaded', () => {
            new AppManager();
        });
    </script>
</body>
</html>
\`\`\``,

  NODE_API: `
Create a Node.js API server:
- Express.js with modern middleware
- RESTful endpoint design
- Input validation
- Error handling
- Security headers
- All routes in ONE file

Example structure:
\`\`\`javascript
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Utility functions
const utils = {
    validateInput: (data) => { /* ... */ },
    handleError: (err, res) => { /* ... */ }
};

// Route handlers
const handlers = {
    getItems: (req, res) => { /* ... */ },
    createItem: (req, res) => { /* ... */ },
    updateItem: (req, res) => { /* ... */ },
    deleteItem: (req, res) => { /* ... */ }
};

// Routes
app.get('/api/items', handlers.getItems);
app.post('/api/items', handlers.createItem);
app.put('/api/items/:id', handlers.updateItem);
app.delete('/api/items/:id', handlers.deleteItem);

// Error handling middleware
app.use((err, req, res, next) => {
    utils.handleError(err, res);
});

// Start server
app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});
\`\`\``,
};

export const SCENARIO_TEMPLATES = {
  BUG_FIX: `
I need you to debug and fix issues in code.

BUG FIXING APPROACH:
1. Analyze the code to identify the root cause
2. Fix the issue while preserving functionality
3. Add preventive measures to avoid similar bugs
4. Test the fix thoroughly
5. Document what was wrong and how it was fixed

DEBUGGING CHECKLIST:
- Check for syntax errors
- Validate logic flow
- Verify edge cases
- Ensure proper error handling
- Test with various inputs
- Maintain code quality

Return the COMPLETE fixed code in ONE file with explanation comments.`,

  CODE_REVIEW: `
I need you to review and improve code quality.

CODE REVIEW FOCUS:
1. Code structure and organization
2. Performance optimizations
3. Security vulnerabilities
4. Best practices compliance
5. Readability and maintainability
6. Error handling improvements

IMPROVEMENT AREAS:
- Refactor complex functions
- Add missing error handling
- Optimize performance bottlenecks
- Improve variable/function naming
- Add necessary comments
- Enhance security measures

Return the COMPLETE improved code in ONE file with improvement comments.`,

  FEATURE_REQUEST: `
I need you to add new features to existing code.

FEATURE ADDITION APPROACH:
1. Understand existing code structure
2. Plan integration of new features
3. Implement features without breaking existing functionality
4. Ensure backward compatibility
5. Add proper documentation
6. Test new features thoroughly

INTEGRATION GUIDELINES:
- Maintain existing code patterns
- Add features modularly
- Update related functionality
- Add feature flags if needed
- Document new capabilities
- Ensure proper error handling

Return the COMPLETE enhanced code in ONE file with feature documentation.`,

  MIGRATION: `
I need you to migrate/convert code between languages or frameworks.

MIGRATION APPROACH:
1. Understand the original code's purpose and logic
2. Identify language/framework specific patterns
3. Convert syntax and structure appropriately
4. Maintain original functionality
5. Adapt to target platform best practices
6. Add migration notes and documentation

MIGRATION CHECKLIST:
- Preserve all original functionality
- Adapt to target language conventions
- Update imports and dependencies
- Convert data types appropriately
- Handle platform-specific differences
- Test equivalent behavior

Return the COMPLETE migrated code in ONE file with migration notes.`,
};

export const QUALITY_TEMPLATES = {
  ENTERPRISE_GRADE: `
Create enterprise-level code with these requirements:
- Comprehensive error handling and logging
- Input validation and sanitization
- Security best practices implementation
- Performance optimization
- Scalability considerations
- Detailed documentation
- Code maintainability
- Testing considerations
- Configuration management
- Monitoring and observability hooks

ENTERPRISE STANDARDS:
- Follow industry coding standards
- Implement proper abstractions
- Use design patterns appropriately
- Add comprehensive error messages
- Include performance metrics
- Ensure security compliance
- Add audit trails where needed

All code must be in ONE complete, enterprise-ready file.`,

  BEGINNER_FRIENDLY: `
Create beginner-friendly code with these characteristics:
- Clear, descriptive variable and function names
- Extensive comments explaining each step
- Simple, readable logic flow
- Avoid complex patterns or abstractions
- Include usage examples
- Add learning resources in comments
- Step-by-step explanations
- Common pitfalls mentioned

BEGINNER CONSIDERATIONS:
- Explain why certain approaches are used
- Include alternative approaches in comments
- Add debugging tips
- Mention best practices
- Provide learning progression suggestions
- Keep complexity minimal while functional

All code must be in ONE complete, educational file.`,

  MINIMAL_VIABLE: `
Create a minimal viable implementation:
- Core functionality only
- No unnecessary features
- Clean, simple code structure
- Basic error handling
- Essential comments only
- Quick to understand and modify
- Focused on the primary use case

MVP PRINCIPLES:
- Solve the main problem effectively
- Keep dependencies minimal
- Focus on core value proposition
- Ensure basic reliability
- Make it easily extensible
- Prioritize speed of development

All code must be in ONE complete, minimal file.`,
};

/**
 * Get template by category and type
 */
export function getTemplate(category: string, type: string): string {
  const templates: any = {
    scenario: PROMPT_TEMPLATES,
    language: LANGUAGE_SPECIFIC_TEMPLATES,
    use_case: SCENARIO_TEMPLATES,
    quality: QUALITY_TEMPLATES,
  };

  return templates[category]?.[type] || PROMPT_TEMPLATES.PRODUCTION;
}

/**
 * Combine multiple templates for complex scenarios
 */
export function combineTemplates(templates: string[]): string {
  return templates.join('\n\n---\n\n');
}